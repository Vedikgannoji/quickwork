import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Share2,
  Star,
  Timer,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Check Out — QuickWork" },
      {
        name: "description",
        content:
          "Confirm shift completion and track your UPI payment status on QuickWork.",
      },
    ],
  }),
  component: CheckoutPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentStatus = "pending" | "processing" | "paid";

// ─── Mock shift data ──────────────────────────────────────────────────────────

const shift = {
  role: "Banquet server",
  employer: "Grand Palm Banquets",
  venue: "Grand Palm Banquet Hall",
  area: "Andheri East",
  date: "Mon, 17 Aug 2026",
  checkIn: "5:03 PM",
  checkOut: "10:58 PM",
  hoursWorked: 5.92,
  wagePerShift: 1200,
  upiId: "quickwork@okaxis",
  txnRef: "QW26081700042",
  workerName: "Rahul Mehta",
  workerUpi: "rahulmehta@upi",
  rating: 5,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(hrs: number) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h ${m}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0 text-primary/70" />
        {label}
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${score} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-5 ${i < score ? "fill-gold text-gold" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

// ─── Payment status card ──────────────────────────────────────────────────────

function PaymentCard({ status }: { status: PaymentStatus }) {
  const isPaid = status === "paid";
  const isProcessing = status === "processing";
  const isPending = status === "pending";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Payment status: ${status}`}
      className={`relative overflow-hidden rounded-3xl border p-8 transition-all duration-500 ${
        isPaid
          ? "border-success/40 bg-success/8"
          : isProcessing
            ? "border-primary/40 bg-primary/8"
            : "border-border bg-surface"
      }`}
    >
      {/* Glow blobs for paid state */}
      {isPaid && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-success/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-success/10 blur-3xl" />
        </div>
      )}

      <div className="relative">
        {/* Icon */}
        <div className="flex items-center gap-4">
          <div
            className={`flex size-16 items-center justify-center rounded-2xl transition-all duration-500 ${
              isPaid
                ? "bg-success text-success-foreground shadow-[0_8px_24px_-8px_var(--color-success)]"
                : isProcessing
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {isPaid ? (
              <CheckCircle2 className="size-8" />
            ) : isProcessing ? (
              <Loader2 className="size-8 animate-spin" />
            ) : (
              <Wallet className="size-8" />
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Payment status
            </p>
            <p
              className={`mt-1 text-2xl font-bold font-display transition-colors duration-500 ${
                isPaid ? "text-success" : isProcessing ? "text-primary" : "text-foreground"
              }`}
            >
              {isPaid ? "Paid" : isProcessing ? "Processing…" : "Pending"}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div
          className={`mt-6 flex items-center justify-between rounded-2xl p-5 transition-colors duration-500 ${
            isPaid ? "bg-success/12 border border-success/25" : "bg-muted/60 border border-border"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IndianRupee className="size-4" />
            Wage for shift
          </div>
          <p
            className={`font-display text-3xl font-bold tabular-nums transition-colors duration-500 ${isPaid ? "text-success" : "text-foreground"}`}
          >
            ₹{shift.wagePerShift.toLocaleString("en-IN")}
          </p>
        </div>

        {/* Status-specific content */}
        {isPaid && (
          <div className="mt-5 space-y-3 animate-rise">
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-success shrink-0" />
              <span className="text-muted-foreground">
                Sent to{" "}
                <span className="font-semibold text-foreground">{shift.workerUpi}</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-success shrink-0" />
              <span className="text-muted-foreground">
                Transaction ref:{" "}
                <span className="font-mono font-semibold text-foreground">{shift.txnRef}</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="size-4 text-success shrink-0" />
              <span className="text-muted-foreground">
                Via{" "}
                <span className="font-semibold text-foreground">{shift.upiId}</span>
              </span>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="mt-5 animate-rise">
            <p className="text-sm text-muted-foreground">
              Your bank is confirming the UPI transfer. This usually takes under 30 seconds.
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
        )}

        {isPending && (
          <div className="mt-5 animate-rise">
            <p className="text-sm text-muted-foreground">
              The employer will initiate the UPI transfer once shift completion is confirmed.
              You'll get a notification the moment it lands.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Check-out screen ─────────────────────────────────────────────────────────

function CheckoutPage() {
  const [phase, setPhase] = useState<"summary" | "payment">("summary");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("pending");
  const [confirmed, setConfirmed] = useState(false);

  // Simulate payment progression after check-out is confirmed
  useEffect(() => {
    if (phase !== "payment") return;

    // pending → processing after 1.2 s
    const t1 = setTimeout(() => setPayStatus("processing"), 1200);
    // processing → paid after 4 s
    const t2 = setTimeout(() => setPayStatus("paid"), 4200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  // ── Phase 1: Job summary + check-out confirmation ──

  if (phase === "summary") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Shift complete</p>
            <h1 className="mt-2 text-4xl font-bold font-display sm:text-5xl">
              Check out
            </h1>
            <p className="mt-3 text-muted-foreground">
              Review your shift summary and confirm to release payment.
            </p>
          </div>
          <VerifiedBadge />
        </div>

        {/* Worker + employer card */}
        <div className="mt-10 rounded-3xl border border-border bg-surface p-7">
          <div className="flex flex-wrap items-start gap-5">
            {/* Avatar */}
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-2xl font-bold text-primary-foreground shadow-brand">
              RM
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{shift.workerName}</h2>
                <BadgeCheck className="size-5 text-gold" aria-label="Verified professional" />
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="size-4" />
                {shift.role}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {shift.venue}, {shift.area}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <p className="text-xs text-muted-foreground">Employer</p>
              <p className="font-semibold text-sm">{shift.employer}</p>
            </div>
          </div>
        </div>

        {/* Shift details */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-7">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Shift summary
          </h3>
          <div className="mt-4">
            <SummaryRow icon={CalendarCheck} label="Date" value={shift.date} />
            <SummaryRow icon={Clock} label="Check-in" value={shift.checkIn} />
            <SummaryRow icon={Clock} label="Check-out" value={shift.checkOut} />
            <SummaryRow icon={Timer} label="Hours worked" value={fmt(shift.hoursWorked)} />
            <SummaryRow
              icon={Banknote}
              label="Wage"
              value={`₹${shift.wagePerShift.toLocaleString("en-IN")}`}
              highlight
            />
          </div>
        </div>

        {/* Rating */}
        <div className="mt-6 rounded-3xl border border-border bg-surface p-7">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Employer rating for this shift
          </h3>
          <div className="flex items-center gap-4">
            <StarRating score={shift.rating} />
            <span className="text-sm text-muted-foreground">
              "Punctual, professional and great with guests."
            </span>
          </div>
        </div>

        {/* Attendance confirmation */}
        <div className="mt-6 rounded-3xl border border-border bg-surface p-7">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Attendance confirmation
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            By confirming, you acknowledge that{" "}
            <span className="font-semibold text-foreground">{shift.workerName}</span> completed
            this shift and authorise the UPI payment of{" "}
            <span className="font-semibold text-primary">
              ₹{shift.wagePerShift.toLocaleString("en-IN")}
            </span>{" "}
            to <span className="font-mono text-sm font-semibold">{shift.workerUpi}</span>.
          </p>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={confirmed}
              onClick={() => setConfirmed((c) => !c)}
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                confirmed
                  ? "border-success bg-success text-success-foreground"
                  : "border-input bg-background"
              }`}
            >
              {confirmed && <CheckCircle2 className="size-3.5" strokeWidth={3} />}
            </button>
            <span className="text-sm leading-relaxed">
              I confirm the shift was completed as described and the wage amount is correct.
            </span>
          </label>
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!confirmed}
            onClick={() => setPhase("payment")}
            aria-disabled={!confirmed}
          >
            <CheckCircle2 />
            Confirm check-out &amp; release payment
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Secured by QuickWork · UPI transfer via {shift.upiId}
          </p>
        </div>
      </div>
    );
  }

  // ── Phase 2: Payment status ──

  return (
    <div className="mx-auto max-w-2xl px-5 py-14 lg:px-8">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-primary">Payment</p>
        <h1 className="mt-2 text-4xl font-bold font-display sm:text-5xl">
          {payStatus === "paid" ? "All done!" : "Sending payment…"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {payStatus === "paid"
            ? "Shift confirmed and wage sent. Great work today."
            : "Your payment is on its way. Sit tight — this only takes a moment."}
        </p>
      </div>

      {/* Payment card */}
      <div className="mt-10">
        <PaymentCard status={payStatus} />
      </div>

      {/* Shift recap pill */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <Briefcase className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{shift.role}</p>
          <p className="text-xs text-muted-foreground truncate">{shift.employer} · {shift.date}</p>
        </div>
        <span className="font-display text-xl font-bold text-primary">
          ₹{shift.wagePerShift.toLocaleString("en-IN")}
        </span>
      </div>

      {/* Post-paid actions */}
      {payStatus === "paid" && (
        <div className="mt-8 flex flex-col gap-3 animate-rise">
          <Button variant="hero" size="lg" className="w-full" asChild>
            <Link to="/work">
              Browse more shifts <ArrowRight />
            </Link>
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" asChild>
              <Link to="/profile">View profile</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: "QuickWork",
                    text: `Just completed a shift as ${shift.role} at ${shift.employer} and got paid ₹${shift.wagePerShift} via UPI. Check out QuickWork!`,
                  });
                }
              }}
            >
              <Share2 className="size-4" />
              Share
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground pt-1">
            Transaction ref:{" "}
            <span className="font-mono font-semibold text-foreground">{shift.txnRef}</span>
          </p>
        </div>
      )}
    </div>
  );
}
