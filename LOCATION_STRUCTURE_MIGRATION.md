# Location Structure Migration Guide

## Overview
The Job `location` field has been expanded from a simple string to a structured object with full backward compatibility for existing data.

## Location Type Definition

### New Structure: `JobLocation`
```typescript
interface JobLocation {
  venueName: string;        // e.g., "Grand Palm Banquets"
  fullAddress: string;      // e.g., "123 Palm Avenue, Next to City Mall"
  area: string;             // e.g., "Andheri East"
  city: string;             // e.g., "Mumbai"
  landmark?: string;        // e.g., "City Mall" (optional)
  mapCoordinates?: {        // GPS coordinates (optional)
    latitude: number;
    longitude: number;
  };
}
```

### Union Type: `JobLocationValue`
```typescript
type JobLocationValue = JobLocation | string;
```
This allows both old (string) and new (structured object) formats to coexist.

## Helper Functions

All helper functions in `src/lib/job-types.ts` handle both formats transparently:

### 1. Type Checking
```typescript
isStructuredLocation(location: JobLocationValue): location is JobLocation
```
Check if a location uses the new structured format.

**Example:**
```typescript
if (isStructuredLocation(job.location)) {
  console.log(job.location.venueName); // TypeScript knows it's JobLocation
} else {
  console.log(job.location); // TypeScript knows it's a string
}
```

### 2. Extract Area
```typescript
getLocationArea(location: JobLocationValue): string
```
- **Structured**: Returns `location.area`
- **Legacy**: Extracts first part before comma from string

**Example:**
```typescript
const area = getLocationArea(job.location);
// Structured: "Andheri East"
// Legacy "Andheri East, Mumbai": "Andheri East"
```

### 3. Extract City
```typescript
getLocationCity(location: JobLocationValue): string
```
- **Structured**: Returns `location.city`
- **Legacy**: Extracts last part after comma from string

**Example:**
```typescript
const city = getLocationCity(job.location);
// Structured: "Mumbai"
// Legacy "Andheri East, Mumbai": "Mumbai"
```

### 4. Format Location
```typescript
formatLocation(location: JobLocationValue, format: 'short' | 'medium' | 'full'): string
```
Format location for display in various contexts.

**Format Options:**
- `'short'`: Area only → "Andheri East"
- `'medium'`: Area + City → "Andheri East, Mumbai"
- `'full'`: All details → "Grand Palm Banquets, 123 Palm Avenue, Andheri East, Mumbai (Near City Mall)"

**Example:**
```typescript
formatLocation(job.location, 'short');   // "Andheri East"
formatLocation(job.location, 'medium');  // "Andheri East, Mumbai"
formatLocation(job.location, 'full');    // Full address with landmark
```

### 5. Get Venue Name
```typescript
getVenueName(location: JobLocationValue): string | null
```
- **Structured**: Returns `location.venueName`
- **Legacy**: Returns `null` (not available in old format)

### 6. Get Full Address
```typescript
getFullAddress(location: JobLocationValue): string
```
- **Structured**: Returns `location.fullAddress`
- **Legacy**: Returns the entire string

### 7. Get Map Coordinates
```typescript
getMapCoordinates(location: JobLocationValue): { latitude: number; longitude: number } | null
```
- **Structured**: Returns coordinates if available
- **Legacy**: Returns `null`

### 8. Migrate Legacy to Structured
```typescript
migrateLocationToStructured(
  legacyLocation: string,
  options?: {
    venueName?: string;
    fullAddress?: string;
    landmark?: string;
  }
): JobLocation
```
Convert old string format to new structured format.

**Example:**
```typescript
const structured = migrateLocationToStructured(
  "Andheri East, Mumbai",
  {
    venueName: "Unknown Venue",
    landmark: "Near Station"
  }
);
// Result:
// {
//   venueName: "Unknown Venue",
//   fullAddress: "Andheri East, Mumbai",
//   area: "Andheri East",
//   city: "Mumbai",
//   landmark: "Near Station"
// }
```

## Updated Files

### ✅ `src/lib/job-types.ts`
- Added `JobLocation` interface
- Added `JobLocationValue` union type
- Added all location helper functions
- Updated `BaseJob.location` to use `JobLocationValue`
- Updated `toJobListing()` to use location helpers

### ✅ `src/lib/booking-model.ts`
- Updated `Job.location` to use `JobLocationValue`
- Updated mock data with structured locations including:
  - Venue names
  - Full addresses
  - Areas and cities
  - Landmarks
  - Map coordinates (optional)

## Usage in UI Components

### Reading Location (Backward Compatible)
```typescript
import { 
  formatLocation, 
  getLocationArea, 
  getVenueName,
  isStructuredLocation 
} from '@/lib/job-types';

// In any component that displays a job:
function JobCard({ job }: { job: Job }) {
  // Works with both formats!
  const displayLocation = formatLocation(job.location, 'medium');
  const area = getLocationArea(job.location);
  const venue = getVenueName(job.location);
  
  return (
    <div>
      {venue && <h3>{venue}</h3>}
      <p>{displayLocation}</p>
      <span className="area-badge">{area}</span>
    </div>
  );
}
```

### Creating New Jobs (Use Structured Format)
```typescript
const newJob = {
  // ... other fields
  location: {
    venueName: 'Royal Banquets',
    fullAddress: '456 Main Street, Block A',
    area: 'Bandra West',
    city: 'Mumbai',
    landmark: 'Near Railway Station',
    mapCoordinates: {
      latitude: 19.0596,
      longitude: 72.8295,
    },
  },
  // ... rest of job data
};
```

### Filtering by Location
```typescript
import { getLocationArea, getLocationCity } from '@/lib/job-types';

// Filter jobs by area (works with both formats)
const jobsInAndheri = allJobs.filter(job => 
  getLocationArea(job.location) === 'Andheri East'
);

// Filter by city
const jobsInMumbai = allJobs.filter(job => 
  getLocationCity(job.location) === 'Mumbai'
);
```

### Map Integration
```typescript
import { getMapCoordinates, isStructuredLocation } from '@/lib/job-types';

function JobMap({ job }: { job: Job }) {
  const coords = getMapCoordinates(job.location);
  
  if (!coords) {
    return <p>Map not available</p>;
  }
  
  return (
    <Map 
      center={[coords.latitude, coords.longitude]} 
      marker={coords}
    />
  );
}
```

## Migration Strategy

### Phase 1: ✅ COMPLETE (Current)
- [x] Add structured location types
- [x] Add backward-compatible helper functions
- [x] Update Job interface to accept both formats
- [x] Update mock data with structured locations

### Phase 2: Update UI Components (Next Steps)
1. **Job Listing Pages** (`/work`, `/hire`):
   - Use `formatLocation()` for display
   - Use `getLocationArea()` for badges/filters
   - Add venue name display where available

2. **Job Creation Forms** (`/hire`, `/post-job`):
   - Add separate fields for venue, address, area, city
   - Add optional landmark field
   - Add optional map picker for coordinates

3. **Job Detail Pages**:
   - Display full structured location
   - Show map if coordinates available
   - Show landmark as a separate badge

4. **Search & Filters**:
   - Filter by area using `getLocationArea()`
   - Filter by city using `getLocationCity()`
   - Add distance-based search using coordinates

### Phase 3: Data Migration (Future)
- Write script to convert existing legacy strings to structured format
- Backfill venue names from employer profiles
- Add geocoding service to populate coordinates

## Benefits

1. **Better Search**: Can filter by specific area/city
2. **Map Integration**: Coordinates enable map markers and distance calculations
3. **Clearer Display**: Venue names and landmarks improve clarity
4. **Backward Compatible**: Old data continues to work
5. **Progressive Enhancement**: New features available for structured locations

## Testing Backward Compatibility

```typescript
// Test with legacy format
const legacyJob: Job = {
  // ... other fields
  location: "Andheri East, Mumbai", // Old string format
};

console.log(getLocationArea(legacyJob.location));      // "Andheri East"
console.log(getLocationCity(legacyJob.location));      // "Mumbai"
console.log(formatLocation(legacyJob.location));       // "Andheri East, Mumbai"
console.log(getVenueName(legacyJob.location));         // null (not available)
console.log(getMapCoordinates(legacyJob.location));    // null (not available)

// Test with structured format
const structuredJob: Job = {
  // ... other fields
  location: {
    venueName: 'Grand Palm Banquets',
    fullAddress: '123 Palm Avenue',
    area: 'Andheri East',
    city: 'Mumbai',
    landmark: 'City Mall',
  },
};

console.log(getLocationArea(structuredJob.location));      // "Andheri East"
console.log(getLocationCity(structuredJob.location));      // "Mumbai"
console.log(formatLocation(structuredJob.location));       // "Andheri East, Mumbai"
console.log(getVenueName(structuredJob.location));         // "Grand Palm Banquets"
console.log(formatLocation(structuredJob.location, 'full')); // Full address
```

## Files Updated

- ✅ `src/lib/job-types.ts` - Added structured location types and helpers
- ✅ `src/lib/booking-model.ts` - Updated Job interface and mock data
- ⏳ `src/routes/work.tsx` - Update to use location helpers (not done yet)
- ⏳ `src/routes/hire.tsx` - Update to use location helpers (not done yet)
- ⏳ `src/routes/post-job.tsx` - Add structured location form fields (not done yet)

## Status

✅ **Schema & Types Complete** - Ready for UI integration  
✅ **Backward Compatibility** - All helpers handle both formats  
✅ **Mock Data Updated** - Sample jobs use structured locations  
✅ **Type Safety** - Union type ensures both formats are valid  
⏳ **UI Components** - Not updated yet (as requested)
