import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useApplications } from "@/lib/application-model";
import { JOB_CATEGORY_LABELS } from "@/lib/job-types";

export const Route = createFileRoute("/my-jobs")({
  head: () => ({
    meta: [
      { title: "My Jobs — QuickWork" },
      {
        name: "description",
        content: "Manage all your posted jobs. Track applications, confirm workers, and view job details.",
      },
      { property: "og:title", content: "QuickWork — My Jobs Dashboard" },
      {
        property: "og:description",
        content: "Manage your posted jobs and track worker applications.",
      },
    ],
  }),
  component: MyJobsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = "Open" | "Partially Filled" | "Fully Filled" | "Completed" | "Cancelled";

type Job = {
  id: string;
  jobTitle: string;
  category: string;
  venueName: string;
  area: string;
  city: string;
  date: string;
  startTime: string;
  endTime: string;
  wage: number;
  wageDisplay: string;
  positionsTotal: number;
  positionsFilled: number;
  positionsRemaining: number;
  status: JobStatus;
  isRapidJob?: boolean;
  rapidJobExpiresAt?: string;
  postedAt: string;
  posterId: string;
};

// ─── Mock Jobs Data ───────────────────────────────────────────────────────────

const mockJobs: Job[] = [
  {
    id: "1",
    jobTitle: "Banquet servers for wedding reception",
    category: "Hospitality",
    venueName: "Grand Palm Banquets",
    area: "Andheri East",
    city: "Mumbai",
    date: "2026-09-10",
    startTime: "17:00",
    endTime: "23:00",
    wage: 1200,
    wageDisplay: "₹1,200",
    positionsTotal: 4,
    positionsFilled: 2,
    positionsRemaining: 2,
    status: "Partially Filled",
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    postedAt: "2026-09-09T10:00:00Z",
    posterId: "poster_1",
  },
  {
    id: "2",
    jobTitle: "Kitchen staff for catering event",
    category: "Hospitality",
    venueName: "Commercial Kitchen Complex",
    area: "Powai",
    city: "Mumbai",
    date: "2026-09-11",
    startTime: "09:00",
    endTime: "16:00",
    wage: 950,
    wageDisplay: "₹950",
    positionsTotal: 6,
    positionsFilled: 6,
    positionsRemaining: 0,
    status: "Fully Filled",
    isRapidJob: false,
    postedAt: "2026-09-08T14:30:00Z",
    posterId: "poster_1",
  },
  {
    id: "3",
    jobTitle: "Event stewards for corporate conference",
    category: "Events",
    venueName: "Convention Center",
    area: "Bandra Kurla",
    city: "Mumbai",
    date: "2026-09-11",
    startTime: "15:00",
    endTime: "22:00",
    wage: 1400,
    wageDisplay: "₹1,400",
    positionsTotal: 8,
    positionsFilled: 5,
    positionsRemaining: 3,
    status: "Partially Filled",
    isRapidJob: false,
    postedAt: "2026-09-07T09:00:00Z",
    posterId: "poster_1",
  },
  {
    id: "4",
    jobTitle: "Dishwashing crew for restaurant",
    category: "Hospitality",
    venueName: "Coastal Restaurant",
    area: "Lower Parel",
    city: "Mumbai",
    date: "2026-09-12",
    startTime: "18:00",
    endTime: "00:00",
    wage: 900,
    wageDisplay: "₹900",
    positionsTotal: 3,
    positionsFilled: 0,
    positionsRemaining: 3,
    status: "Open",
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    postedAt: "2026-09-09T16:45:00Z",
    posterId: "poster_1",
  },
  {
    id: "5",
    jobTitle: "Warehouse loading staff",
    category: "Warehouse",
    venueName: "Industrial Area Phase 2",
    area: "Bhiwandi",
    city: "Mumbai",
    date: "2026-09-05",
    startTime: "10:00",
    endTime: "18:00",
    wage: 1100,
    wageDisplay: "₹1,100",
    positionsTotal: 10,
    positionsFilled: 10,
    positionsRemaining: 0,
    status: "Completed",
    isRapidJob: false,
    postedAt: "2026-09-01T11:00:00Z",
    posterId: "poster_1",
  },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getStatusColor(status: JobStatus) {
  switch (status) {
    case "Open":
      return {
        bg: "bg-primary/10",
        text: "text-primary",
        border: "border-primary/40",
      };
    case "Partially Filled":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800",
      };
    case "Fully Filled":
      return {
        bg: "bg-success/10",
        text: "text-success",
        border: "border-success/40",
      };
    case "Completed":
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-border",
      };
    case "Cancelled":
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
        border: "border-destructive/40",
      };
  }
}

function getStatusIcon(status: JobStatus) {
  switch (status) {
    case "Open":
      return Clock;
    case "Partially Filled":
      return Users;
    case "Fully Filled":
      return CheckCircle2;
    case "Completed":
      return BadgeCheck;
    case "Cancelled":
      return XCircle;
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

function MyJobsPage() {
  const { user, isLoggedIn, openLoginModal } = useAuth();
  const { getApplicationsForJob, getJobApplicationStats } = useApplications();

  const [statusFilter, setStatusFilter] = useState<JobStatus | "All">("All");

  // Redirect if not logged in
  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Briefcase className="size-8" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Login Required</h1>
          <p className="mt-2 text-muted-foreground">
            Please log in to view your posted jobs.
          </p>
          <Button
            variant="hero"
            size="lg"
            className="mt-6"
            onClick={() => openLoginModal()}
          >
            Log in to continue
          </Button>
        </div>
      </div>
    );
  }

  // Filter jobs by current user (in real app, would fetch from backend)
  const myJobs = mockJobs.filter((job) => job.posterId === user?.id || job.posterId === "poster_1");

  const filteredJobs =
    statusFilter === "All" ? myJobs : myJobs.filter((job) => job.status === statusFilter);

  // Count by status
  const counts = {
    all: myJobs.length,
    open: myJobs.filter((j) => j.status === "Open").length,
    partiallyFilled: myJobs.filter((j) => j.status === "Partially Filled").length,
    fullyFilled: myJobs.filter((j) => j.status === "Fully Filled").length,
    completed: myJobs.filter((j) => j.status === "Completed").length,
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Employer Dashboard</p>
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">My Jobs</h1>
          <p className="mt-3 text-muted-foreground">
            Manage your posted jobs and track worker applications.
          </p>
        </div>
        <Button variant="hero" size="lg" asChild>
          <Link to="/post-job">
            <Plus className="size-4" /> Post New Job
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard
          label="All Jobs"
          value={counts.all}
          icon={Briefcase}
          isActive={statusFilter === "All"}
          onClick={() => setStatusFilter("All")}
        />
        <StatCard
          label="Open"
          value={counts.open}
          icon={Clock}
          color="text-primary"
          isActive={statusFilter === "Open"}
          onClick={() => setStatusFilter("Open")}
        />
        <StatCard
          label="Partially Filled"
          value={counts.partiallyFilled}
          icon={Users}
          color="text-amber-600"
          isActive={statusFilter === "Partially Filled"}
          onClick={() => setStatusFilter("Partially Filled")}
        />
        <StatCard
          label="Fully Filled"
          value={counts.fullyFilled}
          icon={CheckCircle2}
          color="text-success"
          isActive={statusFilter === "Fully Filled"}
          onClick={() => setStatusFilter("Fully Filled")}
        />
        <StatCard
          label="Completed"
          value={counts.completed}
          icon={BadgeCheck}
          color="text-muted-foreground"
          isActive={statusFilter === "Completed"}
          onClick={() => setStatusFilter("Completed")}
        />
      </div>

      {/* Jobs List */}
      <div className="mt-8">
        {filteredJobs.length === 0 ? (
          <EmptyState statusFilter={statusFilter} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <h3 className="font-semibold text-primary">Quick Actions</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link to="/post-job">
              <Plus className="size-4" /> Post Another Job
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/hire">
              <Briefcase className="size-4" /> View All Applications
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/work">
              <ArrowLeft className="size-4" /> Browse Worker Pool
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Job Card Component ───────────────────────────────────────────────────────

function JobCard({ job }: { job: Job }) {
  const fillPercentage = Math.round((job.positionsFilled / job.positionsTotal) * 100);
  const statusColors = getStatusColor(job.status);
  const StatusIcon = getStatusIcon(job.status);

  // Format date
  const jobDate = new Date(job.date);
  const formattedDate = jobDate.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-lift">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-semibold leading-snug">{job.jobTitle}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {JOB_CATEGORY_LABELS[job.category as keyof typeof JOB_CATEGORY_LABELS]}
            </span>
            {job.isRapidJob && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-orange-500 bg-orange-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                <Zap className="size-3 fill-current" />
                Rapid
              </span>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
        >
          <StatusIcon className="size-3.5" />
          {job.status}
        </span>
      </div>

      {/* Venue & Date */}
      <div className="mt-4 space-y-2 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="size-4 shrink-0" />
          <span className="font-medium text-foreground">{job.venueName}</span>
          <span>·</span>
          <span>{job.area}</span>
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="size-4 shrink-0" />
          {formattedDate} · {job.startTime} – {job.endTime}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="size-4 shrink-0" />
          <span className="font-semibold text-foreground">{job.wageDisplay}</span> per worker
        </p>
      </div>

      {/* Fill Progress */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">
            <Users className="mr-1.5 inline size-4" />
            Filled
          </span>
          <span className="font-bold">
            {job.positionsFilled}/{job.positionsTotal} — {fillPercentage}%
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              fillPercentage === 100
                ? "bg-success"
                : fillPercentage >= 50
                ? "bg-amber-500"
                : "bg-primary"
            }`}
            style={{ width: `${fillPercentage}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {job.positionsRemaining > 0 ? (
            <>
              {job.positionsRemaining} position{job.positionsRemaining !== 1 ? "s" : ""} remaining
            </>
          ) : (
            "All positions filled"
          )}
        </p>
      </div>

      {/* View Job Button */}
      <Button variant="outline" size="lg" className="mt-5 w-full" asChild>
        <Link to="/hire/$jobId" params={{ jobId: job.id }}>
          View Job & Applications
        </Link>
      </Button>
    </article>
  );
}

// ─── Stat Card Component ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-foreground",
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Briefcase;
  color?: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col rounded-xl border p-4 text-left transition-all hover:shadow-md ${
        isActive
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`size-5 ${isActive ? "text-primary" : color}`} />
        <span className={`text-2xl font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
          {value}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-muted-foreground">{label}</p>
    </button>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ statusFilter }: { statusFilter: JobStatus | "All" }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-primary">
        <Briefcase className="size-8" />
      </div>
      <h3 className="mt-6 text-xl font-semibold">
        {statusFilter === "All" ? "No jobs posted yet" : `No ${statusFilter.toLowerCase()} jobs`}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {statusFilter === "All"
          ? "Start by posting your first job to find verified workers."
          : `You don't have any ${statusFilter.toLowerCase()} jobs at the moment.`}
      </p>
      {statusFilter === "All" && (
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/post-job">
            <Plus className="size-4" /> Post Your First Job
          </Link>
        </Button>
      )}
      {statusFilter !== "All" && (
        <Button variant="outline" size="lg" className="mt-6" onClick={() => {}}>
          View All Jobs
        </Button>
      )}
    </div>
  );
}
