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
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  Users,
  ShowerHead,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/post-job")({
  head: () => ({
    meta: [
      { title: "Post a Shift in 4 Steps — QuickWork" },
      {
        name: "description",
        content:
          "Guided 4-step shift posting: job basics, location and crew size, wage and facilities, then review and publish to verified workers near you.",
      },
      { property: "og:title", content: "Post a Shift in 4 Steps — QuickWork" },
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

const steps = ["Job basics", "Location & crew", "Wage & facilities", "Review"] as const;

const categories = [
  "Catering & banquets",
  "Kitchen support",
  "Housekeeping",
  "Warehouse & loading",
  "Event setup",
  "Retail support",
] as const;

const facilityOptions = [
  { label: "Meals provided", icon: UtensilsCrossed },
  { label: "Transport", icon: Bus },
  { label: "Uniform", icon: Shirt },
  { label: "Locker room", icon: ShowerHead },
] as const;

type Form = {
  title: string;
  category: string;
  date: string;
  time: string;
  hours: string;
  venue: string;
  area: string;
  workers: string;
  notes: string;
  wage: string;
  facilities: string[];
};

const initial: Form = {
  title: "",
  category: categories[0],
  date: "",
  time: "",
  hours: "8",
  venue: "",
  area: "",
  workers: "4",
  notes: "",
  wage: "1200",
  facilities: ["Meals provided"],
};

function PostJobPage() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [form, setForm] = useState<Form>(initial);
  const [published, setPublished] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const valid = [
    form.title.trim().length > 2 && form.date !== "" && form.time !== "",
    form.venue.trim().length > 1 && form.area.trim().length > 1 && Number(form.workers) > 0,
    Number(form.wage) > 0,
    true,
  ][step];

  const go = (next: number) => {
    setDir(next > step ? "fwd" : "back");
    setStep(next);
  };

  const progress = published ? 100 : ((step + 1) / steps.length) * 100;

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
          notifying verified workers near {form.area} right now.
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
        Four quick steps. Verified workers get notified the moment you publish.
      </p>

      {/* Progress */}
      <div className="mt-9">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--brand),var(--gold))] shadow-brand transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-2">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2 text-xs sm:text-sm">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all duration-300 ${
                  i < step
                    ? "border-success bg-success text-success-foreground"
                    : i === step
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`hidden font-medium sm:block ${
                  i === step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <form
        className="mt-8 overflow-hidden rounded-3xl border border-border bg-surface p-7 lg:p-9"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < steps.length - 1) {
            if (valid) go(step + 1);
            return;
          }
          setPublished(true);
        }}
      >
        <div key={step} className={dir === "fwd" ? "animate-step-in" : "animate-step-in-back"}>
          {step === 0 && (
            <section className="grid gap-5">
              <h2 className="text-2xl">Job basics</h2>
              <div className="grid gap-2">
                <Label htmlFor="title">Job title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Banquet servers for wedding reception"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("category", c)}
                      className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.03] ${
                        form.category === c
                          ? "border-primary bg-primary/12 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">Start time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={form.time}
                    onChange={(e) => set("time", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hours">Shift length (hrs)</Label>
                  <Input
                    id="hours"
                    type="number"
                    min={1}
                    max={16}
                    value={form.hours}
                    onChange={(e) => set("hours", e.target.value)}
                  />
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="grid gap-5">
              <h2 className="text-2xl">Location & crew size</h2>
              <div className="grid gap-2">
                <Label htmlFor="venue">Venue name</Label>
                <Input
                  id="venue"
                  placeholder="e.g. Grand Sapphire Banquet Hall"
                  value={form.venue}
                  onChange={(e) => set("venue", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="area">Area / locality</Label>
                <Input
                  id="area"
                  placeholder="e.g. Andheri East, Mumbai"
                  value={form.area}
                  onChange={(e) => set("area", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="workers">Workers needed</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => set("workers", String(Math.max(1, Number(form.workers) - 1)))}
                  >
                    −
                  </Button>
                  <Input
                    id="workers"
                    type="number"
                    min={1}
                    className="w-24 text-center"
                    value={form.workers}
                    onChange={(e) => set("workers", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => set("workers", String(Number(form.workers) + 1))}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    <Users className="mr-1.5 inline size-4" />
                    verified workers nearby
                  </span>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes for workers (optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Entry gate, dress code, reporting instructions…"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="grid gap-5">
              <h2 className="text-2xl">Wage & facilities</h2>
              <div className="grid gap-2">
                <Label htmlFor="wage">Wage per worker per shift (₹)</Label>
                <Input
                  id="wage"
                  type="number"
                  min={0}
                  step={50}
                  value={form.wage}
                  onChange={(e) => set("wage", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Total payout ≈{" "}
                  <span className="font-semibold text-primary">
                    ₹{(Number(form.wage) || 0) * (Number(form.workers) || 0)}
                  </span>{" "}
                  for {form.workers} workers
                </p>
              </div>
              <fieldset>
                <legend className="text-sm font-medium">Facilities offered</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {facilityOptions.map(({ label, icon: Icon }) => {
                    const on = form.facilities.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          set(
                            "facilities",
                            on
                              ? form.facilities.filter((f) => f !== label)
                              : [...form.facilities, label],
                          )
                        }
                        className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-5" />
                        {label}
                        {on && <Check className="ml-auto size-4" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </section>
          )}

          {step === 3 && (
            <section className="grid gap-5">
              <h2 className="text-2xl">Review & publish</h2>
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg">{form.title || "Untitled shift"}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{form.category}</p>
                  </div>
                  <span className="rounded-lg border border-gold/40 bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-foreground">
                    Ready to publish
                  </span>
                </div>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Row icon={CalendarDays} label="When">
                    {form.date} · {form.time} · {form.hours} hrs
                  </Row>
                  <Row icon={MapPin} label="Where">
                    {form.venue}, {form.area}
                  </Row>
                  <Row icon={Users} label="Crew">
                    {form.workers} workers
                  </Row>
                  <Row icon={Wallet} label="Wage">
                    ₹{form.wage} / worker
                  </Row>
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  {form.facilities.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No facilities selected</span>
                  ) : (
                    form.facilities.map((f) => (
                      <span
                        key={f}
                        className="animate-bounce-in flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/15 px-2.5 py-1 text-xs font-semibold text-success"
                      >
                        <CheckCircle2 className="size-3.5" /> {f}
                      </span>
                    ))
                  )}
                </div>
                {form.notes && (
                  <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                    {form.notes}
                  </p>
                )}
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-gold" /> Verified workers within 5 km get an
                instant notification.
              </p>
            </section>
          )}
        </div>

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
                <Send /> Publish shift
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
