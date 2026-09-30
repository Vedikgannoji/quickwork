# Job Data Model Expansion - Summary

## Overview
The Job data model has been expanded with new fields while maintaining backward compatibility with the existing booking system.

## New Files Created

### 1. `src/lib/job-types.ts` ✅
Comprehensive type definitions for jobs including:

- **Enums:**
  - `JobCategory`: Hospitality, Events, Delivery, Retail, Construction, Warehouse, Cleaning, Other
  - `JobType`: OneTime ("one-time"), MultipleDays ("multiple-days"), Recurring ("recurring")

- **Type Aliases:**
  - `JobCategoryValue`: String literal union for category values
  - `JobTypeValue`: String literal union for job type values

- **Core Interface:**
  ```typescript
  interface BaseJob {
    id: string;
    employerId: string;
    
    // New fields
    jobTitle: string;
    category: JobCategoryValue;
    description: string;
    
    // Existing fields
    location: string;
    date: string;
    startTime: string;
    endTime: string;
    duration?: number; // Calculated
    
    // New fields
    jobType: JobTypeValue;
    
    // Facilities
    facilities?: string[];
    
    // Metadata
    createdAt: string;
    updatedAt: string;
  }
  ```

- **Helper Functions:**
  - `calculateDuration(startTime, endTime)`: Calculates duration in minutes, handles overnight shifts
  - `formatDuration(minutes)`: Formats duration to "8h 30m" style
  - `isValidJobCategory(value)`: Type guard for category validation
  - `isValidJobType(value)`: Type guard for job type validation
  - `toJobListing(job, options)`: Converts BaseJob to simplified JobListing

- **Display Labels:**
  - `JOB_CATEGORY_LABELS`: Map of category values to display names
  - `JOB_TYPE_LABELS`: Map of job type values to display names

- **Legacy Support:**
  - `JobListing` interface for browse/search pages (backward compatible)

## Updated Files

### 2. `src/lib/booking-model.ts` ✅
Extended the Job interface while maintaining booking functionality:

```typescript
export interface Job {
  id: string;
  employerId: string;
  
  // New required fields
  jobTitle: string;
  category: JobCategoryValue;
  description: string;
  
  // Location
  location: string;
  
  // Timing
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // Auto-calculated on creation
  
  // Job type
  jobType: JobTypeValue;
  
  // Facilities (job-level)
  facilities?: string[];
  
  // Booking-specific
  categories: Category[]; // Role categories with wages/slots
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}
```

**Key Changes:**
- Job now extends the new expanded model
- `duration` is automatically calculated from `startTime` and `endTime` during `createJob()`
- Mock data updated to include all new fields (`jobTitle`, `category`, `jobType`, `facilities`)
- Imports `JobCategoryValue`, `JobTypeValue`, and `calculateDuration` from `job-types.ts`

## Field Mapping (Old → New)

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `title` | `jobTitle` | Renamed for clarity |
| `description` | `description` | ✅ Already existed |
| - | `category` | **NEW** (enum) |
| `location` | `location` | ✅ Existing |
| `date` | `date` | ✅ Existing |
| `startTime` | `startTime` | ✅ Existing |
| `endTime` | `endTime` | ✅ Existing |
| - | `duration` | **NEW** (calculated) |
| - | `jobType` | **NEW** (enum) |
| - | `facilities` | **NEW** (array) |
| `categories` | `categories` | ✅ Existing (booking slots) |

## Duration Calculation

Duration is automatically calculated when creating a job:
```typescript
const duration = calculateDuration("09:00", "17:30"); // 510 minutes (8h 30m)
```

**Features:**
- Handles overnight shifts (e.g., "22:00" to "06:00" = 8 hours)
- Returns duration in minutes
- Can be formatted using `formatDuration()` helper

## Usage Examples

### Creating a Job
```typescript
import { useBookingStore } from '@/lib/booking-model';
import type { JobCategoryValue, JobTypeValue } from '@/lib/job-types';

const { createJob } = useBookingStore();

const job = createJob({
  employerId: 'emp_123',
  jobTitle: 'Banquet Staff for Wedding',
  category: 'Hospitality' as JobCategoryValue,
  description: 'Need experienced banquet staff...',
  location: 'Andheri East, Mumbai',
  date: '2024-01-15',
  startTime: '16:00',
  endTime: '23:00',
  jobType: 'one-time' as JobTypeValue,
  facilities: ['Meals provided', 'Uniform', 'Transport'],
  categories: [
    { name: 'Banquet Server', wage: 1200, headcount: 8 },
    { name: 'Kitchen Helper', wage: 950, headcount: 4 },
  ],
});

// Duration is auto-calculated: 7 hours (420 minutes)
console.log(job.duration); // 420
```

### Using Helper Functions
```typescript
import { calculateDuration, formatDuration, isValidJobCategory } from '@/lib/job-types';

// Calculate duration
const minutes = calculateDuration('09:00', '17:30'); // 510

// Format for display
const formatted = formatDuration(minutes); // "8h 30m"

// Validate category
if (isValidJobCategory(userInput)) {
  // TypeScript knows userInput is JobCategoryValue
}
```

## TypeScript Benefits

1. **Type Safety**: All category and job type values are strongly typed
2. **Autocomplete**: IDEs will suggest valid enum values
3. **Validation**: Helper functions provide runtime validation with type guards
4. **Backward Compatible**: Existing `JobListing` interface preserved for UI components
5. **Calculated Fields**: Duration is automatically calculated and included in Job type

## Next Steps (UI Integration)

The schema is ready. When updating UI components:

1. **Job Creation Forms** (`/hire`, `/post-job`):
   - Add category dropdown (use `JOB_CATEGORY_LABELS`)
   - Add job type selector (use `JOB_TYPE_LABELS`)
   - Add description textarea
   - Rename "title" to "jobTitle"
   - Add duration display (use `formatDuration()`)

2. **Job Listing Pages** (`/work`):
   - Display category badge (styled by category)
   - Show duration alongside time ("9:00 AM - 5:30 PM • 8h 30m")
   - Filter by category
   - Show job type indicator for recurring/multiple-day jobs

3. **Job Detail Pages**:
   - Display full description
   - Show facilities as badges
   - Highlight job type (especially recurring jobs)
   - Show calculated duration

## Files to Review Before UI Changes

- `src/routes/work.tsx` - Browse jobs page (uses simplified Job type)
- `src/routes/hire.tsx` - Post job page
- `src/routes/post-job.tsx` - 4-step wizard
- `src/components/job-slot-booking.tsx` - Booking component

## Mock Data Updated

Both sample jobs in `seedMockData()` now include all new fields:
- ✅ jobTitle (was "title")
- ✅ category (Hospitality, Warehouse)
- ✅ description
- ✅ jobType (all "one-time")
- ✅ facilities arrays
- ✅ duration (auto-calculated)

## Status

✅ Schema complete - No UI changes made yet  
✅ TypeScript types defined  
✅ Helper functions implemented  
✅ Mock data updated  
✅ Backward compatibility maintained  
⏳ UI components unchanged (as requested)
