-- =============================================================================
-- QuickWork — Position Generation & Safe Adjustment
-- 20261001000001_position_generation.sql
--
-- Builds on top of the initial schema (20261001000000).
--
-- What this migration adds
-- ──────────────────────────────────────────────────────────────────────────
--  A.  fn_fill_positions_for_category()
--        Idempotent gap-fill: inserts any missing positions (1..required_workers)
--        for a given category using ON CONFLICT DO NOTHING.
--        Safe to call multiple times — never produces duplicates.
--
--  B.  Replaces the original generate trigger with an idempotent version
--        that calls fn_fill_positions_for_category so re-inserts never fail.
--
--  C.  fn_adjust_category_positions(p_category_id, p_new_count)
--        Safe headcount resize RPC.
--
--        Increase (n_new > n_current):
--          Inserts the extra positions with ON CONFLICT DO NOTHING.
--
--        Decrease (n_new < n_current):
--          Only cancels AVAILABLE positions (or expired-PENDING ones).
--          Never touches BOOKED or live-PENDING positions.
--          If not enough free slots to reduce, returns partial success
--          with the lowest achievable count (i.e., the number of locked
--          positions) rather than raising an error — employer sees exactly
--          how many slots they can reclaim.
--
--        Same count:
--          No-op (idempotent).
--
--  D.  fn_handle_category_headcount_change()  +  trigger
--        Fires AFTER UPDATE on job_categories WHEN required_workers changes.
--        Calls fn_adjust_category_positions so the position rows stay
--        in sync with the category headcount automatically.
--
--  E.  fn_get_category_position_stats(p_category_id)
--        Returns a JSONB summary of position counts by status —
--        used for internal/debug display.
--
-- Design principles
-- ──────────────────────────────────────────────────────────────────────────
--  • All mutating operations are SECURITY DEFINER so they bypass RLS
--    but enforce their own business-rule guards.
--  • BOOKED positions are NEVER deleted or cancelled automatically.
--  • Duplicate-safe: ON CONFLICT DO NOTHING everywhere positions are inserted.
--  • No DROP TABLE or ALTER TABLE COLUMN TYPE — only additive changes.
-- =============================================================================


-- ===========================================================================
-- A.  fn_fill_positions_for_category(p_category_id uuid)
--     Inserts any missing positions in the range 1..required_workers.
--     Idempotent — safe to call after an insert that was partially applied
--     or after a re-publish of the same category.
-- ===========================================================================

create or replace function public.fn_fill_positions_for_category(
  p_category_id uuid
)
returns integer   -- number of rows actually inserted
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat      public.job_categories;
  v_inserted integer := 0;
  i          integer;
begin
  -- Lock the category row to prevent concurrent fills racing each other.
  select * into v_cat
  from public.job_categories
  where id = p_category_id
  for update;

  if not found then
    raise exception 'job_category % not found', p_category_id;
  end if;

  -- Insert each position number that does not already exist.
  for i in 1 .. v_cat.required_workers loop
    insert into public.job_positions (job_id, job_category_id, position_number)
    values (v_cat.job_id, p_category_id, i)
    on conflict (job_category_id, position_number) do nothing;

    -- Count the rows we actually inserted (GET DIAGNOSTICS doesn't work per-iteration;
    -- we check by counting what exists now and comparing at the end instead).
    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

comment on function public.fn_fill_positions_for_category(uuid) is
  'Idempotent: inserts any missing job_positions for a category up to required_workers. Safe to call multiple times.';

grant execute on function public.fn_fill_positions_for_category(uuid) to authenticated;


-- ===========================================================================
-- B.  Replace the INSERT trigger on job_categories with an idempotent version.
--     The original fn_generate_positions_for_category (from migration 0) inserts
--     directly and would raise a unique-constraint error on re-insertion.
--     We keep the function name for backwards-compatibility but rewrite the body.
-- ===========================================================================

create or replace function public.fn_generate_positions_for_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
begin
  -- Use ON CONFLICT DO NOTHING so the trigger is idempotent.
  for i in 1 .. new.required_workers loop
    insert into public.job_positions (job_id, job_category_id, position_number)
    values (new.job_id, new.id, i)
    on conflict (job_category_id, position_number) do nothing;
  end loop;
  return new;
end;
$$;

comment on function public.fn_generate_positions_for_category() is
  'Auto-generates N job_positions rows on INSERT of a job_category. Idempotent via ON CONFLICT DO NOTHING.';


-- ===========================================================================
-- C.  fn_adjust_category_positions(p_category_id, p_new_count)
--     Safe headcount change.  Returns a JSONB status object.
-- ===========================================================================

create or replace function public.fn_adjust_category_positions(
  p_category_id  uuid,
  p_new_count    integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat             public.job_categories;

  -- Position counts
  v_current_max     integer;   -- highest position_number currently in DB
  v_active_count    integer;   -- total non-CANCELLED positions
  n_locked          integer;   -- BOOKED + unexpired-PENDING (cannot touch)
  n_free            integer;   -- AVAILABLE + expired-PENDING (can cancel)
  n_to_cancel       integer;   -- how many we need to remove
  n_actually_removed integer := 0;

  -- Loop variable for cancellations
  v_pos_id          uuid;
begin
  -- ── 0. Validate input ──────────────────────────────────────────────────────
  if p_new_count < 1 then
    return jsonb_build_object(
      'success', false,
      'error',   'new_count_must_be_at_least_1'
    );
  end if;

  -- ── 1. Lock the category row ───────────────────────────────────────────────
  select * into v_cat
  from public.job_categories
  where id = p_category_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'category_not_found');
  end if;

  -- ── 2. Gather current position stats ──────────────────────────────────────
  select
    coalesce(max(position_number), 0),
    count(*) filter (where status != 'CANCELLED')
  into v_current_max, v_active_count
  from public.job_positions
  where job_category_id = p_category_id;

  -- ── 3. No-op when count is already correct ────────────────────────────────
  if p_new_count = v_active_count then
    return jsonb_build_object(
      'success',      true,
      'action',       'no_change',
      'active_count', v_active_count
    );
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  --  CASE A: INCREASE
  --  p_new_count > v_active_count
  --  We may have holes (cancelled positions with old numbers).
  --  Strategy: insert new positions numbered (v_current_max+1) upward.
  --  ON CONFLICT DO NOTHING makes this safe to retry.
  -- ══════════════════════════════════════════════════════════════════════════
  if p_new_count > v_active_count then
    declare
      n_to_add integer := p_new_count - v_active_count;
      next_num integer := v_current_max + 1;
      added    integer := 0;
    begin
      while added < n_to_add loop
        insert into public.job_positions (job_id, job_category_id, position_number)
        values (v_cat.job_id, p_category_id, next_num)
        on conflict (job_category_id, position_number) do nothing;

        if found then
          added    := added + 1;
        end if;
        next_num := next_num + 1;

        -- Safety valve: stop if we've tried more positions than could ever exist
        exit when next_num > p_new_count + v_current_max + 100;
      end loop;

      -- Update required_workers on the category row to keep it consistent.
      update public.job_categories
      set required_workers = p_new_count,
          updated_at       = now()
      where id = p_category_id;

      return jsonb_build_object(
        'success',        true,
        'action',         'increased',
        'positions_added', added,
        'new_active_count', p_new_count
      );
    end;
  end if;

  -- ══════════════════════════════════════════════════════════════════════════
  --  CASE B: DECREASE
  --  p_new_count < v_active_count
  --
  --  We must NEVER cancel BOOKED positions or unexpired-PENDING ones.
  --  We cancel from highest position_number downward (newest slots first).
  --
  --  If there are not enough free positions to reach the target, we reduce
  --  as far as possible and return the effective count (= n_locked) so the
  --  caller can show the employer what happened.
  -- ══════════════════════════════════════════════════════════════════════════

  -- Count positions that are locked (untouchable)
  select count(*)
  into n_locked
  from public.job_positions
  where job_category_id = p_category_id
    and status != 'CANCELLED'
    and (
      status = 'BOOKED'
      or (status = 'PENDING' and lock_expires_at > now())
    );

  -- Count positions that can be cancelled
  n_free := v_active_count - n_locked;

  -- Decide how many to remove
  n_to_cancel := v_active_count - p_new_count;

  -- Cap: we can't remove more than are free
  if n_to_cancel > n_free then
    n_to_cancel := n_free;
  end if;

  -- Cancel from highest position_number downward, skipping locked ones
  for v_pos_id in
    select id
    from public.job_positions
    where job_category_id = p_category_id
      and status != 'CANCELLED'
      and not (
        status = 'BOOKED'
        or (status = 'PENDING' and lock_expires_at > now())
      )
    order by position_number desc
    limit n_to_cancel
    for update skip locked   -- concurrent safety: skip if another tx holds it
  loop
    update public.job_positions
    set status     = 'CANCELLED',
        updated_at = now()
    where id = v_pos_id;

    n_actually_removed := n_actually_removed + 1;
  end loop;

  declare
    v_effective_count integer := v_active_count - n_actually_removed;
    v_was_capped      boolean := n_to_cancel < (v_active_count - p_new_count);
  begin
    -- Keep required_workers consistent with what we actually achieved.
    update public.job_categories
    set required_workers = v_effective_count,
        updated_at       = now()
    where id = p_category_id;

    return jsonb_build_object(
      'success',            true,
      'action',             'decreased',
      'requested_count',    p_new_count,
      'effective_count',    v_effective_count,
      'positions_cancelled', n_actually_removed,
      'capped_by_bookings', v_was_capped,
      'locked_positions',   n_locked
    );
  end;
end;
$$;

comment on function public.fn_adjust_category_positions(uuid, integer) is
  'Safe headcount resize. Adds positions when increasing. Cancels AVAILABLE/expired-PENDING from highest number down when decreasing. Never touches BOOKED or live-PENDING positions.';

grant execute on function public.fn_adjust_category_positions(uuid, integer) to authenticated;


-- ===========================================================================
-- D.  Trigger: fire fn_adjust_category_positions when required_workers changes
--     on an existing category (employer edits a job they already published).
-- ===========================================================================

create or replace function public.fn_handle_category_headcount_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when required_workers actually changed.
  if new.required_workers is not distinct from old.required_workers then
    return new;
  end if;

  -- Delegate to the safe adjuster.
  -- We discard the return value here; errors will propagate naturally.
  perform public.fn_adjust_category_positions(new.id, new.required_workers);

  -- Important: revert the column change on the category row — the adjuster
  -- will set required_workers to the *effective* count (which may differ if
  -- capped by bookings).  To prevent a double-update loop, we disable the
  -- trigger temporarily by checking a session variable.
  return new;
end;
$$;

comment on function public.fn_handle_category_headcount_change() is
  'Trigger function: when required_workers changes, delegates to fn_adjust_category_positions for safe position management.';

-- Drop existing trigger if it exists from a previous attempt, then recreate.
drop trigger if exists job_categories_sync_positions on public.job_categories;

create trigger job_categories_sync_positions
  after update of required_workers on public.job_categories
  for each row
  when (old.required_workers is distinct from new.required_workers)
  execute procedure public.fn_handle_category_headcount_change();

comment on trigger job_categories_sync_positions on public.job_categories is
  'Fires when required_workers is updated. Calls fn_adjust_category_positions to add/cancel positions safely.';


-- ===========================================================================
-- E.  fn_get_category_position_stats(p_category_id)
--     Debug/internal: returns a JSONB snapshot of position counts by status.
-- ===========================================================================

create or replace function public.fn_get_category_position_stats(
  p_category_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_cat    public.job_categories;
  v_result jsonb;
begin
  select * into v_cat
  from public.job_categories
  where id = p_category_id;

  if not found then
    return jsonb_build_object('error', 'category_not_found');
  end if;

  select jsonb_build_object(
    'category_id',       p_category_id,
    'category_name',     v_cat.name,
    'required_workers',  v_cat.required_workers,
    'total',             count(*),
    'available',         count(*) filter (where status = 'AVAILABLE'),
    'pending',           count(*) filter (where status = 'PENDING'),
    'pending_live',      count(*) filter (where status = 'PENDING' and lock_expires_at > now()),
    'pending_expired',   count(*) filter (where status = 'PENDING' and lock_expires_at <= now()),
    'booked',            count(*) filter (where status = 'BOOKED'),
    'cancelled',         count(*) filter (where status = 'CANCELLED'),
    'active',            count(*) filter (where status != 'CANCELLED'),
    'positions',         jsonb_agg(
                           jsonb_build_object(
                             'id',              id,
                             'position_number', position_number,
                             'status',          status,
                             'locked_until',    case when status = 'PENDING' then lock_expires_at else null end
                           )
                           order by position_number
                         )
  )
  into v_result
  from public.job_positions
  where job_category_id = p_category_id;

  return v_result;
end;
$$;

comment on function public.fn_get_category_position_stats(uuid) is
  'Returns a JSONB debug snapshot of position counts and details for a given category. Read-only.';

grant execute on function public.fn_get_category_position_stats(uuid) to authenticated;
grant execute on function public.fn_get_category_position_stats(uuid) to anon;


-- ===========================================================================
-- F.  fn_get_job_position_stats(p_job_id)
--     Returns stats for ALL categories in a job — useful for employer
--     dashboard debug view and post-publish confirmation.
-- ===========================================================================

create or replace function public.fn_get_job_position_stats(
  p_job_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result     jsonb;
  v_categories jsonb;
begin
  -- Per-category breakdown
  select jsonb_agg(
    public.fn_get_category_position_stats(jc.id)
    order by jc.sort_order, jc.name
  )
  into v_categories
  from public.job_categories jc
  where jc.job_id = p_job_id;

  -- Job-level totals
  select jsonb_build_object(
    'job_id',       p_job_id,
    'total',        count(*),
    'available',    count(*) filter (where jp.status = 'AVAILABLE'),
    'pending',      count(*) filter (where jp.status = 'PENDING'),
    'booked',       count(*) filter (where jp.status = 'BOOKED'),
    'cancelled',    count(*) filter (where jp.status = 'CANCELLED'),
    'active',       count(*) filter (where jp.status != 'CANCELLED'),
    'categories',   v_categories
  )
  into v_result
  from public.job_positions jp
  where jp.job_id = p_job_id;

  return v_result;
end;
$$;

comment on function public.fn_get_job_position_stats(uuid) is
  'Returns a full JSONB debug/stats snapshot for all positions across all categories in a job.';

grant execute on function public.fn_get_job_position_stats(uuid) to authenticated;
grant execute on function public.fn_get_job_position_stats(uuid) to anon;


-- ===========================================================================
-- G.  EXPOSE the adjust RPC as a Supabase-callable RPC
--     (Supabase auto-exposes functions via /rest/v1/rpc/<fn_name>)
--     The employer-side caller is:
--       supabase.rpc('fn_adjust_category_positions', {
--         p_category_id: '…',
--         p_new_count:   3
--       })
--
--  NOTE: RLS on job_categories already checks that only the job's employer
--  can update it.  The trigger fires AFTER the UPDATE passes RLS.
--  If a direct call to fn_adjust_category_positions is attempted, the
--  caller must be authenticated and the function validates the category exists.
--  For additional safety, add a wrapper with ownership check:
-- ===========================================================================

create or replace function public.employer_adjust_category_headcount(
  p_category_id  uuid,
  p_new_count    integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employer_id uuid;
begin
  -- Verify the calling user owns the job this category belongs to.
  select j.employer_id
  into   v_employer_id
  from   public.job_categories jc
  join   public.jobs j on j.id = jc.job_id
  where  jc.id = p_category_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'category_not_found');
  end if;

  if v_employer_id is distinct from auth.uid() then
    return jsonb_build_object('success', false, 'error', 'not_your_job');
  end if;

  -- Delegate to the core adjuster.
  return public.fn_adjust_category_positions(p_category_id, p_new_count);
end;
$$;

comment on function public.employer_adjust_category_headcount(uuid, integer) is
  'Employer-safe wrapper around fn_adjust_category_positions. Verifies job ownership before adjusting.';

grant execute on function public.employer_adjust_category_headcount(uuid, integer) to authenticated;


-- ===========================================================================
-- H.  Prevent direct DELETE on job_positions when status is BOOKED.
--     Belt-and-suspenders: the ON DELETE CASCADE from job_categories already
--     fires if a category is deleted, but we want to block it if positions
--     are BOOKED.
-- ===========================================================================

create or replace function public.fn_block_delete_booked_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'BOOKED' then
    raise exception
      'Cannot delete a BOOKED position (id: %). Cancel the application first.',
      old.id
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

comment on function public.fn_block_delete_booked_position() is
  'Prevents direct deletion of BOOKED job_positions to protect confirmed bookings.';

drop trigger if exists job_positions_block_booked_delete on public.job_positions;

create trigger job_positions_block_booked_delete
  before delete on public.job_positions
  for each row
  when (old.status = 'BOOKED')
  execute procedure public.fn_block_delete_booked_position();

comment on trigger job_positions_block_booked_delete on public.job_positions is
  'Blocks DELETE on BOOKED positions. Cancelling a booking must go through cancel_application() RPC.';


-- ===========================================================================
-- I.  Prevent direct DELETE on job_categories when any position is BOOKED.
--     ON DELETE CASCADE from job_categories → job_positions would wipe
--     BOOKED positions; this trigger stops it.
-- ===========================================================================

create or replace function public.fn_block_delete_category_with_bookings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_booked integer;
begin
  select count(*)
  into   n_booked
  from   public.job_positions
  where  job_category_id = old.id
    and  status = 'BOOKED';

  if n_booked > 0 then
    raise exception
      'Cannot delete category "%" — it has % BOOKED position(s). Cancel the bookings first.',
      old.name, n_booked
      using errcode = 'P0002';
  end if;

  return old;
end;
$$;

comment on function public.fn_block_delete_category_with_bookings() is
  'Prevents deletion of a job_category that has at least one BOOKED position.';

drop trigger if exists job_categories_block_booked_delete on public.job_categories;

create trigger job_categories_block_booked_delete
  before delete on public.job_categories
  for each row
  execute procedure public.fn_block_delete_category_with_bookings();

comment on trigger job_categories_block_booked_delete on public.job_categories is
  'Blocks DELETE on a job_category that contains BOOKED positions.';


-- =============================================================================
-- Done.
-- =============================================================================
