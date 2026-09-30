import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Lock,
  MapPin,
  Search,
  SearchX,
  SendHorizonal,
  Star,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { JobCardListSkeleton } from "@/components/job-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { VerifiedBadge } from "@/components/verified-badge";
import { RapidJobBadge, SurgePricingBadge } from "@/components/rapid-job-badge";
import { useAuth } from "@/lib/auth-context";
import { useApplications } from "@/lib/application-model";
import {
  formatLocation,
  getLocationArea,
  formatDuration,
  JOB_CATEGORY_LABELS,
  JOB_TYPE_LABELS,
  type JobCategoryValue,
  type JobTypeValue,
} from "@/lib/job-types";

export const Route = createFileRoute("/work")({
  head: () => ({
    meta: [
      { title: "Browse Shifts — QuickWork" },
      {
        name: "description",
        content:
          "Browse and filter verified catering and event shifts near you on QuickWork. Wage shown upfront — no login needed to look around.",
      },
      { property: "og:title", content: "QuickWork — Browse Shifts Near You" },
      {
        property: "og:description",
        content: "Filter by location, category, date and wage. Book verified shifts in one tap.",
      },
    ],
  }),
  component: WorkPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Job = {
  id: string;
  jobTitle: string;
  category: JobCategoryValue;
  description: string;
  employer: string;
  rating: string;
  wage: number;
  wageDisplay: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  dateBucket: "today" | "this-week" | "tomorrow";
  dateLabel: string;
  location: string; // Display string
  venueName: string; // Venue name for display
  area: string;
  distance: string;
  facilities: string[];
  jobType: JobTypeValue;
  // Positions
  positionsTotal: number;
  positionsFilled: number;
  positionsRemaining: number;
  // Rapid Job fields
  isRapidJob?: boolean;
  rapidJobExpiresAt?: string;
  // Employer verification
  isVerifiedEmployer?: boolean;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const listings: Job[] = [
  {
    id: "1",
    jobTitle: "Banquet servers for wedding reception",
    category: "Hospitality",
    description: "Looking for experienced banquet staff for a high-end wedding event.",
    employer: "Grand Palm Banquets",
    venueName: "Grand Palm Banquets",
    rating: "4.9",
    wage: 1200,
    wageDisplay: "₹1,200",
    date: "2026-09-10",
    startTime: "17:00",
    endTime: "23:00",
    duration: 360,
    dateBucket: "today",
    dateLabel: "Wed, 10 Sep · 5:00 PM – 11:00 PM · 6h",
    location: "Grand Palm Banquets, Andheri East, Mumbai",
    area: "Andheri East",
    distance: "3.2 km",
    facilities: ["Meals provided", "Uniform"],
    jobType: "one-time",
    positionsTotal: 4,
    positionsFilled: 2,
    positionsRemaining: 2,
    isVerifiedEmployer: true,
    // URGENT: Rapid job expires in ~1.5 hours
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 minutes from now
  },
  {
    id: "2",
    jobTitle: "Kitchen staff for catering event",
    category: "Hospitality",
    description: "Need kitchen helpers for large catering event. Basic food prep experience required.",
    employer: "Saffron Caterers",
    venueName: "Commercial Kitchen Complex",
    rating: "4.8",
    wage: 950,
    wageDisplay: "₹950",
    date: "2026-09-11",
    startTime: "09:00",
    endTime: "16:00",
    duration: 420,
    dateBucket: "tomorrow",
    dateLabel: "Thu, 11 Sep · 9:00 AM – 4:00 PM · 7h",
    location: "Commercial Kitchen Complex, Powai, Mumbai",
    area: "Powai",
    distance: "5.7 km",
    facilities: ["Meals provided", "Transport"],
    jobType: "one-time",
    positionsTotal: 6,
    positionsFilled: 1,
    positionsRemaining: 5,
    isVerifiedEmployer: true,
  },
  {
    id: "3",
    jobTitle: "Event stewards for corporate conference",
    category: "Events",
    description: "Professional event stewards needed for 3-day corporate conference.",
    employer: "Blue Orchid Events",
    venueName: "Convention Center",
    rating: "4.7",
    wage: 1400,
    wageDisplay: "₹1,400",
    date: "2026-09-11",
    startTime: "15:00",
    endTime: "22:00",
    duration: 420,
    dateBucket: "tomorrow",
    dateLabel: "Thu, 11 Sep · 3:00 PM – 10:00 PM · 7h",
    location: "Convention Center, Bandra Kurla, Mumbai",
    area: "Bandra Kurla",
    distance: "8.1 km",
    facilities: ["Transport", "Uniform"],
    jobType: "multiple-days",
    positionsTotal: 8,
    positionsFilled: 5,
    positionsRemaining: 3,
    isVerifiedEmployer: true,
  },
  {
    id: "4",
    jobTitle: "Dishwashing crew for restaurant",
    category: "Hospitality",
    description: "Urgent need for dishwashing crew for busy weekend service.",
    employer: "Coastal Kitchen Co.",
    venueName: "Coastal Restaurant",
    rating: "4.5",
    wage: 900,
    wageDisplay: "₹900",
    date: "2026-09-12",
    startTime: "18:00",
    endTime: "00:00",
    duration: 360,
    dateBucket: "this-week",
    dateLabel: "Fri, 12 Sep · 6:00 PM – 12:00 AM · 6h",
    location: "Coastal Restaurant, Lower Parel, Mumbai",
    area: "Lower Parel",
    distance: "6.4 km",
    facilities: ["Meals provided"],
    jobType: "recurring",
    positionsTotal: 3,
    positionsFilled: 1,
    positionsRemaining: 2,
    isVerifiedEmployer: false,
    // URGENT: Rapid job expires in ~25 minutes (very urgent!)
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25 minutes from now
  },
  {
    id: "5",
    jobTitle: "Banquet server for private party",
    category: "Hospitality",
    description: "Experienced banquet servers needed for upscale private party.",
    employer: "Royal Plaza",
    venueName: "Royal Plaza Hotel",
    rating: "4.6",
    wage: 1100,
    wageDisplay: "₹1,100",
    date: "2026-09-10",
    startTime: "19:00",
    endTime: "23:00",
    duration: 240,
    dateBucket: "today",
    dateLabel: "Wed, 10 Sep · 7:00 PM – 11:00 PM · 4h",
    location: "Royal Plaza Hotel, Andheri West, Mumbai",
    area: "Andheri West",
    distance: "4.0 km",
    facilities: ["Meals provided", "Transport"],
    jobType: "one-time",
    positionsTotal: 5,
    positionsFilled: 5,
    positionsRemaining: 0,
    isVerifiedEmployer: true,
  },
  {
    id: "6",
    jobTitle: "Warehouse loading staff",
    category: "Warehouse",
    description: "Need warehouse loading staff for weekend inventory shift. Must be able to lift 20kg+",
    employer: "Urban Logistics Hub",
    venueName: "Industrial Area Phase 2",
    rating: "4.8",
    wage: 1100,
    wageDisplay: "₹1,100",
    date: "2026-09-13",
    startTime: "10:00",
    endTime: "18:00",
    duration: 480,
    dateBucket: "this-week",
    dateLabel: "Sat, 13 Sep · 10:00 AM – 6:00 PM · 8h",
    location: "Industrial Area Phase 2, Bhiwandi, Mumbai",
    area: "Bhiwandi",
    distance: "18.5 km",
    facilities: ["Meals provided", "Transport"],
    jobType: "one-time",
    positionsTotal: 10,
    positionsFilled: 3,
    positionsRemaining: 7,
    isVerifiedEmployer: true,
  },
  {
    id: "7",
    jobTitle: "Delivery partners for e-commerce rush",
    category: "Delivery",
    description: "Urgent delivery partners needed for weekend e-commerce rush. Own vehicle required.",
    employer: "QuickShip Logistics",
    venueName: "Distribution Hub",
    rating: "4.4",
    wage: 1500,
    wageDisplay: "₹1,500",
    date: "2026-09-14",
    startTime: "08:00",
    endTime: "20:00",
    duration: 720,
    dateBucket: "this-week",
    dateLabel: "Sun, 14 Sep · 8:00 AM – 8:00 PM · 12h",
    location: "Distribution Hub, Malad, Mumbai",
    area: "Malad",
    distance: "7.2 km",
    facilities: ["Fuel allowance", "Phone allowance"],
    jobType: "recurring",
    positionsTotal: 15,
    positionsFilled: 8,
    positionsRemaining: 7,
    isVerifiedEmployer: false,
  },
];

const locationOptions = ["All", "Andheri East", "Powai", "Bandra Kurla", "Lower Parel", "Andheri West", "Bhiwandi", "Malad"];
const categoryOptions = ["All", ...Object.keys(JOB_CATEGORY_LABELS)];
const dateOptions = ["Any", "Today", "This week"];
const wageOptions = ["Any", "₹900+", "₹1,000+", "₹1,200+"];

// ─── Page ─────────────────────────────────────────────────────────────────────

function WorkPage() {
  const { isLoggedIn, openLoginModal, pendingAction, clearPendingAction, user } = useAuth();
  const { submitApplication, hasApplied, getApplicationsByWorker } = useApplications();

  const [loading, setLoading] = useState(true);
  const [booked, setBooked] = useState<string[]>([]);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  // Get current worker's applications
  const currentWorkerId = user?.id || 'guest';
  const myApplications = isLoggedIn ? getApplicationsByWorker(currentWorkerId) : [];

  // Resume pending application once the user logs in
  const resumedRef = useRef(false);
  useEffect(() => {
    if (
      isLoggedIn &&
      pendingAction?.type === "apply-job" &&
      pendingAction.payload &&
      !resumedRef.current
    ) {
      resumedRef.current = true;
      const jobId = pendingAction.payload as string;
      clearPendingAction();
      // Small delay so the modal close animation finishes first
      setTimeout(() => {
        const job = listings.find((j) => j.id === jobId);
        if (job && !hasApplied(currentWorkerId, jobId)) {
          const result = submitApplication({
            workerId: currentWorkerId,
            jobId: jobId,
          });
          if (result.success) {
            toast.success(`Application submitted for: ${job.jobTitle}`);
          }
        }
      }, 200);
    }
  }, [isLoggedIn, pendingAction, clearPendingAction, currentWorkerId, hasApplied, submitApplication]);

  // Reset resume guard when logged out
  useEffect(() => {
    if (!isLoggedIn) resumedRef.current = false;
  }, [isLoggedIn]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  // Filter chips available
  const filterChips = [
    { id: "today", label: "Today", icon: CalendarDays },
    { id: "tomorrow", label: "Tomorrow", icon: CalendarDays },
    { id: "this-week", label: "This Week", icon: CalendarDays },
    { id: "within-2km", label: "Within 2km", icon: MapPin },
    { id: "wage-1000+", label: "₹1,000+", icon: Wallet },
    { id: "wage-1200+", label: "₹1,200+", icon: Wallet },
    { id: "rapid-jobs", label: "Rapid Jobs", icon: Zap },
    { id: "verified-employers", label: "Verified Employers", icon: BadgeCheck },
  ];

  const toggleFilter = (filterId: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterId) ? prev.filter((f) => f !== filterId) : [...prev, filterId]
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearchQuery("");
  };

  const filtered = useMemo(() => {
    return listings.filter((job) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = job.jobTitle.toLowerCase().includes(query);
        const matchesCategory = job.category.toLowerCase().includes(query);
        const matchesLocation = job.location.toLowerCase().includes(query);
        const matchesVenue = job.venueName.toLowerCase().includes(query);
        
        if (!matchesTitle && !matchesCategory && !matchesLocation && !matchesVenue) {
          return false;
        }
      }

      // Date filters
      if (activeFilters.includes("today") && job.dateBucket !== "today") return false;
      if (activeFilters.includes("tomorrow") && job.dateBucket !== "tomorrow") return false;
      if (activeFilters.includes("this-week") && job.dateBucket !== "this-week") return false;

      // Distance filter
      if (activeFilters.includes("within-2km")) {
        const distanceNum = parseFloat(job.distance);
        if (distanceNum > 2) return false;
      }

      // Wage filters
      if (activeFilters.includes("wage-1000+") && job.wage < 1000) return false;
      if (activeFilters.includes("wage-1200+") && job.wage < 1200) return false;

      // Rapid jobs filter
      if (activeFilters.includes("rapid-jobs") && !job.isRapidJob) return false;

      // Verified employers filter
      if (activeFilters.includes("verified-employers") && !job.isVerifiedEmployer) return false;

      return true;
    });
  }, [searchQuery, activeFilters]);

  const filtersActive = activeFilters.length > 0 || searchQuery.trim().length > 0;
  const displayedCount = loading ? listings.length : filtered.length;

  function handleApply(job: Job) {
    if (!isLoggedIn) {
      // Gate: open login modal and store the pending action with job id
      openLoginModal({ type: "apply-job", payload: job.id });
      return;
    }
    
    const result = submitApplication({
      workerId: currentWorkerId,
      jobId: job.id,
      workerNote: undefined, // Could add a modal for note in the future
    });
    
    if (result.success) {
      toast.success("Application submitted successfully!", {
        description: "The employer will review your application shortly.",
      });
    } else if (result.reason === 'duplicate_application') {
      toast.error('You have already applied to this job');
    } else {
      toast.error('Failed to submit application. Please try again.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-sm font-semibold text-primary">Find work</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Shifts near you</h1>
          <p className="mt-3 text-muted-foreground">
            {displayedCount} open shifts today. Wage shown before you book.
          </p>

          {/* Search Bar */}
          <div className="mt-9 relative">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, category, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
              className="w-full rounded-2xl border border-border bg-surface px-12 py-4 text-base transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <section className="mt-5 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Quick Filters</h2>
              </div>
              {filtersActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  disabled={loading}
                  className="h-8"
                >
                  <X className="size-4" /> Clear all
                </Button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {filterChips.map((chip) => {
                const Icon = chip.icon;
                const isActive = activeFilters.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    onClick={() => toggleFilter(chip.id)}
                    disabled={loading}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-50 ${
                      isActive
                        ? chip.id === "rapid-jobs"
                          ? "border-orange-500 bg-orange-500/15 text-orange-600 dark:text-orange-400"
                          : "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {chip.label}
                    {isActive && <X className="size-3" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading shifts…" : `${filtered.length} shift${filtered.length === 1 ? "" : "s"} ${filtersActive ? "match" : "available"}`}
              </p>
            </div>
          </section>

          {/* Job cards */}
          {loading ? (
            <div className="mt-9 grid gap-5 md:grid-cols-2">
              <JobCardListSkeleton count={6} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-9">
              <EmptyState
                icon={SearchX}
                title="No jobs found"
                description={
                  activeFilters.length > 0
                    ? "No jobs match your current filters. Try adjusting your search criteria."
                    : "No jobs are currently available. Check back soon for new opportunities!"
                }
                action={
                  activeFilters.length > 0
                    ? {
                        label: "Clear Filters",
                        onClick: clearAllFilters,
                      }
                    : undefined
                }
                variant="muted"
              />
            </div>
          ) : (
            <div className="mt-9 grid gap-5 md:grid-cols-2">
              {filtered.map((job) => {
                const alreadyApplied = isLoggedIn && hasApplied(currentWorkerId, job.id);
                const myApplication = myApplications.find(app => app.jobId === job.id);
                const isFull = job.positionsRemaining === 0;
                
                return (
                  <Link
                    key={job.id}
                    to="/work/$jobId"
                    params={{ jobId: job.id }}
                    className="block"
                  >
                    <article
                      className={`flex flex-col rounded-2xl border p-5 transition-all duration-200 ${
                        isFull
                          ? "border-border bg-muted/30 opacity-60"
                          : job.isRapidJob
                          ? "border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-card hover:-translate-y-1 hover:shadow-lift"
                          : "border-border bg-card hover:-translate-y-1 hover:shadow-lift"
                      }`}
                    >
                    {/* Rapid Job Badge */}
                    {job.isRapidJob && !isFull && (
                      <div className="mb-3">
                        <RapidJobBadge rapidJobExpiresAt={job.rapidJobExpiresAt} variant="compact" />
                      </div>
                    )}
                    
                    {/* Header: Title + Category Icon */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h2 className="text-lg font-semibold leading-snug">{job.jobTitle}</h2>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {job.category === "Hospitality" && <Utensils className="size-3" />}
                            {job.category === "Events" && <Users className="size-3" />}
                            {job.category === "Warehouse" && <Clock className="size-3" />}
                            {job.category === "Delivery" && <TrendingUp className="size-3" />}
                            {JOB_CATEGORY_LABELS[job.category]}
                          </span>
                          {job.isVerifiedEmployer && (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                              <BadgeCheck className="size-3" />
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Venue + Area */}
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" />
                      <span className="font-medium text-foreground">{job.venueName}</span>
                      <span>·</span>
                      <span>{job.area}</span>
                    </p>

                    {/* Date/Time */}
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarDays className="size-4 shrink-0" />
                      {job.dateLabel}
                    </p>

                    {/* Wage */}
                    <div className="mt-4 flex items-center justify-between">
                      <p className={`flex items-center gap-2 font-display text-2xl font-bold ${
                        job.isRapidJob ? "text-orange-600 dark:text-orange-400" : "text-primary"
                      }`}>
                        <Wallet className="size-5" /> {job.wageDisplay}
                        {job.isRapidJob && (
                          <span className="text-xs font-normal text-muted-foreground">(+20%)</span>
                        )}
                      </p>
                    </div>

                    {/* Positions Remaining */}
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
                      <span className="text-xs font-medium text-muted-foreground">Positions</span>
                      <span className={`text-sm font-bold ${
                        isFull 
                          ? "text-muted-foreground"
                          : job.positionsRemaining <= 2 
                          ? "text-orange-600 dark:text-orange-400" 
                          : "text-primary"
                      }`}>
                        {isFull ? (
                          "Filled"
                        ) : (
                          <>
                            {job.positionsRemaining}/{job.positionsTotal} remaining
                          </>
                        )}
                      </span>
                    </div>
                    
                    {/* Show application status if already applied */}
                    {alreadyApplied && myApplication && (
                      <div className="mt-4">
                        <ApplicationStatusBadge status={myApplication.status} />
                        {myApplication.posterNote && (
                          <div className="mt-2 rounded border border-primary/20 bg-primary/5 p-2">
                            <p className="text-xs font-medium text-primary">Employer note:</p>
                            <p className="mt-1 text-sm">{myApplication.posterNote}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Apply button */}
                    <Button
                      variant={alreadyApplied ? "secondary" : isFull ? "outline" : job.isRapidJob ? "destructive" : "hero"}
                      size="lg"
                      className={`mt-4 w-full ${
                        job.isRapidJob && !alreadyApplied && !isFull
                          ? "animate-pulse bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
                          : ""
                      }`}
                      disabled={alreadyApplied || isFull}
                      onClick={(e) => {
                        e.preventDefault();
                        handleApply(job);
                      }}
                    >
                      {alreadyApplied ? (
                        <><Check /> Application Submitted</>
                      ) : isFull ? (
                        <><X /> Position Filled</>
                      ) : !isLoggedIn ? (
                        <><Lock className="size-4" /> Apply to this job</>
                      ) : (
                        <><SendHorizonal className="size-4" /> {job.isRapidJob ? "Apply Now — Urgent!" : "Apply now"}</>
                      )}
                    </Button>

                    {alreadyApplied && myApplication?.status === 'Confirmed' && (
                      <Button
                        variant="outline"
                        size="lg"
                        className="mt-2 w-full border-success/40 text-success hover:bg-success/10 hover:text-success"
                        onClick={(e) => {
                          e.preventDefault();
                        }}
                        asChild
                      >
                        <Link to="/checkout">
                          <CheckCircle2 className="size-4" /> Confirmed — View details
                        </Link>
                      </Button>
                    )}
                  </article>
                </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar — shows profile if logged in, sign-up nudge if not */}
        <aside className="h-fit rounded-3xl border border-border bg-surface p-7 lg:sticky lg:top-24">
          {isLoggedIn ? (
            <LoggedInSidebar />
          ) : (
            <GuestSidebarNudge />
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Logged-in sidebar ────────────────────────────────────────────────────────

function LoggedInSidebar() {
  const { user } = useAuth();
  return (
    <>
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-2xl font-bold text-primary-foreground shadow-brand">
        {user?.avatar ?? "U"}
      </div>
      <h2 className="mt-5 text-xl">{user?.name ?? "Your Profile"}</h2>
      {user?.location && (
        <p className="mt-1 text-sm text-muted-foreground">{user.location}</p>
      )}
      <div className="mt-4">
        <VerifiedBadge />
      </div>
      <dl className="mt-7 space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Shifts completed</dt>
          <dd className="font-semibold">14</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Punctuality</dt>
          <dd className="font-semibold text-success">98%</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Rating</dt>
          <dd className="flex items-center gap-1.5 font-semibold">
            <Star className="size-4 fill-gold text-gold" /> 4.9
          </dd>
        </div>
      </dl>
      <div className="mt-7 rounded-2xl border border-gold/35 bg-gold/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4 text-gold" /> Renew badge in 42 days
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Keep punctuality above 90% to auto-renew.
        </p>
      </div>
      <Button variant="outline" size="lg" className="mt-6 w-full" asChild>
        <Link to="/profile">Edit profile</Link>
      </Button>
    </>
  );
}

// ─── Guest nudge sidebar ──────────────────────────────────────────────────────

function GuestSidebarNudge() {
  const { openLoginModal } = useAuth();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
        <Lock className="size-7" />
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          ?
        </span>
      </div>
      <h3 className="mt-5 text-lg font-semibold">Ready to find work?</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a free account to apply to jobs, track your applications and build your verified profile.
      </p>
      <Button
        variant="hero"
        size="lg"
        className="mt-6 w-full"
        onClick={() => openLoginModal({ type: "apply-job" })}
      >
        Sign up — it's free
      </Button>
      <button
        type="button"
        onClick={() => openLoginModal()}
        className="mt-3 text-sm text-primary hover:underline"
      >
        Already have an account? Log in
      </button>
    </div>
  );
}

// Removed - now using shared EmptyState component from @/components/empty-state
