# QuickWork Phase 2: Implementation Plan

## Phase 1 Verification Results ✅

**Verified working**:
- ✅ Supabase client lazy initialization (no startup crash)
- ✅ Auth context using real Supabase auth APIs
- ✅ Database migration fixing RPC schema conflicts
- ✅ TypeScript compilation passes
- ✅ Configuration guard component

**Confirmed issues from Phase 1 report**:
- ⚠️ Zustand stores (`booking-model.ts`, `application-model.ts`) have NO database integration
- ⚠️ All job/booking data is in-memory only
- ⚠️ Routes use mock data
- ⚠️ No persistence across page refresh

## Critical Architecture Problem

**Current**: Client State (Zustand) ← → No Backend Sync ← → Supabase (unused)

**Required**: Client State ← → Supabase ← → PostgreSQL

The Zustand stores are completely disconnected. This requires a MAJOR refactor.

## Priority 1: Create Database Service Layer

Instead of rewriting everything at once, create a proper service layer:

### 1.1 Job Service (NEW FILE)
- `src/lib/services/job-service.ts`
- Fetch jobs from Supabase
- Create jobs
- Update jobs
- Delete jobs
- Filter/search jobs

### 1.2 Position Service (ENHANCE EXISTING)
- `src/lib/position-service.ts` (already exists, enhance it)
- Reserve position via RPC
- Confirm booking via RPC
- Release position via RPC
- Fetch position availability

### 1.3 Application Service (NEW FILE)
- `src/lib/services/application-service.ts`
- Submit application
- Fetch user applications
- Update application status
- Cancel application

## Priority 2: Route-by-Route Integration

### Phase 2A: Job Discovery (Worker Side)
Files to modify:
- `src/routes/work.tsx` - Job listing
- `src/routes/work.$jobId.tsx` - Job details
- `src/routes/work.$jobId.positions.tsx` - Position booking

Changes:
- Replace Zustand mock data with Supabase queries
- Add loading states
- Add error handling
- Implement real booking flow

### Phase 2B: Job Management (Employer Side)  
Files to modify:
- `src/routes/post-job.tsx` - Job creation
- `src/routes/my-jobs.tsx` - Job list
- `src/routes/hire.$jobId.tsx` - Applicant management

Changes:
- Create jobs in database
- Fetch employer's jobs
- Manage applications
- Update job status

### Phase 2C: User Dashboards
Files to modify:
- `src/routes/dashboard.tsx` - Main dashboard
- `src/routes/my-applications.tsx` - Worker applications
- `src/routes/profile.tsx` - User profile

Changes:
- Fetch real user data
- Display actual bookings
- Show application history

## Priority 3: State Management Strategy

**Decision**: Keep Zustand for UI state, add React Query for server state

Benefits:
- Zustand: UI state (modals, filters, selections)
- React Query: Server state (jobs, applications, bookings)
- Automatic caching
- Automatic refetching
- Optimistic updates
- Error handling

Implementation:
1. Install @tanstack/react-query (already installed ✅)
2. Create query hooks for each resource
3. Gradually replace Zustand data fetching
4. Keep Zustand for pure UI state

## Priority 4: Booking Flow Implementation

Critical path (highest business value):

```
Worker → Browse Jobs → View Details → Select Position → 
Reserve (RPC) → Confirm (RPC) → Success → Dashboard Update
```

Steps:
1. Implement position selection UI
2. Call `reserve_position(position_id)` RPC
3. Show 5-minute countdown
4. Call `confirm_booking(position_id, note)` RPC
5. Create application record
6. Update UI state
7. Redirect to success page

## Priority 5: Testing Strategy

1. Manual testing with real Supabase project
2. Verify RPC functions work
3. Test concurrent bookings
4. Test session persistence
5. Test error scenarios

## Implementation Order

### Week 1: Foundation
- [x] Verify Phase 1 fixes
- [ ] Create job service layer
- [ ] Create application service layer
- [ ] Set up React Query provider
- [ ] Create query hooks

### Week 2: Core Features
- [ ] Implement job discovery (work.tsx)
- [ ] Implement job details (work.$jobId.tsx)
- [ ] Implement position booking flow
- [ ] Implement job creation (post-job.tsx)
- [ ] Test end-to-end booking

### Week 3: Management Features
- [ ] Implement employer job management
- [ ] Implement application management
- [ ] Implement user dashboards
- [ ] Add realtime subscriptions
- [ ] Test concurrent operations

### Week 4: Polish & Deploy
- [ ] Fix npm vulnerabilities
- [ ] Add loading states everywhere
- [ ] Add error boundaries
- [ ] Performance optimization
- [ ] Production deployment

## Known Blockers

1. **Requires real Supabase project** with:
   - Migrations applied
   - Auth providers configured
   - RLS policies enabled

2. **External services** (can test without):
   - SMS provider (Twilio)
   - Google OAuth credentials

3. **Time-intensive refactor**:
   - ~20-30 route/component files need updates
   - Cannot be completed in single session
   - Requires iterative testing

## Next Actions

Starting with HIGHEST IMPACT, LOWEST RISK:

1. ✅ Create this implementation plan
2. 🚧 Create `job-service.ts` with core CRUD
3. 🚧 Update `work.tsx` to use job service
4. 🚧 Test job listing with real data
5. 🚧 Implement position booking RPC calls
6. 🚧 Create application service
7. Continue iteratively...

## Success Criteria

✅ Phase 2 Complete When:
- [ ] Jobs fetched from Supabase, not Zustand
- [ ] Position booking uses RPC functions
- [ ] Applications persisted to database
- [ ] Page refresh doesn't lose data
- [ ] Worker can complete end-to-end booking
- [ ] Employer can create job and see applicants
- [ ] Realtime updates work
- [ ] No mock data in production code paths

## Honest Assessment

**Can complete in this session**: 
- Service layer creation
- 2-3 route integrations
- Basic booking flow
- Testing with mock Supabase responses

**Requires follow-up sessions**:
- All 20+ routes integrated
- Complete realtime implementation
- Full E2E testing
- Production deployment
- Performance optimization

**This is a 2-3 week refactor**, not a 2-hour task.

Starting implementation now...
