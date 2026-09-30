/**
 * Supabase Database Type Definitions
 *
 * Auto-generated structure aligned with the schema in:
 *   supabase/migrations/20261001000000_initial_schema.sql
 *
 * After connecting to a real Supabase project run:
 *   supabase gen types typescript --project-id <your-project-id> > src/lib/database.types.ts
 * to regenerate with exact column precision.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Position / Application Status Literals ───────────────────────────────────

export type PositionStatus = "AVAILABLE" | "PENDING" | "BOOKED" | "CANCELLED";

export type ApplicationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type JobStatus =
  | "Open"
  | "PartiallyFilled"
  | "FullyFilled"
  | "Completed"
  | "Cancelled";

// ─── Database Shape ────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      // ── profiles ───────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id: string;                   // uuid — matches auth.users.id
          name: string | null;
          phone: string | null;
          email: string | null;
          avatar_url: string | null;
          location: string | null;
          profile_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          profile_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          phone?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          profile_complete?: boolean;
          updated_at?: string;
        };
      };

      // ── jobs ───────────────────────────────────────────────────────────────
      jobs: {
        Row: {
          id: string;
          employer_id: string;
          job_title: string;
          category: string;
          description: string;
          job_type: string;
          venue_name: string;
          full_address: string;
          area: string;
          city: string;
          landmark: string | null;
          job_date: string;             // ISO date string "YYYY-MM-DD"
          start_time: string;           // "HH:MM:SS"
          end_time: string;             // "HH:MM:SS"
          facilities: string[];
          requirements: Json;
          instructions: Json;
          reporting_contact: Json;
          is_rapid_job: boolean;
          rapid_job_expires_at: string | null;
          status: JobStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employer_id: string;
          job_title: string;
          category: string;
          description: string;
          job_type?: string;
          venue_name: string;
          full_address: string;
          area: string;
          city: string;
          landmark?: string | null;
          job_date: string;
          start_time: string;
          end_time: string;
          facilities?: string[];
          requirements?: Json;
          instructions?: Json;
          reporting_contact?: Json;
          is_rapid_job?: boolean;
          rapid_job_expires_at?: string | null;
          status?: JobStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          job_title?: string;
          category?: string;
          description?: string;
          job_type?: string;
          venue_name?: string;
          full_address?: string;
          area?: string;
          city?: string;
          landmark?: string | null;
          job_date?: string;
          start_time?: string;
          end_time?: string;
          facilities?: string[];
          requirements?: Json;
          instructions?: Json;
          reporting_contact?: Json;
          is_rapid_job?: boolean;
          rapid_job_expires_at?: string | null;
          status?: JobStatus;
          updated_at?: string;
        };
      };

      // ── job_categories ─────────────────────────────────────────────────────
      job_categories: {
        Row: {
          id: string;
          job_id: string;
          name: string;
          description: string | null;
          required_workers: number;
          wage: number;                 // rupees per shift
          requirements: Json;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          name: string;
          description?: string | null;
          required_workers: number;
          wage: number;
          requirements?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          required_workers?: number;
          wage?: number;
          requirements?: Json;
          sort_order?: number;
          updated_at?: string;
        };
      };

      // ── job_positions ──────────────────────────────────────────────────────
      job_positions: {
        Row: {
          id: string;
          job_id: string;
          job_category_id: string;
          position_number: number;
          status: PositionStatus;
          worker_id: string | null;
          application_id: string | null;
          locked_at: string | null;
          lock_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          job_category_id: string;
          position_number: number;
          status?: PositionStatus;
          worker_id?: string | null;
          application_id?: string | null;
          locked_at?: string | null;
          lock_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: PositionStatus;
          worker_id?: string | null;
          application_id?: string | null;
          locked_at?: string | null;
          lock_expires_at?: string | null;
          updated_at?: string;
        };
      };

      // ── applications ───────────────────────────────────────────────────────
      applications: {
        Row: {
          id: string;
          worker_id: string;
          job_id: string;
          job_category_id: string;
          position_id: string;
          status: ApplicationStatus;
          worker_note: string | null;
          employer_note: string | null;
          applied_at: string;
          confirmed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          job_id: string;
          job_category_id: string;
          position_id: string;
          status?: ApplicationStatus;
          worker_note?: string | null;
          employer_note?: string | null;
          applied_at?: string;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: ApplicationStatus;
          worker_note?: string | null;
          employer_note?: string | null;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          updated_at?: string;
        };
      };
    };

    Views: {
      // ── job_positions_public ───────────────────────────────────────────────
      job_positions_public: {
        Row: {
          id: string;
          job_id: string;
          job_category_id: string;
          position_number: number;
          status: PositionStatus;
          lock_expires_at: string | null;   // only present when status = PENDING
          my_worker_id: string | null;       // only non-null if current user holds the lock
          my_application_id: string | null;  // only non-null if current user booked this
          created_at: string;
          updated_at: string;
        };
      };
    };

    Functions: {
      // ── RPC return shapes ──────────────────────────────────────────────────
      reserve_position: {
        Args: { p_position_id: string; p_worker_id: string };
        Returns: Json;
        // { success: true, position_id, lock_expires_at, lock_seconds }
        // { success: false, error: string }
      };
      confirm_booking: {
        Args: { p_position_id: string; p_worker_id: string; p_worker_note?: string };
        Returns: Json;
        // { success: true, application_id, position_id }
        // { success: false, error: string }
      };
      release_position: {
        Args: { p_position_id: string; p_worker_id: string };
        Returns: Json;
        // { success: true, position_id }
        // { success: false, error: string }
      };
      cancel_application: {
        Args: { p_application_id: string; p_worker_id: string };
        Returns: Json;
        // { success: true, application_id }
        // { success: false, error: string }
      };
      cleanup_expired_locks: {
        Args: Record<string, never>;
        Returns: number;
      };
    };

    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ─── Convenience Type Aliases ─────────────────────────────────────────────────

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];

export type JobCategory = Database["public"]["Tables"]["job_categories"]["Row"];
export type JobCategoryInsert = Database["public"]["Tables"]["job_categories"]["Insert"];
export type JobCategoryUpdate = Database["public"]["Tables"]["job_categories"]["Update"];

export type JobPosition = Database["public"]["Tables"]["job_positions"]["Row"];
export type JobPositionInsert = Database["public"]["Tables"]["job_positions"]["Insert"];
export type JobPositionUpdate = Database["public"]["Tables"]["job_positions"]["Update"];

export type JobPositionPublic = Database["public"]["Views"]["job_positions_public"]["Row"];

export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];
export type ApplicationUpdate = Database["public"]["Tables"]["applications"]["Update"];

// ─── RPC Result Types ─────────────────────────────────────────────────────────

export interface ReservePositionResult {
  success: true;
  position_id: string;
  lock_expires_at: string;
  lock_seconds: number;
}
export interface ReservePositionError {
  success: false;
  error:
    | "position_not_found"
    | "job_not_accepting"
    | "position_locked_by_another_worker"
    | "position_already_booked"
    | "position_unavailable"
    | "worker_already_has_active_application";
}
export type ReservePositionResponse = ReservePositionResult | ReservePositionError;

export interface ConfirmBookingResult {
  success: true;
  application_id: string;
  position_id: string;
}
export interface ConfirmBookingError {
  success: false;
  error:
    | "position_not_found"
    | "position_already_booked"
    | "no_active_lock"
    | "position_cancelled"
    | "position_unavailable"
    | "lock_owned_by_different_worker"
    | "lock_expired";
}
export type ConfirmBookingResponse = ConfirmBookingResult | ConfirmBookingError;

export interface CancelApplicationResult {
  success: true;
  application_id: string;
}
export interface CancelApplicationError {
  success: false;
  error:
    | "application_not_found"
    | "not_your_application"
    | "application_not_cancellable";
}
export type CancelApplicationResponse =
  | CancelApplicationResult
  | CancelApplicationError;
