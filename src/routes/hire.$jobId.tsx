import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Edit,
  MapPin,
  Pause,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApplicantCardListSkeleton } from "@/components/applicant-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/lib/auth-context";
import { useApplications } from "@/lib/application-model";
import { JOB_CATEGORY_LABELS } from "@/lib/job-types";

export const Route = createFileRoute("/hire/$jobId")({
  head: () => ({
    meta: [
      { title: "Job Applicants — QuickWork" },
      {
        name: "description",
        content: "Review and manage applicants for your job posting.",
      },
    ],
  }),
  component: JobApplicantsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "All" | "Recommended" | "Verified" | "Highest Rated" | "Most Experienced" | "Nearby" | "New";

type Applicant = {
  id: string;
  applicationId: string;
  name: string;
  avatar: string;
  rating: number;
  totalShifts: number;
  isVerified: boolean;
  role: string;
  experience: string;
  skills: string[];
  distance: string;
  appliedAt: string;
  applicationStatus: "Pending" | "Confirmed" | "Waitlisted" | "NotSelected";
  punctuality: number;
  workerNote?: string;
  isRecommended?: boolean;
  matchScore?: number; // 0-100 calculated match percentage
  matchLevel?: "Best Match" | "Great Match" | "Good Match" | "Fair Match";
};

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
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockJobs: Record<string, Job> = {
  "1": {
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
  },
  "2": {
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
    positionsFilled: 1,
    positionsRemaining: 5,
  },
};

const mockApplicants: Record<string, Applicant[]> = {
  "1": [
    {
      id: "worker_1",
      applicationId: "app_001",
      name: "Rajesh Kumar",
      avatar: "RK",
      rating: 4.9,
      totalShifts: 127,
      isVerified: true,
      role: "Senior Banquet Server",
      experience: "5 years in hospitality",
      skills: ["Fine dining", "Guest service", "Tray carrying", "Event coordination"],
      distance: "2.1 km",
      appliedAt: "2026-09-09T10:30:00Z",
      applicationStatus: "Confirmed",
      punctuality: 98,
      workerNote: "I have 5 years of banquet service experience at premium venues.",
      isRecommended: true,
    },
    {
      id: "worker_2",
      applicationId: "app_002",
      name: "Priya Sharma",
      avatar: "PS",
      rating: 4.8,
      totalShifts: 89,
      isVerified: true,
      role: "Banquet Server",
      experience: "3 years in events",
      skills: ["Banquet service", "Customer interaction", "Team coordination"],
      distance: "3.5 km",
      appliedAt: "2026-09-09T11:15:00Z",
      applicationStatus: "Confirmed",
      punctuality: 95,
      workerNote: "Available for the full shift. Professional and punctual.",
      isRecommended: true,
    },
    {
      id: "worker_3",
      applicationId: "app_003",
      name: "Amit Patel",
      avatar: "AP",
      rating: 4.7,
      totalShifts: 65,
      isVerified: true,
      role: "Server",
      experience: "2 years catering",
      skills: ["Event serving", "Food handling", "Guest relations"],
      distance: "4.2 km",
      appliedAt: "2026-09-09T14:20:00Z",
      applicationStatus: "Pending",
      punctuality: 92,
      workerNote: "Experienced in wedding receptions. Can bring references.",
      isRecommended: true,
    },
    {
      id: "worker_4",
      applicationId: "app_004",
      name: "Sneha Desai",
      avatar: "SD",
      rating: 4.6,
      totalShifts: 45,
      isVerified: false,
      role: "Server",
      experience: "1 year hospitality",
      skills: ["Service", "Communication"],
      distance: "5.8 km",
      appliedAt: "2026-09-09T15:45:00Z",
      applicationStatus: "Pending",
      punctuality: 88,
    },
    {
      id: "worker_5",
      applicationId: "app_005",
      name: "Vikram Singh",
      avatar: "VS",
      rating: 4.9,
      totalShifts: 142,
      isVerified: true,
      role: "Lead Server",
      experience: "6 years premium events",
      skills: ["Fine dining", "Wine service", "Team leadership", "VIP handling"],
      distance: "1.8 km",
      appliedAt: "2026-09-09T09:00:00Z",
      applicationStatus: "Pending",
      punctuality: 99,
      workerNote: "Have worked at Grand Palm before. Lead server certified.",
      isRecommended: true,
    },
    {
      id: "worker_6",
      applicationId: "app_006",
      name: "Neha Gupta",
      avatar: "NG",
      rating: 4.5,
      totalShifts: 32,
      isVerified: true,
      role: "Junior Server",
      experience: "6 months banquets",
      skills: ["Service", "Learning quickly"],
      distance: "6.5 km",
      appliedAt: "2026-09-09T16:30:00Z",
      applicationStatus: "Pending",
      punctuality: 90,
    },
    {
      id: "worker_7",
      applicationId: "app_007",
      name: "Arjun Reddy",
      avatar: "AR",
      rating: 4.8,
      totalShifts: 98,
      isVerified: true,
      role: "Banquet Server",
      experience: "4 years events",
      skills: ["Serving", "Setup", "Coordination", "Problem solving"],
      distance: "3.2 km",
      appliedAt: "2026-09-09T08:15:00Z",
      applicationStatus: "Pending",
      punctuality: 96,
      workerNote: "Quick learner, great with guests. Available for full duration.",
      isRecommended: false,
    },
  ],
  "2": [
    {
      id: "worker_8",
      applicationId: "app_008",
      name: "Deepak Kumar",
      avatar: "DK",
      rating: 4.7,
      totalShifts: 73,
      isVerified: true,
      role: "Kitchen Helper",
      experience: "3 years catering",
      skills: ["Food prep", "Kitchen hygiene", "Following instructions"],
      distance: "4.1 km",
      appliedAt: "2026-09-08T10:00:00Z",
      applicationStatus: "Confirmed",
      punctuality: 94,
      workerNote: "Experienced in large-scale catering. Fast and efficient.",
      isRecommended: true,
    },
  ],
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Calculate match score for an applicant based on multiple factors
 * Returns a score from 0-100
 */
function calculateMatchScore(applicant: Applicant, job: Job): number {
  let totalScore = 0;
  const weights = {
    skills: 30,        // Skills match: 30% weight
    rating: 25,        // Rating: 25% weight
    experience: 20,    // Experience: 20% weight
    distance: 15,      // Distance: 15% weight
    verification: 10,  // Verification: 10% weight
  };

  // 1. Skills Match (30 points max)
  // Match job category with relevant skills
  const jobCategory = job.category.toLowerCase();
  const applicantSkills = applicant.skills.map(s => s.toLowerCase());
  
  // Define relevant skills per category
  const categorySkills: Record<string, string[]> = {
    hospitality: ["dining", "service", "guest", "banquet", "catering", "food", "beverage", "serving", "customer"],
    events: ["event", "coordination", "setup", "planning", "management", "organizing"],
    warehouse: ["loading", "inventory", "logistics", "lifting", "packing", "organizing"],
    delivery: ["driving", "navigation", "logistics", "vehicle", "delivery"],
  };

  const relevantSkills = categorySkills[jobCategory] || [];
  let skillMatches = 0;
  
  applicantSkills.forEach(skill => {
    if (relevantSkills.some(relevant => skill.includes(relevant))) {
      skillMatches++;
    }
  });

  // Calculate skills score (cap at 30)
  const skillsScore = Math.min((skillMatches / Math.max(applicantSkills.length, 1)) * weights.skills, weights.skills);
  totalScore += skillsScore;

  // 2. Rating Score (25 points max)
  // 4.5+ rating = full points, scale down from there
  const ratingScore = ((applicant.rating - 3.0) / 2.0) * weights.rating;
  totalScore += Math.max(0, Math.min(ratingScore, weights.rating));

  // 3. Experience Score (20 points max)
  // Based on total shifts completed
  let experienceScore = 0;
  if (applicant.totalShifts >= 100) {
    experienceScore = weights.experience; // 100+ shifts = full points
  } else if (applicant.totalShifts >= 50) {
    experienceScore = weights.experience * 0.8; // 50-99 = 80%
  } else if (applicant.totalShifts >= 25) {
    experienceScore = weights.experience * 0.6; // 25-49 = 60%
  } else if (applicant.totalShifts >= 10) {
    experienceScore = weights.experience * 0.4; // 10-24 = 40%
  } else {
    experienceScore = weights.experience * 0.2; // <10 = 20%
  }
  totalScore += experienceScore;

  // 4. Distance Score (15 points max)
  // Closer is better
  const distanceKm = parseFloat(applicant.distance);
  let distanceScore = 0;
  if (distanceKm <= 2) {
    distanceScore = weights.distance; // Within 2km = full points
  } else if (distanceKm <= 5) {
    distanceScore = weights.distance * 0.7; // 2-5km = 70%
  } else if (distanceKm <= 10) {
    distanceScore = weights.distance * 0.4; // 5-10km = 40%
  } else {
    distanceScore = weights.distance * 0.2; // 10km+ = 20%
  }
  totalScore += distanceScore;

  // 5. Verification Score (10 points max)
  if (applicant.isVerified) {
    totalScore += weights.verification;
  }

  // Round to integer
  return Math.round(totalScore);
}

/**
 * Get match level label based on score
 */
function getMatchLevel(score: number): "Best Match" | "Great Match" | "Good Match" | "Fair Match" {
  if (score >= 85) return "Best Match";
  if (score >= 70) return "Great Match";
  if (score >= 55) return "Good Match";
  return "Fair Match";
}

/**
 * Calculate match scores for all applicants
 */
function calculateAllMatchScores(applicants: Applicant[], job: Job): Applicant[] {
  return applicants.map(applicant => {
    const score = calculateMatchScore(applicant, job);
    return {
      ...applicant,
      matchScore: score,
      matchLevel: getMatchLevel(score),
    };
  });
}

function filterApplicants(applicants: Applicant[], filter: FilterTab): Applicant[] {
  let filtered = [...applicants];

  switch (filter) {
    case "Recommended":
      // Sort by match score (highest first)
      filtered = filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      break;
    case "Verified":
      filtered = filtered.filter((a) => a.isVerified);
      break;
    case "Highest Rated":
      filtered = filtered.sort((a, b) => b.rating - a.rating);
      break;
    case "Most Experienced":
      filtered = filtered.sort((a, b) => b.totalShifts - a.totalShifts);
      break;
    case "Nearby":
      filtered = filtered.sort((a, b) => {
        const distA = parseFloat(a.distance);
        const distB = parseFloat(b.distance);
        return distA - distB;
      });
      break;
    case "New":
      filtered = filtered.sort((a, b) => {
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      });
      break;
  }

  return filtered;
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const applied = new Date(dateString);
  const diffMs = now.getTime() - applied.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "Just now";
}

// ─── Page Component ───────────────────────────────────────────────────────────

function JobApplicantsPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { isLoggedIn, openLoginModal } = useAuth();
  const { confirmApplication, rejectApplication, waitlistApplication, getJobApplicationStats } = useApplications();

  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [localConfirmedCount, setLocalConfirmedCount] = useState(0);
  const [isApplicationsPaused, setIsApplicationsPaused] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const job = mockJobs[jobId];
  const rawApplicants = mockApplicants[jobId] || [];
  
  // Calculate match scores for all applicants
  const allApplicants = job ? calculateAllMatchScores(rawApplicants, job) : rawApplicants;
  
  // Get real-time stats from application store
  const appStats = getJobApplicationStats(jobId);
  const confirmedFromStore = appStats.confirmed;
  
  // Calculate actual remaining positions
  const actualConfirmedCount = Math.max(confirmedFromStore, localConfirmedCount);
  const actualRemainingPositions = job ? job.positionsTotal - actualConfirmedCount : 0;
  const isFullyFilled = actualRemainingPositions <= 0;

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
            Please log in to view job applicants.
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

  if (!job) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
        <ErrorState
          type="notFound"
          title="Job Not Found"
          description="This job doesn't exist or has been removed."
          onRetry={() => navigate({ to: "/my-jobs" })}
        />
      </div>
    );
  }

  const filteredApplicants = filterApplicants(allApplicants, activeFilter);
  const totalApplicants = allApplicants.length;
  const confirmedCount = actualConfirmedCount;
  const pendingCount = allApplicants.filter((a) => a.applicationStatus === "Pending").length;

  const filterTabs: FilterTab[] = [
    "All",
    "Recommended",
    "Verified",
    "Highest Rated",
    "Most Experienced",
    "Nearby",
    "New",
  ];

  function handleConfirm(applicant: Applicant) {
    // Check if job is already fully filled
    if (isFullyFilled) {
      toast.error("Job is fully filled", {
        description: "All positions have been confirmed. You can add to waitlist instead.",
      });
      return;
    }

    // Confirm the application using the real application ID
    const result = confirmApplication(
      applicant.applicationId, 
      "Welcome! Looking forward to working with you.",
      job.positionsTotal  // Pass total positions for validation
    );
    
    if (result.success) {
      // Update local state
      setLocalConfirmedCount(prev => prev + 1);
      
      // Update applicant status in mock data
      applicant.applicationStatus = "Confirmed";
      
      toast.success(`Confirmed ${applicant.name}!`, {
        description: "They've been notified and added to your confirmed workers.",
      });
    } else {
      // Show specific error messages based on reason
      const errorMessages = {
        not_found: "Application not found. Please refresh and try again.",
        invalid_status: "Cannot confirm this application. It may have already been processed.",
        already_confirmed: `${applicant.name} has already been confirmed for this job.`,
        positions_full: result.message || "All positions are already filled. Add to waitlist instead.",
      };
      
      const message = result.reason 
        ? errorMessages[result.reason] 
        : result.message || "Failed to confirm application. Please try again.";
      
      toast.error("Cannot Confirm", {
        description: message,
      });
    }
  }

  function handleReject(applicant: Applicant) {
    const result = rejectApplication(
      applicant.applicationId, 
      "Thank you for applying. We've selected other candidates for this position."
    );
    
    if (result.success) {
      // Update applicant status in mock data
      applicant.applicationStatus = "NotSelected";
      
      toast.success(`Application declined`, {
        description: `${applicant.name} has been notified.`,
      });
    } else {
      toast.error("Failed to decline", {
        description: "Please try again.",
      });
    }
  }

  function handleWaitlist(applicant: Applicant) {
    const result = waitlistApplication(
      applicant.applicationId,
      "Great profile! We'll contact you if a spot opens up."
    );
    
    if (result.success) {
      // Update applicant status in mock data
      applicant.applicationStatus = "Waitlisted";
      
      toast.success(`Added to waitlist`, {
        description: `${applicant.name} will be notified if a spot opens up.`,
      });
    } else {
      toast.error("Failed to add to waitlist", {
        description: "Please try again.",
      });
    }
  }

  function handleEditJob() {
    // In real app, would navigate to edit page with job data
    toast.info("Edit Job", {
      description: "Job editing feature coming soon!",
    });
  }

  function handlePauseApplications() {
    setIsApplicationsPaused(!isApplicationsPaused);
    
    if (!isApplicationsPaused) {
      toast.success("Applications Paused", {
        description: "New workers won't be able to apply to this job until you resume.",
      });
    } else {
      toast.success("Applications Resumed", {
        description: "Workers can now apply to this job again.",
      });
    }
  }

  function handleCancelJobClick() {
    // Show warning dialog
    setShowCancelDialog(true);
  }

  function handleCancelJobConfirm() {
    // In real app, would update job status in database
    setShowCancelDialog(false);
    
    toast.success("Job Cancelled", {
      description: `${confirmedCount} confirmed workers have been notified about the cancellation.`,
    });
    
    // Navigate back to my jobs after a short delay
    setTimeout(() => {
      navigate({ to: "/my-jobs" });
    }, 2000);
  }

  // Format date
  const jobDate = new Date(job.date);
  const formattedDate = jobDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Back button */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-4 lg:px-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/my-jobs">
              <ArrowLeft className="size-4" /> Back to My Jobs
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        {/* Job Header */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold sm:text-3xl">{job.jobTitle}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {job.venueName}, {job.area}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {formattedDate}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Wallet className="size-4" />
                  {job.wageDisplay}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/work/$jobId" params={{ jobId: job.id }}>
                  View Job Details
                </Link>
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-6">
            <Button
              variant="outline"
              size="default"
              onClick={handleEditJob}
              className="flex-1 sm:flex-none"
            >
              <Edit className="size-4" />
              Edit Job
            </Button>
            <Button
              variant="outline"
              size="default"
              onClick={handlePauseApplications}
              className="flex-1 sm:flex-none"
            >
              <Pause className="size-4" />
              {isApplicationsPaused ? "Resume Applications" : "Pause Applications"}
            </Button>
            <Button
              variant="destructive"
              size="default"
              onClick={handleCancelJobClick}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="size-4" />
              Cancel Job
            </Button>
          </div>

          {/* Paused Applications Banner */}
          {isApplicationsPaused && (
            <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <Pause className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    Applications Paused
                  </p>
                  <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
                    New workers cannot apply to this job. Click "Resume Applications" to allow applications again.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Header */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalApplicants}</p>
                <p className="text-sm text-muted-foreground">Total Applicants</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-success/40 bg-success/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-success/20 text-success">
                <CheckCircle2 className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{confirmedCount}</p>
                <p className="text-sm text-muted-foreground">Confirmed</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
                <Clock className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {actualRemainingPositions}
                </p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fully Filled Banner */}
        {isFullyFilled && (
          <div className="mt-6 rounded-2xl border-2 border-success/40 bg-success/5 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-6 shrink-0 text-success" />
              <div className="flex-1">
                <p className="font-semibold text-success">Job Fully Filled!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  All {job.positionsTotal} positions have been confirmed. Remaining applicants can be added to the waitlist or declined.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mt-8 border-b border-border">
          <div className="flex gap-2 overflow-x-auto pb-px scrollbar-hide">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeFilter === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {tab === "All" && ` (${totalApplicants})`}
                {tab === "Recommended" && ` (${totalApplicants})`}
                {tab === "Verified" &&
                  ` (${allApplicants.filter((a) => a.isVerified).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Applicants List */}
        <div className="mt-6">
          {filteredApplicants.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No applicants found"
              description={
                activeFilter === "All"
                  ? "No one has applied to this job yet. Share the job link or wait for workers to discover it."
                  : `No applicants match the "${activeFilter}" filter. Try viewing all applicants or adjusting your filter criteria.`
              }
              action={
                activeFilter !== "All"
                  ? {
                      label: "View All Applicants",
                      onClick: () => setActiveFilter("All"),
                    }
                  : undefined
              }
              variant="muted"
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {filteredApplicants.map((applicant) => (
                <ApplicantCard
                  key={applicant.id}
                  applicant={applicant}
                  isJobFullyFilled={isFullyFilled}
                  showMatchBadge={activeFilter === "Recommended"}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                  onWaitlist={handleWaitlist}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        {filteredApplicants.length > 0 && (
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="size-5 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-primary">Need help choosing?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try the "Recommended" filter to see top-matched candidates based on ratings,
                  experience, and proximity.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Job Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Cancel This Job?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              {confirmedCount > 0 ? (
                <>
                  <p className="font-semibold text-foreground">
                    ⚠️ This job has {confirmedCount} confirmed worker{confirmedCount > 1 ? "s" : ""}.
                  </p>
                  <p>
                    Cancelling this job will notify all confirmed workers that the job has been 
                    cancelled. They will no longer be expected to show up.
                  </p>
                  <p className="text-sm">
                    This action cannot be undone. Are you sure you want to proceed?
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Are you sure you want to cancel this job? All pending applicants will be 
                    notified that the job has been cancelled.
                  </p>
                  <p className="text-sm">
                    This action cannot be undone.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Job</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelJobConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Applicant Card ───────────────────────────────────────────────────────────

function ApplicantCard({
  applicant,
  isJobFullyFilled,
  showMatchBadge,
  onConfirm,
  onReject,
  onWaitlist,
}: {
  applicant: Applicant;
  isJobFullyFilled: boolean;
  showMatchBadge?: boolean;
  onConfirm: (applicant: Applicant) => void;
  onReject: (applicant: Applicant) => void;
  onWaitlist: (applicant: Applicant) => void;
}) {
  const isConfirmed = applicant.applicationStatus === "Confirmed";
  const isPending = applicant.applicationStatus === "Pending";
  const isRejected = applicant.applicationStatus === "NotSelected";
  const isWaitlisted = applicant.applicationStatus === "Waitlisted";

  // Get match badge color based on level
  const getMatchBadgeColor = (level?: string) => {
    switch (level) {
      case "Best Match":
        return "bg-success/15 text-success border-success/30";
      case "Great Match":
        return "bg-primary/15 text-primary border-primary/30";
      case "Good Match":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "Fair Match":
        return "bg-muted/50 text-muted-foreground border-border";
      default:
        return "bg-muted/50 text-muted-foreground border-border";
    }
  };

  return (
    <article
      className={`flex flex-col rounded-2xl border p-5 transition-all ${
        isConfirmed
          ? "border-success/40 bg-success/5"
          : "border-border bg-card hover:shadow-md"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-deep font-display text-xl font-bold text-primary-foreground">
          {applicant.avatar}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{applicant.name}</h3>
                {applicant.isVerified && <VerifiedBadge />}
                {!showMatchBadge && applicant.isRecommended && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    <ThumbsUp className="size-3" />
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{applicant.role}</p>
            </div>
            
            {/* Match Badge or Confirmed Badge */}
            {showMatchBadge && applicant.matchScore !== undefined ? (
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${getMatchBadgeColor(applicant.matchLevel)}`}
              >
                <Sparkles className="size-3.5" />
                <span>{applicant.matchLevel} — {applicant.matchScore}%</span>
              </div>
            ) : isConfirmed ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success whitespace-nowrap">
                <CheckCircle2 className="size-3" />
                Confirmed
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Star className="size-4 fill-gold text-gold" />
          <span className="font-semibold">{applicant.rating}</span>
          <span className="text-muted-foreground">({applicant.totalShifts} shifts)</span>
        </div>
        <span className="text-muted-foreground">·</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-4" />
          {applicant.distance} away
        </div>
        <span className="text-muted-foreground">·</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <TrendingUp className="size-4" />
          {applicant.punctuality}% punctual
        </div>
      </div>

      {/* Experience & Skills */}
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Experience
          </p>
          <p className="mt-1 text-sm">{applicant.experience}</p>
        </div>

        {applicant.skills.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {applicant.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  <BadgeCheck className="size-3" />
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {applicant.workerNote && (
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Application Note:</p>
            <p className="mt-1 text-sm italic">"{applicant.workerNote}"</p>
          </div>
        )}
      </div>

      {/* Applied time */}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3" />
        Applied {getTimeAgo(applicant.appliedAt)}
      </p>

      {/* Actions */}
      {isConfirmed ? (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" disabled>
            <CheckCircle2 className="size-4" /> Confirmed
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link to={`/profile/${applicant.id}`}>View Profile</Link>
          </Button>
        </div>
      ) : isRejected ? (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="lg" className="flex-1 opacity-50" disabled>
            <X className="size-4" /> Not Selected
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link to={`/profile/${applicant.id}`}>View Profile</Link>
          </Button>
        </div>
      ) : isWaitlisted ? (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="lg" className="flex-1 border-primary/50" disabled>
            <Clock className="size-4" /> Waitlisted
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link to={`/profile/${applicant.id}`}>View Profile</Link>
          </Button>
        </div>
      ) : isPending ? (
        isJobFullyFilled ? (
          // Job is fully filled - only offer waitlist option
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
              <CheckCircle2 className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Job Fully Filled
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => onWaitlist(applicant)}
              >
                <Clock className="size-4" /> Add to Waitlist
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => onReject(applicant)}
              >
                <X className="size-4" /> Decline
              </Button>
              <Button variant="ghost" size="lg" asChild>
                <Link to={`/profile/${applicant.id}`}>
                  <User className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          // Normal pending state with all options
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="default"
              size="lg"
              className="flex-1"
              onClick={() => onConfirm(applicant)}
            >
              <Check className="size-4" /> Confirm
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => onReject(applicant)}
            >
              <X className="size-4" /> Decline
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link to={`/profile/${applicant.id}`}>
                <User className="size-4" />
              </Link>
            </Button>
          </div>
        )
      ) : (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" disabled>
            {applicant.applicationStatus}
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link to={`/profile/${applicant.id}`}>View Profile</Link>
          </Button>
        </div>
      )}
    </article>
  );
}
