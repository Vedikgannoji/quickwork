# Phase 2: Service Layer Integration Guide

## Overview

This guide documents the service layer architecture that connects Zustand stores with Supabase backend. The implementation provides:

1. **Service Layer**: Type-safe CRUD operations with Supabase
2. **React Query Hooks**: Caching, optimistic updates, loading states
3. **Data Transformation**: Handles differences between frontend/database schemas

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Components                            │
│                    (src/routes/*.tsx)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     React Query Hooks                            │
│         (src/lib/hooks/use-jobs.ts, use-applications.ts)       │
│                                                                  │
│  • Caching & refetching                                         │
│  • Loading/error states                                         │
│  • Optimistic updates                                           │
│  • Query invalidation                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                              │
│    (src/lib/services/job-service.ts, application-service.ts)   │
│                                                                  │
│  • CRUD operations                                              │
│  • Data transformation (frontend ↔ database)                    │
│  • Error handling                                               │
│  • Business logic                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Supabase Client                            │
│                    (src/lib/supabase.ts)                        │
│                                                                  │
│  • Database queries                                             │
│  • RPC function calls                                           │
│  • Realtime subscriptions                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Created Files

### 1. Service Layer

#### `src/lib/services/job-service.ts`
Type-safe job CRUD operations with Supabase integration.

**Key Functions:**
- `JobService.createJob()` - Create job with categories and positions
- `JobService.getJob(jobId)` - Fetch single job with all relations
- `JobService.getJobs(params)` - Fetch and filter job list
- `JobService.updateJob(jobId, updates)` - Update job fields
- `JobService.deleteJob(jobId)` - Delete job and cascade relations
- `JobService.updateJobStatus(jobId, status)` - Update job status
- `JobService.expireRapidJob(jobId)` - Mark expired rapid jobs cancelled
- `JobService.getExpiredRapidJobs()` - Find rapid jobs needing expiry
- `JobService.getJobCategories(jobId)` - Fetch job categories
- `JobService.getJobPositions(jobId)` - Fetch job positions

**Data Transformation:**
- Converts between flat database schema (venue_name, area, city) and nested frontend types (JobLocation)
- Calculates derived fields: positionsRemaining, duration, status
- Aggregates wage from categories (weighted average)

#### `src/lib/services/application-service.ts`
Type-safe application/booking operations with atomic RPC calls.

**Key Functions:**
- `ApplicationService.reservePosition()` - Reserve position (temporary lock)
- `ApplicationService.confirmBooking()` - Confirm after payment
- `ApplicationService.cancelApplication()` - Cancel application/booking
- `ApplicationService.getApplication(id)` - Fetch single application
- `ApplicationService.getWorkerApplications()` - Worker's application history
- `ApplicationService.getJobApplications()` - Employer's job applications
- `ApplicationService.hasWorkerApplied()` - Check if worker already applied
- `ApplicationService.getAvailablePositions()` - Find open positions
- `ApplicationService.releaseExpiredLocks()` - Cleanup expired locks (scheduled)

**Application Flow:**
1. Worker browses jobs
2. Worker applies → `reservePosition()` (locks position for 15 min)
3. Worker completes payment
4. `confirmBooking()` (permanent booking, updates status to BOOKED)

### 2. React Query Hooks

#### `src/lib/hooks/use-jobs.ts`
React Query hooks for job management with caching and invalidation.

**Available Hooks:**

```typescript
// Fetch jobs (with filters)
const { data: jobs, isLoading, error } = useJobs({
  employerId: 'uuid',
  category: 'Hospitality',
  status: 'Open',
  isRapidJob: true,
  city: 'Mumbai',
  limit: 20,
  offset: 0,
});

// Fetch single job
const { data: job, isLoading } = useJob(jobId);

// Create job
const createJob = useCreateJob();
createJob.mutate({
  job: { ...jobData },
  categories: [{ name: 'Waiter', requiredWorkers: 5, wage: 1200 }],
});

// Update job
const updateJob = useUpdateJob();
updateJob.mutate({ jobId, updates: { job_title: 'New Title' } });

// Delete job
const deleteJob = useDeleteJob();
deleteJob.mutate(jobId);

// Get job categories/positions
const { data: categories } = useJobCategories(jobId);
const { data: positions } = useJobPositions(jobId);
```

#### `src/lib/hooks/use-applications.ts`
React Query hooks for application management.

**Available Hooks:**

```typescript
// Fetch worker applications
const { data: applications } = useWorkerApplications({
  workerId: userId,
  status: ['PENDING', 'BOOKED'],
  limit: 10,
});

// Fetch job applications (employer view)
const { data: applications } = useJobApplications({
  jobId: 'uuid',
  status: 'PENDING',
});

// Check if already applied
const { data } = useHasWorkerApplied({ workerId, jobId });

// Get available positions
const { data: positions } = useAvailablePositions({ jobId, jobCategoryId });

// Reserve position (Step 1: Apply)
const reservePosition = useReservePosition();
reservePosition.mutate({
  positionId,
  workerId,
  jobId,
  jobCategoryId,
  workerNote: 'Looking forward to working!',
});

// Confirm booking (Step 2: After payment)
const confirmBooking = useConfirmBooking();
confirmBooking.mutate({ applicationId, paymentId });

// Cancel application
const cancelApplication = useCancelApplication();
cancelApplication.mutate(applicationId);
```

### 3. React Query Configuration

Updated `src/router.tsx` with production-ready defaults:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // Cache for 5 minutes
      gcTime: 10 * 60 * 1000,       // Keep in memory for 10 min
      retry: 2,                      // Retry failed requests
      refetchOnWindowFocus: true,    // Refetch on tab focus
      refetchOnMount: false,         // Don't refetch if data fresh
    },
    mutations: {
      retry: 1,                      // Retry failed mutations once
    },
  },
});
```

## Route Migration Guide

### Step-by-Step Process

#### 1. Identify Current Data Flow

**Before (Zustand only):**
```typescript
// Route uses local Zustand store
import { useJobStore } from '@/lib/job-store';

function MyRoute() {
  const jobs = useJobStore(state => state.jobs);
  const fetchJobs = useJobStore(state => state.fetchJobs);
  
  useEffect(() => {
    fetchJobs(); // Fetches from nowhere - mock data
  }, []);
  
  return <div>{jobs.map(job => <JobCard key={job.id} job={job} />)}</div>;
}
```

**After (Service + React Query):**
```typescript
// Route uses React Query hook
import { useJobs } from '@/lib/hooks/use-jobs';

function MyRoute() {
  const { data: jobs, isLoading, error } = useJobs({
    status: 'Open',
    limit: 20,
  });
  
  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  
  return <div>{jobs?.map(job => <JobCard key={job.id} job={job} />)}</div>;
}
```

#### 2. Replace Store Selectors with Hooks

| Old Pattern | New Pattern |
|------------|-------------|
| `useJobStore(s => s.jobs)` | `useJobs()` |
| `useJobStore(s => s.getJob(id))` | `useJob(id)` |
| `useJobStore(s => s.createJob)` | `useCreateJob()` |
| `useBookingStore(s => s.applications)` | `useWorkerApplications({ workerId })` |
| `useBookingStore(s => s.reservePosition)` | `useReservePosition()` |

#### 3. Handle Loading States

React Query provides loading/error states automatically:

```typescript
const { data, isLoading, error, refetch } = useJobs();

// Loading skeleton
if (isLoading) return <JobCardSkeleton count={6} />;

// Error handling
if (error) return <ErrorState message={error.message} onRetry={refetch} />;

// Empty state
if (!data || data.length === 0) return <EmptyState />;

// Render data
return <JobList jobs={data} />;
```

#### 4. Implement Mutations

For create/update/delete operations:

```typescript
function CreateJobForm() {
  const createJob = useCreateJob();
  
  const handleSubmit = async (formData) => {
    try {
      const jobId = await createJob.mutateAsync({
        job: formData,
        categories: formData.categories,
      });
      
      toast.success('Job created!');
      navigate(`/hire/${jobId}`);
    } catch (error) {
      toast.error('Failed to create job');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Button type="submit" disabled={createJob.isPending}>
        {createJob.isPending ? 'Creating...' : 'Create Job'}
      </Button>
    </form>
  );
}
```

#### 5. Optimistic Updates (Optional)

For instant UI feedback before server confirms:

```typescript
const cancelApplication = useCancelApplication();

const handleCancel = (applicationId: string) => {
  // Optimistically update UI
  queryClient.setQueryData(
    applicationKeys.workerList(workerId),
    (old: Application[]) => 
      old.map(app => 
        app.id === applicationId 
          ? { ...app, status: 'CANCELLED' } 
          : app
      )
  );
  
  // Make API call
  cancelApplication.mutate(applicationId);
};
```

## Route Integration Priority

### ✅ Completed
- ✅ Service layer (`job-service.ts`, `application-service.ts`)
- ✅ React Query hooks (`use-jobs.ts`, `use-applications.ts`)
- ✅ QueryClient configuration (`router.tsx`)

### 🚧 In Progress (This Document)
Documentation and migration guide

### ⏳ Pending Routes to Migrate

#### High Priority (Core Booking Flow)
1. **`src/routes/work.tsx`** - Job browsing (already partially using Supabase)
2. **`src/routes/work.$jobId.tsx`** - Job details page
3. **`src/routes/work.$jobId.positions.tsx`** - Position selection/booking
4. **`src/routes/checkout.tsx`** - Payment & confirmation
5. **`src/routes/booking-confirmation.$applicationId.tsx`** - Booking confirmation
6. **`src/routes/my-applications.tsx`** - Worker application history

#### Medium Priority (Employer Flow)
7. **`src/routes/post-job.tsx`** - Create job form
8. **`src/routes/my-jobs.tsx`** - Employer's job list
9. **`src/routes/hire.$jobId.tsx`** - Employer job details/management

#### Low Priority (Supporting Pages)
10. **`src/routes/dashboard.tsx`** - Overview dashboard
11. **`src/routes/profile.tsx`** - User profile

## Data Schema Differences

### Jobs Table

**Database Schema (Flat):**
```typescript
{
  venue_name: string,
  full_address: string,
  area: string,
  city: string,
  landmark: string | null,
  job_date: string,
  start_time: string,
  end_time: string,
  // ... other fields
}
```

**Frontend Type (Nested):**
```typescript
{
  location: {
    venueName: string,
    fullAddress: string,
    area: string,
    city: string,
    landmark?: string,
  },
  date: string,
  startTime: string,
  endTime: string,
  // ... other fields
}
```

**Transformation handled by:** `dbJobToBaseJob()` and `baseJobToDbInsert()` in `job-service.ts`

### Application Status Values

| Database | Frontend | Meaning |
|----------|----------|---------|
| `PENDING` | `PENDING` | Position temporarily locked (15 min) |
| `BOOKED` | `BOOKED` | Worker confirmed & paid |
| `ACCEPTED` | `ACCEPTED` | Alternative term for booked |
| `CONFIRMED` | `CONFIRMED` | Employer confirmed (legacy, not used) |
| `CANCELLED` | `CANCELLED` | Application cancelled |
| `REJECTED` | `REJECTED` | Employer rejected |
| `EXPIRED` | `EXPIRED` | Lock expired before confirmation |

### Position Status Values

| Status | Meaning |
|--------|---------|
| `OPEN` | Available for booking |
| `PENDING` | Temporarily locked (15 min expiry) |
| `BOOKED` | Confirmed booking |
| `ACCEPTED` | Alternative term for booked |

## Testing Checklist

### Service Layer Testing
- [ ] `JobService.createJob()` creates job + categories + positions
- [ ] `JobService.getJob()` returns complete job with relations
- [ ] `JobService.getJobs()` filters by employerId, category, status
- [ ] `JobService.updateJob()` updates fields correctly
- [ ] `JobService.deleteJob()` cascades to categories/positions
- [ ] `ApplicationService.reservePosition()` locks position atomically
- [ ] `ApplicationService.confirmBooking()` updates status to BOOKED
- [ ] `ApplicationService.cancelApplication()` releases position
- [ ] Error handling returns `{ success: false, error: string }`

### React Query Testing
- [ ] `useJobs()` caches results for 5 minutes
- [ ] `useJob(id)` refetches when data is stale
- [ ] `useCreateJob()` invalidates job lists on success
- [ ] `useReservePosition()` invalidates available positions
- [ ] `useConfirmBooking()` invalidates applications and job status
- [ ] Loading states show skeleton components
- [ ] Error states show error messages with retry button
- [ ] Mutations show pending state during API calls

### End-to-End Flow Testing
- [ ] Worker browses jobs → data loads from Supabase
- [ ] Worker applies to job → position locks (15 min)
- [ ] Worker completes checkout → position confirms (BOOKED)
- [ ] Worker cancels application → position releases
- [ ] Employer creates job → appears in job list
- [ ] Employer views applications → shows real data
- [ ] Rapid job expires → status updates to Cancelled

## Common Issues & Solutions

### Issue: "Supabase client not initialized"
**Cause:** Missing environment variables  
**Solution:** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`

### Issue: Query returns stale data
**Cause:** React Query cache not invalidated  
**Solution:** Call `queryClient.invalidateQueries()` after mutations

### Issue: Position already locked error
**Cause:** Another worker reserved the position  
**Solution:** Refresh available positions, show user-friendly error

### Issue: Lock expired during checkout
**Cause:** Worker took >15 min in checkout flow  
**Solution:** Detect expiry, offer to re-apply to another position

### Issue: TypeScript errors on database types
**Cause:** Database schema changed  
**Solution:** Regenerate types with `npx supabase gen types typescript`

## Performance Considerations

### React Query Caching Strategy

**Jobs List:**
- Stale time: 5 minutes (good for browsing)
- Refetch on window focus: Yes (get latest jobs when tab regains focus)
- Background refetch: No (only on explicit actions)

**Job Details:**
- Stale time: 5 minutes
- Refetch on window focus: Yes
- Invalidated when: Job updated, application made

**Applications:**
- Stale time: 1 minute (more dynamic data)
- Refetch on window focus: Yes
- Invalidated when: Application created/updated/cancelled

### Database Query Optimization

**Jobs Query:**
- Include related data in single query: `select('*, job_categories(*), job_positions(*)')`
- Filter server-side: `.eq('status', 'Open')` instead of client-side filtering
- Paginate results: `.range(start, end)` to limit payload size

**Positions Query:**
- Only fetch OPEN positions when showing availability
- Use RPC functions for atomic operations (prevents race conditions)

## Next Steps

1. ✅ **Phase 1 Complete** - Service layer and hooks created
2. 🔄 **Phase 2 Current** - Migrate high-priority routes:
   - Start with `work.tsx` (job browsing)
   - Then `work.$jobId.tsx` and position booking flow
   - Then checkout and confirmation
3. ⏳ **Phase 3** - Migrate employer routes (post-job, my-jobs, hire)
4. ⏳ **Phase 4** - Remove Zustand stores entirely (when all routes migrated)
5. ⏳ **Phase 5** - Add realtime subscriptions for live updates

## Resources

- [React Query Docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Supabase TypeScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [TanStack Router Docs](https://tanstack.com/router/latest/docs/framework/react/overview)

---

**Migration Status:** 2 services + 2 hook files created, 0/11 routes migrated  
**Estimated Time:** 2-3 weeks for full migration (20-30 files)  
**Last Updated:** 2026-11-08
