import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock, MapPin, Plus, Star, Users, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/hire")({
  head: () => ({
    meta: [
      { title: "Employer Dashboard — Post a Shift on QuickWork" },
      {
        name: "description",
        content:
          "Post a catering shift in under a minute, review verified applicants and track job status from one QuickWork dashboard.",
      },
      { property: "og:title", content: "QuickWork Employer Dashboard" },
      {
        property: "og:description",
        content: "Post shifts, review verified applicants and track every booking in one place.",
      },
    ],
  }),
  component: HirePage,
});

const facilities = ["Meals provided", "Transport", "Uniform", "Locker room"];

const jobs = [
  {
    role: "Banquet servers",
    count: "6 of 8 booked",
    date: "Fri, 14 Aug · 5:00 PM",
    area: "Andheri East",
    wage: "₹1,200",
    status: "Filling",
  },
  {
    role: "Kitchen helpers",
    count: "4 of 4 booked",
    date: "Sat, 15 Aug · 9:00 AM",
    area: "Powai",
    wage: "₹950",
    status: "Confirmed",
  },
  {
    role: "Dishwashing crew",
    count: "0 of 3 booked",
    date: "Sun, 16 Aug · 7:00 PM",
    area: "Lower Parel",
    wage: "₹900",
    status: "Draft",
  },
];

const applicants = [
  { name: "Rahul Mehta", trade: "Banquet server · 3 yrs", rating: "4.9", verified: true },
  { name: "Sana Qureshi", trade: "Kitchen helper · 2 yrs", rating: "4.8", verified: true },
  { name: "Imran Shaikh", trade: "Steward · 1 yr", rating: "4.6", verified: false },
];

function HirePage() {
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string[]>(["Meals provided"]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Employer dashboard</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Saffron Caterers</h1>
          <p className="mt-3 text-muted-foreground">
            3 active shifts · 14 workers booked this week
          </p>
        </div>
        <VerifiedBadge label="Verified Business" tone="success" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        {/* Post a job */}
        <form
          className="rounded-3xl border border-border bg-surface p-7 lg:p-9"
          onSubmit={(e) => {
            e.preventDefault();
            toast.success("Shift posted — verified workers nearby are being notified.");
          }}
        >
          <h2 className="text-2xl">Post a shift</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Six fields. Workers see it instantly. Prefer a guided flow?{" "}
            <Link to="/post-job" className="story-link font-semibold text-primary">
              Use the 4-step wizard
            </Link>
          </p>


          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time">Start time</Label>
              <Input id="time" type="time" required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="Venue name, area" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workers">Workers needed</Label>
              <Input id="workers" type="number" min={1} defaultValue={4} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wage">Wage per shift (₹)</Label>
              <Input id="wage" type="number" min={0} step={50} defaultValue={1200} required />
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Facilities provided</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {facilities.map((f) => {
                const on = picked.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() =>
                      setPicked((p) => (on ? p.filter((x) => x !== f) : [...p, f]))
                    }
                    className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.03] ${
                      on
                        ? "border-primary bg-primary/12 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" variant="hero" size="lg" className="mt-8 w-full">
            <Plus /> Post shift
          </Button>
        </form>

        {/* Applicants */}
        <div className="rounded-3xl border border-border bg-surface p-7 lg:p-9">
          <h2 className="text-2xl">Applicants</h2>
          <p className="mt-2 text-sm text-muted-foreground">Banquet servers · Fri, 14 Aug</p>
          <ul className="mt-7 space-y-4">
            {loading
              ? [0, 1, 2].map((i) => (
                  <li key={i} className="rounded-2xl border border-border bg-card p-5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="mt-3 h-3 w-1/2" />
                    <Skeleton className="mt-5 h-9 w-28 rounded-lg" />
                  </li>
                ))
              : applicants.map((a) => (
                  <li
                    key={a.name}
                    className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base">{a.name}</h3>
                      {a.verified && <VerifiedBadge />}
                      <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold">
                        <Star className="size-4 fill-gold text-gold" />
                        {a.rating}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{a.trade}</p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => toast.success(`${a.name} confirmed for this shift.`)}
                      >
                        <CheckCircle2 /> Confirm
                      </Button>
                      <Button size="sm" variant="outline">
                        View profile
                      </Button>
                    </div>
                  </li>
                ))}
          </ul>
        </div>
      </div>

      {/* Job status bento */}
      <section className="mt-14">
        <h2 className="text-2xl">Your shifts</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-6">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-4 h-3 w-1/2" />
                  <Skeleton className="mt-2 h-3 w-2/5" />
                  <Skeleton className="mt-6 h-8 w-24 rounded-lg" />
                </div>
              ))
            : jobs.map((job) => (
                <article
                  key={job.role}
                  className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg">{job.role}</h3>
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        job.status === "Confirmed"
                          ? "border-success/40 bg-success/15 text-success"
                          : job.status === "Filling"
                            ? "border-primary/40 bg-primary/12 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="size-4" /> {job.count}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" /> {job.date}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4" /> {job.area}
                  </p>
                  <p className="mt-5 flex items-center gap-2 font-display text-xl font-bold text-primary">
                    <Wallet className="size-5" /> {job.wage}
                    <span className="text-sm font-medium text-muted-foreground">/ worker</span>
                  </p>
                  <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3.5" /> Posted 2 hours ago
                  </p>
                </article>
              ))}
        </div>
      </section>
    </div>
  );
}
