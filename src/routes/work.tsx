import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  Clock,
  Filter,
  MapPin,
  SearchX,
  Star,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifiedBadge } from "@/components/verified-badge";

export const Route = createFileRoute("/work")({
  head: () => ({
    meta: [
      { title: "Browse Shifts — QuickWork Worker Dashboard" },
      {
        name: "description",
        content:
          "Browse and filter verified catering and event shifts near you on QuickWork. Wage shown upfront, book any shift with one tap.",
      },
      { property: "og:title", content: "QuickWork — Browse Shifts Near You" },
      {
        property: "og:description",
        content: "Filter by location, category, date and wage. Book verified shifts in one tap.",
      },
    ],
  }),
  component: WorkPage,
});

type Job = {
  id: string;
  role: string;
  category: string;
  employer: string;
  rating: string;
  wage: number;
  wageDisplay: string;
  dateBucket: "today" | "this-week";
  dateLabel: string;
  area: string;
  distance: string;
  perks: string[];
};

const listings: Job[] = [
  {
    id: "1",
    role: "Banquet server",
    category: "Banquet",
    employer: "Grand Palm Banquets",
    rating: "4.9",
    wage: 1200,
    wageDisplay: "₹1,200",
    dateBucket: "today",
    dateLabel: "Tue, 18 Aug · 5:00 PM – 11:00 PM",
    area: "Andheri East",
    distance: "3.2 km",
    perks: ["Meals provided", "Uniform"],
  },
  {
    id: "2",
    role: "Kitchen helper",
    category: "Kitchen",
    employer: "Saffron Caterers",
    rating: "4.8",
    wage: 950,
    wageDisplay: "₹950",
    dateBucket: "this-week",
    dateLabel: "Wed, 19 Aug · 9:00 AM – 4:00 PM",
    area: "Powai",
    distance: "5.7 km",
    perks: ["Meals provided", "Transport"],
  },
  {
    id: "3",
    role: "Event steward",
    category: "Steward",
    employer: "Blue Orchid Events",
    rating: "4.7",
    wage: 1400,
    wageDisplay: "₹1,400",
    dateBucket: "this-week",
    dateLabel: "Wed, 19 Aug · 3:00 PM – 10:00 PM",
    area: "Bandra Kurla",
    distance: "8.1 km",
    perks: ["Transport", "Uniform"],
  },
  {
    id: "4",
    role: "Dishwashing crew",
    category: "Kitchen",
    employer: "Coastal Kitchen Co.",
    rating: "4.5",
    wage: 900,
    wageDisplay: "₹900",
    dateBucket: "this-week",
    dateLabel: "Thu, 20 Aug · 6:00 PM – 12:00 AM",
    area: "Lower Parel",
    distance: "6.4 km",
    perks: ["Meals provided"],
  },
  {
    id: "5",
    role: "Banquet server",
    category: "Banquet",
    employer: "Royal Plaza",
    rating: "4.6",
    wage: 1100,
    wageDisplay: "₹1,100",
    dateBucket: "today",
    dateLabel: "Tue, 18 Aug · 7:00 PM – 11:00 PM",
    area: "Andheri West",
    distance: "4.0 km",
    perks: ["Meals provided", "Transport"],
  },
  {
    id: "6",
    role: "Bartender",
    category: "Bartender",
    employer: "High Spirits",
    rating: "4.8",
    wage: 1300,
    wageDisplay: "₹1,300",
    dateBucket: "this-week",
    dateLabel: "Fri, 21 Aug · 5:00 PM – 1:00 AM",
    area: "Bandra West",
    distance: "7.0 km",
    perks: ["Tips", "Uniform"],
  },
];

const locationOptions = [
  "All",
  "Andheri East",
  "Powai",
  "Bandra Kurla",
  "Lower Parel",
  "Andheri West",
  "Bandra West",
];
const categoryOptions = ["All", "Banquet", "Kitchen", "Steward", "Bartender"];
const dateOptions = ["Any", "Today", "This week"];
const wageOptions = ["Any", "₹900+", "₹1,000+", "₹1,200+"];

function WorkPage() {
  const [loading, setLoading] = useState(true);
  const [booked, setBooked] = useState<string[]>([]);
  const [location, setLocation] = useState("All");
  const [category, setCategory] = useState("All");
  const [date, setDate] = useState("Any");
  const [wage, setWage] = useState("Any");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return listings.filter((job) => {
      if (location !== "All" && job.area !== location) return false;
      if (category !== "All" && job.category !== category) return false;
      if (date === "Today" && job.dateBucket !== "today") return false;
      if (wage !== "Any") {
        const min = Number(wage.replace(/[₹,+]/g, ""));
        if (job.wage < min) return false;
      }
      return true;
    });
  }, [location, category, date, wage]);

  const clearFilters = () => {
    setLocation("All");
    setCategory("All");
    setDate("Any");
    setWage("Any");
  };

  const filtersActive =
    location !== "All" || category !== "All" || date !== "Any" || wage !== "Any";
  const displayedCount = loading ? listings.length : filtered.length;

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-sm font-semibold text-primary">Worker dashboard</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Shifts near you</h1>
          <p className="mt-3 text-muted-foreground">
            {displayedCount} open shifts in catering today. Wage shown before you book.
          </p>

          {/* Filter chips */}
          <section className="mt-9 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Filter shifts</h2>
            </div>
            <div className="mt-4 space-y-4">
              <FilterRow
                label="Location"
                options={locationOptions}
                value={location}
                onChange={setLocation}
                disabled={loading}
              />
              <FilterRow
                label="Category"
                options={categoryOptions}
                value={category}
                onChange={setCategory}
                disabled={loading}
              />
              <FilterRow
                label="Date"
                options={dateOptions}
                value={date}
                onChange={setDate}
                disabled={loading}
              />
              <FilterRow
                label="Wage"
                options={wageOptions}
                value={wage}
                onChange={setWage}
                disabled={loading}
              />
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Loading shifts..."
                  : `${filtered.length} shift${filtered.length === 1 ? "" : "s"} match`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                disabled={!filtersActive || loading}
                className={!filtersActive ? "invisible" : ""}
              >
                <X className="size-4" /> Clear all
              </Button>
            </div>
          </section>

          {/* Job cards */}
          {loading ? (
            <div className="mt-9 grid gap-5 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-6">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-3 h-3 w-1/2" />
                  <Skeleton className="mt-6 h-6 w-24" />
                  <Skeleton className="mt-4 h-3 w-3/4" />
                  <Skeleton className="mt-6 h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onClear={clearFilters} />
          ) : (
            <div className="mt-9 grid gap-5 md:grid-cols-2">
              {filtered.map((job) => {
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
                      <Wallet className="size-5" /> {job.wageDisplay}
                    </p>

                    <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="size-4 shrink-0" /> {job.dateLabel}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" /> {job.area} · {job.distance}
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
                        "Book Now"
                      )}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
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

          <Button variant="outline" size="lg" className="mt-6 w-full" asChild>
            <Link to="/profile">Edit profile</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:scale-[1.03] disabled:opacity-50 disabled:hover:scale-100 ${
              active
                ? "border-primary bg-primary/12 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-9 flex flex-col items-center rounded-3xl border border-border bg-surface p-12 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-gold/25 blur-xl" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-gold/35 bg-gold/10 text-gold">
          <SearchX className="size-8" />
        </div>
      </div>
      <h3 className="mt-6 text-2xl">No shifts match your filters</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Try adjusting your location, category, date or wage range to find more opportunities.
      </p>
      <Button variant="hero" size="lg" className="mt-8" onClick={onClear}>
        <X className="size-4" /> Clear all filters
      </Button>
    </div>
  );
}
