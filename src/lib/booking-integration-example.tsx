/**
 * Example of integrating the booking model into the existing work page.
 * This shows how to replace the simple mock booking with transaction‑safe slot booking.
 */

import { useEffect } from "react";
import { useBookingStore, seedMockData } from "@/lib/booking-model";

/**
 * Example integration for the work page:
 * 1. Seed mock booking data on initial load
 * 2. Convert existing job listings to use slot‑based booking
 * 3. Integrate with auth for pending actions
 */

export function useBookingIntegration() {
  const { jobs, getJobWithSlots, createJob } = useBookingStore();

  // Seed mock data if none exists
  useEffect(() => {
    if (Object.keys(jobs).length === 0) {
      seedMockData();
    }
  }, [jobs]);

  /**
   * Convert existing work page job to booking model job
   */
  function convertToBookingJob(mockJob: any) {
    // This would convert the existing mock job structure to booking model
    const job = createJob({
      employerId: 'emp_mock_1',
      title: mockJob.role,
      description: `${mockJob.role} position at ${mockJob.employer}`,
      location: mockJob.area,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startTime: '16:00',
      endTime: '22:00',
      categories: [
        {
          name: mockJob.category,
          wage: mockJob.wage,
          headcount: Math.floor(Math.random() * 5) + 1, // 1-5 slots
        },
      ],
    });
    
    return job;
  }

  /**
   * Get available slots for a job
   */
  function getAvailableSlots(jobId: string) {
    const jobWithSlots = getJobWithSlots(jobId);
    return jobWithSlots?.availableSlots || 0;
  }

  return {
    jobs,
    getAvailableSlots,
    convertToBookingJob,
  };
}

/**
 * Example of updated work page booking flow:
 * 
 * BEFORE (simple):
 * - Click "Book" → if logged out, open login modal
 * - If logged in, mark as booked
 * 
 * AFTER (transaction‑safe):
 * - Click "Book" → if logged out, open login modal with pending action
 * - If logged in:
 *   1. Find available slot for this job category
 *   2. Lock the slot (2‑min timer)
 *   3. Complete booking → slot status = booked
 *   4. If lock expires → slot becomes available again
 * 
 * Benefits:
 * - Prevents double‑booking
 * - Gives users time to complete booking
 * - Shows real‑time availability
 */

export const BOOKING_INTEGRATION_GUIDE = `
## Integrating Booking Model into Work Page

### Current Structure
The work page has mock jobs with simple booking.

### Target Structure
1. Each job becomes a booking model Job
2. Each job role becomes a Category
3. Each Category generates Slots equal to headcount
4. Booking = claiming a specific Slot

### Steps:
1. Seed booking data on app load
2. Map existing job listings to booking jobs
3. Update booking button to use slot booking
4. Show slot availability in UI
5. Handle pending actions after login

### Example UI Updates:
- "Book this shift" → "Book Slot (X available)"
- Show slot status: available/locked/booked
- Real‑time availability updates

### Migration Notes:
- Keep existing mock data for fallback
- Gradually migrate to slot‑based booking
- Maintain backward compatibility
`;