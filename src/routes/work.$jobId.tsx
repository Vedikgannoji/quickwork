import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Info,
  ListChecks,
  Lock,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Utensils,
  Users,
  UtensilsCrossed,
  Wallet,
  Wine,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { JobDetailsSkeleton } from "@/components/job-details-skeleton";
import { ErrorState } from "@/components/error-state";
import { RapidJobBadge } from "@/components/rapid-job-badge";
import { useAuth } from "@/lib/auth-context";
import { useApplications } from "@/lib/application-model";
import {
  JOB_CATEGORY_LABELS,
  JOB_TYPE_LABELS,
  type JobCategoryValue,
} from "@/lib/job-types";
import { supabase } from "@/lib/supabase";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/work/$jobId")({
  head: () => ({
    meta: [
      { title: "Job Details — QuickWork" },
      {
        name: "description",
        content:
          "View shift details, work categories, pay, and available positions. Book your spot on QuickWork.",
      },
    ],
  }),
  component: JobDetailsPage,
});

// ─── Data types ───────────────────────────────────────────────────────────────

interface WorkCategory {
  id: string;
  name: string;
  wage: number;
  requiredWorkers: number;
  availablePositions: number;
  bookedPositions: number;
  description: string | null;
  sortOrder: number;
}

interface JobDetail {
  id: string;
  jobTitle: string;
  category: string;
  description: string;
  jobType: string;
  venueName: string;
  fullAddress: string;
  area: string;
  city: string;
  landmark: string | null;
  jobDate: string;
  startTime: string;
  endTime: string;
  facilities: string[];
  requirements: {
    experience?: string;
    skills?: string[];
    dress_code?: string;
    documents_required?: string;
  } | null;
  instructions: {
    before_arrival?: string[];
    during_shift?: string[];
  } | null;
  reportingContact: {
    name?: string;
    phone?: string;
  } | null;
  isRapidJob: boolean;
  rapidJobExpiresAt: string | null;
  status: string;
  // Aggregated
  workCategories: WorkCategory[];
  totalPositions: number;
  bookedPositions: number;
  availablePositions: number;
}

// ─── Supabase fetch ───────────────────────────────────────────────────────────

async function fetchJobDetail(jobId: string): Promise<{
  job: JobDetail | null;
  error: string | null;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("jobs")
    .select(
      `
      id, job_title, category, description, job_type,
      venue_name, full_address, area, city, landmark,
      job_date, start_time, end_time,
      facilities, requirements, instructions, reporting_contact,
      is_rapid_job, rapid_job_expires_at, status,
      job_categories (
        id, name, description, required_workers, wage, sort_order,
        job_positions ( status )
      )
      `,
    )
    .eq("id", jobId)
    .single();

  if (error) {
    return { job: null, error: error.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workCategories: WorkCategory[] = ((row.job_categories ?? []) as any[])
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((cat: any) => {
      const positions = (cat.job_positions ?? []) as { status: string }[];
      const nonCancelled = positions.filter((p) => p.status !== "CANCELLED");
      const booked = nonCancelled.filter((p) => p.status === "BOOKED").length;
      const available = nonCancelled.filter(
        (p) => p.status === "AVAILABLE",
      ).length;

      return {
        id: cat.id as string,
        name: cat.name as string,
        wage: cat.wage as number,
        requiredWorkers: cat.required_workers as number,
        availablePositions: available,
        bookedPositions: booked,
        description: cat.description as string | null,
        sortOrder: cat.sort_order as number,
      };
    });

  const totalPositions = workCategories.reduce(
    (s, c) => s + c.requiredWorkers,
    0,
  );
  const bookedPositions = workCategories.reduce(
    (s, c) => s + c.bookedPositions,
    0,
  );
  const availablePositions = workCategories.reduce(
    (s, c) => s + c.availablePositions,
    0,
  );

  const job: JobDetail = {
    id: row.id,
    jobTitle: row.job_title,
    category: row.category,
    description: row.description,
    jobType: row.job_type,
    venueName: row.venue_name,
    fullAddress: row.full_address,
    area: row.area,
    city: row.city,
    landmark: row.landmark,
    jobDate: row.job_date,
    startTime: (row.start_time as string).slice(0, 5),
    endTime: (row.end_time as string).slice(0, 5),
    facilities: (row.facilities ?? []) as string[],
    requirements: (row.requirements as JobDetail["requirements"]) ?? null,
    instructions: (row.instructions as JobDetail["instructions"]) ?? null,
    reportingContact:
      (row.reporting_contact as JobDetail["reportingContact"]) ?? null,
    isRapidJob: row.is_rapid_job as boolean,
    rapidJobExpiresAt: row.rapid_job_expires_at as string | null,
    status: row.status as string,
    workCategories,
    totalPositions,
    bookedPositions,
    availablePositions,
  };

  return { job, error: null };
}

// ─── Mock data fallback ───────────────────────────────────────────────────────

const TODAY_ISO = new Date().toISOString().split("T")[0]!;

const MOCK_JOB: JobDetail = {
  id: "mock",
  jobTitle: "Wedding Event Staff — Grand Sapphire Banquets",
  category: "Hospitality",
  description:
    "We're looking for experienced event staff for a premium wedding reception at Grand Sapphire Banquets. You'll be responsible for serving guests during the reception, ensuring drinks are refilled, clearing plates, and maintaining a professional demeanor throughout the event. This is a high-end venue with elevated expectations for service quality. Prior banquet experience is an advantage.",
  jobType: "one-time",
  venueName: "Grand Sapphire Banquets",
  fullAddress: "Plot 12, Financial District, Nanakramguda",
  area: "Gachibowli",
  city: "Hyderabad",
  landmark: "Near Cyber Towers",
  jobDate: TODAY_ISO,
  startTime: "19:00",
  endTime: "23:30",
  facilities: ["Meals provided", "Uniform", "Transport"],
  requirements: {
    experience: "1–2 years in banquet or catering service preferred",
    skills: ["Fine dining service", "Tray carrying", "Guest interaction"],
    dress_code: "Black trousers, white shirt (uniform jacket provided)",
    documents_required: "Aadhar card, 2 passport photos",
  },
  instructions: {
    before_arrival: [
      "Arrive 30 minutes before shift start",
      "Report to the supervisor at the main entrance",
      "Bring required documents",
      "Wear black formal shoes",
    ],
    during_shift: [
      "Follow supervisor instructions at all times",
      "Maintain professional appearance",
      "Handle guest requests promptly",
      "Clear tables between courses",
    ],
  },
  reportingContact: { name: "Rajesh Kumar", phone: "+91 98765 43210" },
  isRapidJob: true,
  rapidJobExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  status: "Open",
  workCategories: [
    {
      id: "cat-1",
      name: "Food Serving",
      wage: 1200,
      requiredWorkers: 5,
      availablePositions: 3,
      bookedPositions: 2,
      description: "Serve food courses to guests at assigned tables.",
      sortOrder: 1,
    },
    {
      id: "cat-2",
      name: "Liquor Serving",
      wage: 1400,
      requiredWorkers: 3,
      availablePositions: 1,
      bookedPositions: 2,
      description: "Pour and serve beverages including wine and spirits.",
      sortOrder: 2,
    },
    {
      id: "cat-3",
      name: "Starters Serving",
      wage: 1200,
      requiredWorkers: 2,
      availablePositions: 2,
      bookedPositions: 0,
      description: "Circulate among guests with starter trays.",
      sortOrder: 3,
    },
    {
      id: "cat-4",
      name: "Juice Serving",
      wage: 1100,
      requiredWorkers: 2,
      availablePositions: 2,
      bookedPositions: 0,
      description: "Serve soft drinks and juices at refreshment counters.",
      sortOrder: 4,
    },
  ],
  totalPositions: 12,
  bookedPositions: 4,
  availablePositions: 8,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLabel(
  isoDate: string,
  startTime: string,
  endTime: string,
): string {
  const date = new Date(isoDate + "T00:00");
  const dayLabel = date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  function fmt(t: string) {
    const [h, m] = t.split(":").map(Number);
    const suffix = h! >= 12 ? "PM" : "AM";
    const dh = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
    return `${dh}:${String(m!).padStart(2, "0")} ${suffix}`;
  }

  return `${dayLabel} · ${fmt(startTime)} – ${fmt(endTime)}`;
}

function shiftDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh! * 60 + em!) - (sh! * 60 + sm!);
  if (mins < 0) mins += 24 * 60; // crosses midnight
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function categoryIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("food") || lower.includes("starters") || lower.includes("kitchen"))
    return <UtensilsCrossed className="size-4" aria-hidden="true" />;
  if (lower.includes("liquor") || lower.includes("wine") || lower.includes("beverage") || lower.includes("bar"))
    return <Wine className="size-4" aria-hidden="true" />;
  if (lower.includes("juice") || lower.includes("mocktail") || lower.includes("drink"))
    return <Utensils className="size-4" aria-hidden="true" />;
  if (lower.includes("delivery") || lower.includes("transport"))
    return <Truck className="size-4" aria-hidden="true" />;
  if (lower.includes("warehouse") || lower.includes("loading"))
    return <Package className="size-4" aria-hidden="true" />;
  if (lower.includes("steward") || lower.includes("floor") || lower.includes("server"))
    return <Sparkles className="size-4" aria-hidden="true" />;
  return <Users className="size-4" aria-hidden="true" />;
}

function categoryEmoji(jobCategory: string): string {
  const map: Record<string, string> = {
    Hospitality:  "🍽",
    Events:       "🎪",
    Delivery:     "🚚",
    Retail:       "🛒",
    Construction: "👷",
    Warehouse:    "📦",
    Cleaning:     "🧹",
    Other:        "💼",
  };
  return map[jobCategory] ?? "💼";
}

// ─── Animated progress bar ────────────────────────────────────────────────────

function HiringProgressBar({
  booked,
  total,
  isRapid,
}: {
  booked: number;
  total: number;
  isRapid: boolean;
}) {
  const [width, setWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const t = setTimeout(() => {
        setWidth(total > 0 ? Math.round((booked / total) * 100) : 0);
      }, 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [booked, total]);

  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
  const isFull = booked >= total && total > 0;
  const isLow = !isFull && total - booked <= 3 && total > 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold font-display">
          {booked}
          <span className="text-base font-normal text-muted-foreground">
            &nbsp;/ {total} filled
          </span>
        </span>
        <span
          className={`text-sm font-semibold ${
            isFull
              ? "text-muted-foreground"
              : isLow
                ? "text-orange-600 dark:text-orange-400"
                : "text-success"
          }`}
        >
          {isFull
            ? "All filled"
            : isLow
              ? `Only ${total - booked} left!`
              : `${total - booked} open`}
        </span>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={booked}
        aria-valuemax={total}
        aria-label={`${booked} of ${total} positions filled`}
      >
        <div
          className={`h-full rounded-full transition-all duration-[900ms] ease-out ${
            isFull
              ? "bg-muted-foreground/40"
              : isLow || isRapid
                ? "bg-gradient-to-r from-orange-500 to-amber-400"
                : "bg-gradient-to-r from-primary to-brand-deep"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{pct}% positions confirmed</p>
    </div>
  );
}

// ─── Work category card ───────────────────────────────────────────────────────

function CategoryCard({
  cat,
  index,
  isRapid,
}: {
  cat: WorkCategory;
  index: number;
  isRapid: boolean;
}) {
  const isCatFull = cat.availablePositions === 0;
  const isLow = !isCatFull && cat.availablePositions <= 2;
  const fillPct =
    cat.requiredWorkers > 0
      ? Math.round((cat.bookedPositions / cat.requiredWorkers) * 100)
      : 0;

  return (
    <div
      className={`animate-bounce-in rounded-2xl border-2 p-5 transition-all duration-200 ${
        isCatFull
          ? "border-border bg-muted/20 opacity-60"
          : isLow
            ? "border-orange-500/40 bg-orange-500/5"
            : "border-border bg-card hover:border-primary/40"
      }`}
      style={{
        animationDelay: `${180 + index * 70}ms`,
        animationFillMode: "both",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
              isRapid && !isCatFull
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "bg-primary/10 text-primary"
            }`}
          >
            {categoryIcon(cat.name)}
          </div>
          <div>
            <h3 className="font-bold leading-tight">{cat.name}</h3>
            {cat.description && (
              <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                {cat.description}
              </p>
            )}
          </div>
        </div>

        {/* Wage */}
        <div className="text-right shrink-0">
          <p
            className={`font-display text-xl font-bold ${
              isRapid && !isCatFull
                ? "text-orange-600 dark:text-orange-400"
                : isCatFull
                  ? "text-muted-foreground"
                  : "text-primary"
            }`}
          >
            ₹{cat.wage.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-muted-foreground">/ shift</p>
        </div>
      </div>

      {/* Position row */}
      <div className="mt-4 flex items-center gap-3">
        {/* Mini progress */}
        <div className="flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isCatFull
                  ? "bg-muted-foreground/40"
                  : isLow
                    ? "bg-orange-500"
                    : "bg-primary"
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-2 text-sm shrink-0">
          <span className="text-muted-foreground">
            {cat.requiredWorkers} needed
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span
            className={`font-bold ${
              isCatFull
                ? "text-muted-foreground"
                : isLow
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-success"
            }`}
          >
            {isCatFull ? "Full" : `${cat.availablePositions} open`}
          </span>
        </div>
      </div>

      {/* Low warning pill */}
      {isLow && !isCatFull && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
          <span className="inline-block size-1.5 rounded-full bg-orange-500 animate-pulse" />
          Filling fast — {cat.availablePositions} position{cat.availablePositions !== 1 ? "s" : ""} left
        </div>
      )}
      {isCatFull && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          All positions filled
        </p>
      )}
    </div>
  );
}

// ─── Section wrapper with stagger ─────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <section
      className="animate-rise"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <h2 className="flex items-center gap-2.5 text-lg font-bold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function JobDetailsPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { isLoggedIn, openLoginModal, user } = useAuth();
  const { submitApplication, hasApplied, getApplicationsByWorker } =
    useApplications();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  const currentWorkerId = user?.id ?? "guest";
  const alreadyApplied = isLoggedIn && hasApplied(currentWorkerId, jobId);
  const myApplications = isLoggedIn
    ? getApplicationsByWorker(currentWorkerId)
    : [];
  const myApplication = myApplications.find((a) => a.jobId === jobId);
  const isConfirmed = myApplication?.status === "Confirmed";

  // Fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // For mock IDs, skip Supabase and use mock immediately
    if (
      jobId.startsWith("mock-") ||
      ["1", "2", "3", "4", "5", "6", "7"].includes(jobId)
    ) {
      setTimeout(() => {
        if (!cancelled) {
          setJob({ ...MOCK_JOB, id: jobId });
          setIsMock(true);
          setLoading(false);
        }
      }, 600);
      return () => { cancelled = true; };
    }

    fetchJobDetail(jobId).then((result) => {
      if (cancelled) return;
      if (result.error || !result.job) {
        // Supabase not configured or job not found — use mock gracefully
        setJob({ ...MOCK_JOB, id: jobId });
        setIsMock(true);
        setError(null);
      } else {
        setJob(result.job);
        setIsMock(false);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [jobId]);

  function handleApply() {
    if (!isLoggedIn) {
      openLoginModal({ type: "book-shift", payload: jobId });
      return;
    }
    if (!job || job.availablePositions <= 0) return;

    const result = submitApplication({
      workerId: currentWorkerId,
      jobId: jobId,
    });

    if (result.success) {
      toast.success("Application submitted!", {
        description: "The employer will review your application shortly.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const msgs: Record<string, string> = {
        duplicate_application: "You've already applied to this job.",
        invalid_params: "Invalid application data. Please try again.",
      };
      toast.error("Cannot apply", {
        description: result.reason
          ? (msgs[result.reason] ?? "Something went wrong.")
          : result.message ?? "Failed to submit. Please try again.",
      });
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <JobDetailsSkeleton />;

  // ── Job not found ──────────────────────────────────────────────────────────
  if (!job) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
        <ErrorState
          type="notFound"
          title="Job Not Found"
          description="This job listing doesn't exist or has been removed."
          onRetry={() => navigate({ to: "/work" })}
        />
      </div>
    );
  }

  const isFull = job.availablePositions === 0 && job.totalPositions > 0;
  const isExpired =
    job.isRapidJob &&
    job.rapidJobExpiresAt &&
    new Date(job.rapidJobExpiresAt) < new Date();
  const isCancelled = job.status === "Cancelled";
  const isJobClosed = isCancelled || (isExpired && job.availablePositions === 0);

  const dateLabel = formatDateLabel(job.jobDate, job.startTime, job.endTime);
  const duration = shiftDuration(job.startTime, job.endTime);

  const minWage = job.workCategories.length > 0
    ? Math.min(...job.workCategories.map((c) => c.wage))
    : 0;
  const maxWage = job.workCategories.length > 0
    ? Math.max(...job.workCategories.map((c) => c.wage))
    : 0;

  const wageText =
    minWage === maxWage || maxWage === 0
      ? `₹${minWage.toLocaleString("en-IN")}`
      : `₹${minWage.toLocaleString("en-IN")} – ₹${maxWage.toLocaleString("en-IN")}`;

  const skills = (job.requirements?.skills ?? []) as string[];
  const beforeArrival = (job.instructions?.before_arrival ?? []) as string[];
  const duringShift = (job.instructions?.during_shift ?? []) as string[];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-32 lg:pb-0">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 py-3 lg:px-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/work">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to jobs
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div
        className={`animate-rise ${
          job.isRapidJob && !isJobClosed
            ? "bg-gradient-to-br from-orange-500/12 via-orange-500/5 to-transparent border-b border-orange-500/20"
            : "border-b border-border"
        }`}
        style={{ animationFillMode: "both" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">

              {/* Rapid badge */}
              {job.isRapidJob && !isJobClosed && (
                <div className="mb-3">
                  {job.rapidJobExpiresAt ? (
                    <RapidJobBadge
                      rapidJobExpiresAt={job.rapidJobExpiresAt}
                      variant="default"
                    />
                  ) : (
                    <RapidJobBadge variant="default" />
                  )}
                </div>
              )}

              {/* Title */}
              <h1
                className={`text-3xl font-bold leading-tight sm:text-4xl ${
                  isCancelled ? "text-muted-foreground line-through" : ""
                }`}
              >
                {job.jobTitle}
              </h1>

              {/* Category + status row */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  <span aria-hidden="true">{categoryEmoji(job.category)}</span>
                  {JOB_CATEGORY_LABELS[job.category as JobCategoryValue] ??
                    job.category}
                </span>
                {isCancelled && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm font-semibold text-destructive">
                    <X className="size-3.5" aria-hidden="true" />
                    Cancelled
                  </span>
                )}
                {isMock && (
                  <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Preview
                  </span>
                )}
              </div>

              {/* Quick info strip */}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  <strong className="text-foreground">{job.venueName}</strong>
                  &nbsp;·&nbsp;{job.area}, {job.city}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                  {dateLabel}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4 shrink-0" aria-hidden="true" />
                  {duration} shift
                </span>
              </div>
            </div>

            {/* Wage callout */}
            <div
              className={`shrink-0 rounded-2xl border-2 px-6 py-4 text-center ${
                job.isRapidJob && !isJobClosed
                  ? "border-orange-500/40 bg-orange-500/10"
                  : "border-primary/30 bg-primary/8"
              }`}
            >
              <p
                className={`font-display text-3xl font-bold ${
                  job.isRapidJob && !isJobClosed
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-primary"
                }`}
              >
                {wageText}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                per shift
              </p>
              {job.isRapidJob && !isJobClosed && (
                <p className="mt-1 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                  +20% surge pricing
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">

          {/* ── Left column ────────────────────────────────────────────────── */}
          <div className="space-y-10">

            {/* Hiring progress */}
            <section
              className={`animate-rise rounded-2xl border-2 p-6 ${
                isFull
                  ? "border-border bg-muted/20"
                  : job.isRapidJob
                    ? "border-orange-500/30 bg-orange-500/5"
                    : "border-primary/20 bg-primary/5"
              }`}
              style={{ animationDelay: "60ms", animationFillMode: "both" }}
            >
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Hiring Progress
              </p>
              <HiringProgressBar
                booked={job.bookedPositions}
                total={job.totalPositions}
                isRapid={job.isRapidJob}
              />
            </section>

            {/* Work categories */}
            <Section title="Work Categories" icon={Users} delay={120}>
              {job.workCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories defined for this job.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {job.workCategories.map((cat, i) => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      index={i}
                      isRapid={job.isRapidJob}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* Description */}
            <Section title="About this shift" icon={Info} delay={220}>
              <p className="leading-relaxed text-muted-foreground">
                {job.description}
              </p>
            </Section>

            {/* Requirements */}
            {(job.requirements?.experience ||
              skills.length > 0 ||
              job.requirements?.dress_code ||
              job.requirements?.documents_required) && (
              <Section title="Requirements" icon={ListChecks} delay={300}>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
                  {job.requirements?.experience && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Experience
                      </p>
                      <p className="mt-1.5 text-sm">{job.requirements.experience}</p>
                    </div>
                  )}
                  {skills.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Skills
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skills.map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/8 px-3 py-1 text-sm font-medium text-primary"
                          >
                            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {job.requirements?.dress_code && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Dress Code
                      </p>
                      <p className="mt-1.5 text-sm">{job.requirements.dress_code}</p>
                    </div>
                  )}
                  {job.requirements?.documents_required && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Documents Required
                      </p>
                      <p className="mt-1.5 text-sm">{job.requirements.documents_required}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Facilities */}
            {job.facilities.length > 0 && (
              <Section title="Facilities Provided" icon={CheckCircle2} delay={360}>
                <div className="flex flex-wrap gap-2">
                  {job.facilities.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-2 text-sm font-semibold text-success"
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      {f}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Instructions */}
            {(beforeArrival.length > 0 || duringShift.length > 0) && (
              <Section title="Shift Instructions" icon={Clock} delay={420}>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-6">
                  {beforeArrival.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Before Arrival
                      </p>
                      <ul className="mt-3 space-y-2">
                        {beforeArrival.map((inst, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm">
                            <Check
                              className="mt-0.5 size-4 shrink-0 text-primary"
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                            {inst}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {duringShift.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        During Shift
                      </p>
                      <ul className="mt-3 space-y-2">
                        {duringShift.map((inst, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm">
                            <Check
                              className="mt-0.5 size-4 shrink-0 text-primary"
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                            {inst}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contact — only for confirmed */}
                  {isConfirmed && job.reportingContact?.name && (
                    <div className="rounded-xl border border-success/40 bg-success/8 p-4">
                      <div className="flex items-center gap-2 text-success">
                        <Phone className="size-4" aria-hidden="true" />
                        <p className="font-semibold text-sm">Reporting Contact</p>
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {job.reportingContact.name}
                      </p>
                      {job.reportingContact.phone && (
                        <a
                          href={`tel:${job.reportingContact.phone}`}
                          className="mt-1 inline-block text-sm font-bold text-primary hover:underline"
                        >
                          {job.reportingContact.phone}
                        </a>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Contact details visible because your booking is confirmed
                      </p>
                    </div>
                  )}
                  {!isConfirmed && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      <Lock className="size-4 shrink-0" aria-hidden="true" />
                      Reporting contact revealed after booking confirmation
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* My application status */}
            {alreadyApplied && myApplication && (
              <section
                className={`animate-rise rounded-2xl border-2 p-6 ${
                  myApplication.status === "Confirmed"
                    ? "border-success/40 bg-success/5"
                    : "border-primary/30 bg-primary/5"
                }`}
                style={{ animationDelay: "480ms", animationFillMode: "both" }}
              >
                <h2 className="flex items-center gap-2 font-bold text-lg">
                  {myApplication.status === "Confirmed" && (
                    <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                  )}
                  {myApplication.status === "Pending" && (
                    <Clock className="size-5 text-primary" aria-hidden="true" />
                  )}
                  My Application
                </h2>
                <div className="mt-4">
                  {myApplication.status === "Pending" && (
                    <>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                        Under Review
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Your application is waiting for employer review. You'll
                        be notified once confirmed.
                      </p>
                    </>
                  )}
                  {myApplication.status === "Confirmed" && (
                    <>
                      <p className="text-sm font-bold text-success">Confirmed!</p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Your booking is confirmed. Check the instructions above
                        for reporting details.
                      </p>
                      <Button variant="hero" size="lg" className="mt-4" asChild>
                        <Link
                          to="/booking-confirmation/$applicationId"
                          params={{ applicationId: myApplication.id }}
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          View Booking Confirmation
                        </Link>
                      </Button>
                    </>
                  )}
                  {myApplication.status === "Waitlisted" && (
                    <>
                      <p className="text-sm font-bold text-primary">Waitlisted</p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        You're on the waitlist. We'll notify you if a position
                        opens up.
                      </p>
                    </>
                  )}
                  {myApplication.status === "NotSelected" && (
                    <>
                      <p className="text-sm font-bold text-muted-foreground">
                        Not Selected
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Unfortunately, your application wasn't selected for this
                        job.
                      </p>
                    </>
                  )}
                  {myApplication.posterNote && (
                    <div className="mt-4 rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Employer note:
                      </p>
                      <p className="mt-1 text-sm">{myApplication.posterNote}</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* ── Right column (sticky booking panel, desktop) ───────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <BookingPanel
                job={job}
                wageText={wageText}
                isFull={isFull}
                isJobClosed={!!isJobClosed}
                alreadyApplied={alreadyApplied}
                isLoggedIn={isLoggedIn}
                onApply={handleApply}
              />

              {/* Venue info card */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-sm font-bold">Location</h3>
                <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <MapPin className="size-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">{job.venueName}</p>
                    <p>{job.fullAddress}</p>
                    <p>{job.city}</p>
                    {job.landmark && (
                      <p className="mt-1 text-xs">Near {job.landmark}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Job type */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold">Job Type</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {JOB_TYPE_LABELS[job.jobType as keyof typeof JOB_TYPE_LABELS] ?? job.jobType}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile sticky bottom bar ───────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-border bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p
                className={`font-display text-xl font-bold ${
                  job.isRapidJob && !isJobClosed
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-primary"
                }`}
              >
                {wageText}
              </p>
              <p className="text-xs text-muted-foreground">
                {isFull
                  ? "All positions filled"
                  : `${job.availablePositions} position${job.availablePositions !== 1 ? "s" : ""} available`}
              </p>
            </div>
            <CtaButton
              job={job}
              isFull={isFull}
              isJobClosed={!!isJobClosed}
              alreadyApplied={alreadyApplied}
              isLoggedIn={isLoggedIn}
              onApply={handleApply}
              className="min-w-[160px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop booking panel ─────────────────────────────────────────────────────

function BookingPanel({
  job,
  wageText,
  isFull,
  isJobClosed,
  alreadyApplied,
  isLoggedIn,
  onApply,
}: {
  job: JobDetail;
  wageText: string;
  isFull: boolean;
  isJobClosed: boolean;
  alreadyApplied: boolean;
  isLoggedIn: boolean;
  onApply: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-6 ${
        job.isRapidJob && !isJobClosed
          ? "border-orange-500/40 bg-orange-500/8"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      {/* Wage */}
      <p
        className={`font-display text-3xl font-bold ${
          job.isRapidJob && !isJobClosed
            ? "text-orange-600 dark:text-orange-400"
            : "text-primary"
        }`}
      >
        {wageText}
      </p>
      <p className="text-xs text-muted-foreground">per shift</p>

      {/* Availability */}
      <div className="mt-4 rounded-xl border border-border bg-background/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Availability
        </p>
        <p
          className={`mt-1 text-lg font-bold ${
            isFull
              ? "text-muted-foreground"
              : job.availablePositions <= 3
                ? "text-orange-600 dark:text-orange-400"
                : "text-success"
          }`}
        >
          {isFull ? "All positions filled" : `${job.availablePositions} open`}
        </p>
        <p className="text-xs text-muted-foreground">
          {job.bookedPositions} / {job.totalPositions} confirmed
        </p>
      </div>

      {/* CTA */}
      <div className="mt-4">
        <CtaButton
          job={job}
          isFull={isFull}
          isJobClosed={isJobClosed}
          alreadyApplied={alreadyApplied}
          isLoggedIn={isLoggedIn}
          onApply={onApply}
          className="w-full"
        />
      </div>

      {/* Trust signals */}
      {!isFull && !isJobClosed && (
        <div className="mt-4 space-y-2">
          {[
            { icon: ShieldCheck, label: "Wage guaranteed before you book" },
            { icon: Star,         label: "Verified employer" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CTA button (shared by desktop panel + mobile bar) ─────────────────────────

function CtaButton({
  job,
  isFull,
  isJobClosed,
  alreadyApplied,
  isLoggedIn,
  onApply,
  className = "",
}: {
  job: JobDetail;
  isFull: boolean;
  isJobClosed: boolean;
  alreadyApplied: boolean;
  isLoggedIn: boolean;
  onApply: () => void;
  className?: string;
}) {
  // For open jobs, authenticated users go straight to the position-selection screen
  const jobIdParam = job.id;
  if (alreadyApplied) {
    return (
      <Button variant="secondary" size="lg" disabled className={className}>
        <Check className="size-4" aria-hidden="true" />
        Application Submitted
      </Button>
    );
  }

  if (isFull) {
    return (
      <Button variant="outline" size="lg" disabled className={className}>
        <Users className="size-4" aria-hidden="true" />
        Job Full
      </Button>
    );
  }

  if (isJobClosed) {
    return (
      <Button variant="outline" size="lg" disabled className={className}>
        <Clock className="size-4" aria-hidden="true" />
        {job.status === "Cancelled" ? "Job Cancelled" : "Job Expired"}
      </Button>
    );
  }

  if (job.isRapidJob) {
    if (!isLoggedIn) {
      return (
        <Button
          variant="destructive"
          size="lg"
          onClick={onApply}
          className={`bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 transition-all duration-200 active:scale-[0.98] ${className}`}
          id="rapid-apply-btn"
        >
          <Lock className="size-4" aria-hidden="true" />
          Sign in to Apply
        </Button>
      );
    }
    return (
      <Button
        variant="destructive"
        size="lg"
        className={`bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 transition-all duration-200 active:scale-[0.98] ${className}`}
        id="rapid-apply-btn"
        asChild
      >
        <Link to="/work/$jobId/positions" params={{ jobId: jobIdParam }}>
          <Zap className="size-4 fill-current" aria-hidden="true" />
          Select Position — Urgent
        </Link>
      </Button>
    );
  }

  if (!isLoggedIn) {
    return (
      <Button
        variant="hero"
        size="lg"
        onClick={onApply}
        className={`active:scale-[0.98] transition-all duration-200 ${className}`}
        id="apply-btn"
      >
        <Lock className="size-4" aria-hidden="true" />
        Sign in to Apply
      </Button>
    );
  }

  return (
    <Button
      variant="hero"
      size="lg"
      className={`active:scale-[0.98] transition-all duration-200 ${className}`}
      id="apply-btn"
      asChild
    >
      <Link to="/work/$jobId/positions" params={{ jobId: jobIdParam }}>
        <Zap className="size-4" aria-hidden="true" />
        Select a Position
      </Link>
    </Button>
  );
}
