import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  Clock,
  FileCheck2,
  HardHat,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShieldMotif, VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuickWork — Book Verified Daily-Wage Workers in Minutes" },
      {
        name: "description",
        content:
          "QuickWork connects catering businesses with verified daily-wage workers for instant short-term shifts. Post a job or find work today.",
      },
      { property: "og:title", content: "QuickWork — Verified Workers, Booked in Minutes" },
      {
        property: "og:description",
        content:
          "Instant short-term staffing for catering, events, warehousing and more. Verified workers, transparent wages, same-day bookings.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: FileCheck2,
    title: "Post the shift",
    text: "Date, time, wage, headcount and facilities. Takes under a minute.",
  },
  {
    icon: Users,
    title: "Get matched",
    text: "Verified workers nearby see your shift instantly and book it.",
  },
  {
    icon: BadgeCheck,
    title: "Confirm & check in",
    text: "Review verified profiles, confirm the crew, check them in on arrival.",
  },
  {
    icon: Wallet,
    title: "Pay per shift",
    text: "Wages settled at the end of the shift. Ratings both ways.",
  },
];

function Index() {
  return (
    <div>
      {/* Hero */}
      <section className="mesh-hero relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
          <span className="inline-flex animate-bounce-in items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            <Sparkles className="size-3.5" /> Now live for catering teams
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl leading-[1.05] font-bold text-white sm:text-6xl lg:text-7xl">
            Staff your shift in <span className="text-brand-gradient">10 minutes</span>, with workers
            you can trust.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/75">
            QuickWork books verified daily-wage professionals for short-term work — catering today,
            warehousing, logistics, retail, events and housekeeping next.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button variant="hero" size="xl" asChild>
              <Link to="/hire">
                Post a shift <ArrowRight />
              </Link>
            </Button>
            <Button variant="onDark" size="xl" asChild>
              <Link to="/work">Find work today</Link>
            </Button>
          </div>
          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6">
            {[
              ["12 min", "Average time to fill"],
              ["18,400+", "Verified workers"],
              ["4.9 / 5", "Employer rating"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-display text-2xl font-bold text-white sm:text-3xl">{value}</dt>
                <dd className="mt-1 text-xs text-white/60 sm:text-sm">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Two paths */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <h2 className="text-center text-3xl sm:text-4xl">Which side are you on today?</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Two doors, one platform. Pick yours and you're two clicks from done.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Link
            to="/hire"
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-primary hover:shadow-brand-lg"
          >
            <span className="grain-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <span className="relative flex size-14 items-center justify-center rounded-xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] shadow-brand">
              <Briefcase className="size-7 text-primary-foreground" />
            </span>
            <h3 className="relative mt-6 text-2xl">I'm Hiring</h3>
            <p className="relative mt-2 text-muted-foreground">
              Post a shift, review verified applicants and lock your crew before service starts.
            </p>
            <span className="relative mt-6 inline-flex items-center gap-2 font-semibold text-primary">
              Open employer dashboard <ArrowRight className="size-4" />
            </span>
          </Link>

          <Link
            to="/work"
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-gold hover:shadow-gold"
          >
            <span className="pointer-events-none absolute inset-0 bg-gold/8 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <span className="relative flex size-14 items-center justify-center rounded-xl bg-[image:linear-gradient(135deg,var(--gold),var(--brand))] shadow-gold">
              <HardHat className="size-7 text-gold-foreground" />
            </span>
            <h3 className="relative mt-6 text-2xl">I'm Looking for Work</h3>
            <p className="relative mt-2 text-muted-foreground">
              Browse paid shifts near you, see the wage upfront and book with one tap.
            </p>
            <span className="relative mt-6 inline-flex items-center gap-2 font-semibold text-primary">
              Open worker dashboard <ArrowRight className="size-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* How it works — bento */}
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl">How QuickWork works</h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Four steps from empty roster to a checked-in crew.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/how-it-works">See the full flow</Link>
          </Button>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <step.icon className="size-5" />
                </span>
                <span className="font-display text-3xl font-bold text-border">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section id="trust" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="grid items-center gap-12 rounded-3xl border border-border bg-surface p-8 lg:grid-cols-2 lg:p-14">
          <div>
            <VerifiedBadge label="Skill Verification Program" />
            <h2 className="mt-5 text-3xl sm:text-4xl">
              Every worker is checked before they ever reach your floor.
            </h2>
            <p className="mt-4 text-muted-foreground">
              ID and address checks, a practical skill assessment per trade, and shift-by-shift
              ratings. Pass the program and you carry the gold Verified Professional Badge.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                ["Government ID + address verified", ShieldCheck],
                ["Hands-on skill test per trade", BadgeCheck],
                ["Punctuality tracked every shift", Clock],
              ].map(([text, Icon]) => {
                const I = Icon as typeof ShieldCheck;
                return (
                  <li key={text as string} className="flex items-center gap-3 text-sm">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-success/15 text-success">
                      <I className="size-4" />
                    </span>
                    {text as string}
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="gold" size="lg" asChild>
                <Link to="/work">Get verified</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/how-it-works">How verification works</Link>
              </Button>
            </div>
          </div>
          <ShieldMotif className="min-h-80" />
        </div>
      </section>

      {/* Live shifts teaser */}
      <section className="mx-auto max-w-7xl px-5 pb-8 lg:px-8">
        <h2 className="text-3xl sm:text-4xl">Shifts open right now</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            ["Banquet server", "Grand Palm Banquets", "₹1,200 / shift", "Andheri East"],
            ["Kitchen helper", "Saffron Caterers", "₹950 / shift", "Powai"],
            ["Event steward", "Blue Orchid Events", "₹1,400 / shift", "Bandra Kurla"],
          ].map(([role, employer, wage, area]) => (
            <div
              key={role}
              className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
            >
              <h3 className="text-lg">{role}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{employer}</p>
              <p className="mt-4 font-display text-xl font-bold text-primary">{wage}</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {area}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarCheck className="size-4" /> Tomorrow · 4:00 PM
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Button variant="hero" size="lg" asChild>
            <Link to="/work">
              Browse all shifts <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
