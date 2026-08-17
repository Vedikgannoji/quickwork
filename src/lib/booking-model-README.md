# Booking Data Model - QuickWork

## Overview

This module implements a transaction‑safe booking system for QuickWork's worker‑employer marketplace.

## Data Model Hierarchy

```
Job
├── employerId
├── title, description, location, date, times
└── Categories[]
    ├── name (e.g., "Banquet Server")
    ├── wage (₹ per shift)
    ├── headcount (number of workers needed)
    └── Slots[] (auto‑generated, count = headcount)
        ├── status: available | locked | booked | expired
        ├── lockedAt (timestamp when locked)
        ├── bookedBy (user ID)
        └── expiresAt (when lock/booking expires)
```

## Slot Status Lifecycle

```
available → [lock] → locked → [book] → booked
    ↑                                    ↓
    └────── [expire/auto‑cleanup] ←──────┘
```

## Transaction Safety

The booking flow ensures two users can't claim the same slot:

1. **Lock Phase** (2 minutes):
   - When a user attempts to book, the slot enters `locked` state
   - No other user can lock or book the same slot
   - Lock expires automatically after 2 minutes

2. **Booking Phase**:
   - User must complete booking within lock period
   - If successful → slot becomes `booked`
   - If lock expires → slot becomes `expired` then `available`

3. **Concurrent Booking Protection**:
   - Atomic state transitions (lock → booked)
   - Status checks prevent double‑booking
   - Cleanup job expires old locks automatically

## Key Components

### 1. Types (`booking-model.ts`)
- `SlotStatus`: Enum of possible slot states
- `Slot`, `Category`, `Job`: Core data structures
- `LOCK_DURATION_MS`: 2 minutes (configurable)

### 2. Store (`useBookingStore`)
- Zustand‑based state management
- Methods: `createJob`, `lockSlot`, `bookSlot`, `releaseLock`, etc.
- Auto‑cleanup of expired locks

### 3. Transaction Hook (`useBookingTransaction`)
- `attemptBooking(slotId, userId)`: Complete lock‑and‑book flow
- `isSlotBookable(slotId)`: Check if slot can be booked
- Transaction‑safe wrapper around store methods

### 4. UI Components
- `JobSlotBooking`: Shows all slots in a category with booking buttons
- `SimpleBookingButton`: Single‑slot booking button
- `BookingDemo`: Full demo page (`/booking-demo` route)

## Usage Examples

### Creating a Job with Categories
```typescript
const { createJob } = useBookingStore();
const job = createJob({
  employerId: 'emp_123',
  title: 'Wedding Banquet Staff',
  description: '...',
  location: 'Mumbai',
  date: '2024-08-20',
  startTime: '16:00',
  endTime: '23:00',
  categories: [
    { name: 'Banquet Server', wage: 1200, headcount: 8 },
    { name: 'Bartender', wage: 1500, headcount: 2 },
  ],
});
```

### Booking a Slot
```typescript
const { attemptBooking } = useBookingTransaction();

const result = await attemptBooking(slotId, userId);
if (result.success) {
  console.log('Booked!', result.slot);
} else {
  console.log('Failed:', result.error);
}
```

### Checking Slot Availability
```typescript
const { isSlotBookable } = useBookingTransaction();
const { bookable, reason, status } = isSlotBookable(slotId);
```

## Integration with Existing Auth

The booking model works with the existing auth system:
- `AuthContext` provides `user.id` for `bookedBy`
- Login modal gates booking actions
- Auto‑resume of pending actions after login

## Testing Transaction Safety

1. Open `/booking-demo` in two browser tabs
2. In Tab 1, book a slot → it locks for 2 minutes
3. In Tab 2, try to book the same slot → fails
4. Wait 2+ minutes → lock expires
5. In Tab 2, try again → now succeeds

## Production Considerations

This demo uses in‑memory Zustand storage. In production:

1. **Database Backend**:
   - Use PostgreSQL with row‑level locking
   - Use `SELECT ... FOR UPDATE SKIP LOCKED` for concurrency
   - Scheduled jobs to clean expired locks

2. **Scalability**:
   - Redis for distributed locks
   - Message queue for booking events
   - Retry logic for failed transactions

3. **Monitoring**:
   - Track lock expiration rates
   - Monitor double‑booking attempts
   - Alert on high contention

## API Reference

See TypeScript definitions in `booking-model.ts` for full API documentation.