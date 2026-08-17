/**
 * Transaction‑safe booking data model for QuickWork.
 * 
 * Model:
 * - Job has multiple Categories (name, wage, headcount)
 * - Each Category generates individual Slots equal to headcount
 * - Slot status: available, locked (temp hold ~2 min), booked, expired
 * - Booking is transaction‑safe: two users can't claim the same slot.
 */

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlotStatus = 'available' | 'locked' | 'booked' | 'expired';

export interface Slot {
  id: string;
  jobId: string;
  categoryId: string;
  status: SlotStatus;
  /** When slot was locked (ISO timestamp) */
  lockedAt: string | null;
  /** User ID who booked the slot (null if not booked) */
  bookedBy: string | null;
  /** When slot was booked (ISO timestamp) */
  bookedAt: string | null;
  /** When slot expires (ISO timestamp) – used for expired/locked slots */
  expiresAt: string | null;
}

export interface Category {
  id: string;
  jobId: string;
  name: string;
  /** Wage per shift in rupees */
  wage: number;
  /** Number of slots (workers) needed for this category */
  headcount: number;
  /** Auto‑generated slots */
  slots: Slot[];
}

export interface Job {
  id: string;
  employerId: string;
  title: string;
  description: string;
  location: string;
  /** ISO date string */
  date: string;
  startTime: string;
  endTime: string;
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Lock duration in milliseconds (2 minutes) */
export const LOCK_DURATION_MS = 2 * 60 * 1000;

// ─── Booking Store (State + Actions) ──────────────────────────────────────────

interface BookingStore {
  // Data
  jobs: Record<string, Job>;
  slots: Record<string, Slot>;
  
  // Actions
  createJob: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'categories'> & {
    categories: Omit<Category, 'id' | 'jobId' | 'slots'>[];
  }) => Job;
  
  lockSlot: (slotId: string, userId: string) => {
    success: boolean;
    slot: Slot | null;
    reason?: 'already_booked' | 'already_locked' | 'expired' | 'slot_not_found';
  };
  
  bookSlot: (slotId: string, userId: string) => {
    success: boolean;
    slot: Slot | null;
    reason?: 'not_locked' | 'lock_expired' | 'already_booked' | 'slot_not_found';
  };
  
  releaseLock: (slotId: string) => void;
  
  expireLocks: () => number; // returns count of expired slots
  
  getJobWithSlots: (jobId: string) => (Job & { availableSlots: number }) | null;
  
  getCategoryWithSlots: (categoryId: string) => (Category & { 
    availableSlots: Slot[];
    lockedSlots: Slot[];
    bookedSlots: Slot[];
  }) | null;
  
  getSlotStatus: (slotId: string) => SlotStatus | 'not_found';
  
  // Internal
  _generateId: () => string;
  _cleanupExpiredLocks: () => void;
}

export const useBookingStore = create<BookingStore>()(
  (set, get) => ({
      jobs: {},
      slots: {},
      
      // ─── Create a new job with categories ──────────────────────────────────────
      createJob: (jobData) => {
        const jobId = get()._generateId();
        const now = new Date().toISOString();
        
        // Create categories and generate slots
        const categories: Category[] = jobData.categories.map(cat => {
          const categoryId = get()._generateId();
          const slots: Slot[] = Array.from({ length: cat.headcount }, (_, i) => ({
            id: get()._generateId(),
            jobId,
            categoryId,
            status: 'available',
            lockedAt: null,
            bookedBy: null,
            bookedAt: null,
            expiresAt: null,
          }));
          
          return {
            id: categoryId,
            jobId,
            name: cat.name,
            wage: cat.wage,
            headcount: cat.headcount,
            slots,
          };
        });
        
        // Collect all slots
        const allSlots: Record<string, Slot> = {};
        categories.forEach(cat => {
          cat.slots.forEach(slot => {
            allSlots[slot.id] = slot;
          });
        });
        
        const job: Job = {
          id: jobId,
          employerId: jobData.employerId,
          title: jobData.title,
          description: jobData.description,
          location: jobData.location,
          date: jobData.date,
          startTime: jobData.startTime,
          endTime: jobData.endTime,
          categories,
          createdAt: now,
          updatedAt: now,
        };
        
        set(state => ({
          jobs: { ...state.jobs, [jobId]: job },
          slots: { ...state.slots, ...allSlots },
        }));
        
        return job;
      },
      
      // ─── Lock a slot (temp hold) ──────────────────────────────────────────────
      lockSlot: (slotId, userId) => {
        const { slots } = get();
        const slot = slots[slotId];
        
        if (!slot) {
          return { success: false, slot: null, reason: 'slot_not_found' };
        }
        
        // Check if slot is already booked
        if (slot.status === 'booked') {
          return { success: false, slot: null, reason: 'already_booked' };
        }
        
        // Check if slot is already locked (and not expired)
        if (slot.status === 'locked' && slot.lockedAt) {
          const lockExpiry = new Date(slot.lockedAt).getTime() + LOCK_DURATION_MS;
          if (Date.now() < lockExpiry) {
            return { success: false, slot: null, reason: 'already_locked' };
          }
          // Lock expired, treat as available
        }
        
        // Lock the slot
        const now = new Date().toISOString();
        const lockedSlot: Slot = {
          ...slot,
          status: 'locked',
          lockedAt: now,
          expiresAt: new Date(Date.now() + LOCK_DURATION_MS).toISOString(),
        };
        
        set(state => ({
          slots: { ...state.slots, [slotId]: lockedSlot },
        }));
        
        return { success: true, slot: lockedSlot };
      },
      
      // ─── Book a slot (convert lock to booked) ────────────────────────────────
      bookSlot: (slotId, userId) => {
        const { slots } = get();
        const slot = slots[slotId];
        
        if (!slot) {
          return { success: false, slot: null, reason: 'slot_not_found' };
        }
        
        // Check if slot is already booked
        if (slot.status === 'booked') {
          return { success: false, slot: null, reason: 'already_booked' };
        }
        
        // Check if slot is locked (and not expired)
        if (slot.status === 'locked' && slot.lockedAt) {
          const lockExpiry = new Date(slot.lockedAt).getTime() + LOCK_DURATION_MS;
          if (Date.now() >= lockExpiry) {
            // Lock expired
            const expiredSlot: Slot = {
              ...slot,
              status: 'expired',
              lockedAt: null,
              expiresAt: null,
            };
            set(state => ({
              slots: { ...state.slots, [slotId]: expiredSlot },
            }));
            return { success: false, slot: null, reason: 'lock_expired' };
          }
          
          // Lock is valid, book the slot
          const now = new Date().toISOString();
          const bookedSlot: Slot = {
            ...slot,
            status: 'booked',
            bookedBy: userId,
            bookedAt: now,
            expiresAt: null,
            lockedAt: null,
          };
          
          set(state => ({
            slots: { ...state.slots, [slotId]: bookedSlot },
          }));
          
          return { success: true, slot: bookedSlot };
        }
        
        // Slot is not locked
        return { success: false, slot: null, reason: 'not_locked' };
      },
      
      // ─── Release a lock (make slot available again) ──────────────────────────
      releaseLock: (slotId) => {
        const { slots } = get();
        const slot = slots[slotId];
        
        if (!slot || slot.status !== 'locked') return;
        
        const availableSlot: Slot = {
          ...slot,
          status: 'available',
          lockedAt: null,
          expiresAt: null,
        };
        
        set(state => ({
          slots: { ...state.slots, [slotId]: availableSlot },
        }));
      },
      
      // ─── Expire old locks ────────────────────────────────────────────────────
      expireLocks: () => {
        const { slots } = get();
        let expiredCount = 0;
        
        const updatedSlots = { ...slots };
        Object.keys(updatedSlots).forEach(slotId => {
          const slot = updatedSlots[slotId];
          if (slot.status === 'locked' && slot.lockedAt) {
            const lockExpiry = new Date(slot.lockedAt).getTime() + LOCK_DURATION_MS;
            if (Date.now() >= lockExpiry) {
              updatedSlots[slotId] = {
                ...slot,
                status: 'expired',
                lockedAt: null,
                expiresAt: null,
              };
              expiredCount++;
            }
          }
        });
        
        if (expiredCount > 0) {
          set({ slots: updatedSlots });
        }
        
        return expiredCount;
      },
      
      // ─── Get job with slot counts ────────────────────────────────────────────
      getJobWithSlots: (jobId) => {
        const { jobs, slots } = get();
        const job = jobs[jobId];
        
        if (!job) return null;
        
        let availableSlots = 0;
        Object.values(slots).forEach(slot => {
          if (slot.jobId === jobId && slot.status === 'available') {
            availableSlots++;
          }
        });
        
        return { ...job, availableSlots };
      },
      
      // ─── Get category with organized slots ───────────────────────────────────
      getCategoryWithSlots: (categoryId) => {
        const { jobs, slots } = get();
        
        // Find the category
        let targetCategory: Category | null = null;
        for (const job of Object.values(jobs)) {
          const cat = job.categories.find(c => c.id === categoryId);
          if (cat) {
            targetCategory = cat;
            break;
          }
        }
        
        if (!targetCategory) return null;
        
        // Organize slots
        const availableSlots: Slot[] = [];
        const lockedSlots: Slot[] = [];
        const bookedSlots: Slot[] = [];
        
        targetCategory.slots.forEach(slotId => {
          const slot = slots[slotId.id];
          if (!slot) return;
          
          switch (slot.status) {
            case 'available':
              availableSlots.push(slot);
              break;
            case 'locked':
              lockedSlots.push(slot);
              break;
            case 'booked':
              bookedSlots.push(slot);
              break;
          }
        });
        
        return {
          ...targetCategory,
          availableSlots,
          lockedSlots,
          bookedSlots,
        };
      },
      
      // ─── Get slot status ─────────────────────────────────────────────────────
      getSlotStatus: (slotId) => {
        const { slots } = get();
        const slot = slots[slotId];
        return slot?.status ?? 'not_found';
      },
      
      // ─── Internal helpers ────────────────────────────────────────────────────
      _generateId: () => {
        return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      },
      
      _cleanupExpiredLocks: () => {
        // This runs on every state update automatically
        const { expireLocks } = get();
        expireLocks();
      },
    })
  );

// ─── Initial Mock Data ────────────────────────────────────────────────────────

export function seedMockData() {
  const { createJob } = useBookingStore.getState();
  
  // Create some sample jobs
  const sampleJobs = [
    {
      employerId: 'emp_1',
      title: 'Banquet Staff Needed for Wedding',
      description: 'Looking for experienced banquet staff for a high-end wedding event. Uniform will be provided.',
      location: 'Andheri East, Mumbai',
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
      startTime: '16:00',
      endTime: '23:00',
      categories: [
        { name: 'Banquet Server', wage: 1200, headcount: 8 },
        { name: 'Kitchen Helper', wage: 950, headcount: 4 },
        { name: 'Bartender', wage: 1500, headcount: 2 },
      ],
    },
    {
      employerId: 'emp_2',
      title: 'Warehouse Loading Staff',
      description: 'Urgently need warehouse loading staff for weekend shift. Must be able to lift 20kg+',
      location: 'Bhiwandi, Mumbai',
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // tomorrow
      startTime: '10:00',
      endTime: '18:00',
      categories: [
        { name: 'Warehouse Loader', wage: 1100, headcount: 12 },
        { name: 'Forklift Operator', wage: 1800, headcount: 3 },
      ],
    },
  ];
  
  sampleJobs.forEach(job => createJob(job));
}

// ─── Transaction‑safe booking hook ────────────────────────────────────────────

export function useBookingTransaction() {
  const {
    lockSlot,
    bookSlot,
    releaseLock,
    getSlotStatus,
    getCategoryWithSlots,
  } = useBookingStore();
  
  /**
   * Attempt to lock and book a slot in a transaction‑safe way.
   * Returns the final slot state and success/failure.
   */
  async function attemptBooking(slotId: string, userId: string): Promise<{
    success: boolean;
    slot: Slot | null;
    error?: string;
  }> {
    // Step 1: Try to lock the slot
    const lockResult = lockSlot(slotId, userId);
    if (!lockResult.success) {
      return {
        success: false,
        slot: null,
        error: lockResult.reason === 'already_booked' 
          ? 'This slot has already been booked by someone else.'
          : 'This slot is currently unavailable.',
      };
    }
    
    // Simulate network delay (in real app, this would be server round‑trip)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 2: Immediately try to book the locked slot
    const bookResult = bookSlot(slotId, userId);
    
    if (!bookResult.success) {
      // If booking failed, release the lock
      releaseLock(slotId);
      
      return {
        success: false,
        slot: null,
        error: bookResult.reason === 'lock_expired'
          ? 'Your booking session expired. Please try again.'
          : 'Booking failed. Please try again.',
      };
    }
    
    return {
      success: true,
      slot: bookResult.slot,
    };
  }
  
  /**
   * Check if a slot is bookable (available or lockable).
   */
  function isSlotBookable(slotId: string): {
    bookable: boolean;
    reason?: string;
    status: SlotStatus | 'not_found';
  } {
    const status = getSlotStatus(slotId);
    
    if (status === 'not_found') {
      return { bookable: false, reason: 'Slot not found', status };
    }
    
    if (status === 'available') {
      return { bookable: true, status };
    }
    
    if (status === 'locked') {
      // Check if lock is expired
      const slot = useBookingStore.getState().slots[slotId];
      if (slot?.lockedAt) {
        const lockExpiry = new Date(slot.lockedAt).getTime() + LOCK_DURATION_MS;
        if (Date.now() >= lockExpiry) {
          return { bookable: true, status: 'expired' };
        }
      }
      return { bookable: false, reason: 'Slot is temporarily locked', status };
    }
    
    if (status === 'booked') {
      return { bookable: false, reason: 'Slot already booked', status };
    }
    
    return { bookable: false, reason: 'Slot expired', status };
  }
  
  return {
    attemptBooking,
    isSlotBookable,
    lockSlot,
    bookSlot,
    releaseLock,
    getCategoryWithSlots,
  };
}