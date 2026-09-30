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
  Phone,
  Users,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { JobDetailsSkeleton } from "@/components/job-details-skeleton";
import { ErrorState } from "@/components/error-state";
import { RapidJobBadge } from "@/components/rapid-job-badge";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAuth } from "@/lib/auth-context";
import { useApplications } from "@/lib/application-model";
import {
  JOB_CATEGORY_LABELS,
  JOB_TYPE_LABELS,
  type JobCategoryValue,
  type JobTypeValue,
} from "@/lib/job-types";

export const Route = createFileRoute("/work/$jobId")({
  head: () => ({
    meta: [
      { title: "Job Details — QuickWork" },
      {
        name: "description",
        content: "View complete job details, requirements, and apply for verified shifts.",
      },
    ],
  }),
  component: JobDetailsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Job = {
  id: string;
  jobTitle: string;
  category: JobCategoryValue;
  description: string;
  employer: string;
  venueName: string;
  rating: string;
  wage: number;
  wageDisplay: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  dateLabel: string;
  location: string;
  area: string;
  city: string;
  fullAddress: string;
  landmark?: string;
  distance: string;
  facilities: string[];
  jobType: JobTypeValue;
  // Positions
  positionsTotal: number;
  positionsFilled: number;
  positionsRemaining: number;
  // Requirements
  experience?: string;
  skills: string[];
  dressCode?: string;
  documentsRequired?: string;
  // Instructions
  beforeArrival: string[];
  duringShift: string[];
  // Contact (shown only when confirmed)
  reportingContact?: {
    name: string;
    phone: string;
  };
  // Rapid Job fields
  isRapidJob?: boolean;
  rapidJobExpiresAt?: string;
  // Employer verification
  isVerifiedEmployer?: boolean;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockJobs: Record<string, Job> = {
  "1": {
    id: "1",
    jobTitle: "Banquet servers for wedding reception",
    category: "Hospitality",
    description: "Looking for experienced banquet staff for a high-end wedding event. You'll be serving guests during the reception, ensuring drinks are refilled, clearing plates, and maintaining a professional demeanor throughout the event. This is a premium venue with high expectations for service quality.",
    employer: "Grand Palm Banquets",
    venueName: "Grand Palm Banquets",
    rating: "4.9",
    wage: 1200,
    wageDisplay: "₹1,200",
    date: "2026-09-10",
    startTime: "17:00",
    endTime: "23:00",
    duration: 360,
    dateLabel: "Wed, 10 Sep · 5:00 PM – 11:00 PM",
    location: "Grand Palm Banquets, Andheri East, Mumbai",
    area: "Andheri East",
    city: "Mumbai",
    fullAddress: "Plot 42, MIDC Road, Andheri East",
    landmark: "Near Andheri Metro Station",
    distance: "3.2 km",
    facilities: ["Meals provided", "Uniform", "Transport"],
    jobType: "one-time",
    positionsTotal: 4,
    positionsFilled: 2,
    positionsRemaining: 2,
    experience: "1-2 years in banquet service preferred",
    skills: ["Fine dining service", "Tray carrying", "Guest interaction"],
    dressCode: "Black pants, white shirt (uniform jacket provided)",
    documentsRequired: "Aadhar card, 2 passport photos",
    beforeArrival: [
      "Arrive 30 minutes before shift start",
      "Report to supervisor at main entrance",
      "Bring required documents",
      "Wear black formal shoes",
    ],
    duringShift: [
      "Follow supervisor instructions at all times",
      "Maintain professional appearance",
      "Handle guest requests promptly",
      "Clear tables between courses",
    ],
    reportingContact: {
      name: "Rajesh Kumar",
      phone: "+91 98765 43210",
    },
    isVerifiedEmployer: true,
    isRapidJob: true,
    rapidJobExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  },
  "2": {
    id: "2",
    jobTitle: "Kitchen staff for catering event",
    category: "Hospitality",
    description: "Need kitchen helpers for large catering event. Basic food prep experience required. You'll be assisting the chef with food preparation, plating, and kitchen organization during a corporate lunch event.",
    employer: "Saffron Caterers",
    venueName: "Commercial Kitchen Complex",
    rating: "4.8",
    wage: 950,
    wageDisplay: "₹950",
    date: "2026-09-11",
    startTime: "09:00",
    endTime: "16:00",
    duration: 420,
    dateLabel: "Thu, 11 Sep · 9:00 AM – 4:00 PM",
    location: "Commercial Kitchen Complex, Powai, Mumbai",
    area: "Powai",
    city: "Mumbai",
    fullAddress: "Building 12, Hiranandani Business Park, Powai",
    landmark: "Behind Powai Lake",
    distance: "5.7 km",
    facilities: ["Meals provided", "Transport"],
    jobType: "one-time",
    positionsTotal: 6,
    positionsFilled: 1,
    positionsRemaining: 5,
    experience: "Basic kitchen experience, no prior catering required",
    skills: ["Food handling", "Kitchen hygiene", "Following instructions"],
    dressCode: "White chef coat and apron (provided)",
    documentsRequired: "Aadhar card, health certificate (if available)",
    beforeArrival: [
      "Arrive by 8:45 AM sharp",
      "Report to kitchen manager",
      "Bring comfortable closed-toe shoes",
    ],
    duringShift: [
      "Maintain strict kitchen hygiene",
      "Follow food safety protocols",
      "Assist with prep work as directed",
      "Keep workstation clean",
    ],
    reportingContact: {
      name: "Chef Priya Sharma",
      phone: "+91 98765 11111",
    },
    isVerifiedEmployer: true,
    isRapidJob: false,
  },
  "5": {
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
    dateLabel: "Wed, 10 Sep · 7:00 PM – 11:00 PM",
    location: "Royal Plaza Hotel, Andheri West, Mumbai",
    area: "Andheri West",
    city: "Mumbai",
    fullAddress: "Versova Link Road, Andheri West",
    landmark: "Near Versova Beach",
    distance: "4.0 km",
    facilities: ["Meals provided", "Transport"],
    jobType: "one-time",
    positionsTotal: 5,
    positionsFilled: 5,
    positionsRemaining: 0,
    experience: "2+ years in hospitality",
    skills: ["Service excellence", "Table setup"],
    dressCode: "Black formal attire",
    documentsRequired: "ID proof",
    beforeArrival: ["Report 45 minutes early", "Uniform check"],
    duringShift: ["Professional service", "Guest satisfaction focus"],
    reportingContact: {
      name: "Manager Amit",
      phone: "+91 98765 22222",
    },
    isVerifiedEmployer: true,
    isRapidJob: false,
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function JobDetailsPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { isLoggedIn, openLoginModal, user } = useAuth();
  const { submitApplication, hasApplied, getApplicationsByWorker } = useApplications();

  const job = mockJobs[jobId];
  const [showContactDetails, setShowContactDetails] = useState(false);

  // Get current worker's applications
  const currentWorkerId = user?.id || "guest";
  const alreadyApplied = isLoggedIn && hasApplied(currentWorkerId, jobId);
  const myApplications = isLoggedIn ? getApplicationsByWorker(currentWorkerId) : [];
  const myApplication = myApplications.find((app) => app.jobId === jobId);

  // Show contact details if user is confirmed for this job
  const isConfirmed = myApplication?.status === "Confirmed";

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

  const isFull = job.positionsRemaining === 0;
  const durationHours = Math.floor(job.duration / 60);
  const durationMinutes = job.duration % 60;

  function handleApply() {
    if (!isLoggedIn) {
      openLoginModal({ type: "apply-job", payload: jobId });
      return;
    }

    // Check if job is fully booked
    if (job.positionsRemaining <= 0) {
      toast.error("Job is Fully Booked", {
        description: "All positions have been filled. You can join the waitlist if available.",
      });
      return;
    }

    // Check if job is cancelled (if we had a status field)
    // if (job.status === 'cancelled') {
    //   toast.error("Job Cancelled", {
    //     description: "This job posting has been cancelled by the employer.",
    //   });
    //   return;
    // }

    const result = submitApplication({
      workerId: currentWorkerId,
      jobId: jobId,
      workerNote: undefined,
    });

    if (result.success) {
      toast.success("Application submitted successfully!", {
        description: "The employer will review your application shortly.",
      });
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Show specific error messages
      const errorMessages = {
        duplicate_application: result.message || "You have already applied to this job.",
        invalid_params: "Invalid application data. Please try again.",
      };
      
      const message = result.reason 
        ? errorMessages[result.reason] 
        : result.message || "Failed to submit application. Please try again.";
      
      toast.error("Cannot Apply", {
        description: message,
      });
    }
  }

  function handleJoinWaitlist() {
    if (!isLoggedIn) {
      openLoginModal({ type: "apply-job", payload: jobId });
      return;
    }
    
    // Submit application - it will be added to waitlist by the employer
    const result = submitApplication({
      workerId: currentWorkerId,
      jobId: jobId,
      workerNote: "Interested in joining waitlist if spot opens up",
    });

    if (result.success) {
      toast.success("Added to waitlist!", {
        description: "You'll be notified if a confirmed worker cancels and a spot opens up.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const errorMessages = {
        duplicate_application: result.message || "You're already on the waitlist for this job.",
        invalid_params: "Invalid application data. Please try again.",
      };
      
      const message = result.reason 
        ? errorMessages[result.reason] 
        : result.message || "Failed to join waitlist. Please try again.";
      
      toast.error("Cannot Join Waitlist", {
        description: message,
      });
    }
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Back button */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-5 py-4 lg:px-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/work">
              <ArrowLeft className="size-4" /> Back to jobs
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold sm:text-4xl">{job.jobTitle}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  {job.category === "Hospitality" && <Utensils className="size-4" />}
                  {job.category === "Events" && <Users className="size-4" />}
                  {JOB_CATEGORY_LABELS[job.category]}
                </span>
                {job.isVerifiedEmployer && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-semibold text-success">
                    <BadgeCheck className="size-4" />
                    Verified Employer
                  </span>
                )}
              </div>
            </div>
            {job.isRapidJob && (
              <div>
                <RapidJobBadge rapidJobExpiresAt={job.rapidJobExpiresAt} variant="large" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="font-semibold text-foreground">{job.employer}</span>
            {job.isVerifiedEmployer && (
              <VerifiedBadge />
            )}
          </div>
        </header>

        {/* Key Info Grid */}
        <section className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Location
              </p>
              <p className="mt-1 font-semibold">{job.venueName}</p>
              <p className="text-sm text-muted-foreground">{job.fullAddress}</p>
              <p className="text-sm text-muted-foreground">{job.city}</p>
              {job.landmark && (
                <p className="mt-1 text-xs text-muted-foreground">Near {job.landmark}</p>
              )}
              <p className="mt-1 text-xs font-medium text-primary">{job.distance} away</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date & Time
              </p>
              <p className="mt-1 font-semibold">{job.dateLabel}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                {durationHours > 0 && `${durationHours}h `}
                {durationMinutes > 0 && `${durationMinutes}m`} shift
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {JOB_TYPE_LABELS[job.jobType]}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                job.isRapidJob
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Wage
              </p>
              <p
                className={`mt-1 font-display text-2xl font-bold ${
                  job.isRapidJob
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-primary"
                }`}
              >
                {job.wageDisplay}
              </p>
              <p className="text-sm text-muted-foreground">per worker</p>
              {job.isRapidJob && (
                <p className="mt-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
                  +20% surge pricing
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Positions
              </p>
              <p className="mt-1 font-semibold">
                {job.positionsTotal} required
              </p>
              <p className="text-sm text-muted-foreground">
                {job.positionsFilled} confirmed
              </p>
              <p
                className={`mt-1 text-sm font-bold ${
                  isFull
                    ? "text-muted-foreground"
                    : job.positionsRemaining <= 2
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-success"
                }`}
              >
                {isFull ? "All positions filled" : `${job.positionsRemaining} remaining`}
              </p>
            </div>
          </div>
        </section>

        {/* About / Description */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Info className="size-5 text-primary" />
            About this job
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{job.description}</p>
        </section>

        {/* Requirements */}
        {(job.experience || job.skills.length > 0 || job.dressCode || job.documentsRequired) && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <ListChecks className="size-5 text-primary" />
              Requirements
            </h2>
            <dl className="mt-5 space-y-4">
              {job.experience && (
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">Experience</dt>
                  <dd className="mt-1 text-sm">{job.experience}</dd>
                </div>
              )}
              {job.skills.length > 0 && (
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">Skills</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 text-sm font-medium text-primary"
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                        {skill}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {job.dressCode && (
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">Dress Code</dt>
                  <dd className="mt-1 text-sm">{job.dressCode}</dd>
                </div>
              )}
              {job.documentsRequired && (
                <div>
                  <dt className="text-sm font-semibold text-muted-foreground">
                    Documents Required
                  </dt>
                  <dd className="mt-1 text-sm">{job.documentsRequired}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Facilities */}
        {job.facilities.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <CheckCircle2 className="size-5 text-primary" />
              Facilities Provided
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.facilities.map((facility) => (
                <span
                  key={facility}
                  className="inline-flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-sm font-semibold text-success"
                >
                  <CheckCircle2 className="size-4" />
                  {facility}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Instructions */}
        {(job.beforeArrival.length > 0 || job.duringShift.length > 0) && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Clock className="size-5 text-primary" />
              Instructions
            </h2>

            {job.beforeArrival.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Before Arrival
                </h3>
                <ul className="mt-3 space-y-2">
                  {job.beforeArrival.map((instruction, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={3} />
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.duringShift.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-muted-foreground">During Shift</h3>
                <ul className="mt-3 space-y-2">
                  {job.duringShift.map((instruction, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={3} />
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact Details - Only shown when confirmed */}
            {isConfirmed && job.reportingContact && (
              <div className="mt-6 rounded-xl border border-success/40 bg-success/5 p-4">
                <div className="flex items-center gap-2 text-success">
                  <Phone className="size-4" />
                  <h3 className="font-semibold">Reporting Contact</h3>
                </div>
                <p className="mt-2 text-sm font-medium">{job.reportingContact.name}</p>
                <a
                  href={`tel:${job.reportingContact.phone}`}
                  className="mt-1 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  {job.reportingContact.phone}
                </a>
                <p className="mt-2 text-xs text-muted-foreground">
                  Contact details are visible because your application is confirmed
                </p>
              </div>
            )}

            {!isConfirmed && (
              <div className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="size-4" />
                  <p className="text-sm font-medium">
                    Reporting contact details will be revealed once your application is confirmed
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Application Status */}
        {alreadyApplied && myApplication && (
          <section className="mt-8 rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="flex items-center gap-2 font-semibold text-primary">
                  {myApplication.status === "Confirmed" && <CheckCircle2 className="size-5" />}
                  {myApplication.status === "Pending" && <Clock className="size-5" />}
                  Application Status
                </h3>
                <div className="mt-3">
                  {myApplication.status === "Pending" && (
                    <>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                        Pending Review
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Your application has been submitted and is waiting for the employer to review and confirm. You'll be notified once there's an update.
                      </p>
                    </>
                  )}
                  {myApplication.status === "Confirmed" && (
                    <>
                      <p className="text-sm font-bold text-success">
                        Confirmed!
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Congratulations! Your application has been accepted.
                      </p>
                      <Button variant="hero" size="lg" className="mt-4" asChild>
                        <Link to="/booking-confirmation/$applicationId" params={{ applicationId: myApplication.id }}>
                          <CheckCircle2 className="size-4" /> View Booking Confirmation
                        </Link>
                      </Button>
                    </>
                  )}
                  {myApplication.status === "Waitlisted" && (
                    <>
                      <p className="text-sm font-bold text-primary">
                        Waitlisted
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        You're on the waitlist for this job. We'll notify you if a spot opens up.
                      </p>
                    </>
                  )}
                  {myApplication.status === "NotSelected" && (
                    <>
                      <p className="text-sm font-bold text-muted-foreground">
                        Not Selected
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Unfortunately, your application was not selected for this job.
                      </p>
                    </>
                  )}
                </div>
                {myApplication.posterNote && (
                  <div className="mt-4 rounded-lg border border-border bg-card p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Employer Note:</p>
                    <p className="mt-1 text-sm">{myApplication.posterNote}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Sticky Bottom Apply Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p
                className={`font-display text-xl font-bold ${
                  job.isRapidJob
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-primary"
                }`}
              >
                {job.wageDisplay}
                {job.isRapidJob && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (+20%)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {isFull ? "All positions filled" : `${job.positionsRemaining} positions remaining`}
              </p>
            </div>

            {alreadyApplied ? (
              <Button variant="secondary" size="lg" disabled className="min-w-[200px]">
                <Check /> Application Submitted
              </Button>
            ) : isFull ? (
              <Button
                variant="outline"
                size="lg"
                onClick={handleJoinWaitlist}
                className="min-w-[200px] border-primary/50 text-primary hover:bg-primary/10"
              >
                <Users className="size-4" /> Join Waitlist
              </Button>
            ) : job.isRapidJob ? (
              <Button
                variant="destructive"
                size="lg"
                onClick={handleApply}
                className="min-w-[200px] animate-pulse bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                <Zap className="size-4 fill-current" /> Apply Now — Urgent!
              </Button>
            ) : (
              <Button variant="hero" size="lg" onClick={handleApply} className="min-w-[200px]">
                {isLoggedIn ? (
                  <>Apply for Job</>
                ) : (
                  <>
                    <Lock className="size-4" /> Apply for Job
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
