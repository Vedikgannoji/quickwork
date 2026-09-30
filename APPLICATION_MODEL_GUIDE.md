# Application Model Guide

## Overview

The **Application Model** manages worker applications to jobs, separate from the booking/slot system. This provides a clear workflow where workers apply and employers explicitly confirm or reject applications.

## Key Concepts

### Applications vs Bookings

- **Applications**: Workers express interest in a job → Poster reviews → Poster confirms/rejects
- **Bookings**: Transaction-safe slot reservation system (separate from applications)

Applications are about **matching** workers to jobs. Bookings are about **securing** specific slots.

## Application Lifecycle

```
Worker applies → Pending → Poster reviews → Confirmed/NotSelected/Waitlisted
```

### Status Flow

```
┌─────────┐
│ Pending │ ← Initial state when worker applies
└────┬────┘
     │
     ├──→ Confirmed      (Poster accepts)
     ├──→ NotSelected    (Poster rejects)
     └──→ Waitlisted     (Backup option)
```

### Status Descriptions

| Status | Description | Can Change To |
|--------|-------------|---------------|
| **Pending** | Application submitted, awaiting review | Confirmed, NotSelected, Waitlisted |
| **Confirmed** | Accepted by poster, worker is assigned | _(final state)_ |
| **NotSelected** | Rejected by poster | _(final state)_ |
| **Waitlisted** | Backup option if confirmed workers drop | Confirmed, NotSelected |

## Data Model

### Application Interface

```typescript
interface Application {
  id: string;                    // Unique application ID
  workerId: string;              // Worker who applied
  jobId: string;                 // Job being applied to
  status: ApplicationStatusValue; // Current status
  appliedAt: string;             // ISO timestamp
  confirmedAt: string | null;    // Set when confirmed (null otherwise)
  workerNote?: string;           // Optional note from worker
  posterNote?: string;           // Optional note from poster
  createdAt: string;
  updatedAt: string;
}
```

### Status Type

```typescript
enum ApplicationStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  NotSelected = "NotSelected",
  Waitlisted = "Waitlisted",
}

type ApplicationStatusValue = 
  | "Pending"
  | "Confirmed"
  | "NotSelected"
  | "Waitlisted";
```

## Core Features

### 1. Duplicate Prevention

**Workers cannot submit multiple applications to the same job.**

```typescript
const result = submitApplication({
  workerId: 'worker_1',
  jobId: 'job_123',
  workerNote: 'I have experience!',
});

// Second attempt by same worker
const duplicate = submitApplication({
  workerId: 'worker_1',  // Same worker
  jobId: 'job_123',       // Same job
});

// Result:
// duplicate.success = false
// duplicate.reason = 'duplicate_application'
```

### 2. Explicit Confirmation

**Applications do NOT auto-confirm.** Poster must explicitly review and confirm.

```typescript
// Worker applies
submitApplication({ workerId: 'worker_1', jobId: 'job_123' });
// Status: Pending (not Confirmed)

// Poster must confirm
confirmApplication('app_id_123', 'Great profile!');
// Status: Confirmed
// confirmedAt: now
```

### 3. Status Validation

**Only certain status transitions are allowed:**

```typescript
// ✅ Allowed transitions
Pending → Confirmed
Pending → NotSelected
Pending → Waitlisted
Waitlisted → Confirmed
Waitlisted → NotSelected

// ❌ Not allowed
Confirmed → anything (final state)
NotSelected → anything (final state)
```

## Usage Examples

### Worker: Submit Application

```typescript
import { useApplications } from '@/lib/application-model';

function JobDetailsPage({ jobId }: { jobId: string }) {
  const { submitApplication, hasApplied } = useApplications();
  const currentUserId = 'worker_123';
  
  const alreadyApplied = hasApplied(currentUserId, jobId);
  
  const handleApply = async () => {
    const result = submitApplication({
      workerId: currentUserId,
      jobId,
      workerNote: 'I have 3 years experience in this field.',
    });
    
    if (result.success) {
      toast.success('Application submitted!');
    } else if (result.reason === 'duplicate_application') {
      toast.error('You have already applied to this job.');
    }
  };
  
  return (
    <Button 
      onClick={handleApply}
      disabled={alreadyApplied}
    >
      {alreadyApplied ? 'Already Applied' : 'Apply Now'}
    </Button>
  );
}
```

### Worker: View My Applications

```typescript
import { useApplications, APPLICATION_STATUS_LABELS } from '@/lib/application-model';

function MyApplicationsPage() {
  const { getApplicationsByWorker } = useApplications();
  const currentUserId = 'worker_123';
  
  const myApplications = getApplicationsByWorker(currentUserId);
  
  return (
    <div>
      <h2>My Applications ({myApplications.length})</h2>
      {myApplications.map(app => (
        <div key={app.id}>
          <p>Job: {app.jobId}</p>
          <p>Status: {APPLICATION_STATUS_LABELS[app.status]}</p>
          <p>Applied: {new Date(app.appliedAt).toLocaleDateString()}</p>
          {app.confirmedAt && (
            <p>Confirmed: {new Date(app.confirmedAt).toLocaleDateString()}</p>
          )}
          {app.posterNote && (
            <p>Poster note: {app.posterNote}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Poster: Review Applications

```typescript
import { useApplications, APPLICATION_STATUS_COLORS } from '@/lib/application-model';

function ReviewApplicationsPage({ jobId }: { jobId: string }) {
  const {
    getApplicationsForJob,
    getJobApplicationStats,
    confirmApplication,
    rejectApplication,
    waitlistApplication,
  } = useApplications();
  
  const applications = getApplicationsForJob(jobId);
  const stats = getJobApplicationStats(jobId);
  
  const handleConfirm = (appId: string) => {
    const result = confirmApplication(appId, 'Welcome aboard!');
    if (result.success) {
      toast.success('Application confirmed!');
    }
  };
  
  const handleReject = (appId: string) => {
    const result = rejectApplication(appId, 'Position filled.');
    if (result.success) {
      toast.success('Application rejected.');
    }
  };
  
  const handleWaitlist = (appId: string) => {
    const result = waitlistApplication(appId, 'Backup option');
    if (result.success) {
      toast.success('Moved to waitlist.');
    }
  };
  
  return (
    <div>
      <div className="stats">
        <p>Total: {stats.total}</p>
        <p>Pending: {stats.pending}</p>
        <p>Confirmed: {stats.confirmed}</p>
        <p>Waitlisted: {stats.waitlisted}</p>
        <p>Not Selected: {stats.notSelected}</p>
      </div>
      
      <div className="applications">
        {applications.map(app => {
          const colors = APPLICATION_STATUS_COLORS[app.status];
          
          return (
            <div key={app.id}>
              <p>Worker: {app.workerId}</p>
              <span className={`badge ${colors.bg} ${colors.text} ${colors.border}`}>
                {app.status}
              </span>
              {app.workerNote && <p>Note: {app.workerNote}</p>}
              
              {app.status === 'Pending' && (
                <div className="actions">
                  <button onClick={() => handleConfirm(app.id)}>Confirm</button>
                  <button onClick={() => handleWaitlist(app.id)}>Waitlist</button>
                  <button onClick={() => handleReject(app.id)}>Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Poster: Bulk Confirm Applications

```typescript
import { confirmMultipleApplications } from '@/lib/application-model';

function BulkActionsPanel({ selectedAppIds }: { selectedAppIds: string[] }) {
  const handleBulkConfirm = () => {
    const result = confirmMultipleApplications(
      selectedAppIds,
      'Batch confirmed - welcome!'
    );
    
    toast.success(`Confirmed ${result.successful.length} applications`);
    
    if (result.failed.length > 0) {
      toast.error(`Failed to confirm ${result.failed.length} applications`);
    }
  };
  
  return (
    <button onClick={handleBulkConfirm}>
      Confirm Selected ({selectedAppIds.length})
    </button>
  );
}
```

## Integration with Job Model

### Updating positionsConfirmed

When applications are confirmed, update the job's `positionsConfirmed` count:

```typescript
import { useApplications } from '@/lib/application-model';
import { useJobStore } from '@/lib/job-store'; // Hypothetical job store

function confirmApplicationAndUpdateJob(appId: string, jobId: string) {
  const { confirmApplication, getConfirmedCount } = useApplications();
  const { updateJob } = useJobStore();
  
  // Confirm the application
  const result = confirmApplication(appId);
  
  if (result.success) {
    // Get updated confirmed count
    const confirmedCount = getConfirmedCount(jobId);
    
    // Update job
    updateJob(jobId, {
      positionsConfirmed: confirmedCount,
      // positionsRemaining is calculated automatically
    });
  }
}
```

### Auto-updating Job Status

```typescript
import { calculateJobStatus } from '@/lib/job-types';
import { useApplications } from '@/lib/application-model';

function syncJobStatusWithApplications(job: Job) {
  const { getConfirmedCount } = useApplications();
  
  const positionsConfirmed = getConfirmedCount(job.id);
  const newStatus = calculateJobStatus(
    job.positionsRequired,
    positionsConfirmed,
    job.date,
    job.status
  );
  
  if (newStatus !== job.status) {
    updateJob(job.id, { status: newStatus, positionsConfirmed });
  }
}
```

## Helper Functions

### Check Application Status

```typescript
import {
  canConfirmApplication,
  canRejectApplication,
  canWaitlistApplication,
  isApplicationFinal,
} from '@/lib/application-model';

const app = getApplication('app_123');

// Can this application be confirmed?
const confirmable = canConfirmApplication(app.status);
// true for Pending or Waitlisted

// Is this a final state?
const isFinal = isApplicationFinal(app.status);
// true for Confirmed or NotSelected
```

### Validate Status

```typescript
import { isValidApplicationStatus } from '@/lib/application-model';

const userInput = 'Confirmed';
if (isValidApplicationStatus(userInput)) {
  // TypeScript knows userInput is ApplicationStatusValue
  console.log('Valid status:', userInput);
}
```

## UI Display Constants

### Status Labels

```typescript
import { APPLICATION_STATUS_LABELS } from '@/lib/application-model';

APPLICATION_STATUS_LABELS.Pending      // "Pending Review"
APPLICATION_STATUS_LABELS.Confirmed    // "Confirmed"
APPLICATION_STATUS_LABELS.NotSelected  // "Not Selected"
APPLICATION_STATUS_LABELS.Waitlisted   // "Waitlisted"
```

### Status Colors (Tailwind)

```typescript
import { APPLICATION_STATUS_COLORS } from '@/lib/application-model';

const colors = APPLICATION_STATUS_COLORS.Confirmed;
// {
//   bg: "bg-success/10",
//   text: "text-success",
//   border: "border-success/40"
// }

// Usage in JSX:
<div className={`${colors.bg} ${colors.text} ${colors.border}`}>
  Confirmed
</div>
```

## Testing with Mock Data

```typescript
import { seedMockApplications } from '@/lib/application-model';

// In development, seed some test applications
if (import.meta.env.DEV) {
  seedMockApplications();
}
```

This creates 8 sample applications with various statuses for testing the UI.

## Best Practices

### 1. Always Check for Duplicates

Before showing "Apply" button, check if worker has already applied:

```typescript
const hasApplied = useApplications().hasApplied(workerId, jobId);

<Button disabled={hasApplied}>
  {hasApplied ? 'Already Applied' : 'Apply Now'}
</Button>
```

### 2. Show Application Stats

Display application statistics to give posters quick insights:

```typescript
const stats = getJobApplicationStats(jobId);

// Show: "15 applications (8 pending, 5 confirmed, 2 waitlisted)"
```

### 3. Separate Confirmed Workers from Applicants

In UI, clearly distinguish:
- **Applicants** (all applications)
- **Confirmed Workers** (only confirmed applications)

```typescript
const allApplications = getApplicationsForJob(jobId);
const confirmedWorkers = getApplicationsForJob(jobId, 'Confirmed');
```

### 4. Handle Status Validation

Always check if an action is allowed before attempting it:

```typescript
if (canConfirmApplication(app.status)) {
  confirmApplication(app.id);
} else {
  toast.error('Cannot confirm this application');
}
```

### 5. Provide Feedback with Notes

Use posterNote to explain decisions to workers:

```typescript
rejectApplication(appId, 'All positions filled. Thank you for applying!');
waitlistApplication(appId, 'Great profile! We'll contact you if a spot opens.');
```

## API Patterns

### Store Structure

```typescript
{
  applications: {
    'app_1': { id: 'app_1', workerId: 'w1', jobId: 'j1', ... },
    'app_2': { id: 'app_2', workerId: 'w2', jobId: 'j1', ... },
  },
  
  // Indexes for fast lookups
  applicationsByWorker: {
    'w1': ['app_1', 'app_3'],
    'w2': ['app_2'],
  },
  
  applicationsByJob: {
    'j1': ['app_1', 'app_2'],
    'j2': ['app_3'],
  },
}
```

### Return Values

All mutation functions return a consistent structure:

```typescript
{
  success: boolean;
  application: Application | null;
  reason?: string; // Only present on failure
}
```

Example reasons:
- `'duplicate_application'` - Worker already applied to this job
- `'not_found'` - Application ID doesn't exist
- `'invalid_status'` - Action not allowed for current status
- `'already_confirmed'` - Application already confirmed

## Migration Strategy

### Phase 1: Add Application Model (Current)

- ✅ Create Application model separate from bookings
- ✅ Implement all CRUD operations
- ✅ Add duplicate prevention
- ✅ Add status validation

### Phase 2: Integrate with UI

- [ ] Add "Apply" button to job detail pages
- [ ] Create "My Applications" page for workers
- [ ] Create "Review Applications" page for posters
- [ ] Show application stats on job cards

### Phase 3: Connect to Job Model

- [ ] Update `positionsConfirmed` when applications are confirmed
- [ ] Auto-update job status based on confirmed applications
- [ ] Show confirmed workers count in job listings

### Phase 4: Advanced Features

- [ ] Email notifications on application status change
- [ ] Application deadlines (auto-reject after job date)
- [ ] Recommended workers based on skills/history
- [ ] Bulk import workers from CSV

## Common Patterns

### Pattern: Auto-reject old applications

```typescript
function autoRejectExpiredApplications() {
  const { getApplicationsForJob, rejectApplication } = useApplicationStore.getState();
  
  // For all past jobs
  pastJobs.forEach(job => {
    const pendingApps = getApplicationsForJob(job.id, 'Pending');
    
    pendingApps.forEach(app => {
      rejectApplication(app.id, 'Job date has passed');
    });
  });
}
```

### Pattern: Notify workers on status change

```typescript
function confirmApplicationWithNotification(appId: string) {
  const result = confirmApplication(appId);
  
  if (result.success && result.application) {
    // Send notification
    sendEmailNotification(result.application.workerId, {
      subject: 'Application Confirmed!',
      body: `Your application for ${result.application.jobId} has been confirmed.`,
    });
  }
}
```

### Pattern: Application deadlines

```typescript
function canStillApply(job: Job): boolean {
  const applicationDeadline = new Date(job.date);
  applicationDeadline.setHours(applicationDeadline.getHours() - 24); // 24h before job
  
  return Date.now() < applicationDeadline.getTime();
}
```

## Troubleshooting

### Issue: "Duplicate application" error

**Cause**: Worker already applied to this job.

**Solution**: Check with `hasApplied()` before allowing application:

```typescript
if (hasApplied(workerId, jobId)) {
  toast.info('You have already applied to this job');
  return;
}
```

### Issue: "Invalid status" error when confirming

**Cause**: Application is in a final state (Confirmed or NotSelected).

**Solution**: Check status before attempting action:

```typescript
const app = getApplication(appId);
if (isApplicationFinal(app.status)) {
  toast.error('This application cannot be modified');
  return;
}
```

### Issue: positionsConfirmed not updating

**Cause**: Applications confirmed but job not updated.

**Solution**: Use `getConfirmedCount()` to sync:

```typescript
const confirmedCount = getConfirmedCount(jobId);
updateJob(jobId, { positionsConfirmed: confirmedCount });
```

## Summary

The Application Model provides:

✅ **Separate workflow** from bookings  
✅ **Duplicate prevention** - one application per worker per job  
✅ **Explicit confirmation** - no auto-confirm  
✅ **Status validation** - only allowed transitions  
✅ **Notes system** - feedback from workers and posters  
✅ **Bulk operations** - confirm/reject multiple at once  
✅ **Fast lookups** - indexed by worker and job  
✅ **Statistics** - application counts by status  

This creates a clear, manageable workflow for matching workers to jobs!
