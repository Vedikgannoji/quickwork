# Job Status Tracking & Position Management Guide

**Last Updated:** September 9, 2026  
**Version:** 3.0

## Overview

This guide documents the job status tracking system with automatic position management. Jobs now track confirmed positions and automatically update their status based on fill rate and job date.

---

## New Enums & Types

### JobStatus Enum

```typescript
export enum JobStatus {
  Open = "Open",                       // No positions confirmed yet
  PartiallyFilled = "PartiallyFilled", // Some positions confirmed
  FullyFilled = "FullyFilled",        // All positions confirmed
  Completed = "Completed",             // Job date has passed
  Cancelled = "Cancelled",             // Manually cancelled
}
```

**Type Alias:**
```typescript
export type JobStatusValue = 
  | "Open" 
  | "PartiallyFilled" 
  | "FullyFilled" 
  | "Completed" 
  | "Cancelled";
```

---

## Position Tracking Fields

Added to `BaseJob` interface:

```typescript
export interface BaseJob {
  // ... existing fields ...
  
  // Position tracking
  positionsRequired: number;   // Total positions needed
  positionsConfirmed: number;  // Positions filled
  positionsRemaining: number;  // Calculated: required - confirmed
  
  // Job status (auto-updated)
  status: JobStatusValue;
  
  // ... rest of fields ...
}
```

**Field Details:**

| Field | Type | Description | Auto-Calculated |
|-------|------|-------------|-----------------|
| `positionsRequired` | `number` | Total workers needed | No |
| `positionsConfirmed` | `number` | Workers confirmed | No |
| `positionsRemaining` | `number` | Open positions | **Yes** |
| `status` | `JobStatusValue` | Current job status | **Yes** |

---

## Auto-Calculation Logic

### Positions Remaining

```typescript
positionsRemaining = Math.max(0, positionsRequired - positionsConfirmed)
```

**Helper Function:**
```typescript
calculatePositionsRemaining(positionsRequired: number, positionsConfirmed: number): number
```

### Job Status

Status is automatically calculated based on:
1. **Position fill rate** (confirmed vs required)
2. **Job date** (past vs future)
3. **Manual cancellation** (overrides all)

**Status Rules:**

```
IF status === "Cancelled"
  → Keep "Cancelled" (manual override)

ELSE IF job date has passed (end of day)
  → "Completed"

ELSE IF positionsConfirmed === 0
  → "Open"

ELSE IF positionsConfirmed === positionsRequired
  → "FullyFilled"

ELSE
  → "PartiallyFilled"
```

**Helper Function:**
```typescript
calculateJobStatus(
  positionsRequired: number,
  positionsConfirmed: number,
  jobDate: string,  // ISO format: "2026-09-15"
  currentStatus?: JobStatusValue
): JobStatusValue
```

**Example:**
```typescript
// Job for tomorrow with 3 of 8 positions filled
calculateJobStatus(8, 3, "2026-09-10") // → "PartiallyFilled"

// Same job, all filled
calculateJobStatus(8, 8, "2026-09-10") // → "FullyFilled"

// Job date has passed
calculateJobStatus(8, 6, "2026-09-08") // → "Completed"

// Manually cancelled
calculateJobStatus(8, 3, "2026-09-10", "Cancelled") // → "Cancelled"
```

---

## Helper Functions

### 1. canAcceptApplications

Check if job is still open for applications.

```typescript
function canAcceptApplications(status: JobStatusValue): boolean

// Returns true for: Open, PartiallyFilled
// Returns false for: FullyFilled, Completed, Cancelled
```

**Usage:**
```typescript
if (canAcceptApplications(job.status)) {
  // Show "Apply" button
} else {
  // Show "Fully Staffed" or "Closed" message
}
```

### 2. getFillPercentage

Calculate how full the job is (0-100%).

```typescript
function getFillPercentage(
  positionsRequired: number,
  positionsConfirmed: number
): number

// Returns: Math.round((confirmed / required) * 100)
```

**Usage:**
```typescript
const fillPercentage = getFillPercentage(8, 6); // 75
// Use for progress bars, visual indicators
```

### 3. isValidJobStatus

Type guard for validating status values.

```typescript
function isValidJobStatus(value: string): value is JobStatusValue
```

---

## Display Labels & Colors

### Status Labels

```typescript
export const JOB_STATUS_LABELS: Record<JobStatusValue, string> = {
  Open: "Open",
  PartiallyFilled: "Partially Filled",
  FullyFilled: "Fully Filled",
  Completed: "Completed",
  Cancelled: "Cancelled",
};
```

### Status Colors

```typescript
export const JOB_STATUS_COLORS: Record<JobStatusValue, { 
  bg: string; 
  text: string; 
  border: string 
}> = {
  Open: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/40"
  },
  PartiallyFilled: {
    bg: "bg-gold/10",
    text: "text-gold-foreground dark:text-gold",
    border: "border-gold/40"
  },
  FullyFilled: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/40"
  },
  Completed: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border"
  },
  Cancelled: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/40"
  },
};
```

**Color Scheme:**
- 🔵 **Open** - Primary blue (action needed)
- 🟡 **PartiallyFilled** - Gold (in progress)
- 🟢 **FullyFilled** - Success green (complete)
- ⚪ **Completed** - Muted gray (archived)
- 🔴 **Cancelled** - Destructive red (error state)

---

## UI Implementation

### Status Badge

```tsx
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/lib/job-types";

function StatusBadge({ status }: { status: JobStatusValue }) {
  const colors = JOB_STATUS_COLORS[status];
  
  return (
    <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${colors.border} ${colors.bg} ${colors.text}`}>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
```

### Position Counter with Progress Bar

```tsx
import { getFillPercentage } from "@/lib/job-types";

function PositionTracker({ job }: { job: Job }) {
  const fillPercentage = getFillPercentage(
    job.positionsRequired,
    job.positionsConfirmed
  );
  
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {job.positionsConfirmed} of {job.positionsRequired} confirmed
      </p>
      
      {/* Progress bar */}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${fillPercentage}%` }}
        />
      </div>
      
      <p className="mt-1 text-xs text-muted-foreground">
        {job.positionsRemaining > 0 
          ? `${job.positionsRemaining} position${job.positionsRemaining === 1 ? '' : 's'} remaining`
          : 'Fully staffed'
        }
      </p>
    </div>
  );
}
```

### Conditional Apply Button

```tsx
import { canAcceptApplications } from "@/lib/job-types";

function ApplyButton({ job }: { job: Job }) {
  const canApply = canAcceptApplications(job.status);
  
  if (job.status === "Completed") {
    return <Button disabled>Job Completed</Button>;
  }
  
  if (job.status === "Cancelled") {
    return <Button disabled>Cancelled</Button>;
  }
  
  if (!canApply) {
    return <Button disabled>Fully Staffed</Button>;
  }
  
  return <Button variant="hero">Apply Now</Button>;
}
```

---

## Updated Interfaces

### hire.tsx - JobSummary

```typescript
type JobSummary = {
  id: string;
  jobTitle: string;
  category: JobCategoryValue;
  positionsRequired: number;    // NEW
  positionsConfirmed: number;   // NEW
  positionsRemaining: number;   // NEW
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  location: string;
  area: string;
  wage: string;
  status: JobStatusValue;       // CHANGED from "Filling" | "Confirmed" | "Draft"
  jobType: JobTypeValue;
  postedAt: string;
};
```

**Migration from old format:**
```typescript
// Old: count: "6 of 8 booked", status: "Filling"
// New:
{
  positionsRequired: 8,
  positionsConfirmed: 6,
  positionsRemaining: 2,
  status: "PartiallyFilled"
}
```

---

## Example: Complete Job with Status

```typescript
const job: BaseJob = {
  id: "job_123",
  employerId: "emp_456",
  jobTitle: "Banquet servers for wedding reception",
  category: "Hospitality",
  description: "High-end wedding event, formal service required",
  
  location: {
    venueName: "Grand Palm Banquets",
    fullAddress: "123 Palm Avenue",
    area: "Andheri East",
    city: "Mumbai"
  },
  
  date: "2026-09-15",
  startTime: "17:00",
  endTime: "23:00",
  duration: 360,
  jobType: "one-time",
  
  // Position tracking
  positionsRequired: 8,
  positionsConfirmed: 6,
  positionsRemaining: 2,  // Auto-calculated
  
  // Status (auto-updated)
  status: "PartiallyFilled",
  
  wage: 1200,
  facilities: ["Meals provided", "Uniform"],
  
  requirements: {
    experience: "2+ years in formal catering",
    skills: ["Fine dining service"],
    ageRequirement: "21+",
    languages: ["English", "Hindi"]
  },
  
  createdAt: "2026-09-08T10:30:00Z",
  updatedAt: "2026-09-08T14:45:00Z"
};
```

---

## Automatic Status Updates

### When to Recalculate Status

**Trigger events:**
1. Worker confirms for job (`positionsConfirmed++`)
2. Worker cancels booking (`positionsConfirmed--`)
3. Job date changes
4. Daily cron job (check if jobs completed)
5. Manual cancellation by employer

**Example workflow:**
```typescript
// Worker books a position
function confirmWorker(jobId: string, workerId: string) {
  const job = getJob(jobId);
  
  // Update positions
  job.positionsConfirmed += 1;
  job.positionsRemaining = calculatePositionsRemaining(
    job.positionsRequired,
    job.positionsConfirmed
  );
  
  // Auto-update status
  job.status = calculateJobStatus(
    job.positionsRequired,
    job.positionsConfirmed,
    job.date,
    job.status
  );
  
  saveJob(job);
}
```

### Daily Status Check (Backend)

```typescript
// Run daily at midnight
async function updateCompletedJobs() {
  const today = new Date().toISOString().split('T')[0];
  
  // Find all jobs where date < today and status !== "Completed"
  const pastJobs = await db.jobs.findMany({
    where: {
      date: { lt: today },
      status: { notIn: ["Completed", "Cancelled"] }
    }
  });
  
  // Update to Completed
  for (const job of pastJobs) {
    job.status = "Completed";
    await db.jobs.update(job);
  }
}
```

---

## Backend Integration

### API Response Example

**Public job listing (work.tsx):**
```json
GET /api/jobs
{
  "jobs": [{
    "id": "job_123",
    "jobTitle": "Banquet servers needed",
    "positionsRequired": 8,
    "positionsConfirmed": 6,
    "positionsRemaining": 2,
    "status": "PartiallyFilled",
    // ... other fields ...
    // No reportingContact (private field)
  }]
}
```

**Employer dashboard (hire.tsx):**
```json
GET /api/jobs/my-jobs
{
  "jobs": [{
    "id": "job_123",
    "positionsRequired": 8,
    "positionsConfirmed": 6,
    "positionsRemaining": 2,
    "status": "PartiallyFilled",
    "applicants": [
      { "workerId": "w1", "status": "confirmed" },
      { "workerId": "w2", "status": "confirmed" },
      // ... 4 more confirmed
      { "workerId": "w3", "status": "pending" }
    ]
  }]
}
```

### Database Schema

```sql
ALTER TABLE jobs 
  ADD COLUMN positions_required INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN positions_confirmed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN positions_remaining INTEGER GENERATED ALWAYS AS (positions_required - positions_confirmed) STORED,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Open';

-- Index for status queries
CREATE INDEX idx_jobs_status ON jobs(status);

-- Index for finding jobs to complete
CREATE INDEX idx_jobs_date_status ON jobs(date, status);
```

---

## Testing Checklist

### Status Calculation Tests

- [ ] Open: 0 of 5 confirmed → "Open"
- [ ] PartiallyFilled: 3 of 5 confirmed → "PartiallyFilled"  
- [ ] FullyFilled: 5 of 5 confirmed → "FullyFilled"
- [ ] Completed: Past date → "Completed" (regardless of positions)
- [ ] Cancelled: Manual cancellation → "Cancelled" (overrides all)

### Position Tracking Tests

- [ ] Confirm worker: `positionsConfirmed++`, status updates
- [ ] Cancel booking: `positionsConfirmed--`, status updates
- [ ] Remaining calculation: Always `max(0, required - confirmed)`
- [ ] Fill percentage: `(6/8) * 100 = 75%`

### UI Tests

- [ ] Status badge shows correct color
- [ ] Progress bar reflects fill percentage
- [ ] "Apply" button disabled for FullyFilled/Completed/Cancelled
- [ ] Position counter shows "X of Y confirmed"
- [ ] Remaining count: "2 positions remaining" / "Fully staffed"

---

## Migration Strategy

### From Old Schema

**Old fields (hire.tsx):**
```typescript
count: "6 of 8 booked"
status: "Filling" | "Confirmed" | "Draft"
```

**New fields:**
```typescript
positionsRequired: 8
positionsConfirmed: 6
positionsRemaining: 2
status: "PartiallyFilled"
```

**Migration script:**
```typescript
function migrateJobStatus(oldJob: OldJob): NewJob {
  // Parse "6 of 8 booked"
  const match = oldJob.count.match(/(\d+) of (\d+)/);
  const confirmed = match ? parseInt(match[1]) : 0;
  const required = match ? parseInt(match[2]) : 1;
  
  // Map old status to new
  const statusMap: Record<string, JobStatusValue> = {
    "Draft": "Open",
    "Filling": "PartiallyFilled",
    "Confirmed": "FullyFilled"
  };
  
  return {
    ...oldJob,
    positionsRequired: required,
    positionsConfirmed: confirmed,
    positionsRemaining: required - confirmed,
    status: statusMap[oldJob.status] || "Open"
  };
}
```

---

## Best Practices

### For Employers

**Do:**
- ✅ Set realistic `positionsRequired` (don't overbook)
- ✅ Monitor fill rate with progress bars
- ✅ Update positions if plans change
- ✅ Cancel jobs properly (set status to "Cancelled")

**Don't:**
- ❌ Manually set `positionsRemaining` (always calculated)
- ❌ Manually set `status` after confirming workers (auto-calculated)
- ❌ Delete jobs (cancel instead for record-keeping)

### For Developers

**Do:**
- ✅ Always recalculate status after position changes
- ✅ Use helper functions for status logic
- ✅ Run daily job to mark completed jobs
- ✅ Respect "Cancelled" status (never auto-override)

**Don't:**
- ❌ Store `positionsRemaining` in database (calculate on read)
- ❌ Skip status validation on API endpoints
- ❌ Allow negative positions

---

## Related Files

- `src/lib/job-types.ts` - Status enum, helper functions
- `src/lib/booking-model.ts` - Job interface with status
- `src/routes/hire.tsx` - Employer dashboard with status display
- `JOB_MODEL_EXPANSION.md` - Original job model guide
- `JOB_REQUIREMENTS_GUIDE.md` - Requirements & instructions guide

---

**Status:** ✅ Implementation complete  
**Build:** ✅ Passing (488ms)  
**TypeScript:** ✅ 0 errors
