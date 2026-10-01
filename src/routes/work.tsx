import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  SearchX,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  X,
  Zap,
  ArrowRight,
  Package,
  Loader2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { JobCardListSkeleton } from "@/components/job-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RapidJobBadge } from "@/components/rapid-job-badge";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/lib/auth-context";
import {
  JOB_CATEGORY_LABELS,
  type JobCategoryValue,
} from "@/lib/job-types";
import { supabase } from "@/lib/supabase";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/work")({
  head: () => ({
    meta: [
      { title: "Find Work — QuickWork" },
      {
        name: "description",
        content:
          "Discover verified daily-wage shifts near you. Wage shown upfront — filter by category, date and location. No login needed to browse.",
      },
      { property: "og:title", content: "Find Work — QuickWork" },
      {
        property: "og:description",
        content:
          "Browse open shifts near you. Filter by category, date and pay. Book in one tap.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const TODAY_ISO = new Date().toISOString().split("T")[0]!;
const TOMORROW_ISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
})();

const CATEGORY_CHIPS: { id: JobCategoryValue; emoji: string }[] = [
  { id: "Hospitality", emoji: "🍽" },
  { id: "Events",      emoji: "🎪" },
  { id: "Delivery",    emoji: "🚚" },
  { id: "Retail",      emoji: "🛒" },
  { id: "Construction",emoji: "👷" },
  { id: "Warehouse",   emoji: "📦" },
  { id: "Cleaning",    emoji: "🧹" },
  { id: "Other",       emoji: "💼" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterId =
  | "rapid"
  | "today"
  | "tomorrow"
  | "verified"
  | "wage-1000"
  | "wage-1200"
  | "wage-1500";

interface JobListing {
  id: string;
  jobTitle: string;
  category: string;
  description: string;
  venueName: string;
  area: string;
  city: string;
  jobDate: string;       // YYYY-MM-DD
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
  isRapidJob: boolean;
  rapidJobExpiresAt: string | null;
  status: string;
  facilities: string[];
  isVerifiedEmployer: boolean;
  // Category summary (denormalised for card display)
  minWage: number;       // lowest wage across categories
  maxWage: number;       // highest wage
  categoryNames: string[];  // e.g. ["Food Serving", "Liquor Serving"]
  // Position counts (aggregated)
  totalPositions: number;
  availablePositions: number;
}

// ─── Supabase query ───────────────────────────────────────────────────────────

interface FetchParams {
  searchQuery: string;
  activeFilters: FilterId[];
  selectedCategory: JobCategoryValue | "All";
  page: number;
}

async function fetchJobs(params: FetchParams): Promise<{
  jobs: JobListing[];
  hasMore: boolean;
  error: string | null;
}> {
  const { searchQuery, activeFilters, selectedCategory, page } = params;

  // Build the base query — only columns needed for the card
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("jobs")
    .select(
      `
      id,
      job_title,
      category,
      description,
      venue_name,
      area,
      city,
      job_date,
      start_time,
      end_time,
      is_rapid_job,
      rapid_job_expires_at,
      status,
      facilities,
      job_categories ( name, wage, sort_order ),
      job_positions ( status )
      `,
      { count: "exact" }
    )
    // Only open jobs
    .in("status", ["Open", "PartiallyFilled"])
    // Jobs on or after today
    .gte("job_date", TODAY_ISO)
    // Order: Rapid first, then by date, then newest
    .order("is_rapid_job", { ascending: false })
    .order("job_date", { ascending: true })
    .order("created_at", { ascending: false })
    // Pagination
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  // Server-side filters
  if (selectedCategory !== "All") {
    query = query.eq("category", selectedCategory);
  }
  if (activeFilters.includes("rapid")) {
    query = query.eq("is_rapid_job", true);
  }
  if (activeFilters.includes("today")) {
    query = query.eq("job_date", TODAY_ISO);
  }
  if (activeFilters.includes("tomorrow")) {
    query = query.eq("job_date", TOMORROW_ISO);
  }

  const { data, error, count } = await query;

  if (error) {
    return { jobs: [], hasMore: false, error: error.message };
  }

  // Transform raw rows → JobListing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs: JobListing[] = (data as any[]).map((row: any) => {
    const categories = (row.job_categories ?? []) as {
      name: string;
      wage: number;
      sort_order: number;
    }[];
    const positions = (row.job_positions ?? []) as { status: string }[];

    const wages = categories.map((c) => c.wage);
    const minWage = wages.length > 0 ? Math.min(...wages) : 0;
    const maxWage = wages.length > 0 ? Math.max(...wages) : 0;
    const categoryNames = [...categories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.name);

    const totalPositions = positions.filter(
      (p) => p.status !== "CANCELLED"
    ).length;
    const availablePositions = positions.filter(
      (p) => p.status === "AVAILABLE"
    ).length;

    return {
      id: row.id as string,
      jobTitle: row.job_title as string,
      category: row.category as string,
      description: row.description as string,
      venueName: row.venue_name as string,
      area: row.area as string,
      city: row.city as string,
      jobDate: row.job_date as string,
      startTime: (row.start_time as string).slice(0, 5),
      endTime: (row.end_time as string).slice(0, 5),
      isRapidJob: row.is_rapid_job as boolean,
      rapidJobExpiresAt: row.rapid_job_expires_at as string | null,
      status: row.status as string,
      facilities: (row.facilities ?? []) as string[],
      isVerifiedEmployer: false, // will join profiles in next phase
      minWage,
      maxWage,
      categoryNames,
      totalPositions,
      availablePositions,
    };
  });

  // Client-side wage filters (can't do cleanly server-side without aggregation)
  const filtered = jobs.filter((job) => {
    if (activeFilters.includes("wage-1500") && job.maxWage < 1500) return false;
    if (activeFilters.includes("wage-1200") && job.maxWage < 1200) return false;
    if (activeFilters.includes("wage-1000") && job.maxWage < 1000) return false;
    if (
      searchQuery.trim() &&
      !job.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !job.category.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !job.area.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !job.city.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !job.venueName.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const hasMore = count != null ? (page + 1) * PAGE_SIZE < count : false;

  return { jobs: filtered, hasMore, error: null };
}

// ─── Mock data fallback (no Supabase env vars) ────────────────────────────────

const MOCK_JOBS: JobListing[] = [
  {
    id: "mock-1",
    jobTitle: "Wedding Event Staff — Grand Sapphire Banquets",
    category: "Hospitality",
    description: "Experienced event staff for a premium wedding reception.",
    venueName: "Grand Sapphire Banquets",
    area: "Gachibowli",
    city: "Hyderabad",
    jobDate: TODAY_ISO,
    startTime: "19:00",
    endTime: "23:30",
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    status: "Open",
    facilities: ["Meals provided", "Uniform"],
    isVerifiedEmployer: true,
    minWage: 1200,
    maxWage: 1400,
    categoryNames: ["Food Serving", "Liquor Serving", "Starters"],
    totalPositions: 12,
    availablePositions: 8,
  },
  {
    id: "mock-2",
    jobTitle: "Corporate Conference Stewards",
    category: "Events",
    description: "Professional event stewards for a 2-day corporate conference.",
    venueName: "HICC Convention Centre",
    area: "Madhapur",
    city: "Hyderabad",
    jobDate: TODAY_ISO,
    startTime: "08:00",
    endTime: "18:00",
    isRapidJob: false,
    rapidJobExpiresAt: null,
    status: "Open",
    facilities: ["Meals provided", "Transport", "Uniform"],
    isVerifiedEmployer: true,
    minWage: 1400,
    maxWage: 1400,
    categoryNames: ["Registration Desk", "Floor Stewards", "AV Crew"],
    totalPositions: 18,
    availablePositions: 12,
  },
  {
    id: "mock-3",
    jobTitle: "Warehouse Loading Staff — Weekend Shift",
    category: "Warehouse",
    description: "Need warehouse loading staff for weekend inventory shift. Must be able to lift 20 kg+.",
    venueName: "Urban Logistics Hub",
    area: "Uppal",
    city: "Hyderabad",
    jobDate: TOMORROW_ISO,
    startTime: "06:00",
    endTime: "14:00",
    isRapidJob: false,
    rapidJobExpiresAt: null,
    status: "PartiallyFilled",
    facilities: ["Meals provided", "Transport"],
    isVerifiedEmployer: false,
    minWage: 1100,
    maxWage: 1100,
    categoryNames: ["Loading Crew"],
    totalPositions: 10,
    availablePositions: 6,
  },
  {
    id: "mock-4",
    jobTitle: "Food Court Servers — Phoenix Mall",
    category: "Retail",
    description: "Experienced food court servers for a busy weekend at Phoenix Mall.",
    venueName: "Phoenix Palladium Mall",
    area: "Manikonda",
    city: "Hyderabad",
    jobDate: TOMORROW_ISO,
    startTime: "11:00",
    endTime: "21:00",
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
    status: "Open",
    facilities: ["Meals provided"],
    isVerifiedEmployer: true,
    minWage: 950,
    maxWage: 950,
    categoryNames: ["Floor Servers", "Cashier Desk"],
    totalPositions: 8,
    availablePositions: 5,
  },
  {
    id: "mock-5",
    jobTitle: "Banquet Kitchen Crew",
    category: "Hospitality",
    description: "Kitchen preparation and plating crew for large banquet event.",
    venueName: "Novotel Hyderabad Airport",
    area: "Shamshabad",
    city: "Hyderabad",
    jobDate: TOMORROW_ISO,
    startTime: "14:00",
    endTime: "22:00",
    isRapidJob: false,
    rapidJobExpiresAt: null,
    status: "Open",
    facilities: ["Meals provided", "Uniform"],
    isVerifiedEmployer: true,
    minWage: 1300,
    maxWage: 1500,
    categoryNames: ["Kitchen Prep", "Plating", "Desserts"],
    totalPositions: 9,
    availablePositions: 9,
  },
  {
    id: "mock-6",
    jobTitle: "E-commerce Delivery Partners — Weekend Rush",
    category: "Delivery",
    description: "Own vehicle required. High-density delivery run for weekend orders.",
    venueName: "Distribution Hub",
    area: "Kukatpally",
    city: "Hyderabad",
    jobDate: TOMORROW_ISO,
    startTime: "08:00",
    endTime: "20:00",
    isRapidJob: false,
    rapidJobExpiresAt: null,
    status: "Open",
    facilities: [],
    isVerifiedEmployer: false,
    minWage: 1500,
    maxWage: 1500,
    categoryNames: ["Delivery Riders"],
    totalPositions: 15,
    availablePositions: 10,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoDate: string, startTime: string): string {
  const date = new Date(isoDate + "T00:00");
  const todayStr = TODAY_ISO;
  const tomorrowStr = TOMORROW_ISO;

  let dayLabel: string;
  if (isoDate === todayStr) {
    dayLabel = "Today";
  } else if (isoDate === tomorrowStr) {
    dayLabel = "Tomorrow";
  } else {
    dayLabel = date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  const [h, m] = startTime.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const displayH = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
  const timeStr = `${displayH}:${String(m!).padStart(2, "0")} ${suffix}`;

  return `${dayLabel} · ${timeStr}`;
}

function wageDisplay(min: number, max: number): string {
  if (min === max || max === 0) {
    return `₹${min.toLocaleString("en-IN")}`;
  }
  return `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}`;
}

function availabilityLabel(available: number, total: number): string {
  if (total === 0) return "No positions";
  if (available === 0) return "All filled";
  if (available === total) return `${total} positions open`;
  return `${available} / ${total} positions left`;
}

function availabilityFill(available: number, total: number): number {
  if (total === 0) return 0;
  return Math.max(4, Math.round((available / total) * 100));
}

function categoryEmoji(cat: string): string {
  return CATEGORY_CHIPS.find((c) => c.id === cat)?.emoji ?? "💼";
}

// ─── Availability bar ─────────────────────────────────────────────────────────

function AvailabilityBar({
  available,
  total,
  isRapid,
}: {
  available: number;
  total: number;
  isRapid: boolean;
}) {
  const fill = availabilityFill(available, total);
  const isFull = available === 0;
  const isLow = available > 0 && available <= 3;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`text-xs font-semibold ${
            isFull
              ? "text-muted-foreground"
              : isLow
                ? "text-orange-600 dark:text-orange-400"
                : "text-success"
          }`}
        >
          {availabilityLabel(available, total)}
        </span>
        {isLow && !isFull && (
          <span className="animate-pulse text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            Filling fast
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isFull
              ? "bg-muted-foreground/40"
              : isLow || isRapid
                ? "bg-gradient-to-r from-orange-500 to-orange-400"
                : "bg-gradient-to-r from-success to-emerald-400"
          }`}
          style={{ width: `${fill}%` }}
          role="progressbar"
          aria-valuenow={available}
          aria-valuemax={total}
          aria-label={`${available} of ${total} positions available`}
        />
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: JobListing;
  index: number;
}

function JobCard({ job, index }: JobCardProps) {
  const isFull = job.availablePositions === 0 && job.totalPositions > 0;

  return (
    <Link
      to="/work/$jobId"
      params={{ jobId: job.id }}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-2xl"
      style={{
        animationDelay: `${index * 55}ms`,
        animationFillMode: "both",
      }}
      aria-label={`${job.jobTitle} — ${job.area}, ${job.city} — ₹${job.minWage}`}
    >
      <article
        className={`animate-bounce-in relative flex h-full flex-col overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
          isFull
            ? "border-border bg-muted/20 opacity-55"
            : job.isRapidJob
              ? "border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-card hover:border-orange-500/70 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(249,115,22,0.18)]"
              : "border-border bg-card hover:border-primary/40 hover:-translate-y-1 hover:shadow-lift"
        }`}
        style={{ animationDelay: `${index * 55}ms` }}
      >
        {/* Rapid Job accent strip */}
        {job.isRapidJob && !isFull && (
          <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-400" />
        )}

        <div className="flex flex-1 flex-col p-5">
          {/* Rapid badge */}
          {job.isRapidJob && !isFull && (
            <div className="mb-3">
              {job.rapidJobExpiresAt ? (
                <RapidJobBadge
                  rapidJobExpiresAt={job.rapidJobExpiresAt}
                  variant="compact"
                />
              ) : (
                <RapidJobBadge variant="compact" />
              )}
            </div>
          )}

          {/* Title row */}
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <h2
                className={`text-base font-bold leading-snug ${
                  isFull ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {job.jobTitle}
              </h2>

              {/* Category chip */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                    job.isRapidJob && !isFull
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                      : "border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  <span aria-hidden="true">{categoryEmoji(job.category)}</span>
                  {JOB_CATEGORY_LABELS[job.category as JobCategoryValue] ?? job.category}
                </span>
                {job.isVerifiedEmployer && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            <span className="font-medium text-foreground">{job.venueName}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{job.area}, {job.city}</span>
          </p>

          {/* Date */}
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            {formatDate(job.jobDate, job.startTime)}
          </p>

          {/* Work categories pills */}
          {job.categoryNames.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.categoryNames.slice(0, 4).map((name) => (
                <span
                  key={name}
                  className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {name}
                </span>
              ))}
              {job.categoryNames.length > 4 && (
                <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                  +{job.categoryNames.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Wage */}
          <div className="mt-4">
            <p
              className={`font-display text-2xl font-bold ${
                job.isRapidJob && !isFull
                  ? "text-orange-600 dark:text-orange-400"
                  : isFull
                    ? "text-muted-foreground"
                    : "text-primary"
              }`}
            >
              {wageDisplay(job.minWage, job.maxWage)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ shift</span>
            </p>
          </div>

          {/* Availability bar */}
          <div className="mt-4">
            <AvailabilityBar
              available={job.availablePositions}
              total={job.totalPositions}
              isRapid={job.isRapidJob}
            />
          </div>

          {/* Facilities */}
          {job.facilities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.facilities.slice(0, 3).map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/8 px-2 py-0.5 text-[11px] font-medium text-success"
                >
                  ✓ {f}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-5">
            {isFull ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 py-2.5 text-sm font-semibold text-muted-foreground">
                All positions filled
              </div>
            ) : (
              <div
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                  job.isRapidJob
                    ? "bg-gradient-to-r from-orange-500 to-orange-400 text-white group-hover:from-orange-600 group-hover:to-orange-500"
                    : "bg-primary text-primary-foreground group-hover:opacity-90"
                }`}
              >
                <span>View job</span>
                <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Card skeleton (restyled to match new card) ───────────────────────────────

function NewJobCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="animate-bounce-in rounded-2xl border-2 border-border bg-card p-5"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Title */}
      <div className="h-5 w-3/4 rounded-lg bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-24 rounded-lg bg-muted animate-pulse" />
      {/* Location */}
      <div className="mt-4 flex items-center gap-2">
        <div className="size-4 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-40 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="size-4 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-28 rounded-lg bg-muted animate-pulse" />
      </div>
      {/* Category pills */}
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-20 rounded-md bg-muted animate-pulse" />
        <div className="h-5 w-16 rounded-md bg-muted animate-pulse" />
        <div className="h-5 w-24 rounded-md bg-muted animate-pulse" />
      </div>
      {/* Wage */}
      <div className="mt-4 h-8 w-32 rounded-lg bg-muted animate-pulse" />
      {/* Progress bar */}
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between">
          <div className="h-3 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
      </div>
      {/* CTA */}
      <div className="mt-5 h-10 w-full rounded-xl bg-muted animate-pulse" />
    </div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  icon: Icon,
  isActive,
  isRapid,
  onClick,
  disabled,
}: {
  label: string;
  icon?: React.ElementType;
  isActive: boolean;
  isRapid?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40 ${
        isActive
          ? isRapid
            ? "border-orange-500 bg-orange-500 text-white shadow-md"
            : "border-primary bg-primary text-primary-foreground shadow-md"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {label}
      {isActive && <X className="size-3" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function WorkPage() {
  const { isLoggedIn, openLoginModal } = useAuth();

  // State
  const [searchQuery, setSearchQuery]   = useState("");
  const [draftSearch, setDraftSearch]   = useState(""); // debounced
  const [activeFilters, setActiveFilters] = useState<FilterId[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<JobCategoryValue | "All">("All");
  const [page, setPage]               = useState(0);

  // Data
  const [jobs, setJobs]               = useState<JobListing[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isMockData, setIsMockData]   = useState(false);

  // Debounce search input
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setDraftSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearchQuery(val);
      setPage(0);
    }, 350);
  };

  // Load jobs
  const load = useCallback(
    async (append = false) => {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const currentPage = append ? page + 1 : 0;

      const result = await fetchJobs({
        searchQuery,
        activeFilters,
        selectedCategory,
        page: currentPage,
      });

      if (result.error) {
        // Graceful fallback — show mock data if Supabase isn't configured
        if (!append) {
          setJobs(MOCK_JOBS);
          setHasMore(false);
          setIsMockData(true);
          setError(null); // Don't show error UI — just show mock data silently
        }
      } else {
        if (append) {
          setJobs((prev) => [...prev, ...result.jobs]);
          setPage(currentPage);
        } else {
          setJobs(result.jobs);
          setPage(0);
          setIsMockData(false);
        }
        setHasMore(result.hasMore);
        setError(null);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [searchQuery, activeFilters, selectedCategory, page],
  );

  // Reload when filters change (not on initial mount — handled below)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      load(false);
      return;
    }
    setPage(0);
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeFilters, selectedCategory]);

  // Filter helpers
  const toggleFilter = (f: FilterId) => {
    setActiveFilters((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
    setPage(0);
  };

  const clearAll = () => {
    setActiveFilters([]);
    setSelectedCategory("All");
    setDraftSearch("");
    setSearchQuery("");
    setPage(0);
  };

  const filtersActive =
    activeFilters.length > 0 ||
    selectedCategory !== "All" ||
    searchQuery.trim().length > 0;

  const rapidJobs = useMemo(() => jobs.filter((j) => j.isRapidJob), [jobs]);
  const normalJobs = useMemo(() => jobs.filter((j) => !j.isRapidJob), [jobs]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-primary">Find work</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Shifts near you</h1>
          <p className="mt-3 text-muted-foreground">
            {loading
              ? "Finding open shifts…"
              : `${jobs.length}${hasMore ? "+" : ""} open shift${jobs.length !== 1 ? "s" : ""}${filtersActive ? " match your filters" : " today"}`}
          </p>
        </div>
        {isMockData && (
          <div className="animate-bounce-in rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            Preview mode — connect Supabase to see live jobs
          </div>
        )}
      </div>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="relative mt-8">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="job-search"
          type="search"
          autoComplete="off"
          placeholder="Search by title, location, or category…"
          value={draftSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-14 w-full rounded-2xl border-2 border-border bg-surface pl-12 pr-12 text-base transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          aria-label="Search jobs"
        />
        {draftSearch && (
          <button
            type="button"
            onClick={() => handleSearchChange("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* ── Category strip ────────────────────────────────────────────────── */}
      <div
        className="mt-5 flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by job category"
      >
        <button
          type="button"
          aria-pressed={selectedCategory === "All"}
          onClick={() => {
            setSelectedCategory("All");
            setPage(0);
          }}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.03] ${
            selectedCategory === "All"
              ? "border-foreground bg-foreground text-background shadow-sm"
              : "border-border bg-background text-muted-foreground hover:border-primary/50"
          }`}
          id="category-all"
        >
          All
        </button>
        {CATEGORY_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={selectedCategory === c.id}
            onClick={() => {
              setSelectedCategory((prev) => (prev === c.id ? "All" : c.id));
              setPage(0);
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-[1.03] ${
              selectedCategory === c.id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
            id={`category-${c.id.toLowerCase()}`}
          >
            <span aria-hidden="true">{c.emoji}</span>
            {JOB_CATEGORY_LABELS[c.id]}
          </button>
        ))}
      </div>

      {/* ── Quick filter pills ─────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Filters
        </span>

        <FilterPill
          label="⚡ Rapid Jobs"
          isActive={activeFilters.includes("rapid")}
          isRapid
          onClick={() => toggleFilter("rapid")}
        />
        <FilterPill
          label="Today"
          icon={CalendarDays}
          isActive={activeFilters.includes("today")}
          onClick={() => toggleFilter("today")}
        />
        <FilterPill
          label="Tomorrow"
          icon={CalendarDays}
          isActive={activeFilters.includes("tomorrow")}
          onClick={() => toggleFilter("tomorrow")}
        />
        <FilterPill
          label="₹1,000+"
          icon={Wallet}
          isActive={activeFilters.includes("wage-1000")}
          onClick={() => toggleFilter("wage-1000")}
        />
        <FilterPill
          label="₹1,200+"
          icon={Wallet}
          isActive={activeFilters.includes("wage-1200")}
          onClick={() => toggleFilter("wage-1200")}
        />
        <FilterPill
          label="₹1,500+"
          icon={Wallet}
          isActive={activeFilters.includes("wage-1500")}
          onClick={() => toggleFilter("wage-1500")}
        />
        <FilterPill
          label="Verified"
          icon={BadgeCheck}
          isActive={activeFilters.includes("verified")}
          onClick={() => toggleFilter("verified")}
        />

        {filtersActive && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/8 px-3 py-1.5 text-xs font-semibold text-destructive transition-all hover:bg-destructive/15"
            id="clear-all-filters-btn"
          >
            <X className="size-3" strokeWidth={3} aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_296px]">
        <div>
          {/* Error */}
          {error && (
            <ErrorState
              title="Could not load jobs"
              description={error}
              action={{ label: "Try again", onClick: () => load(false) }}
            />
          )}

          {/* Loading skeleton */}
          {loading && !error && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <NewJobCardSkeleton key={i} index={i} />
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && !error && (
            <>
              {/* Rapid Jobs spotlight section */}
              {rapidJobs.length > 0 && !activeFilters.includes("rapid") && (
                <section className="mb-8" aria-label="Urgent rapid jobs">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-orange-500/15">
                      <Zap className="size-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                    </span>
                    <h2 className="text-lg font-bold">Urgent — Fill Fast</h2>
                    <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
                      {rapidJobs.length} urgent
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {rapidJobs.map((job, i) => (
                      <JobCard key={job.id} job={job} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Regular jobs section */}
              {normalJobs.length > 0 && (
                <section aria-label="Available shifts">
                  {rapidJobs.length > 0 && !activeFilters.includes("rapid") && (
                    <h2 className="mb-4 text-lg font-bold">All open shifts</h2>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(activeFilters.includes("rapid") ? jobs : normalJobs).map(
                      (job, i) => (
                        <JobCard key={job.id} job={job} index={i} />
                      )
                    )}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {jobs.length === 0 && (
                <EmptyState
                  icon={SearchX}
                  title="No shifts found"
                  description={
                    filtersActive
                      ? "No shifts match your current filters. Try adjusting them."
                      : "No shifts are available right now. Check back soon!"
                  }
                  action={
                    filtersActive
                      ? { label: "Clear filters", onClick: clearAll }
                      : undefined
                  }
                  variant="muted"
                />
              )}

              {/* Load more */}
              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => load(true)}
                    disabled={loadingMore}
                    id="load-more-btn"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      <>
                        Load more shifts
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="h-fit lg:sticky lg:top-24 space-y-4">
          {/* Profile / login nudge card */}
          <div className="rounded-3xl border border-border bg-surface p-6">
            {isLoggedIn ? <LoggedInSidebar /> : <GuestSidebarNudge />}
          </div>

          {/* Stats card */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="size-4 text-primary" aria-hidden="true" />
              Live Opportunities
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Open shifts</dt>
                <dd className="font-bold text-primary">{jobs.length}{hasMore ? "+" : ""}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Urgent / rapid</dt>
                <dd className="font-bold text-orange-600 dark:text-orange-400">{rapidJobs.length}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Positions available</dt>
                <dd className="font-bold text-success">
                  {jobs.reduce((s, j) => s + j.availablePositions, 0)}
                </dd>
              </div>
            </dl>
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h3 className="mb-3 text-sm font-bold text-primary">How it works</h3>
            <ol className="space-y-2.5 text-xs text-muted-foreground">
              {[
                "Browse open shifts near you",
                "Pick a role and position",
                "Show up and get paid",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
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
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-xl font-bold text-primary-foreground shadow-brand">
        {user?.avatar ?? (user?.name?.[0] ?? "U")}
      </div>
      <h2 className="mt-4 text-lg font-semibold">{user?.name ?? "Your Profile"}</h2>
      {user?.location && (
        <p className="mt-0.5 text-sm text-muted-foreground">{user.location}</p>
      )}
      <div className="mt-3">
        <VerifiedBadge />
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        {[
          { label: "Shifts completed", value: "14" },
          { label: "Punctuality",      value: "98%",  cls: "text-success" },
          { label: "Rating",           value: "4.9",  star: true },
        ].map(({ label, value, cls, star }) => (
          <div key={label} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={`flex items-center gap-1 font-semibold ${cls ?? ""}`}>
              {star && <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />}
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <Button variant="outline" size="sm" className="mt-5 w-full" asChild>
        <Link to="/profile">Edit profile</Link>
      </Button>
    </>
  );
}

// ─── Guest nudge ──────────────────────────────────────────────────────────────

function GuestSidebarNudge() {
  const { openLoginModal } = useAuth();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Lock className="size-6" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          ?
        </span>
      </div>
      <h3 className="mt-4 text-base font-semibold">Ready to find work?</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a free account to apply, track applications, and build your verified profile.
      </p>
      <Button
        variant="hero"
        size="lg"
        className="mt-5 w-full"
        onClick={() => openLoginModal({ type: "book-shift" })}
        id="guest-signup-btn"
      >
        Sign up — it's free
      </Button>
      <button
        type="button"
        onClick={() => openLoginModal()}
        className="mt-3 text-sm text-primary hover:underline"
        id="guest-login-btn"
      >
        Already have an account? Log in
      </button>
    </div>
  );
}
