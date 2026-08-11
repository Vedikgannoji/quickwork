import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, Clock, MapPin, Star, Utensils, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/work")({
  head: () => ({
    meta: [
      { title: "Find Daily Shifts — QuickWork Worker Dashboard" },
      {
        name: "description",
        content:
          "Browse verified catering and event shifts near you on QuickWork. Wage shown upfront, book any shift with one tap.",
      },
      { property: "og:title", content: "QuickWork — Find Work Today" },
      {
        property: "og:description",
        content: "Paid shifts near you with the wage shown upfront. One tap to book.",
      },
    ],
  }),
  component: WorkPage,
});

const listings = [
  {
    id: "1",
    role: "Banquet server",
    employer: "Grand Palm Banquets",
    rating: "4.9",
    wage: "₹1,200",
    date: "Fri, 14 Aug · 5:00 PM – 11:00 PM",
    area: "Andheri East · 3.2 km",
    perks: ["Meals provided", "Uniform"],
  },
  {
    id: "2",
    role: "Kitchen helper",
    employer: "Saffron Caterers",
    rating: "4.8",
    wage: "₹950",
    date: "Sat, 15 Aug · 9:00 AM – 4:00 PM",
    area: "Powai · 5.7 km",
    perks: ["Meals provided", "Transport"],
  },
  {
    id: "3",
    role: "Event steward",
    employer: "Blue Orchid Events",
    rating: "4.7",
    wage: "₹1,400",
    date: "Sun, 16 Aug · 3:00 PM – 10:00 PM",
    area: "Bandra Kurla · 8.1 km",
    perks: ["Transport", "Uniform"],
  },
  {
    id: "4",
    role: "Dishwashing crew",
    employer: "Coastal Kitchen Co.",
    rating: "4.5",
    wage: "₹900",
    date: "Mon, 17 Aug · 6:00 PM – 12:00 AM",
    area: "Lower Parel · 6.4 km",
    perks: ["Meals provided"],
  },
];

function WorkPage() {
  const [loading, setLoading] = useState(true);
  const [booked, setBooked] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-sm font-semibold text-primary">Worker dashboard</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Shifts near you</h1>
          <p className="mt-3 text-muted-foreground">
            {listings.length} open shifts in catering today. Wage shown before you book.
          </p>

          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {loading
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-6">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-3 h-3 w-1/2" />
                    <Skeleton className="mt-6 h-6 w-24" />
                    <Skeleton className="mt-4 h-3 w-3/4" />
                    <Skeleton className="mt-6 h-11 w-full rounded-xl" />
                  </div>
                ))
              : listings.map((job) => {
                  const isBooked = booked.includes(job.id);
                  return (
                    <article
                      key={job.id}
                      className="flex flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg">{job.role}</h2>
                        <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-sm font-semibold">
                          <Star className="size-3.5 fill-gold text-gold" />
                          {job.rating}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{job.employer}</p>

                      <p className="mt-5 flex items-center gap-2 font-display text-2xl font-bold text-primary">
                        <Wallet className="size-5" /> {job.wage}
                      </p>

                      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4 shrink-0" /> {job.date}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4 shrink-0" /> {job.area}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {job.perks.map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            <Utensils className="size-3" /> {p}
                          </span>
                        ))}
                      </div>

                      <Button
                        variant={isBooked ? "secondary" : "hero"}
                        size="lg"
                        className="mt-6 w-full"
                        disabled={isBooked}
                        onClick={() => {
                          setBooked((b) => [...b, job.id]);
                          toast.success(`Booked: ${job.role} · ${job.employer}`);
                        }}
                      >
                        {isBooked ? (
                          <>
                            <Check /> Booked
                          </>
                        ) : (
                          "Book this job"
                        )}
                      </Button>
                    </article>
                  );
                })}
          </div>
        </div>

        {/* Profile */}
        <aside className="h-fit rounded-3xl border border-border bg-surface p-7 lg:sticky lg:top-24">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-2xl font-bold text-primary-foreground shadow-brand">
            RM
          </div>
          <h2 className="mt-5 text-xl">Rahul Mehta</h2>
          <p className="mt-1 text-sm text-muted-foreground">Banquet server · 3 years</p>
          <div className="mt-4">
            <VerifiedBadge />
          </div>

          <dl className="mt-7 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Shifts completed</dt>
              <dd className="font-semibold">128</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Punctuality</dt>
              <dd className="font-semibold text-success">98%</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="flex items-center gap-1.5 font-semibold">
                <Star className="size-4 fill-gold text-gold" /> 4.9
              </dd>
            </div>
          </dl>

          <div className="mt-7 rounded-2xl border border-gold/35 bg-gold/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-gold" /> Renew badge in 42 days
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Keep punctuality above 90% to auto-renew.
            </p>
          </div>

          <Button variant="outline" size="lg" className="mt-6 w-full">
            Edit profile
          </Button>
        </aside>
      </div>
    </div>
  );
}
