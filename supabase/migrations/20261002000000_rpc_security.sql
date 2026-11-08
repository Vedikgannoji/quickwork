-- Migration: RPC Security - Remove client-supplied user IDs, use auth.uid()
-- All RPCs now enforce authentication and use server-side user identification

-- ============================================================================
-- 1. DROP and RECREATE RPCs with auth.uid() enforcement
-- ============================================================================

-- Drop old versions that accept worker_id parameter
DROP FUNCTION IF EXISTS reserve_position(uuid, uuid);
DROP FUNCTION IF EXISTS confirm_booking(uuid, uuid, text);
DROP FUNCTION IF EXISTS release_position(uuid, uuid);
DROP FUNCTION IF EXISTS cancel_application(uuid, uuid);

-- reserve_position: Lock a position for the authenticated worker
CREATE OR REPLACE FUNCTION reserve_position(p_position_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_worker_id uuid;
  v_position record;
  v_existing_application_id uuid;
  v_lock_duration interval := interval '5 minutes';
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the position row
  SELECT * INTO v_position
  FROM positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Check if position is available
  IF v_position.status != 'AVAILABLE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_available');
  END IF;

  -- Check for existing active application
  SELECT id INTO v_existing_application_id
  FROM applications
  WHERE position_id = p_position_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  IF v_existing_application_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_already_applied');
  END IF;

  -- Reserve the position
  UPDATE positions
  SET 
    status = 'LOCKED',
    locked_by = v_worker_id,
    locked_at = now(),
    lock_expires_at = now() + v_lock_duration
  WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'success', true,
    'position_id', p_position_id,
    'lock_expires_at', (now() + v_lock_duration)::text
  );
END;
$$;

-- confirm_booking: Convert locked position to confirmed application
CREATE OR REPLACE FUNCTION confirm_booking(
  p_position_id uuid,
  p_worker_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_worker_id uuid;
  v_position record;
  v_application_id uuid;
  v_job_id uuid;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the position
  SELECT * INTO v_position
  FROM positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Verify lock ownership
  IF v_position.locked_by != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_locked_by_you');
  END IF;

  -- Verify lock not expired
  IF v_position.lock_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'lock_expired');
  END IF;

  -- Get job_id from category
  SELECT job_id INTO v_job_id
  FROM job_categories
  WHERE id = v_position.category_id;

  -- Create application
  INSERT INTO applications (worker_id, job_id, position_id, status, worker_note)
  VALUES (v_worker_id, v_job_id, p_position_id, 'CONFIRMED', p_worker_note)
  RETURNING id INTO v_application_id;

  -- Update position status
  UPDATE positions
  SET 
    status = 'CONFIRMED',
    locked_by = NULL,
    locked_at = NULL,
    lock_expires_at = NULL
  WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'position_id', p_position_id
  );
END;
$$;

-- release_position: Release a lock held by the authenticated worker
CREATE OR REPLACE FUNCTION release_position(p_position_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_worker_id uuid;
  v_position record;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the position
  SELECT * INTO v_position
  FROM positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'position_not_found');
  END IF;

  -- Verify lock ownership
  IF v_position.locked_by != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_locked_by_you');
  END IF;

  -- Release the lock
  UPDATE positions
  SET 
    status = 'AVAILABLE',
    locked_by = NULL,
    locked_at = NULL,
    lock_expires_at = NULL
  WHERE id = p_position_id;

  RETURN jsonb_build_object(
    'success', true,
    'position_id', p_position_id
  );
END;
$$;

-- cancel_application: Cancel an application owned by the authenticated worker
CREATE OR REPLACE FUNCTION cancel_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_worker_id uuid;
  v_application record;
BEGIN
  -- Authenticate
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Lock the application
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- Verify ownership
  IF v_application.worker_id != v_worker_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_your_application');
  END IF;

  -- Check if cancellable
  IF v_application.status NOT IN ('PENDING', 'CONFIRMED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel_status');
  END IF;

  -- Cancel the application
  UPDATE applications
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_application_id;

  -- If there's a position, release it
  IF v_application.position_id IS NOT NULL THEN
    UPDATE positions
    SET 
      status = 'AVAILABLE',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
    WHERE id = v_application.position_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id
  );
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION reserve_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION release_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_application(uuid) TO authenticated;

-- ============================================================================
-- 2. Replace unique constraint with partial unique index
-- ============================================================================

-- Drop old constraint if exists
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_unique_position;

-- Create partial unique index: one active application per position
CREATE UNIQUE INDEX IF NOT EXISTS applications_position_active_unique
ON applications (position_id)
WHERE status NOT IN ('CANCELLED', 'REJECTED');

-- ============================================================================
-- 3. Revoke execute permissions from maintenance functions
-- ============================================================================

REVOKE EXECUTE ON FUNCTION cleanup_expired_locks() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_adjust_category_positions(uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_fill_positions_for_category(uuid) FROM public, anon, authenticated;

-- ============================================================================
-- 4. Setup pg_cron for automatic lock cleanup
-- ============================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup_expired_locks to run every minute
-- Remove existing schedule if present
SELECT cron.unschedule('cleanup-expired-locks') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-locks'
);

-- Schedule the job
SELECT cron.schedule(
  'cleanup-expired-locks',
  '* * * * *', -- Every minute
  'SELECT cleanup_expired_locks();'
);
