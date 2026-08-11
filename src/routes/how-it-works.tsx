import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarCheck,
  FileCheck2,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How QuickWork Works — Post, Match, Verify, Pay" },
      {
        name: "description",
        content:
          "See how QuickWork fills short-term shifts: post a job, match with verified workers, confirm the crew and pay per shift.",
      },
      { property: "og:title", content: "How QuickWork Works" },
      {
        property: "og:description",
        content:
          "Four steps from empty roster to checked-in crew, plus how the Skill Verification Program works.",
      },
    ],
  }),
  component: HowItWorks,
});

const employerSteps = [
  { icon: FileCheck2, title: "Post a shift", text: "Date, time, location, headcount, wage, facilities." },
  { icon: Users, title: "Receive applicants", text: "Verified workers nearby apply within minutes." },
  { icon: UserCheck, title: "Confirm the crew", text: "Check badges and ratings, then confirm." },
  { icon: Wallet, title: "Pay per shift", text: "Settle wages at shift end and rate the crew." },
];

const workerSteps = [
  { icon: BadgeCheck, title: "Get verified", text: "ID, address and a practical skill test." },
  { icon: CalendarCheck, title: "Browse shifts", text: "Wage, distance and timing shown upfront." },
  { icon: Star, title: "Book in one tap", text: "No bidding, no negotiation, no middlemen." },
  { icon: Wallet, title: "Get paid", text: "Wage confirmed before you accept the shift." },
];

function Column({
  label,
  steps,
}: {
  label: string;
  steps: { icon: typeof Users; title: string; text: string }[];
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-7 lg:p-9">
      <h2 className="text-2xl">{label}</h2>
      <ol className="mt-7 space-y-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="flex gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <s.icon className="size-5" />
            </span>
            <div>
              <h3 className="text-base">
                <span className="text-muted-foreground">0{i + 1} · </span>
                {s.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <h1 className="max-w-3xl text-4xl sm:text-5xl">
        Simple enough for a first shift. Reliable enough for a full season.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Same platform, two clear paths. Here is exactly what happens on each side.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Column label="For employers" steps={employerSteps} />
        <Column label="For workers" steps={workerSteps} />
      </div>

      <section className="mt-16 rounded-3xl border border-gold/30 bg-gold/10 p-8 lg:p-12">
        <VerifiedBadge label="Verified Professional Badge" />
        <h2 className="mt-5 max-w-2xl text-3xl">
          The gold badge is earned, not bought — and it shows on every profile.
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            ["Identity", "Government ID and address confirmed against a live selfie check."],
            ["Skill", "A trade-specific practical assessment scored by a QuickWork assessor."],
            ["Reliability", "Attendance, punctuality and employer ratings from every shift."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <ShieldCheck className="size-6 text-gold" />
              <h3 className="mt-4 text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button variant="hero" size="lg" asChild>
            <Link to="/hire">Post a shift</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/work">Find work</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
