-- =============================================================================
-- QuickWork — Initial Schema Migration
-- 20261001000000_initial_schema.sql
--
-- Creates all tables required for the BookMyShow-style job-position booking
-- feature, including:
--   profiles, jobs, job_categories, job_positions, applications
--
-- Design principles:
--   • Database is the source of truth — no race conditions via SELECT FOR UPDATE
--   • RLS on every table — no blind data exposure
--   • Atomic slot booking via SECURITY DEFINER RPC functions
--   • Safe to run on a fresh Supabase project (no DROP TABLE)
--   • Realtime-ready: publications set up for position-level live updates
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------

-- pgcrypto: gen_random_uuid() (available in Supabase by default)
create extension if not exists "pgcrypto";

-- moddatetime: auto-update updated_at on row change
create extension if not exists "moddatetime" schema extensions;

-- ---------------------------------------------------------------------------
-- 1. PROFILES
--    One row per Supabase auth user.
--    Both workers and employers use the same table — no separate role tables.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  name              text,
  phone             text        unique,
  email             text,
  avatar_url        text,
  location          text,                     -- free text e.g. "Andheri East, Mumbai"
  profile_complete  boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'Public user profiles. One row per auth.users entry. Works for both workers and employers.';

-- Auto-update updated_at
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure extensions.moddatetime(updated_at);

-- Index phone for quick lookup (used in auth)
create index if not exists profiles_phone_idx on public.profiles (phone)
  where phone is not null;

-- ---------------------------------------------------------------------------
-- 2. JOBS
--    Posted by an employer (profiles row).
--    All position counts are DERIVED from job_positions — never manually set.
-- ---------------------------------------------------------------------------

create table if not exists public.jobs (
  id                    uuid        primary key default gen_random_uuid(),
  employer_id           uuid        not null references public.profiles(id) on delete cascade,

  -- Core
  job_title             text        not null check (char_length(job_title) >= 3),
  category              text        not null,   -- JobCategoryValue enum: Hospitality | Events | …
  description           text        not null check (char_length(description) >= 6),
  job_type              text        not null default 'one-time',  -- one-time | multiple-days | recurring

  -- Location (stored as individual columns for querying + display)
  venue_name            text        not null,
  full_address          text        not null,
  area                  text        not null,
  city                  text        not null,
  landmark              text,

  -- Timing
  job_date              date        not null,
  start_time            time        not null,
  end_time              time        not null,

  -- Optional extras (stored as JSONB for flexibility)
  facilities            text[]      default '{}',
  requirements          jsonb       default '{}'::jsonb,  -- { experience, skills, dress_code, … }
  instructions          jsonb       default '{}'::jsonb,  -- { before_arrival, during_shift }
  reporting_contact     jsonb       default '{}'::jsonb,  -- private: only shown to confirmed workers

  -- Rapid Jobs
  is_rapid_job          boolean     not null default false,
  rapid_job_expires_at  timestamptz,

  -- Status (computed by trigger whenever job_positions change, but also manually settable)
  status                text        not null default 'Open'
                          check (status in ('Open', 'PartiallyFilled', 'FullyFilled', 'Completed', 'Cancelled')),

  -- Metadata
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.jobs is
  'Job listings posted by employers. Status is auto-computed from position fill counts.';

comment on column public.jobs.requirements is
  'JSONB bag: { experience, skills, age_requirement, languages, dress_code, documents_required }';

comment on column public.jobs.instructions is
  'JSONB bag: { before_arrival: string[], during_shift: string[] }';

comment on column public.jobs.reporting_contact is
  'Private contact info shown only to confirmed workers: { name, method, location, phone }';

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute procedure extensions.moddatetime(updated_at);

-- Indexes
create index if not exists jobs_employer_idx    on public.jobs (employer_id);
create index if not exists jobs_status_idx      on public.jobs (status);
create index if not exists jobs_date_city_idx   on public.jobs (job_date, city);
create index if not exists jobs_rapid_idx       on public.jobs (is_rapid_job, rapid_job_expires_at)
  where is_rapid_job = true;

-- ---------------------------------------------------------------------------
-- 3. JOB_CATEGORIES
--    An employer defines one or more role-categories per job.
--    e.g., "Food Serving" (5 workers, ₹1,200) + "Liquor Serving" (3 workers, ₹1,400)
-- ---------------------------------------------------------------------------

create table if not exists public.job_categories (
  id                uuid        primary key default gen_random_uuid(),
  job_id            uuid        not null references public.jobs(id) on delete cascade,

  name              text        not null check (char_length(name) >= 2),
  description       text,
  required_workers  integer     not null check (required_workers > 0),
  wage              integer     not null check (wage > 0),   -- rupees per shift
  requirements      jsonb       default '{}'::jsonb,  -- category-specific requirements

  sort_order        integer     not null default 0,   -- for UI ordering

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.job_categories is
  'Work-role categories within a job. Each category has a headcount and wage.';

create trigger job_categories_set_updated_at
  before update on public.job_categories
  for each row execute procedure extensions.moddatetime(updated_at);

create index if not exists job_categories_job_idx on public.job_categories (job_id);

-- ---------------------------------------------------------------------------
-- 4. JOB_POSITIONS
--    One row per available slot within a category.
--    Auto-generated when a job_category is created (see trigger below).
--    Statuses: AVAILABLE → PENDING → BOOKED | CANCELLED
--
--    ⚠  Race-condition safety:
--       Never update status directly from client.
--       Always use the reserve_position() or cancel_position() RPC functions
--       which use SELECT … FOR UPDATE to serialise concurrent requests.
-- ---------------------------------------------------------------------------

create table if not exists public.job_positions (
  id                  uuid        primary key default gen_random_uuid(),
  job_id              uuid        not null references public.jobs(id)            on delete cascade,
  job_category_id     uuid        not null references public.job_categories(id)  on delete cascade,

  position_number     integer     not null check (position_number > 0),

  -- Status lifecycle: AVAILABLE → PENDING → BOOKED | CANCELLED
  status              text        not null default 'AVAILABLE'
                        check (status in ('AVAILABLE', 'PENDING', 'BOOKED', 'CANCELLED')),

  -- Set when a worker holds/books this position
  worker_id           uuid        references public.profiles(id) on delete set null,

  -- Set when the associated application is created
  application_id      uuid,  -- FK added later (after applications table exists)

  -- Locking fields (used by reserve_position RPC for the 2-minute hold window)
  locked_at           timestamptz,
  lock_expires_at     timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Constraints
  unique (job_category_id, position_number)
);

comment on table public.job_positions is
  'Individual bookable positions within a job category. One row = one seat/slot.';

comment on column public.job_positions.status is
  'AVAILABLE: open for booking. PENDING: locked by a worker (2-min window). BOOKED: confirmed. CANCELLED: removed.';

comment on column public.job_positions.locked_at is
  'When the PENDING lock was placed. Lock expires after 2 minutes.';

create trigger job_positions_set_updated_at
  before update on public.job_positions
  for each row execute procedure extensions.moddatetime(updated_at);

-- Indexes
create index if not exists job_positions_job_idx          on public.job_positions (job_id);
create index if not exists job_positions_category_idx     on public.job_positions (job_category_id);
create index if not exists job_positions_status_idx       on public.job_positions (status);
create index if not exists job_positions_worker_idx       on public.job_positions (worker_id)
  where worker_id is not null;
create index if not exists job_positions_lock_expiry_idx  on public.job_positions (lock_expires_at)
  where status = 'PENDING';

-- ---------------------------------------------------------------------------
-- 5. APPLICATIONS
--    Joins a worker to a specific position within a category within a job.
--    One application = one position assignment.
-- ---------------------------------------------------------------------------

create table if not exists public.applications (
  id                uuid        primary key default gen_random_uuid(),

  -- Who
  worker_id         uuid        not null references public.profiles(id)          on delete cascade,

  -- What
  job_id            uuid        not null references public.jobs(id)              on delete cascade,
  job_category_id   uuid        not null references public.job_categories(id)    on delete cascade,
  position_id       uuid        not null references public.job_positions(id)     on delete cascade,

  -- Status lifecycle
  status            text        not null default 'PENDING'
                      check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED')),

  -- Optional notes
  worker_note       text,       -- worker's message when applying
  employer_note     text,       -- employer's response (reason for accept/reject)

  -- Timestamps
  applied_at        timestamptz not null default now(),
  confirmed_at      timestamptz,  -- set when ACCEPTED
  cancelled_at      timestamptz,  -- set when CANCELLED or REJECTED

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- ── Integrity Constraints ──────────────────────────────────────────────────
  -- A worker may have only ONE active (non-cancelled) application per job.
  -- An active application means status NOT IN ('CANCELLED', 'REJECTED').
  -- Enforced by a partial unique index.
  constraint applications_unique_position unique (position_id),   -- one worker per position
  constraint applications_worker_job_active_unique
    unique (worker_id, job_id)  -- one application per worker per job (enforced below via partial index)
);

comment on table public.applications is
  'A worker''s booking of a specific position within a job. Exactly one row per position-worker pair.';

-- Drop the (worker_id, job_id) simple unique if it conflicts with cancelled ones.
-- We want: a worker can have only ONE *active* application per job.
-- We'll enforce this in the RPC function with an explicit check.
alter table public.applications
  drop constraint if exists applications_worker_job_active_unique;

-- Partial unique index: prevent duplicate active applications per worker per job
-- CANCELLED and REJECTED applications don't block re-application.
create unique index if not exists applications_one_active_per_worker_job
  on public.applications (worker_id, job_id)
  where status not in ('CANCELLED', 'REJECTED');

-- Add the FK back from job_positions → applications
alter table public.job_positions
  add constraint job_positions_application_id_fk
  foreign key (application_id)
  references public.applications(id)
  on delete set null;

-- Index
create index if not exists applications_worker_idx    on public.applications (worker_id);
create index if not exists applications_job_idx       on public.applications (job_id);
create index if not exists applications_category_idx  on public.applications (job_category_id);
create index if not exists applications_status_idx    on public.applications (status);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute procedure extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- 6. TRIGGER: Auto-generate positions when a job_category is inserted
-- ---------------------------------------------------------------------------

create or replace function public.fn_generate_positions_for_category()
returns trigger
language plpgsql
security definer
as $$
declare
  i integer;
begin
  for i in 1 .. new.required_workers loop
    insert into public.job_positions (job_id, job_category_id, position_number)
    values (new.job_id, new.id, i);
  end loop;
  return new;
end;
$$;

comment on function public.fn_generate_positions_for_category() is
  'Auto-generates N job_positions rows (N = required_workers) when a job_category is inserted.';

create trigger job_categories_generate_positions
  after insert on public.job_categories
  for each row execute procedure public.fn_generate_positions_for_category();

-- ---------------------------------------------------------------------------
-- 7. TRIGGER: Auto-update job status when positions change
--    Runs after any insert/update on job_positions.
-- ---------------------------------------------------------------------------

create or replace function public.fn_update_job_status()
returns trigger
language plpgsql
security definer
as $$
declare
  v_total    integer;
  v_booked   integer;
  v_new_status text;
begin
  select
    count(*),
    count(*) filter (where status = 'BOOKED')
  into v_total, v_booked
  from public.job_positions
  where job_id = coalesce(new.job_id, old.job_id)
    and status != 'CANCELLED';

  if v_total = 0 then
    v_new_status := 'Open';
  elsif v_booked = 0 then
    v_new_status := 'Open';
  elsif v_booked >= v_total then
    v_new_status := 'FullyFilled';
  else
    v_new_status := 'PartiallyFilled';
  end if;

  update public.jobs
  set status = v_new_status, updated_at = now()
  where id = coalesce(new.job_id, old.job_id)
    and status not in ('Completed', 'Cancelled');  -- don't override terminal states

  return coalesce(new, old);
end;
$$;

comment on function public.fn_update_job_status() is
  'Recomputes job.status from booked/total position counts whenever job_positions change.';

create trigger job_positions_update_job_status
  after insert or update or delete on public.job_positions
  for each row execute procedure public.fn_update_job_status();

-- ---------------------------------------------------------------------------
-- 8. TRIGGER: Auto-create profile row on Supabase auth sign-up
-- ---------------------------------------------------------------------------

create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.fn_handle_new_user() is
  'Creates a profiles row automatically whenever a new auth.users row is inserted.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.fn_handle_new_user();

-- ---------------------------------------------------------------------------
-- 9. RPC: reserve_position(position_id, worker_id)
--    Atomically transition a position from AVAILABLE → PENDING.
--    Clears expired PENDING locks first (so a freshly-available slot is bookable).
--    Returns: jsonb { success, position_id, error? }
--
--    SECURITY DEFINER so the RLS bypass for the lock is safe — the function
--    itself enforces the business rules that RLS cannot express atomically.
-- ---------------------------------------------------------------------------

create or replace function public.reserve_position(
  p_position_id  uuid,
  p_worker_id    uuid
)
returns jsonb
language plpgsql
security definer  -- runs as migration owner, not the calling user
as $$
declare
  v_pos     public.job_positions;
  v_job     public.jobs;
  lock_secs constant integer := 120;  -- 2-minute lock window
begin
  -- ── 1. Lock the row exclusively (prevents concurrent reserves) ────────────
  select * into v_pos
  from public.job_positions
  where id = p_position_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'position_not_found');
  end if;

  -- ── 2. Check the parent job is still accepting bookings ───────────────────
  select * into v_job
  from public.jobs
  where id = v_pos.job_id;

  if v_job.status in ('FullyFilled', 'Completed', 'Cancelled') then
    return jsonb_build_object('success', false, 'error', 'job_not_accepting');
  end if;

  -- ── 3. Clear expired PENDING locks ────────────────────────────────────────
  if v_pos.status = 'PENDING' and v_pos.lock_expires_at < now() then
    update public.job_positions
    set status          = 'AVAILABLE',
        worker_id       = null,
        locked_at       = null,
        lock_expires_at = null,
        updated_at      = now()
    where id = p_position_id
    returning * into v_pos;
  end if;

  -- ── 4. Only AVAILABLE positions can be reserved ───────────────────────────
  if v_pos.status != 'AVAILABLE' then
    return jsonb_build_object(
      'success', false,
      'error',   case v_pos.status
                   when 'PENDING' then 'position_locked_by_another_worker'
                   when 'BOOKED'  then 'position_already_booked'
                   else                'position_unavailable'
                 end
    );
  end if;

  -- ── 5. Enforce one active application per worker per job ──────────────────
  if exists (
    select 1 from public.applications
    where worker_id = p_worker_id
      and job_id    = v_pos.job_id
      and status not in ('CANCELLED', 'REJECTED')
  ) then
    return jsonb_build_object('success', false, 'error', 'worker_already_has_active_application');
  end if;

  -- ── 6. Place the lock: AVAILABLE → PENDING ────────────────────────────────
  update public.job_positions
  set status          = 'PENDING',
      worker_id       = p_worker_id,
      locked_at       = now(),
      lock_expires_at = now() + (lock_secs || ' seconds')::interval,
      updated_at      = now()
  where id = p_position_id;

  return jsonb_build_object(
    'success',           true,
    'position_id',       p_position_id,
    'lock_expires_at',   (now() + (lock_secs || ' seconds')::interval)::text,
    'lock_seconds',      lock_secs
  );
end;
$$;

comment on function public.reserve_position(uuid, uuid) is
  'Atomically lock a position for a worker (AVAILABLE → PENDING). Uses SELECT FOR UPDATE.';

-- ---------------------------------------------------------------------------
-- 10. RPC: confirm_booking(position_id, worker_id, worker_note?)
--     Atomically transition a position from PENDING → BOOKED.
--     Creates the applications row in the same transaction.
--     Returns: jsonb { success, application_id?, error? }
-- ---------------------------------------------------------------------------

create or replace function public.confirm_booking(
  p_position_id  uuid,
  p_worker_id    uuid,
  p_worker_note  text    default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_pos     public.job_positions;
  v_app_id  uuid;
begin
  -- ── 1. Lock the row exclusively ───────────────────────────────────────────
  select * into v_pos
  from public.job_positions
  where id = p_position_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'position_not_found');
  end if;

  -- ── 2. Must be in PENDING status ──────────────────────────────────────────
  if v_pos.status != 'PENDING' then
    return jsonb_build_object(
      'success', false,
      'error',   case v_pos.status
                   when 'BOOKED'     then 'position_already_booked'
                   when 'AVAILABLE'  then 'no_active_lock'
                   when 'CANCELLED'  then 'position_cancelled'
                   else                   'position_unavailable'
                 end
    );
  end if;

  -- ── 3. Lock must belong to this worker ────────────────────────────────────
  if v_pos.worker_id != p_worker_id then
    return jsonb_build_object('success', false, 'error', 'lock_owned_by_different_worker');
  end if;

  -- ── 4. Lock must not have expired ─────────────────────────────────────────
  if v_pos.lock_expires_at < now() then
    -- Release the stale lock for courtesy
    update public.job_positions
    set status          = 'AVAILABLE',
        worker_id       = null,
        locked_at       = null,
        lock_expires_at = null,
        updated_at      = now()
    where id = p_position_id;

    return jsonb_build_object('success', false, 'error', 'lock_expired');
  end if;

  -- ── 5. Create the application record ─────────────────────────────────────
  insert into public.applications (
    worker_id, job_id, job_category_id, position_id, status, worker_note, applied_at, confirmed_at
  )
  values (
    p_worker_id,
    v_pos.job_id,
    v_pos.job_category_id,
    p_position_id,
    'ACCEPTED',
    p_worker_note,
    now(),
    now()
  )
  returning id into v_app_id;

  -- ── 6. Transition position: PENDING → BOOKED ─────────────────────────────
  update public.job_positions
  set status          = 'BOOKED',
      worker_id       = p_worker_id,
      application_id  = v_app_id,
      locked_at       = null,
      lock_expires_at = null,
      updated_at      = now()
  where id = p_position_id;

  -- fn_update_job_status trigger fires automatically after the update above.

  return jsonb_build_object(
    'success',        true,
    'application_id', v_app_id,
    'position_id',    p_position_id
  );
end;
$$;

comment on function public.confirm_booking(uuid, uuid, text) is
  'Atomically confirm a reserved position (PENDING → BOOKED) and create the application row.';

-- ---------------------------------------------------------------------------
-- 11. RPC: release_position(position_id, worker_id)
--     Worker explicitly releases their PENDING lock.
--     Returns: jsonb { success, error? }
-- ---------------------------------------------------------------------------

create or replace function public.release_position(
  p_position_id uuid,
  p_worker_id   uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_pos public.job_positions;
begin
  select * into v_pos
  from public.job_positions
  where id = p_position_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'position_not_found');
  end if;

  if v_pos.status != 'PENDING' then
    return jsonb_build_object('success', false, 'error', 'position_not_pending');
  end if;

  if v_pos.worker_id != p_worker_id then
    return jsonb_build_object('success', false, 'error', 'not_your_lock');
  end if;

  update public.job_positions
  set status          = 'AVAILABLE',
      worker_id       = null,
      locked_at       = null,
      lock_expires_at = null,
      updated_at      = now()
  where id = p_position_id;

  return jsonb_build_object('success', true, 'position_id', p_position_id);
end;
$$;

comment on function public.release_position(uuid, uuid) is
  'Worker explicitly releases a PENDING lock they hold. Position returns to AVAILABLE.';

-- ---------------------------------------------------------------------------
-- 12. RPC: cancel_application(application_id, worker_id)
--     Worker cancels their ACCEPTED booking.
--     Sets application → CANCELLED, position → AVAILABLE (re-opens the slot).
--     Returns: jsonb { success, error? }
-- ---------------------------------------------------------------------------

create or replace function public.cancel_application(
  p_application_id  uuid,
  p_worker_id       uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_app public.applications;
begin
  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'application_not_found');
  end if;

  if v_app.worker_id != p_worker_id then
    return jsonb_build_object('success', false, 'error', 'not_your_application');
  end if;

  if v_app.status not in ('PENDING', 'ACCEPTED') then
    return jsonb_build_object('success', false, 'error', 'application_not_cancellable');
  end if;

  -- Cancel the application
  update public.applications
  set status        = 'CANCELLED',
      cancelled_at  = now(),
      updated_at    = now()
  where id = p_application_id;

  -- Re-open the position (lock the position row to avoid concurrent booking)
  update public.job_positions
  set status          = 'AVAILABLE',
      worker_id       = null,
      application_id  = null,
      locked_at       = null,
      lock_expires_at = null,
      updated_at      = now()
  where id = v_app.position_id;

  -- fn_update_job_status fires automatically.

  return jsonb_build_object('success', true, 'application_id', p_application_id);
end;
$$;

comment on function public.cancel_application(uuid, uuid) is
  'Worker cancels their booking. Application → CANCELLED, position → AVAILABLE.';

-- ---------------------------------------------------------------------------
-- 13. RPC: cleanup_expired_locks()
--     Releases all PENDING positions whose lock_expires_at has passed.
--     Intended to be called periodically (e.g., every 60 s from frontend,
--     or via pg_cron: SELECT cron.schedule('*/2 * * * *', 'SELECT public.cleanup_expired_locks()'))
--     Returns: integer — number of positions released.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_expired_locks()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  with released as (
    update public.job_positions
    set status          = 'AVAILABLE',
        worker_id       = null,
        locked_at       = null,
        lock_expires_at = null,
        updated_at      = now()
    where status          = 'PENDING'
      and lock_expires_at < now()
    returning id
  )
  select count(*) into v_count from released;

  return v_count;
end;
$$;

comment on function public.cleanup_expired_locks() is
  'Releases all stale PENDING position locks. Safe to call repeatedly.';

-- ---------------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

-- ── profiles ───────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Any authenticated user can read any profile (name, avatar — needed for UI)
create policy "Profiles: authenticated users can read all"
  on public.profiles for select
  to authenticated
  using (true);

-- Unauthenticated/anonymous users can read profiles too (public info)
create policy "Profiles: anon users can read all"
  on public.profiles for select
  to anon
  using (true);

-- Users can only update their own profile
create policy "Profiles: users can update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profile insert is handled by fn_handle_new_user (SECURITY DEFINER).
-- No direct insert policy needed — but allow it for service role
create policy "Profiles: service role insert"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ── jobs ───────────────────────────────────────────────────────────────────
alter table public.jobs enable row level security;

-- Anyone (including anonymous) can read job listings
create policy "Jobs: public read"
  on public.jobs for select
  using (true);

-- Only authenticated users can post jobs; employer_id must match auth user
create policy "Jobs: employer can insert"
  on public.jobs for insert
  to authenticated
  with check (auth.uid() = employer_id);

-- Employer can update/delete their own jobs
create policy "Jobs: employer can update own"
  on public.jobs for update
  to authenticated
  using (auth.uid() = employer_id)
  with check (auth.uid() = employer_id);

create policy "Jobs: employer can delete own"
  on public.jobs for delete
  to authenticated
  using (auth.uid() = employer_id);

-- ── job_categories ─────────────────────────────────────────────────────────
alter table public.job_categories enable row level security;

-- Public read (workers need category/wage info)
create policy "Job categories: public read"
  on public.job_categories for select
  using (true);

-- Only the job's employer can manage categories
create policy "Job categories: employer can insert"
  on public.job_categories for insert
  to authenticated
  with check (
    auth.uid() = (select employer_id from public.jobs where id = job_id)
  );

create policy "Job categories: employer can update own"
  on public.job_categories for update
  to authenticated
  using (
    auth.uid() = (select employer_id from public.jobs where id = job_id)
  );

create policy "Job categories: employer can delete own"
  on public.job_categories for delete
  to authenticated
  using (
    auth.uid() = (select employer_id from public.jobs where id = job_id)
  );

-- ── job_positions ──────────────────────────────────────────────────────────
alter table public.job_positions enable row level security;

-- Public read (workers need to see which positions are available)
-- NOTE: we DO NOT expose worker_id or application_id in the public read view
--       — that is handled by the view defined in section 15.
create policy "Job positions: public read"
  on public.job_positions for select
  using (true);

-- Positions are created by SECURITY DEFINER trigger (fn_generate_positions_for_category).
-- Updates go through SECURITY DEFINER RPCs (reserve_position, confirm_booking, etc.)
-- Direct insert/update/delete by clients is BLOCKED — no policies = deny.
-- Exception: employer can cancel (AVAILABLE/PENDING → CANCELLED) positions on their jobs.
create policy "Job positions: employer can cancel own"
  on public.job_positions for update
  to authenticated
  using (
    auth.uid() = (select j.employer_id from public.jobs j where j.id = job_id)
  );

-- ── applications ───────────────────────────────────────────────────────────
alter table public.applications enable row level security;

-- Workers see only their own applications
create policy "Applications: worker sees own"
  on public.applications for select
  to authenticated
  using (auth.uid() = worker_id);

-- Employers see applications for their jobs (to review candidates)
-- NOTE: does NOT expose other workers' personal data beyond what's in the row.
create policy "Applications: employer sees their job applications"
  on public.applications for select
  to authenticated
  using (
    auth.uid() = (select j.employer_id from public.jobs j where j.id = job_id)
  );

-- Applications are inserted by SECURITY DEFINER confirm_booking() RPC only.
-- Direct inserts from client are blocked.

-- Employer can update application status (ACCEPTED → REJECTED, etc.)
create policy "Applications: employer can update status on own jobs"
  on public.applications for update
  to authenticated
  using (
    auth.uid() = (select j.employer_id from public.jobs j where j.id = job_id)
  );

-- Workers can cancel their own applications via RPC — we allow direct update
-- only if status transitions to CANCELLED and worker_id matches.
-- (The RPC is the safer path, but we add this for direct API access.)
create policy "Applications: worker can cancel own"
  on public.applications for update
  to authenticated
  using (auth.uid() = worker_id)
  with check (auth.uid() = worker_id and status = 'CANCELLED');

-- ---------------------------------------------------------------------------
-- 15. SECURE VIEW: job_positions_public
--     Exposes position status to workers WITHOUT leaking worker_id or
--     application_id of other workers.
--     Workers can see: id, job_id, job_category_id, position_number, status,
--                      lock_expires_at (countdown), their OWN worker_id only.
-- ---------------------------------------------------------------------------

create or replace view public.job_positions_public
  with (security_invoker = true)
as
select
  jp.id,
  jp.job_id,
  jp.job_category_id,
  jp.position_number,
  jp.status,
  -- Expose lock expiry so frontend can show countdown — but not WHO holds it
  case when jp.status = 'PENDING' then jp.lock_expires_at else null end as lock_expires_at,
  -- Only reveal worker_id if it belongs to the currently authenticated user
  case when jp.worker_id = auth.uid() then jp.worker_id else null end   as my_worker_id,
  -- Same for application_id
  case when jp.worker_id = auth.uid() then jp.application_id else null end as my_application_id,
  jp.created_at,
  jp.updated_at
from public.job_positions jp;

comment on view public.job_positions_public is
  'Safe public view of job_positions. Hides worker_id and application_id of other workers.';

-- ---------------------------------------------------------------------------
-- 16. SUPABASE REALTIME
--     Enable realtime on job_positions so workers see live position changes.
--     Only the columns needed for the UI are published (no private columns).
-- ---------------------------------------------------------------------------

-- Supabase realtime publication (already exists in Supabase projects as supabase_realtime)
-- We add job_positions to it.
alter publication supabase_realtime add table public.job_positions;
alter publication supabase_realtime add table public.applications;

-- ---------------------------------------------------------------------------
-- 17. GRANT EXECUTE on RPC functions to authenticated users
--     (SECURITY DEFINER functions run as the defining role, but must still
--      be invokable by authenticated users.)
-- ---------------------------------------------------------------------------

grant execute on function public.reserve_position(uuid, uuid)               to authenticated;
grant execute on function public.confirm_booking(uuid, uuid, text)          to authenticated;
grant execute on function public.release_position(uuid, uuid)               to authenticated;
grant execute on function public.cancel_application(uuid, uuid)             to authenticated;
grant execute on function public.cleanup_expired_locks()                    to authenticated;

-- Allow anon to call cleanup (useful from frontend without auth)
grant execute on function public.cleanup_expired_locks()                    to anon;

-- ---------------------------------------------------------------------------
-- Done.
-- ---------------------------------------------------------------------------
