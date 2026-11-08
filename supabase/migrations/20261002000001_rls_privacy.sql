-- Migration: RLS Privacy - Fine-grained access control and data separation
-- Implements privacy-first policies: users can only see data they're authorized for

-- ============================================================================
-- 1. PROFILES: Replace broad policies with fine-grained access
-- ============================================================================

-- Drop existing read policies
DROP POLICY IF EXISTS "profiles_select_anon" ON profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- New SELECT policies for profiles

-- Owner can read their own row
CREATE POLICY "profiles_select_own"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Employer and worker who share an ACCEPTED application can read each other's profile
CREATE POLICY "profiles_select_accepted_connection"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM applications a
    INNER JOIN jobs j ON j.id = a.job_id
    WHERE a.status = 'CONFIRMED'
      AND (
        -- Current user is the employer, viewing the worker
        (j.employer_id = auth.uid() AND a.worker_id = profiles.id)
        OR
        -- Current user is the worker, viewing the employer
        (a.worker_id = auth.uid() AND j.employer_id = profiles.id)
      )
  )
);

-- ============================================================================
-- 2. PUBLIC_PROFILES VIEW: Limited read-only profile data
-- ============================================================================

CREATE OR REPLACE VIEW public_profiles
WITH (security_invoker = false)
AS
SELECT 
  id,
  name,
  avatar_url,
  location
FROM profiles;

-- Grant read access to anon and authenticated
GRANT SELECT ON public_profiles TO anon, authenticated;

-- ============================================================================
-- 3. JOB_PRIVATE: Separate sensitive job contact information
-- ============================================================================

-- Create job_private table
CREATE TABLE IF NOT EXISTS job_private (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  reporting_contact jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE job_private ENABLE ROW LEVEL SECURITY;

-- RLS: employer or worker with ACCEPTED application can read
CREATE POLICY "job_private_select"
ON job_private
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_private.job_id
      AND (
        -- User is the employer
        j.employer_id = auth.uid()
        OR
        -- User has an ACCEPTED application on this job
        EXISTS (
          SELECT 1
          FROM applications a
          WHERE a.job_id = j.id
            AND a.worker_id = auth.uid()
            AND a.status = 'CONFIRMED'
        )
      )
  )
);

-- RLS: only the employer can write
CREATE POLICY "job_private_insert"
ON job_private
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_private.job_id
      AND j.employer_id = auth.uid()
  )
);

CREATE POLICY "job_private_update"
ON job_private
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_private.job_id
      AND j.employer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_private.job_id
      AND j.employer_id = auth.uid()
  )
);

CREATE POLICY "job_private_delete"
ON job_private
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_private.job_id
      AND j.employer_id = auth.uid()
  )
);

-- Migrate existing data from jobs.reporting_contact to job_private
INSERT INTO job_private (job_id, reporting_contact)
SELECT id, reporting_contact
FROM jobs
WHERE reporting_contact IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;

-- Drop the reporting_contact column from jobs
ALTER TABLE jobs DROP COLUMN IF EXISTS reporting_contact;

-- ============================================================================
-- 4. LOCK DOWN DIRECT UPDATES: Force changes through RPCs
-- ============================================================================

-- Drop all UPDATE policies on job_positions
DROP POLICY IF EXISTS "job_positions_update" ON job_positions;
DROP POLICY IF EXISTS "Workers can update positions" ON job_positions;
DROP POLICY IF EXISTS "Employers can update positions" ON job_positions;
DROP POLICY IF EXISTS "Users can update positions" ON job_positions;

-- Drop all UPDATE policies on applications
DROP POLICY IF EXISTS "applications_update" ON applications;
DROP POLICY IF EXISTS "Workers can update own applications" ON applications;
DROP POLICY IF EXISTS "Worker can cancel own application" ON applications;
DROP POLICY IF EXISTS "Employers can update applications for their jobs" ON applications;
DROP POLICY IF EXISTS "Users can update applications" ON applications;

-- Note: SELECT and INSERT policies remain for read access and initial creation
-- All mutations must now go through the security definer RPCs

-- ============================================================================
-- 5. PROFILES COLUMN PRIVILEGES: Granular update control
-- ============================================================================

-- Revoke all update privileges on profiles from authenticated
REVOKE UPDATE ON profiles FROM authenticated;

-- Grant update only on specific safe columns
GRANT UPDATE (name, phone, avatar_url, location, profile_complete) ON profiles TO authenticated;

-- Any columns added to profiles in the future will NOT be writable by users
-- unless explicitly granted with: GRANT UPDATE (new_column) ON profiles TO authenticated;
