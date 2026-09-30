# Rapid Jobs Feature Guide

## Overview

**Rapid Jobs** are urgent, time-sensitive job postings that expire 1-2 hours after being posted. They provide higher urgency visibility and automatically hide once they expire or become fully filled.

---

## Core Concepts

### What is a Rapid Job?

A Rapid Job is a regular job with additional properties:
- ✅ `isRapidJob: true` - Marks the job as urgent
- ✅ `rapidJobExpiresAt` - Timestamp when the job offer expires (1-2 hours from posting)
- ✅ **Auto-hiding** - Automatically hidden when expired or fully filled
- ✅ **Higher visibility** - Displayed prominently with urgency indicators

### Expiration Rules

A Rapid Job expires/hides when:
1. **Time expires**: Current time > `rapidJobExpiresAt`
2. **Fully filled**: `status === 'FullyFilled'` (all positions confirmed)

---

## Data Model

### Fields Added to Job Interface

```typescript
export interface BaseJob {
  // ... existing fields ...
  
  // Rapid Jobs
  isRapidJob: boolean;                // True if this is a rapid job
  rapidJobExpiresAt?: string;         // ISO timestamp - expiration time
  
  // ... rest of fields ...
}
```

### Example Rapid Job

```typescript
const rapidJob: BaseJob = {
  id: 'job_rapid_1',
  employerId: 'emp_1',
  jobTitle: 'Urgent: Banquet servers needed NOW',
  category: 'Hospitality',
  description: 'Need servers immediately for last-minute event',
  
  // ... standard fields ...
  
  // Rapid job specific
  isRapidJob: true,
  rapidJobExpiresAt: '2026-09-10T16:30:00Z', // 2 hours from posting
  
  createdAt: '2026-09-10T14:30:00Z',
  updatedAt: '2026-09-10T14:30:00Z',
};
```

---

## Helper Functions

### 1. Calculate Expiration

```typescript
import { calculateRapidJobExpiry } from '@/lib/job-types';

// Create rapid job expiring in 2 hours (default)
const expiresAt = calculateRapidJobExpiry();

// Custom expiry (1 hour)
const expiresAt = calculateRapidJobExpiry(1);
```

### 2. Check if Expired

```typescript
import { isRapidJobExpired } from '@/lib/job-types';

const expired = isRapidJobExpired(job.rapidJobExpiresAt);
// Returns: true if current time > expiration time
```

### 3. Get Time Remaining

```typescript
import { getRapidJobTimeRemaining, formatRapidJobTimeRemaining } from '@/lib/job-types';

// Get minutes remaining
const minutesLeft = getRapidJobTimeRemaining(job.rapidJobExpiresAt);
// Returns: number (e.g., 45)

// Get formatted string
const timeLeft = formatRapidJobTimeRemaining(job.rapidJobExpiresAt);
// Returns: "45 min", "1h 20m", or "Expired"
```

### 4. Check if Should Hide

```typescript
import { shouldHideRapidJob } from '@/lib/job-types';

const hidden = shouldHideRapidJob(job);
// Returns: true if expired OR fully filled
```

### 5. Filter Visible Jobs

```typescript
import { filterVisibleRapidJobs } from '@/lib/job-types';

const visibleJobs = filterVisibleRapidJobs(allJobs);
// Returns: jobs with hidden rapid jobs removed
```

---

## Scheduled Checker

### Automatic Status Updates

Use the `RapidJobScheduler` to automatically check and update rapid jobs.

#### Basic Setup

```typescript
import { createRapidJobScheduler } from '@/lib/rapid-job-scheduler';
import { useJobStore } from '@/lib/job-store';

const scheduler = createRapidJobScheduler({
  checkInterval: 60 * 1000, // Check every minute
  
  onUpdate: (updates) => {
    const { updateJob } = useJobStore.getState();
    
    updates.forEach(update => {
      console.log(`${update.reason}: ${update.jobId}`);
      
      if (update.newStatus) {
        updateJob(update.jobId, { 
          status: update.newStatus,
          hidden: update.shouldHide 
        });
      }
    });
  },
  
  onLog: (message) => {
    console.log('[Rapid Jobs]', message);
  },
});

// Stop when done (e.g., on component unmount)
scheduler.stop();
```

#### React Component Usage

```tsx
import { useEffect, useRef } from 'react';
import { createRapidJobScheduler, type RapidJobScheduler } from '@/lib/rapid-job-scheduler';

function App() {
  const schedulerRef = useRef<RapidJobScheduler | null>(null);
  const { jobs, updateJob } = useJobStore();
  
  useEffect(() => {
    // Start scheduler
    schedulerRef.current = createRapidJobScheduler({
      checkInterval: 60 * 1000, // 1 minute
      
      onUpdate: (updates) => {
        updates.forEach(update => {
          if (update.shouldHide) {
            updateJob(update.jobId, { 
              hidden: true,
              status: update.newStatus 
            });
          }
        });
      },
      
      onLog: console.log,
    });
    
    // Cleanup on unmount
    return () => {
      schedulerRef.current?.stop();
    };
  }, []);
  
  // Manually check when jobs change
  useEffect(() => {
    schedulerRef.current?.check(Object.values(jobs));
  }, [jobs]);
  
  return <div>Your app</div>;
}
```

#### One-Time Check

If you don't want a continuous scheduler:

```typescript
import { checkRapidJobsOnce } from '@/lib/rapid-job-scheduler';

// Manual check
const updates = checkRapidJobsOnce(allJobs);

updates.forEach(update => {
  console.log(`Job ${update.jobId} needs update: ${update.reason}`);
  // Handle update...
});
```

---

## UI Integration

### 1. Display Rapid Job Badge

```tsx
import { getRapidJobTimeRemaining, formatRapidJobTimeRemaining } from '@/lib/job-types';
import { Clock, Zap } from 'lucide-react';

function RapidJobBadge({ job }: { job: BaseJob }) {
  if (!job.isRapidJob) return null;
  
  const timeLeft = formatRapidJobTimeRemaining(job.rapidJobExpiresAt);
  
  return (
    <div className="flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
      <Zap className="size-3 animate-pulse" />
      <span>URGENT</span>
      <Clock className="size-3" />
      <span>{timeLeft} left</span>
    </div>
  );
}
```

### 2. Filter Out Expired Jobs

```tsx
import { filterVisibleRapidJobs } from '@/lib/job-types';

function JobList() {
  const { jobs } = useJobStore();
  
  // Filter out hidden rapid jobs
  const visibleJobs = filterVisibleRapidJobs(Object.values(jobs));
  
  return (
    <div>
      {visibleJobs.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
```

### 3. Show Countdown Timer

```tsx
import { useEffect, useState } from 'react';
import { getRapidJobTimeRemaining } from '@/lib/job-types';

function RapidJobCountdown({ job }: { job: BaseJob }) {
  const [timeLeft, setTimeLeft] = useState(() => 
    getRapidJobTimeRemaining(job.rapidJobExpiresAt)
  );
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getRapidJobTimeRemaining(job.rapidJobExpiresAt);
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [job.rapidJobExpiresAt]);
  
  if (timeLeft === 0) {
    return <span className="text-destructive">Expired</span>;
  }
  
  const hours = Math.floor(timeLeft / 60);
  const minutes = timeLeft % 60;
  
  return (
    <span className="font-mono text-destructive">
      {hours > 0 && `${hours}h `}
      {minutes}m
    </span>
  );
}
```

### 4. Highlight Rapid Jobs in List

```tsx
function JobCard({ job }: { job: BaseJob }) {
  return (
    <div className={`
      rounded-lg border p-4
      ${job.isRapidJob ? 'border-destructive bg-destructive/5' : 'border-border'}
    `}>
      {job.isRapidJob && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">
            URGENT
          </span>
          <span className="text-sm text-muted-foreground">
            Expires in {formatRapidJobTimeRemaining(job.rapidJobExpiresAt)}
          </span>
        </div>
      )}
      
      <h3>{job.jobTitle}</h3>
      {/* ... rest of job card ... */}
    </div>
  );
}
```

---

## API Patterns

### Creating a Rapid Job

```typescript
import { calculateRapidJobExpiry } from '@/lib/job-types';

function postRapidJob(jobData: Partial<BaseJob>) {
  const newJob: BaseJob = {
    ...jobData,
    id: generateId(),
    
    // Mark as rapid job
    isRapidJob: true,
    rapidJobExpiresAt: calculateRapidJobExpiry(2), // Expires in 2 hours
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Save to store/database
  saveJob(newJob);
  
  return newJob;
}
```

### Updating Job Status

```typescript
import { updateRapidJobStatus } from '@/lib/job-types';

function checkAndUpdateRapidJob(job: BaseJob) {
  const update = updateRapidJobStatus(job);
  
  if (update) {
    console.log(`Update needed: ${update.reason}`);
    
    if (update.shouldHide) {
      // Hide the job from listings
      hideJob(job.id);
    }
    
    if (update.newStatus) {
      // Update job status
      updateJobStatus(job.id, update.newStatus);
    }
  }
}
```

### Batch Check All Jobs

```typescript
import { getRapidJobsNeedingUpdate } from '@/lib/job-types';

function checkAllRapidJobs(jobs: BaseJob[]) {
  const updates = getRapidJobsNeedingUpdate(jobs);
  
  console.log(`Found ${updates.length} rapid jobs needing updates`);
  
  updates.forEach(update => {
    console.log(`- ${update.jobId}: ${update.reason}`);
    
    if (update.shouldHide) {
      hideJob(update.jobId);
    }
    
    if (update.newStatus) {
      updateJobStatus(update.jobId, update.newStatus);
    }
  });
}
```

---

## Scheduler Configuration

### Custom Check Intervals

```typescript
// Check every 30 seconds (aggressive)
const scheduler = createRapidJobScheduler({
  checkInterval: 30 * 1000,
});

// Check every 5 minutes (conservative)
const scheduler = createRapidJobScheduler({
  checkInterval: 5 * 60 * 1000,
});
```

### Custom Callbacks

```typescript
const scheduler = createRapidJobScheduler({
  checkInterval: 60 * 1000,
  
  onUpdate: (updates) => {
    // Send notifications
    updates.forEach(update => {
      if (update.shouldHide) {
        notifyEmployer(update.jobId, 'Your rapid job has expired');
      }
    });
    
    // Update database
    batchUpdateJobs(updates);
  },
  
  onLog: (message) => {
    // Custom logging (e.g., to analytics)
    analytics.track('rapid_job_check', { message });
  },
});
```

### Scheduler Methods

```typescript
const scheduler = createRapidJobScheduler();

// Start (if stopped)
scheduler.start();

// Stop
scheduler.stop();

// Manual check
scheduler.check(jobs);

// Get status
const status = scheduler.getStatus();
console.log(`Running: ${status.isRunning}, Interval: ${status.checkInterval}ms`);
```

---

## Best Practices

### 1. Set Appropriate Expiration Times

```typescript
// For truly urgent jobs (1 hour)
rapidJobExpiresAt: calculateRapidJobExpiry(1)

// Standard rapid jobs (2 hours) - default
rapidJobExpiresAt: calculateRapidJobExpiry(2)

// Extended rapid jobs (3 hours)
rapidJobExpiresAt: calculateRapidJobExpiry(3)
```

### 2. Update UI Reactively

```tsx
// Re-render when job changes
const [job, setJob] = useState(initialJob);

useEffect(() => {
  const interval = setInterval(() => {
    // Check if job should be hidden
    if (shouldHideRapidJob(job)) {
      // Remove from UI or mark as expired
      setJob(prev => ({ ...prev, hidden: true }));
    }
  }, 10 * 1000); // Check every 10 seconds
  
  return () => clearInterval(interval);
}, [job]);
```

### 3. Notify on Expiration

```typescript
onUpdate: (updates) => {
  updates.forEach(update => {
    if (update.reason === 'Rapid job expired') {
      // Notify employer
      sendNotification(update.jobId, {
        title: 'Rapid Job Expired',
        body: 'Your urgent job posting has expired and is no longer visible to workers.',
      });
    }
  });
}
```

### 4. Add Visual Indicators

- **Pulsing badge** for urgent jobs
- **Countdown timer** showing time remaining
- **Red/orange color scheme** for urgency
- **Lightning bolt icon** for rapid jobs
- **Surge pricing indicator** (+20% wage)

---

## Testing

### Manual Testing

```typescript
// Create test rapid job expiring in 5 minutes
const testJob: BaseJob = {
  // ... job fields ...
  isRapidJob: true,
  rapidJobExpiresAt: calculateRapidJobExpiry(5 / 60), // 5 minutes
};

// Wait 6 minutes, then check
setTimeout(() => {
  console.log('Expired:', isRapidJobExpired(testJob.rapidJobExpiresAt));
  // Should be true
}, 6 * 60 * 1000);
```

### Unit Tests

```typescript
describe('Rapid Jobs', () => {
  test('calculates expiry correctly', () => {
    const expiry = calculateRapidJobExpiry(2);
    const expiryTime = new Date(expiry).getTime();
    const twoHoursFromNow = Date.now() + (2 * 60 * 60 * 1000);
    
    expect(expiryTime).toBeCloseTo(twoHoursFromNow, -3); // Within 1 second
  });
  
  test('detects expired jobs', () => {
    const pastTime = new Date(Date.now() - 1000).toISOString();
    expect(isRapidJobExpired(pastTime)).toBe(true);
    
    const futureTime = new Date(Date.now() + 1000).toISOString();
    expect(isRapidJobExpired(futureTime)).toBe(false);
  });
  
  test('hides fully filled rapid jobs', () => {
    const job: BaseJob = {
      // ... fields ...
      isRapidJob: true,
      status: 'FullyFilled',
    };
    
    expect(shouldHideRapidJob(job)).toBe(true);
  });
});
```

---

## Summary

✅ **Rapid Jobs** are time-sensitive postings with automatic expiration
✅ **Auto-hide** when expired (1-2 hours) or fully filled
✅ **Helper functions** for all common operations
✅ **Scheduler** for automatic background checks
✅ **React-friendly** with hooks and components
✅ **Production-ready** with full TypeScript support

Use Rapid Jobs for urgent staffing needs that require immediate attention and high visibility!
