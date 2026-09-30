# Job Requirements, Instructions & Reporting Contact Guide

**Last Updated:** September 9, 2026  
**Version:** 2.0

## Overview

This guide documents the expanded job model with worker requirements, shift instructions, and private reporting contact information. These fields help employers set clear expectations and workers understand job requirements before applying.

---

## New Type Definitions

### JobRequirements

Worker qualification requirements for the job.

```typescript
interface JobRequirements {
  /** Required experience level (e.g., "Entry level", "2+ years", "Experienced") */
  experience?: string | undefined;
  
  /** Required skills (e.g., ["Food handling", "Customer service"]) */
  skills?: string[] | undefined;
  
  /** Age requirement (e.g., "18+", "21-50", "No restriction") */
  ageRequirement?: string | undefined;
  
  /** Required languages (e.g., ["English", "Hindi", "Marathi"]) */
  languages?: string[] | undefined;
  
  /** Dress code requirements (e.g., "Formal black and white", "Provided uniform") */
  dressCode?: string | undefined;
  
  /** Required documents (e.g., ["Government ID", "Bank details", "Police verification"]) */
  documentsRequired?: string[] | undefined;
}
```

**Usage:**
```typescript
const requirements: JobRequirements = {
  experience: "2+ years in catering",
  skills: ["Food handling", "Customer service"],
  ageRequirement: "21+",
  languages: ["English", "Hindi"],
  dressCode: "Formal black and white",
  documentsRequired: ["Government ID", "Bank details"]
};
```

---

### JobInstructions

Step-by-step instructions for workers before and during the shift.

```typescript
interface JobInstructions {
  /** Instructions before arriving at the venue */
  beforeArrival?: string[] | undefined;
  
  /** Instructions during the shift */
  duringShift?: string[] | undefined;
}
```

**Usage:**
```typescript
const instructions: JobInstructions = {
  beforeArrival: [
    "Report 15 minutes early",
    "Bring your own mask",
    "Check in at security desk"
  ],
  duringShift: [
    "Follow supervisor's directions",
    "Maintain cleanliness standards",
    "Breaks at designated times"
  ]
};
```

---

### ReportingContact

Private contact information only visible to confirmed workers.

```typescript
interface ReportingContact {
  /** Contact person name */
  name: string;
  
  /** Contact method (e.g., "Phone", "WhatsApp", "On-site manager") */
  method: string;
  
  /** Where to report (e.g., "Main entrance", "Back office", "Security desk") */
  location: string;
}
```

**Privacy Note:** 🔒 This information is **private** and only shown to workers after they are confirmed for the shift. It should NOT appear in public job listings.

**Usage:**
```typescript
const reportingContact: ReportingContact = {
  name: "Rajesh Kumar",
  method: "Phone: +91 98765 43210",
  location: "Main entrance, ask for Events Manager"
};
```

---

## Integration in BaseJob

These fields are now part of the `BaseJob` interface:

```typescript
export interface BaseJob {
  // ... existing fields ...
  
  // Requirements, instructions, and reporting (new fields)
  requirements?: JobRequirements | undefined;
  instructions?: JobInstructions | undefined;
  reportingContact?: ReportingContact | undefined; // Private: only for confirmed workers
  
  // ... rest of fields ...
}
```

**All fields are optional** to maintain backward compatibility with existing jobs.

---

## Post-Job Form Integration

The post-job form has been expanded from 4 steps to **5 steps**:

1. **Job basics** - Title, category, description, type, timing
2. **Location & crew** - Venue, address, area, city, workers needed
3. **Wage & facilities** - Pay rate, facilities offered
4. **Requirements & Instructions** ⭐ NEW
   - Worker requirements (experience, skills, age, languages, dress code, documents)
   - Instructions (before arrival, during shift)
   - Reporting contact (private, only for confirmed workers)
5. **Review** - Final review before publishing

### Step 4: Requirements & Instructions

This new step is divided into three sections:

#### 1. Worker Requirements Section
- Experience level (e.g., "Entry level", "2+ years")
- Required skills (comma-separated)
- Age requirement (e.g., "18+", "21-50")
- Languages (comma-separated)
- Dress code
- Required documents (comma-separated)

#### 2. Instructions for Workers Section
- Before arrival (one instruction per line)
- During shift (one instruction per line)

#### 3. Reporting Contact Section (Private)
- Contact person name
- Contact method (phone/WhatsApp/etc.)
- Where to report (location description)
- **Visual indicator:** Blue badge showing "Private - Only for confirmed workers"

---

## Data Parsing

### Comma-Separated Fields

The form accepts comma-separated values for arrays:

```typescript
// Form input: "Food handling, Customer service, Lifting"
// Parsed to:
skills: ["Food handling", "Customer service", "Lifting"]
```

**Parsing logic:**
```typescript
const skills = form.skills
  .split(',')
  .map(s => s.trim())
  .filter(s => s.length > 0);
```

### Line-Separated Instructions

Instructions accept one instruction per line:

```typescript
// Form input (textarea):
// Report 15 minutes early
// Bring your own mask
// Check in at security desk

// Parsed to:
beforeArrival: [
  "Report 15 minutes early",
  "Bring your own mask",
  "Check in at security desk"
]
```

**Parsing logic:**
```typescript
const beforeArrival = form.beforeArrival
  .split('\n')
  .map(s => s.trim())
  .filter(s => s.length > 0);
```

---

## Display Guidelines

### Public Job Listings

When displaying jobs in public listings (work.tsx, hire.tsx, index.tsx):

**✅ Show:**
- Requirements (if available)
- Instructions (if available)

**❌ DO NOT Show:**
- Reporting contact (private field)

**Example:**
```typescript
// In job cards/listings
{job.requirements && (
  <div className="requirements">
    {job.requirements.experience && <p>Experience: {job.requirements.experience}</p>}
    {job.requirements.skills && <p>Skills: {job.requirements.skills.join(', ')}</p>}
    {/* ... other requirements ... */}
  </div>
)}

{/* NEVER show this in public listings */}
{/* {job.reportingContact && ...} ❌ */}
```

### Private Worker View (After Confirmation)

When showing job details to **confirmed workers only**:

**✅ Show Everything:**
- All requirements
- All instructions
- Reporting contact information

**Example:**
```typescript
// In confirmed worker's job detail view
{isConfirmedWorker && job.reportingContact && (
  <div className="reporting-contact private-section">
    <h3>🔒 Reporting Information</h3>
    <p><strong>Contact:</strong> {job.reportingContact.name}</p>
    <p><strong>Method:</strong> {job.reportingContact.method}</p>
    <p><strong>Location:</strong> {job.reportingContact.location}</p>
  </div>
)}
```

---

## Example: Complete Job with Requirements

```typescript
const job: BaseJob = {
  id: "job_123",
  employerId: "emp_456",
  jobTitle: "Banquet servers for wedding reception",
  category: "Hospitality",
  description: "High-end wedding event, formal service required",
  
  location: {
    venueName: "Grand Palm Banquets",
    fullAddress: "123 Palm Avenue, Next to City Mall",
    area: "Andheri East",
    city: "Mumbai",
    landmark: "City Mall"
  },
  
  date: "2026-09-15",
  startTime: "17:00",
  endTime: "23:00",
  duration: 360,
  jobType: "one-time",
  
  wage: 1200,
  facilities: ["Meals provided", "Uniform"],
  
  // New fields
  requirements: {
    experience: "2+ years in formal catering",
    skills: ["Fine dining service", "Wine service", "Customer interaction"],
    ageRequirement: "21+",
    languages: ["English", "Hindi"],
    dressCode: "Formal black and white (will be inspected on arrival)",
    documentsRequired: ["Government ID", "Bank details"]
  },
  
  instructions: {
    beforeArrival: [
      "Report 30 minutes before shift start",
      "Enter through main entrance and check in at security",
      "Dress code will be inspected - ensure formal attire",
      "Bring your own mask (mandatory)"
    ],
    duringShift: [
      "Follow banquet manager's directions at all times",
      "Maintain professional demeanor with guests",
      "Breaks: 15 min at 7:00 PM, 15 min at 9:00 PM",
      "No phones on the floor during service",
      "Report any incidents immediately to supervisor"
    ]
  },
  
  reportingContact: {
    name: "Rajesh Kumar (Banquet Manager)",
    method: "Phone: +91 98765 43210 (WhatsApp available)",
    location: "Main entrance reception desk - ask for Banquet Manager"
  },
  
  createdAt: "2026-09-08T10:30:00Z",
  updatedAt: "2026-09-08T10:30:00Z"
};
```

---

## UI Components Checklist

### Post-Job Form (post-job.tsx)
- ✅ Step 4 added: Requirements & Instructions
- ✅ Worker Requirements section with all fields
- ✅ Instructions section (before/during)
- ✅ Reporting Contact section with privacy badge
- ✅ Form validation (all fields optional)
- ✅ Progress indicator updated (5 steps)

### Job Listings (work.tsx, hire.tsx)
- ⏳ Display requirements in job cards (optional enhancement)
- ⏳ Show instructions preview (optional enhancement)
- ✅ Ensure reportingContact is NEVER shown

### Worker Dashboard (future)
- ⏳ Show reportingContact only for confirmed workers
- ⏳ Display all instructions prominently
- ⏳ Confirm requirements are met before booking

---

## Validation Rules

### Optional Fields
All new fields are **optional**. No validation errors if left blank.

### Format Validation
- Comma-separated fields: Split on comma, trim whitespace
- Line-separated fields: Split on newline, trim whitespace
- Empty arrays: Filter out empty strings after splitting

### Privacy Validation
- `reportingContact` must NEVER be included in public API responses
- Backend should filter this field based on user authentication status
- Frontend should check `isConfirmedWorker` before displaying

---

## Backend Integration Notes

### API Endpoints

**Public job listings:**
```json
GET /api/jobs
Response: {
  "jobs": [{
    "id": "job_123",
    // ... all fields except reportingContact ...
    "requirements": { ... },
    "instructions": { ... }
    // reportingContact: NOT included ✅
  }]
}
```

**Confirmed worker view:**
```json
GET /api/jobs/:id/full?workerId=worker_789
Authorization: Bearer <worker_token>
Response: {
  "id": "job_123",
  // ... all fields ...
  "reportingContact": {
    "name": "Rajesh Kumar",
    "method": "Phone: +91 98765 43210",
    "location": "Main entrance"
  }
}
```

### Database Schema

Add these columns to the `jobs` table:

```sql
-- Requirements (JSONB)
ALTER TABLE jobs ADD COLUMN requirements JSONB;

-- Instructions (JSONB)
ALTER TABLE jobs ADD COLUMN instructions JSONB;

-- Reporting Contact (JSONB, sensitive)
ALTER TABLE jobs ADD COLUMN reporting_contact JSONB;

-- Indexes
CREATE INDEX idx_jobs_requirements ON jobs USING GIN (requirements);
```

---

## Migration Strategy

### Backward Compatibility

All new fields are **optional**, so existing jobs continue to work without any changes:

```typescript
// Old job (no new fields)
const oldJob: BaseJob = {
  id: "old_job",
  // ... existing fields only ...
  // No requirements, instructions, or reportingContact
};
// ✅ Still valid!
```

### Gradual Adoption

1. **Phase 1:** Deploy new schema with optional fields
2. **Phase 2:** Update post-job form to collect new data
3. **Phase 3:** Encourage employers to add requirements (UI prompts)
4. **Phase 4:** Display requirements in job listings
5. **Phase 5:** Use requirements for worker matching/filtering

---

## Best Practices

### For Employers

**Do:**
- ✅ Be specific about requirements (helps workers self-filter)
- ✅ Provide clear, actionable instructions
- ✅ Include emergency contact info in reporting contact
- ✅ Update reporting contact if it changes

**Don't:**
- ❌ Use discriminatory language in requirements
- ❌ Set unrealistic requirements (deters applicants)
- ❌ Leave reporting contact blank (confuses workers)

### For Developers

**Do:**
- ✅ Always filter `reportingContact` from public APIs
- ✅ Check authentication before showing private fields
- ✅ Parse comma/line-separated fields carefully
- ✅ Handle missing/null fields gracefully

**Don't:**
- ❌ Log `reportingContact` in error messages
- ❌ Cache private data in public endpoints
- ❌ Assume fields are always present

---

## Testing Checklist

- [ ] Post job with all requirements fields filled
- [ ] Post job with no requirements (all optional)
- [ ] Verify reporting contact is NOT in public API response
- [ ] Verify reporting contact IS in authenticated worker response
- [ ] Test comma-separated field parsing (skills, languages, documents)
- [ ] Test line-separated field parsing (instructions)
- [ ] Test form validation (all fields optional)
- [ ] Test 5-step navigation (back/forward)
- [ ] Verify progress indicator shows 5 steps
- [ ] Test build completes without errors

---

## Related Files

- `src/lib/job-types.ts` - Type definitions
- `src/lib/booking-model.ts` - Job model with booking
- `src/routes/post-job.tsx` - 5-step post form
- `JOB_MODEL_EXPANSION.md` - Original expansion guide
- `LOCATION_STRUCTURE_MIGRATION.md` - Location structure guide

---

**Status:** ✅ Implementation complete  
**Build:** ✅ Passing  
**TypeScript:** ✅ 0 errors
