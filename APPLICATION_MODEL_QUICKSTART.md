# Application Model - Quick Start

## What is it?

A separate system from bookings where:
1. Workers **apply** to jobs
2. Posters **review** applications
3. Posters **confirm/reject** applications explicitly

**Key Rule:** Applying does NOT auto-confirm. Poster must confirm.

## Installation

```typescript
import {
  useApplications,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
} from '@/lib/application-model';
```

## Quick Examples

### 1. Worker: Apply to Job

```typescript
const { submitApplication, hasApplied } = useApplications();
const currentUserId = 'worker_123';

// Check if already applied
if (hasApplied(currentUserId, jobId)) {
  return <p>Already Applied</p>;
}

// Submit application
const result = submitApplication({
  workerId: currentUserId,
  jobId: jobId,
  workerNote: 'I have 3 years of experience.',
});

if (result.success) {
  toast.success('Application submitted!');
} else if (result.reason === 'duplicate_application') {
  toast.error('You already applied to this job');
}
```

### 2. Worker: View My Applications

```typescript
const { getApplicationsByWorker } = useApplications();
const myApps = getApplicationsByWorker('worker_123');

myApps.forEach(app => {
  console.log(app.status);       // "Pending", "Confirmed", etc.
  console.log(app.appliedAt);    // ISO timestamp
  console.log(app.confirmedAt);  // null if not confirmed yet
  console.log(app.posterNote);   // Feedback from poster
});
```

### 3. Poster: Review Applications

```typescript
const {
  getApplicationsForJob,
  confirmApplication,
  rejectApplication,
  waitlistApplication,
} = useApplications();

const applications = getApplicationsForJob(jobId);

// Confirm an application
confirmApplication('app_123', 'Welcome! Looking forward to working with you.');

// Reject an application
rejectApplication('app_456', 'Position filled. Thank you for applying.');

// Waitlist an application
waitlistApplication('app_789', 'Great profile! We\'ll contact you if a spot opens.');
```

### 4. Poster: Application Stats

```typescript
const { getJobApplicationStats } = useApplications();
const stats = getJobApplicationStats(jobId);

console.log(stats.total);       // 15
console.log(stats.pending);     // 8
console.log(stats.confirmed);   // 5
console.log(stats.waitlisted);  // 2
console.log(stats.notSelected); // 0
```

### 5. Get Confirmed Worker Count

```typescript
const { getConfirmedCount } = useApplications();
const confirmedWorkers = getConfirmedCount(jobId);

// Use this to update Job.positionsConfirmed
updateJob(jobId, { positionsConfirmed: confirmedWorkers });
```

## Application Statuses

| Status | Description | Color |
|--------|-------------|-------|
| **Pending** | Awaiting review | Amber |
| **Confirmed** | Accepted by poster | Green (success) |
| **NotSelected** | Rejected by poster | Gray (muted) |
| **Waitlisted** | Backup option | Blue (primary) |

## UI Display

### Status Badge

```tsx
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from '@/lib/application-model';

const app = getApplication('app_123');
const colors = APPLICATION_STATUS_COLORS[app.status];
const label = APPLICATION_STATUS_LABELS[app.status];

<span className={`badge ${colors.bg} ${colors.text} ${colors.border}`}>
  {label}
</span>
```

### Application Card

```tsx
{applications.map(app => (
  <div key={app.id} className="border rounded p-4">
    <div className="flex justify-between">
      <p className="font-medium">Worker: {app.workerId}</p>
      <Badge status={app.status} />
    </div>
    
    {app.workerNote && (
      <p className="text-sm text-muted-foreground">{app.workerNote}</p>
    )}
    
    <p className="text-xs">Applied: {new Date(app.appliedAt).toLocaleDateString()}</p>
    
    {app.status === 'Pending' && (
      <div className="flex gap-2 mt-2">
        <Button onClick={() => confirmApplication(app.id)}>Confirm</Button>
        <Button onClick={() => waitlistApplication(app.id)} variant="outline">
          Waitlist
        </Button>
        <Button onClick={() => rejectApplication(app.id)} variant="ghost">
          Reject
        </Button>
      </div>
    )}
  </div>
))}
```

## Validation Helpers

```typescript
import {
  canConfirmApplication,
  canRejectApplication,
  canWaitlistApplication,
  isApplicationFinal,
} from '@/lib/application-model';

const app = getApplication('app_123');

// Can this application be confirmed?
if (canConfirmApplication(app.status)) {
  // Show "Confirm" button
}

// Is this in a final state? (cannot be changed)
if (isApplicationFinal(app.status)) {
  // Hide action buttons
}
```

## Bulk Actions

```typescript
import { confirmMultipleApplications } from '@/lib/application-model';

const selectedIds = ['app_1', 'app_2', 'app_3'];

const result = confirmMultipleApplications(selectedIds, 'Batch confirmed!');

console.log(`Confirmed: ${result.successful.length}`);
console.log(`Failed: ${result.failed.length}`);
```

## Common Patterns

### Pattern: Disable Apply Button

```tsx
const hasApplied = useApplications().hasApplied(workerId, jobId);

<Button disabled={hasApplied}>
  {hasApplied ? 'Already Applied' : 'Apply Now'}
</Button>
```

### Pattern: Filter by Status

```tsx
const pendingApps = getApplicationsForJob(jobId, 'Pending');
const confirmedApps = getApplicationsForJob(jobId, 'Confirmed');

<Tabs>
  <TabsList>
    <TabsTrigger>Pending ({pendingApps.length})</TabsTrigger>
    <TabsTrigger>Confirmed ({confirmedApps.length})</TabsTrigger>
  </TabsList>
  
  <TabsContent value="pending">
    {pendingApps.map(app => <ApplicationCard app={app} />)}
  </TabsContent>
  
  <TabsContent value="confirmed">
    {confirmedApps.map(app => <ApplicationCard app={app} />)}
  </TabsContent>
</Tabs>
```

### Pattern: Sync with Job Model

```typescript
// After confirming an application, update the job
const result = confirmApplication(appId);

if (result.success) {
  const confirmedCount = getConfirmedCount(jobId);
  
  updateJob(jobId, {
    positionsConfirmed: confirmedCount,
    // positionsRemaining is calculated automatically
  });
}
```

## Key Features

✅ **Duplicate Prevention** - One application per worker per job  
✅ **Explicit Confirmation** - Poster must confirm, no auto-confirm  
✅ **Status Validation** - Only allowed transitions work  
✅ **Notes System** - Workers and posters can add notes  
✅ **Fast Lookups** - Indexed by worker and job ID  
✅ **Bulk Operations** - Confirm/reject multiple at once  

## Next Steps

Read the full guide: `APPLICATION_MODEL_GUIDE.md`

---

**Remember:** Applications are separate from bookings. Applications = matching workers to jobs. Bookings = securing time slots.
