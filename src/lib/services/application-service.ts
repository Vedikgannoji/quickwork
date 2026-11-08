/**
 * Application Service - Supabase Integration Layer
 * 
 * Provides CRUD operations for job applications with proper database persistence.
 * Handles the complete application lifecycle:
 * - Worker applies to job
 * - Position reservation (temporary lock)
 * - Booking confirmation
 * - Application cancellation
 * 
 * Works with RPC functions for atomic position locking.
 */

import { getSupabase } from '../supabase';
import type { Database } from '../database.types';

// ─── Database Types ───────────────────────────────────────────────────────────

type DbApplication = Database['public']['Tables']['applications']['Row'];
type DbApplicationInsert = Database['public']['Tables']['applications']['Insert'];
type DbApplicationUpdate = Database['public']['Tables']['applications']['Update'];
type DbJobPosition = Database['public']['Tables']['job_positions']['Row'];

// ─── Application Status Types ─────────────────────────────────────────────────

export type ApplicationStatus =
  | 'PENDING'      // Application submitted, position temporarily locked
  | 'CONFIRMED'    // Employer confirmed (not used in current flow)
  | 'BOOKED'       // Worker confirmed/paid, position secured
  | 'ACCEPTED'     // Alternative term for booked
  | 'REJECTED'     // Employer rejected
  | 'CANCELLED'    // Worker or employer cancelled
  | 'EXPIRED';     // Lock expired before confirmation

// ─── Frontend Application Type ────────────────────────────────────────────────

export interface Application {
  id: string;
  jobId: string;
  jobCategoryId: string;
  positionId: string;
  workerId: string;
  status: ApplicationStatus;
  appliedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  workerNote: string | null;
  employerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Transform Functions ──────────────────────────────────────────────────────

function dbApplicationToApplication(dbApp: DbApplication): Application {
  return {
    id: dbApp.id,
    jobId: dbApp.job_id,
    jobCategoryId: dbApp.job_category_id,
    positionId: dbApp.position_id,
    workerId: dbApp.worker_id,
    status: dbApp.status as ApplicationStatus,
    appliedAt: dbApp.applied_at,
    confirmedAt: dbApp.confirmed_at,
    cancelledAt: dbApp.cancelled_at,
    workerNote: dbApp.worker_note,
    employerNote: dbApp.employer_note,
    createdAt: dbApp.created_at,
    updatedAt: dbApp.updated_at,
  };
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class ApplicationService {
  /**
   * Reserve a position for a job application.
   * This is step 1 of the application flow:
   * 1. Reserve position (locks it temporarily for 15 min)
   * 2. Worker proceeds to checkout
   * 3. After payment, confirm booking
   * 
   * Uses RPC function for atomic operation.
   */
  static async reservePosition(params: {
    positionId: string;
    workerId: string;
    jobId: string;
    jobCategoryId: string;
    workerNote?: string;
  }): Promise<
    | { success: true; applicationId: string; lockExpiresAt: string }
    | { success: false; error: string }
  > {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Call RPC function to reserve position atomically
      const { data, error } = await supabase.rpc('reserve_position', {
        position_id: params.positionId,
      });

      if (error) {
        console.error('Failed to reserve position:', error);
        return { success: false, error: error.message };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.message || 'Failed to reserve position' };
      }

      // Position is now locked. Create application record.
      const applicationData: DbApplicationInsert = {
        job_id: params.jobId,
        job_category_id: params.jobCategoryId,
        position_id: params.positionId,
        worker_id: params.workerId,
        status: 'PENDING',
        applied_at: new Date().toISOString(),
        worker_note: params.workerNote || null,
      };

      const { data: application, error: appError } = await supabase
        .from('applications')
        .insert(applicationData)
        .select()
        .single();

      if (appError || !application) {
        console.error('Failed to create application:', appError);
        // Release the position lock
        await supabase.rpc('release_position', { position_id: params.positionId });
        return { success: false, error: appError?.message || 'Failed to create application' };
      }

      return {
        success: true,
        applicationId: application.id,
        lockExpiresAt: data.lock_expires_at,
      };
    } catch (error) {
      console.error('Exception reserving position:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Confirm a booking after successful payment.
   * This is step 3 of the application flow.
   * 
   * Uses RPC function for atomic operation.
   */
  static async confirmBooking(params: {
    applicationId: string;
    paymentId?: string;
  }): Promise<{ success: true } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Get application to find position ID
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('position_id')
        .eq('id', params.applicationId)
        .single();

      if (appError || !application) {
        return { success: false, error: appError?.message || 'Application not found' };
      }

      // Call RPC function to confirm booking atomically
      const { data, error } = await supabase.rpc('confirm_booking', {
        position_id: application.position_id,
        app_id: params.applicationId,
      });

      if (error) {
        console.error('Failed to confirm booking:', error);
        return { success: false, error: error.message };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.message || 'Failed to confirm booking' };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception confirming booking:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Cancel an application.
   * Uses RPC function for atomic operation.
   */
  static async cancelApplication(
    applicationId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabase.rpc('cancel_application', {
        app_id: applicationId,
      });

      if (error) {
        console.error('Failed to cancel application:', error);
        return { success: false, error: error.message };
      }

      if (!data || !data.success) {
        return { success: false, error: data?.message || 'Failed to cancel application' };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception cancelling application:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get a single application by ID.
   */
  static async getApplication(
    applicationId: string
  ): Promise<{ success: true; application: Application } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Application not found' };
      }

      return { success: true, application: dbApplicationToApplication(data) };
    } catch (error) {
      console.error('Exception fetching application:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all applications for a worker.
   */
  static async getWorkerApplications(params: {
    workerId: string;
    status?: ApplicationStatus | ApplicationStatus[];
    limit?: number;
    offset?: number;
  }): Promise<{ success: true; applications: Application[]; total: number } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      let query = supabase
        .from('applications')
        .select('*', { count: 'exact' })
        .eq('worker_id', params.workerId);

      if (params.status) {
        if (Array.isArray(params.status)) {
          query = query.in('status', params.status);
        } else {
          query = query.eq('status', params.status);
        }
      }

      query = query.order('applied_at', { ascending: false });

      if (params.limit) {
        query = query.limit(params.limit);
      }
      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      const applications = data?.map(dbApplicationToApplication) || [];
      return { success: true, applications, total: count || applications.length };
    } catch (error) {
      console.error('Exception fetching worker applications:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all applications for a job (employer view).
   */
  static async getJobApplications(params: {
    jobId: string;
    status?: ApplicationStatus | ApplicationStatus[];
    limit?: number;
    offset?: number;
  }): Promise<{ success: true; applications: Application[]; total: number } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      let query = supabase
        .from('applications')
        .select('*', { count: 'exact' })
        .eq('job_id', params.jobId);

      if (params.status) {
        if (Array.isArray(params.status)) {
          query = query.in('status', params.status);
        } else {
          query = query.eq('status', params.status);
        }
      }

      query = query.order('applied_at', { ascending: false });

      if (params.limit) {
        query = query.limit(params.limit);
      }
      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      const applications = data?.map(dbApplicationToApplication) || [];
      return { success: true, applications, total: count || applications.length };
    } catch (error) {
      console.error('Exception fetching job applications:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check if worker has already applied to a job.
   */
  static async hasWorkerApplied(params: {
    workerId: string;
    jobId: string;
  }): Promise<{ success: true; hasApplied: boolean; applicationId?: string } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabase
        .from('applications')
        .select('id')
        .eq('worker_id', params.workerId)
        .eq('job_id', params.jobId)
        .not('status', 'in', '("CANCELLED","REJECTED","EXPIRED")')
        .maybeSingle();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        hasApplied: !!data,
        applicationId: data?.id,
      };
    } catch (error) {
      console.error('Exception checking application status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get available positions for a job category.
   * Returns positions that are OPEN (not locked or booked).
   */
  static async getAvailablePositions(params: {
    jobId: string;
    jobCategoryId?: string;
  }): Promise<{ success: true; positions: DbJobPosition[] } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      let query = supabase
        .from('job_positions')
        .select('*')
        .eq('job_id', params.jobId)
        .eq('status', 'OPEN');

      if (params.jobCategoryId) {
        query = query.eq('job_category_id', params.jobCategoryId);
      }

      query = query.order('position_number', { ascending: true });

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, positions: data || [] };
    } catch (error) {
      console.error('Exception fetching available positions:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Release expired position locks.
   * This should be called by a scheduled job periodically.
   */
  static async releaseExpiredLocks(): Promise<{ success: true; releasedCount: number } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { data, error } = await supabase.rpc('cleanup_expired_locks');

      if (error) {
        console.error('Failed to release expired locks:', error);
        return { success: false, error: error.message };
      }

      return { success: true, releasedCount: data?.released_count || 0 };
    } catch (error) {
      console.error('Exception releasing expired locks:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update application status directly (admin operation).
   * Not recommended for normal flow - use reservePosition, confirmBooking, cancelApplication instead.
   */
  static async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
    note?: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const updates: DbApplicationUpdate = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'BOOKED' || status === 'ACCEPTED') {
        updates.confirmed_at = new Date().toISOString();
      }

      if (status === 'CANCELLED') {
        updates.cancelled_at = new Date().toISOString();
      }

      if (note) {
        updates.employer_note = note;
      }

      const { error } = await supabase
        .from('applications')
        .update(updates)
        .eq('id', applicationId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception updating application:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export default ApplicationService;
