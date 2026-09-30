import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  CheckCircle2,
  MapPin,
  Send,
  SendHorizonal,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  Users,
  ShowerHead,
  Zap,
  Clock,
  Briefcase,
  Wrench,
  Plus,
  X,
  FileText,
  AlertCircle,
  ListChecks,
  UserCheck,
  Star,
  BadgeCheck,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateRapidJobExpiry } from "@/lib/job-types";

export const Route = createFileRoute("/post-job")({
  head: () => ({
    meta: [
      { title: "Post a Shift in 5 Steps — QuickWork" },
      {
        name: "description",
        content:
          "Guided 5-step shift posting: job basics, location, wage, requirements & instructions, then review and publish to verified workers near you.",
      },
      { property: "og:title", content: "Post a Shift in 5 Steps — QuickWork" },
      {
        property: "og:description",
        content: "A guided flow to publish your next shift to verified daily-wage workers nearby.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostJobPage,
});

const steps = [
  "What job are you posting?",
  "Where and when?",
  "How many workers?",
  "What should workers know?",
  "Review & Post"
] as const;

const stepShortLabels = [
  "Job Details",
  "Location & Time", 
  "Workers & Pay",
  "Requirements",
  "Review"
] as const;

import { JobCategory, JobType, JOB_CATEGORY_LABELS, JOB_TYPE_LABELS, calculateDuration } from "@/lib/job-types";
import { notifyEligibleWorkers, scheduleReminderNotification } from "@/lib/rapid-job-notifications";

const categories = Object.values(JobCategory);

const facilityOptions = [
  { label: "Meals provided", icon: UtensilsCrossed },
  { label: "Transport", icon: Bus },
  { label: "Uniform", icon: Shirt },
  { label: "Locker room", icon: ShowerHead },
  { label: "Accommodation", icon: Briefcase },
  { label: "Water", icon: Sparkles },
  { label: "Parking", icon: MapPin },
  { label: "Equipment", icon: Wrench },
] as const;

type Form = {
  // Step 1: What job are you posting?
  title: string;
  category: string;
  
  // Step 2: Where and when?
  venueName: string;
  fullAddress: string;
  area: string;
  city: string;
  landmark: string;
  date: string;
  startTime: string;
  endTime: string;
  
  // Step 3: How many workers?
  workers: string;
  wageType: "per-shift" | "per-hour";
  wage: string;
  facilities: string[];
  customFacility: string;
  
  // Step 4: What should workers know?
  description: string;
  jobType: string;
  experience: string;
  skills: string[];
  skillInput: string;
  dressCode: string;
  documentsRequired: string;
  beforeArrivalItems: string[];
  beforeArrivalInput: string;
  duringShiftItems: string[];
  duringShiftInput: string;
  notes: string;
  
  // Removed fields (consolidated into Step 4)
  ageRequirement: string;
  languages: string;
  beforeArrival: string;
  duringShift: string;
  reportingName: string;
  reportingMethod: string;
  reportingLocation: string;
  
  // Rapid Job (spans multiple steps)
  isRapidJob: boolean;
  rapidJobHours: string;
};

const initial: Form = {
  // Step 1
  title: "",
  category: categories[0],
  
  // Step 2
  venueName: "",
  fullAddress: "",
  area: "",
  city: "",
  landmark: "",
  date: "",
  startTime: "",
  endTime: "",
  
  // Step 3
  workers: "4",
  wageType: "per-shift",
  wage: "1200",
  facilities: [],
  customFacility: "",
  
  // Step 4
  description: "",
  jobType: JobType.OneTime,
  experience: "",
  skills: [],
  skillInput: "",
  dressCode: "",
  documentsRequired: "",
  beforeArrivalItems: [],
  beforeArrivalInput: "",
  duringShiftItems: [],
  duringShiftInput: "",
  notes: "",
  
  // Removed/unused
  ageRequirement: "",
  languages: "",
  beforeArrival: "",
  duringShift: "",
  reportingName: "",
  reportingMethod: "",
  reportingLocation: "",
  
  // Rapid Job
  isRapidJob: false,
  rapidJobHours: "2",
};

function PostJobPage() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [form, setForm] = useState<Form>(initial);
  const [published, setPublished] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Validation with specific error messages
  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    
    if (step === 0) {
      if (form.title.trim().length < 3) {
        errors.push("Job title must be at least 3 characters");
      }
      if (form.category.trim().length === 0) {
        errors.push("Please select a job category");
      }
    }
    
    if (step === 1) {
      if (form.venueName.trim().length < 2) {
        errors.push("Venue name is required");
      }
      if (form.area.trim().length < 2) {
        errors.push("Area/locality is required");
      }
      if (form.city.trim().length < 2) {
        errors.push("City is required");
      }
      if (form.date === "") {
        errors.push("Date is required");
      }
      if (form.startTime === "") {
        errors.push("Start time is required");
      }
      if (form.endTime === "") {
        errors.push("End time is required");
      }
    }
    
    if (step === 2) {
      if (Number(form.positions) <= 0) {
        errors.push("Number of workers must be at least 1");
      }
      if (Number(form.wage) <= 0) {
        errors.push("Wage amount must be greater than 0");
      }
    }
    
    if (step === 3) {
      if (form.description.trim().length < 6) {
        errors.push("Job description must be at least 6 characters");
      }
    }
    
    return errors;
  };

  const validationErrors = getValidationErrors();
  
  const valid = [
    // Step 1: What job are you posting?
    form.title.trim().length > 2 && form.category.trim().length > 0,
    
    // Step 2: Where and when?
    form.venueName.trim().length > 1 && 
    form.area.trim().length > 1 && 
    form.city.trim().length > 1 && 
    form.date !== "" && 
    form.startTime !== "" && 
    form.endTime !== "",
    
    // Step 3: How many workers?
    Number(form.positions) > 0 && Number(form.wage) > 0,
    
    // Step 4: What should workers know?
    form.description.trim().length > 5,
    
    // Step 5: Review
    true,
  ][step];

  const go = (next: number) => {
    setDir(next > step ? "fwd" : "back");
    setStep(next);
  };

  const progress = published ? 100 : ((step + 1) / steps.length) * 100;

  // If rapid job is enabled, date must be today
  const today = new Date().toISOString().split('T')[0];
  
  // Auto-set date to today when rapid job is enabled
  useEffect(() => {
    if (form.isRapidJob && form.date !== today) {
      set("date", today);
    }
  }, [form.isRapidJob, form.date, today]);

  if (published) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-24 text-center lg:px-8">
        <span className="relative flex size-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
          <span className="absolute inset-0 rounded-full bg-gold/15" />
          <span className="animate-bounce-in flex size-20 items-center justify-center rounded-full bg-[image:linear-gradient(135deg,var(--gold),var(--brand))] shadow-gold">
            <Check className="size-10 text-gold-foreground" strokeWidth={3} />
          </span>
        </span>
        <h1 className="animate-rise mt-8 text-4xl sm:text-5xl">Shift published!</h1>
        <p className="animate-rise mt-4 text-muted-foreground">
          <span className="font-semibold text-foreground">{form.title}</span> is live. We're
          notifying verified workers near {form.area}, {form.city} right now.
        </p>
        <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="hero" size="lg" asChild>
            <Link to="/hire">
              Go to dashboard <ArrowRight />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setForm(initial);
              setStep(0);
              setPublished(false);
            }}
          >
            Post another shift
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
      <p className="text-sm font-semibold text-primary">Post a shift</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Post a shift</h1>
      <p className="mt-3 text-muted-foreground">
        Five quick steps. Verified workers get notified the moment you publish.
      </p>

      {/* Quick Post Toggle for Returning Users */}
      {!published && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => {
              toast.info("Quick Post: Coming soon! Single-page form for experienced users.", {
                description: "For now, use the step-by-step wizard below.",
              });
            }}
            className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-4 transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:shadow-md"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 text-primary transition-transform duration-200 group-hover:scale-110">
              <Zap className="size-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-primary">Quick Post</p>
              <p className="text-xs text-muted-foreground">
                Skip the wizard • Single-page form for returning users
              </p>
            </div>
            <ArrowRight className="size-5 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Rapid Job Toggle - Global */}
      {!published && (
        <div className={`mt-6 overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
          form.isRapidJob 
            ? "border-orange-500 bg-gradient-to-br from-orange-500/10 to-orange-500/5 shadow-lg" 
            : "border-border bg-muted/50"
        }`}>
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => set("isRapidJob", !form.isRapidJob)}
                className={`relative flex h-7 w-14 shrink-0 items-center rounded-full border-2 transition-all duration-200 ${
                  form.isRapidJob
                    ? "border-orange-500 bg-orange-500"
                    : "border-border bg-muted"
                }`}
              >
                <span
                  className={`block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    form.isRapidJob ? "translate-x-7" : "translate-x-0.5"
                  }`}
                />
              </button>
              
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <Zap className={`size-5 ${form.isRapidJob ? "text-orange-600 dark:text-orange-400 fill-current" : "text-muted-foreground"}`} />
                  <span className={`text-lg font-bold ${form.isRapidJob ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>
                    Rapid Job
                  </span>
                  {form.isRapidJob && (
                    <span className="animate-pulse rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">
                      URGENT
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-sm ${form.isRapidJob ? "text-orange-600/80 dark:text-orange-400/80" : "text-muted-foreground"}`}>
                  {form.isRapidJob 
                    ? "Priority visibility • Auto-expires if not filled • Must start today" 
                    : "Get priority visibility and urgent worker notifications"}
                </p>
              </div>

              {form.isRapidJob && (
                <div className="flex items-center gap-2 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 p-1">
                  <button
                    type="button"
                    onClick={() => set("rapidJobHours", "1")}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                      form.rapidJobHours === "1"
                        ? "bg-orange-500 text-white shadow-md"
                        : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
                    }`}
                  >
                    1 hour
                  </button>
                  <button
                    type="button"
                    onClick={() => set("rapidJobHours", "2")}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                      form.rapidJobHours === "2"
                        ? "bg-orange-500 text-white shadow-md"
                        : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
                    }`}
                  >
                    2 hours
                  </button>
                </div>
              )}
            </div>

            {form.isRapidJob && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
                <AlertCircle className="size-4 mt-0.5 shrink-0 text-orange-600 dark:text-orange-400" />
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  <strong>Rapid Job requirements:</strong> Job must start today. Workers will see a countdown timer. 
                  Job auto-expires in {form.rapidJobHours}h if not fully filled.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="mt-9">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--brand),var(--gold))] shadow-brand transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-4 grid grid-cols-5 gap-2">
          {steps.map((label, i) => (
            <li key={label} className="flex flex-col items-start gap-2">
              <div className="flex w-full items-center gap-2">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                    i < step
                      ? "border-success bg-success text-success-foreground"
                      : i === step
                        ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/20"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
              </div>
              <span
                className={`text-xs font-medium leading-tight ${
                  i === step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {stepShortLabels[i]}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <form
        className={`mt-8 overflow-hidden rounded-3xl border-2 bg-surface p-7 transition-all duration-300 lg:p-9 ${
          form.isRapidJob 
            ? "border-orange-500/40 shadow-[0_0_30px_rgba(255,107,53,0.15)]" 
            : "border-border"
        }`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (step < steps.length - 1) {
            if (valid) go(step + 1);
            return;
          }

          // Create job object from form data
          const newJob = {
            id: `job-${Date.now()}`,
            jobTitle: form.title,
            category: form.category,
            jobType: form.jobType,
            venueName: form.venueName,
            area: form.area,
            date: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
            duration: calculateDuration(form.startTime, form.endTime),
            wageDisplay: `₹${form.wage}/${form.wagePeriod === "hour" ? "hr" : "shift"}`,
            positionsTotal: form.positions,
            positionsConfirmed: 0,
            positionsRemaining: form.positions,
            isRapidJob: form.isRapidJob,
            rapidJobExpiry: form.isRapidJob ? calculateRapidJobExpiry(form.date, parseInt(form.rapidJobHours)) : undefined,
            requirements: {
              experience: form.experience,
              skills: form.skills,
              facilities: form.facilities,
            },
            instructions: {
              beforeArrival: form.beforeArrival,
              duringShift: form.duringShift,
              reportingContact: form.reportingContact,
            },
            description: form.description,
          };

          // If it's a Rapid Job, notify eligible workers
          if (form.isRapidJob) {
            try {
              const result = await notifyEligibleWorkers(newJob);
              
              if (result.totalNotified > 0) {
                toast.success("Rapid Job Posted!", {
                  description: `Notified ${result.totalNotified} eligible workers nearby.`,
                });
              } else {
                toast.success("Job Posted!", {
                  description: "No eligible workers found nearby at the moment.",
                });
              }

              // Schedule reminder notification for 15 minutes later
              scheduleReminderNotification(newJob, () => {
                // In real app, would fetch current status from database
                // For now, return mock data
                return {
                  positionsRemaining: newJob.positionsRemaining,
                  isCancelled: false,
                };
              });

            } catch (error) {
              console.error("Error notifying workers:", error);
              toast.success("Job Posted!", {
                description: "Workers will be notified shortly.",
              });
            }
          }

          setPublished(true);
        }}
      >
        <div key={step} className={dir === "fwd" ? "animate-step-in" : "animate-step-in-back"}>
          {/* Step 1: What job are you posting? */}
          {step === 0 && (
            <section className="grid gap-8">
              <div className="text-center">
                <h2 className="text-3xl">{steps[0]}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start with the basics — what role and category?
                </p>
              </div>

              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="title" className="text-base font-semibold">
                    Job title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. Banquet servers for wedding reception"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    className="h-14 text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific — include the type of work and event if applicable
                  </p>
                </div>

                <div className="grid gap-3">
                  <Label className="text-base font-semibold">
                    Category <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {categories.map((c) => {
                      const isSelected = form.category === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => set("category", c)}
                          className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-border hover:border-primary/50 hover:shadow-sm"
                          }`}
                        >
                          <div className="relative z-10">
                            <p className={`text-sm font-semibold ${
                              isSelected ? "text-primary" : "text-foreground"
                            }`}>
                              {JOB_CATEGORY_LABELS[c as keyof typeof JOB_CATEGORY_LABELS]}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="absolute right-2 top-2">
                              <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="size-4" strokeWidth={3} />
                              </div>
                            </div>
                          )}
                          {!isSelected && (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 transition-all duration-200 group-hover:from-primary/5 group-hover:to-primary/10" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose the category that best matches your job type
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Step 2: Where and when? */}
          {step === 1 && (
            <section className="grid gap-8">
              <div className="text-center">
                <h2 className="text-3xl">{steps[1]}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Where will workers report, and when does the shift start?
                </p>
              </div>

              <div className="grid gap-7">
                {/* Location Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Location Details</h3>
                  </div>
                  
                  <div className="grid gap-5">
                    <div className="grid gap-3">
                      <Label htmlFor="venueName" className="text-base font-semibold">
                        Venue name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="venueName"
                        placeholder="e.g. Grand Sapphire Banquet Hall"
                        value={form.venueName}
                        onChange={(e) => set("venueName", e.target.value)}
                        className="h-12 text-base"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="area">
                          Area / Locality <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="area"
                          placeholder="e.g. Andheri East"
                          value={form.area}
                          onChange={(e) => set("area", e.target.value)}
                          className="h-11"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="city">
                          City <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="city"
                          placeholder="e.g. Mumbai"
                          value={form.city}
                          onChange={(e) => set("city", e.target.value)}
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="fullAddress">Street address</Label>
                      <Input
                        id="fullAddress"
                        placeholder="e.g. 123 Main Road, Near City Mall"
                        value={form.fullAddress}
                        onChange={(e) => set("fullAddress", e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional — helps workers find the exact location
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="landmark">Nearby landmark</Label>
                      <Input
                        id="landmark"
                        placeholder="e.g. Opposite Metro Station, Behind City Mall"
                        value={form.landmark}
                        onChange={(e) => set("landmark", e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional — a recognizable nearby landmark
                      </p>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Schedule Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Schedule</h3>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-3">
                      <Label htmlFor="date" className="text-base font-semibold">
                        Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={form.date}
                        onChange={(e) => set("date", e.target.value)}
                        className="h-12 text-base"
                        min={new Date().toISOString().split('T')[0]}
                        disabled={form.isRapidJob}
                      />
                      {form.isRapidJob && (
                        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
                          <Zap className="size-4 text-orange-600 dark:text-orange-400" />
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                            Rapid jobs must start today
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="grid gap-3">
                        <Label htmlFor="startTime" className="text-base font-semibold">
                          Start time <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="startTime"
                            type="time"
                            value={form.startTime}
                            onChange={(e) => set("startTime", e.target.value)}
                            className="h-12 text-base"
                          />
                          <Clock className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <Label htmlFor="endTime" className="text-base font-semibold">
                          End time <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="endTime"
                            type="time"
                            value={form.endTime}
                            onChange={(e) => set("endTime", e.target.value)}
                            className="h-12 text-base"
                          />
                          <Clock className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    </div>

                    {form.startTime && form.endTime && (
                      <div className="animate-bounce-in rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                            <Clock className="size-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Shift duration
                            </p>
                            <p className="text-xl font-bold text-primary">
                              {(() => {
                                const duration = calculateDuration(form.startTime, form.endTime);
                                const hours = Math.floor(duration / 60);
                                const minutes = duration % 60;
                                
                                if (minutes === 0) {
                                  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                                }
                                return `${hours}h ${minutes}m`;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Step 3: How many workers? */}
          {step === 2 && (
            <section className="grid gap-8">
              <div className="text-center">
                <h2 className="text-3xl">{steps[2]}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Set crew size, wage per shift, and perks
                </p>
              </div>

              <div className="grid gap-7">
                {/* Workers Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Crew Size</h3>
                  </div>

                  <div className="grid gap-3">
                    <Label htmlFor="workers" className="text-base font-semibold">
                      Positions required <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-12 shrink-0"
                        onClick={() => set("workers", String(Math.max(1, Number(form.workers) - 1)))}
                        disabled={Number(form.workers) <= 1}
                      >
                        −
                      </Button>
                      <div className="flex-1">
                        <Input
                          id="workers"
                          type="number"
                          min={1}
                          max={999}
                          className="h-14 text-center text-2xl font-bold"
                          value={form.workers}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || (Number(val) >= 1 && Number(val) <= 999)) {
                              set("workers", val);
                            }
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-12 shrink-0"
                        onClick={() => set("workers", String(Math.min(999, Number(form.workers) + 1)))}
                        disabled={Number(form.workers) >= 999}
                      >
                        +
                      </Button>
                    </div>
                    <p className="text-center text-sm text-muted-foreground">
                      {Number(form.workers) === 1 ? "1 worker needed" : `${form.workers} workers needed`}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Wage Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Wallet className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Compensation</h3>
                  </div>

                  <div className="grid gap-5">
                    {/* Wage Type Toggle */}
                    <div className="grid gap-3">
                      <Label className="text-base font-semibold">Wage type</Label>
                      <div className="inline-flex rounded-xl border-2 border-border bg-muted p-1">
                        <button
                          type="button"
                          onClick={() => set("wageType", "per-shift")}
                          className={`flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
                            form.wageType === "per-shift"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Per Shift
                        </button>
                        <button
                          type="button"
                          onClick={() => set("wageType", "per-hour")}
                          className={`flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
                            form.wageType === "per-hour"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Per Hour
                        </button>
                      </div>
                    </div>

                    {/* Wage Amount */}
                    <div className="grid gap-3">
                      <Label htmlFor="wage" className="text-base font-semibold">
                        Wage amount (₹) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          id="wage"
                          type="number"
                          min={0}
                          step={50}
                          value={form.wage}
                          onChange={(e) => set("wage", e.target.value)}
                          className="h-14 pl-10 text-2xl font-bold"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {form.wageType === "per-shift" 
                          ? "Amount per worker per shift" 
                          : "Amount per worker per hour"}
                      </p>
                    </div>

                    {/* Auto-calculated Total */}
                    {Number(form.wage) > 0 && Number(form.workers) > 0 && (
                      <div className="animate-bounce-in rounded-xl border border-success/30 bg-success/5 p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Total {form.wageType === "per-shift" ? "per shift" : "cost"}
                            </p>
                            <p className="mt-1 text-3xl font-bold text-success">
                              ₹{(Number(form.wage) * Number(form.workers)).toLocaleString()}
                            </p>
                          </div>
                          {form.wageType === "per-hour" && form.startTime && form.endTime && (
                            <div className="text-right">
                              <p className="text-sm font-medium text-muted-foreground">
                                Full shift cost
                              </p>
                              <p className="mt-1 text-2xl font-bold text-success">
                                ₹{(
                                  Number(form.wage) * 
                                  Number(form.workers) * 
                                  (calculateDuration(form.startTime, form.endTime) / 60)
                                ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          )}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {form.wageType === "per-shift" 
                            ? `₹${form.wage} × ${form.workers} ${Number(form.workers) === 1 ? 'worker' : 'workers'}`
                            : form.startTime && form.endTime
                              ? `₹${form.wage}/hour × ${form.workers} ${Number(form.workers) === 1 ? 'worker' : 'workers'} × ${(calculateDuration(form.startTime, form.endTime) / 60).toFixed(1)} hours`
                              : `₹${form.wage}/hour × ${form.workers} ${Number(form.workers) === 1 ? 'worker' : 'workers'}`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Facilities Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Facilities & Perks</h3>
                  </div>

                  <div className="grid gap-4">
                    <Label className="text-base font-semibold">What will you provide?</Label>
                    
                    {/* Predefined Facilities */}
                    <div className="flex flex-wrap gap-2">
                      {facilityOptions.map(({ label, icon: Icon }) => {
                        const isSelected = form.facilities.includes(label);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() =>
                              set(
                                "facilities",
                                isSelected
                                  ? form.facilities.filter((f) => f !== label)
                                  : [...form.facilities, label],
                              )
                            }
                            className={`group flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-background hover:border-primary/50"
                            }`}
                          >
                            <Icon className="size-4" />
                            <span>{label}</span>
                            {isSelected && <Check className="size-4" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Facilities */}
                    {form.facilities.filter(f => !facilityOptions.some(opt => opt.label === f)).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {form.facilities
                          .filter(f => !facilityOptions.some(opt => opt.label === f))
                          .map((customFacility) => (
                            <div
                              key={customFacility}
                              className="group flex items-center gap-2 rounded-full border-2 border-gold bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold-foreground shadow-sm"
                            >
                              <Sparkles className="size-4" />
                              <span>{customFacility}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  set("facilities", form.facilities.filter((f) => f !== customFacility))
                                }
                                className="rounded-full hover:bg-gold/20 p-0.5 transition-colors"
                              >
                                <X className="size-3.5" strokeWidth={3} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Add Custom Facility */}
                    <div className="grid gap-2">
                      <Label htmlFor="customFacility" className="text-sm">
                        Add custom facility
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="customFacility"
                          placeholder="e.g. Snacks, Medical kit, Break room..."
                          value={form.customFacility}
                          onChange={(e) => set("customFacility", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && form.customFacility.trim()) {
                              e.preventDefault();
                              const trimmed = form.customFacility.trim();
                              if (!form.facilities.includes(trimmed)) {
                                set("facilities", [...form.facilities, trimmed]);
                                set("customFacility", "");
                              }
                            }
                          }}
                          className="h-11"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-11 shrink-0"
                          onClick={() => {
                            const trimmed = form.customFacility.trim();
                            if (trimmed && !form.facilities.includes(trimmed)) {
                              set("facilities", [...form.facilities, trimmed]);
                              set("customFacility", "");
                            }
                          }}
                          disabled={!form.customFacility.trim()}
                        >
                          <Plus className="size-5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Press Enter or click + to add • Selected: {form.facilities.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Step 4: What should workers know? */}
          {step === 3 && (
            <section className="grid gap-8">
              <div className="text-center">
                <h2 className="text-3xl">{steps[3]}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Describe the work and any special requirements
                </p>
              </div>

              <div className="grid gap-7">
                {/* Description Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Job Description</h3>
                  </div>

                  <div className="grid gap-3">
                    <Label htmlFor="description" className="text-base font-semibold">
                      Describe the work <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      rows={5}
                      placeholder="Describe what workers will do, the environment they'll work in, and any important details they should know..."
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      className="resize-none text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      Be clear and specific to attract the right workers • {form.description.length} characters
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <Label className="text-base font-semibold">Job type</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(JobType).map((type) => {
                        const isSelected = form.jobType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => set("jobType", type)}
                            className={`rounded-xl border-2 px-5 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {JOB_TYPE_LABELS[type as keyof typeof JOB_TYPE_LABELS]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Requirements Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Worker Requirements</h3>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6">
                    <p className="text-sm text-muted-foreground mb-5">
                      Help workers know if they're qualified (all fields optional)
                    </p>

                    <div className="grid gap-5">
                      {/* Experience */}
                      <div className="grid gap-2">
                        <Label htmlFor="experience">Experience level</Label>
                        <Input
                          id="experience"
                          placeholder="e.g. Entry level, 2+ years experience, Professional"
                          value={form.experience}
                          onChange={(e) => set("experience", e.target.value)}
                          className="h-11"
                        />
                      </div>

                      {/* Skills (Tag Input) */}
                      <div className="grid gap-3">
                        <Label htmlFor="skillInput">Required skills</Label>
                        
                        {/* Display existing skills */}
                        {form.skills.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {form.skills.map((skill, index) => (
                              <div
                                key={`${skill}-${index}`}
                                className="group flex items-center gap-2 rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                              >
                                <span>{skill}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    set("skills", form.skills.filter((_, i) => i !== index))
                                  }
                                  className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                                >
                                  <X className="size-3.5" strokeWidth={3} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Input to add new skill */}
                        <div className="flex gap-2">
                          <Input
                            id="skillInput"
                            placeholder="e.g. Food handling, Customer service, Lifting..."
                            value={form.skillInput}
                            onChange={(e) => set("skillInput", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && form.skillInput.trim()) {
                                e.preventDefault();
                                const trimmed = form.skillInput.trim();
                                if (!form.skills.includes(trimmed)) {
                                  set("skills", [...form.skills, trimmed]);
                                  set("skillInput", "");
                                }
                              }
                            }}
                            className="h-11"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11 shrink-0"
                            onClick={() => {
                              const trimmed = form.skillInput.trim();
                              if (trimmed && !form.skills.includes(trimmed)) {
                                set("skills", [...form.skills, trimmed]);
                                set("skillInput", "");
                              }
                            }}
                            disabled={!form.skillInput.trim()}
                          >
                            <Plus className="size-5" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Press Enter or click + to add • {form.skills.length} skill{form.skills.length !== 1 ? 's' : ''} added
                        </p>
                      </div>

                      {/* Dress Code */}
                      <div className="grid gap-2">
                        <Label htmlFor="dressCode">Dress code</Label>
                        <Input
                          id="dressCode"
                          placeholder="e.g. Formal black and white, Casual, Provided uniform"
                          value={form.dressCode}
                          onChange={(e) => set("dressCode", e.target.value)}
                          className="h-11"
                        />
                      </div>

                      {/* Documents Required */}
                      <div className="grid gap-2">
                        <Label htmlFor="documentsRequired">Documents needed</Label>
                        <Input
                          id="documentsRequired"
                          placeholder="e.g. Government ID, Bank details, Police verification"
                          value={form.documentsRequired}
                          onChange={(e) => set("documentsRequired", e.target.value)}
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Instructions Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <ListChecks className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Instructions for Workers</h3>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    {/* Before Arrival */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                          <AlertCircle className="size-4 text-primary" />
                        </div>
                        <h4 className="font-semibold">Before Arrival</h4>
                      </div>

                      {/* Display existing items */}
                      {form.beforeArrivalItems.length > 0 && (
                        <ul className="space-y-2 mb-4">
                          {form.beforeArrivalItems.map((item, index) => (
                            <li
                              key={`before-${index}`}
                              className="group flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm"
                            >
                              <Check className="size-4 mt-0.5 shrink-0 text-primary" strokeWidth={3} />
                              <span className="flex-1">{item}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  set("beforeArrivalItems", form.beforeArrivalItems.filter((_, i) => i !== index))
                                }
                                className="opacity-0 group-hover:opacity-100 rounded-full hover:bg-muted p-1 transition-all"
                              >
                                <X className="size-3.5" strokeWidth={3} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Input to add new item */}
                      <div className="grid gap-2">
                        <Input
                          placeholder="e.g. Report 15 minutes early"
                          value={form.beforeArrivalInput}
                          onChange={(e) => set("beforeArrivalInput", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && form.beforeArrivalInput.trim()) {
                              e.preventDefault();
                              set("beforeArrivalItems", [...form.beforeArrivalItems, form.beforeArrivalInput.trim()]);
                              set("beforeArrivalInput", "");
                            }
                          }}
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (form.beforeArrivalInput.trim()) {
                              set("beforeArrivalItems", [...form.beforeArrivalItems, form.beforeArrivalInput.trim()]);
                              set("beforeArrivalInput", "");
                            }
                          }}
                          disabled={!form.beforeArrivalInput.trim()}
                          className="w-full"
                        >
                          <Plus className="size-4" />
                          Add instruction
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {form.beforeArrivalItems.length} instruction{form.beforeArrivalItems.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {/* During Shift */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                          <Clock className="size-4 text-primary" />
                        </div>
                        <h4 className="font-semibold">During Shift</h4>
                      </div>

                      {/* Display existing items */}
                      {form.duringShiftItems.length > 0 && (
                        <ul className="space-y-2 mb-4">
                          {form.duringShiftItems.map((item, index) => (
                            <li
                              key={`during-${index}`}
                              className="group flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm"
                            >
                              <Check className="size-4 mt-0.5 shrink-0 text-primary" strokeWidth={3} />
                              <span className="flex-1">{item}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  set("duringShiftItems", form.duringShiftItems.filter((_, i) => i !== index))
                                }
                                className="opacity-0 group-hover:opacity-100 rounded-full hover:bg-muted p-1 transition-all"
                              >
                                <X className="size-3.5" strokeWidth={3} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Input to add new item */}
                      <div className="grid gap-2">
                        <Input
                          placeholder="e.g. Follow supervisor's directions"
                          value={form.duringShiftInput}
                          onChange={(e) => set("duringShiftInput", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && form.duringShiftInput.trim()) {
                              e.preventDefault();
                              set("duringShiftItems", [...form.duringShiftItems, form.duringShiftInput.trim()]);
                              set("duringShiftInput", "");
                            }
                          }}
                          className="h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (form.duringShiftInput.trim()) {
                              set("duringShiftItems", [...form.duringShiftItems, form.duringShiftInput.trim()]);
                              set("duringShiftInput", "");
                            }
                          }}
                          disabled={!form.duringShiftInput.trim()}
                          className="w-full"
                        >
                          <Plus className="size-4" />
                          Add instruction
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {form.duringShiftItems.length} instruction{form.duringShiftItems.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Additional Notes */}
                <div className="space-y-3">
                  <Label htmlFor="notes" className="text-base font-semibold">
                    Additional notes (optional)
                  </Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Any other important information for workers..."
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    className="resize-none"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Step 5: Review & Post */}
          {step === 4 && (
            <section className="grid gap-8">
              <div className="text-center">
                <h2 className="text-3xl">{steps[4]}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Here's how your job will appear to workers
                </p>
              </div>

              {/* Job Card Preview - Matches worker view exactly */}
              <div className="mx-auto w-full max-w-md">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Live Preview
                </div>
                
                <article
                  className={`flex flex-col rounded-2xl border p-6 shadow-md ${
                    form.isRapidJob
                      ? "border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-card"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Rapid Job Badge */}
                  {form.isRapidJob && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500 bg-orange-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400 animate-pulse">
                        <Zap className="size-3 fill-current" />
                        Urgent · Expires in {form.rapidJobHours}h
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-orange-500/50 bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
                        <TrendingUp className="size-3" />
                        +20% surge pay
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{form.title || "Your Job Title"}</h2>
                      <span className="mt-1 inline-block rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {JOB_CATEGORY_LABELS[form.category as keyof typeof JOB_CATEGORY_LABELS]}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-sm font-semibold">
                      <Star className="size-3.5 fill-gold text-gold" />
                      4.8
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Your Business Name</p>

                  <p className={`mt-4 flex items-center gap-2 font-display text-2xl font-bold ${
                    form.isRapidJob ? "text-orange-600 dark:text-orange-400" : "text-primary"
                  }`}>
                    <Wallet className="size-5" /> ₹{form.wage || "0"}
                    {form.isRapidJob && (
                      <span className="text-sm font-normal text-muted-foreground">(+20%)</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.wageType === "per-hour" ? "per hour" : "per shift"} · {form.workers || "0"} position{Number(form.workers) !== 1 ? "s" : ""}
                  </p>

                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0" />
                    {form.date ? new Date(form.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : "Date TBD"} ·{" "}
                    {form.startTime || "??"} – {form.endTime || "??"}
                    {form.startTime && form.endTime && (
                      <> · {Math.floor(calculateDuration(form.startTime, form.endTime) / 60)}h {calculateDuration(form.startTime, form.endTime) % 60}m</>
                    )}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" /> {form.area || "Area"}, {form.city || "City"}
                  </p>

                  {form.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{form.description}</p>
                  )}

                  {(form.facilities.length > 0 || form.skills.length > 0) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {form.facilities.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                          <CheckCircle2 className="size-3" /> {f}
                        </span>
                      ))}
                      {form.skills.slice(0, 2).map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground">
                          <BadgeCheck className="size-3" /> {s}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground">
                        <Clock className="size-3" /> {JOB_TYPE_LABELS[form.jobType as keyof typeof JOB_TYPE_LABELS]}
                      </span>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant={form.isRapidJob ? "destructive" : "hero"}
                    size="lg"
                    className={`mt-6 w-full pointer-events-none ${
                      form.isRapidJob
                        ? "animate-pulse bg-orange-600 dark:bg-orange-500"
                        : ""
                    }`}
                  >
                    <SendHorizonal className="size-4" /> {form.isRapidJob ? "Apply Now — Urgent!" : "Apply now"}
                  </Button>
                </article>
              </div>

              {/* Summary Details */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <FileText className="size-5 text-primary" />
                  Job Summary
                </h3>
                
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</dt>
                    <dd className="mt-1 text-sm font-medium">{form.venueName || "Not set"}</dd>
                    <dd className="text-sm text-muted-foreground">{form.fullAddress || form.area}, {form.city}</dd>
                    {form.landmark && <dd className="text-xs text-muted-foreground">Near {form.landmark}</dd>}
                  </div>
                  
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Cost</dt>
                    <dd className="mt-1 text-sm font-medium">
                      ₹{Number(form.wage || 0) * Number(form.workers || 0)}{" "}
                      {form.wageType === "per-hour" && form.startTime && form.endTime && (
                        <span className="text-muted-foreground">
                          × {Math.ceil(calculateDuration(form.startTime, form.endTime) / 60)}h = ₹
                          {Number(form.wage || 0) * Number(form.workers || 0) * Math.ceil(calculateDuration(form.startTime, form.endTime) / 60)}
                        </span>
                      )}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {form.workers} worker{Number(form.workers) !== 1 ? "s" : ""} × ₹{form.wage || 0} {form.wageType === "per-hour" ? "/hour" : "/shift"}
                    </dd>
                  </div>

                  {form.experience && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience</dt>
                      <dd className="mt-1 text-sm">{form.experience}</dd>
                    </div>
                  )}

                  {form.dressCode && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dress Code</dt>
                      <dd className="mt-1 text-sm">{form.dressCode}</dd>
                    </div>
                  )}

                  {form.documentsRequired && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents Required</dt>
                      <dd className="mt-1 text-sm">{form.documentsRequired}</dd>
                    </div>
                  )}
                </dl>

                {(form.beforeArrivalItems.length > 0 || form.duringShiftItems.length > 0) && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {form.beforeArrivalItems.length > 0 && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before Arrival</dt>
                        <dd className="mt-2 space-y-1">
                          {form.beforeArrivalItems.map((item, idx) => (
                            <p key={idx} className="flex items-start gap-2 text-sm">
                              <Check className="size-4 mt-0.5 shrink-0 text-primary" strokeWidth={3} />
                              {item}
                            </p>
                          ))}
                        </dd>
                      </div>
                    )}

                    {form.duringShiftItems.length > 0 && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">During Shift</dt>
                        <dd className="mt-2 space-y-1">
                          {form.duringShiftItems.map((item, idx) => (
                            <p key={idx} className="flex items-start gap-2 text-sm">
                              <Check className="size-4 mt-0.5 shrink-0 text-primary" strokeWidth={3} />
                              {item}
                            </p>
                          ))}
                        </dd>
                      </div>
                    )}
                  </div>
                )}

                {form.notes && (
                  <div className="mt-5 rounded-xl border border-border bg-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Notes</p>
                    <p className="mt-1 text-sm">{form.notes}</p>
                  </div>
                )}
              </div>

              {/* Publish Info */}
              <div className={`rounded-2xl border p-5 ${
                form.isRapidJob
                  ? "border-orange-500/30 bg-orange-500/5"
                  : "border-primary/20 bg-primary/5"
              }`}>
                <div className="flex items-start gap-3">
                  {form.isRapidJob ? (
                    <Zap className="size-5 shrink-0 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Sparkles className="size-5 shrink-0 text-primary" />
                  )}
                  <div>
                    <p className={`font-medium ${form.isRapidJob ? "text-orange-600 dark:text-orange-400" : "text-primary"}`}>
                      {form.isRapidJob ? "Urgent Job — Priority Notifications" : "Ready to publish"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {form.isRapidJob 
                        ? `All verified workers within 5km will get instant push notifications. Job expires in ${form.rapidJobHours} hour${form.rapidJobHours !== "1" ? "s" : ""} if not filled.`
                        : "Verified workers within 5 km will get an instant notification when you publish."}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Validation Errors */}
        {!valid && validationErrors.length > 0 && (
          <div className="mt-6 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="font-semibold text-destructive">Please fix the following errors:</p>
                <ul className="mt-2 space-y-1 text-sm text-destructive/90">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-0.5">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="mt-9 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => go(step - 1)}
            disabled={step === 0}
          >
            <ArrowLeft /> Back
          </Button>
          <Button type="submit" variant="hero" size="lg" disabled={!valid}>
            {step === steps.length - 1 ? (
              <>
                <Send /> Post job
              </>
            ) : (
              <>
                Continue <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-2 text-sm">
        <Icon className="size-4 text-primary" /> {children}
      </dd>
    </div>
  );
}
