import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] shadow-brand">
              <Zap className="size-5 text-primary-foreground" />
            </span>
            <span className="font-display text-xl font-bold">QuickWork</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Verified daily-wage workers, booked in minutes. Built for catering — expanding to
            warehousing, logistics, retail, events and housekeeping.
          </p>
          <div className="mt-5 flex gap-2">
            {[Instagram, Facebook, Linkedin].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="Social link"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:scale-[1.03] hover:border-primary hover:text-primary"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">
            Platform
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link to="/hire" className="transition-colors hover:text-primary">
                Post a job
              </Link>
            </li>
            <li>
              <Link to="/work" className="transition-colors hover:text-primary">
                Find work
              </Link>
            </li>
            <li>
              <Link to="/how-it-works" className="transition-colors hover:text-primary">
                How it works
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">
            Company
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a href="#trust" className="transition-colors hover:text-primary">
                Verification program
              </a>
            </li>
            <li>
              <a href="#" className="transition-colors hover:text-primary">
                Support
              </a>
            </li>
            <li>
              <a href="#" className="transition-colors hover:text-primary">
                Privacy
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground lg:px-8">
        © {new Date().getFullYear()} QuickWork. Work that starts today.
      </div>
    </footer>
  );
}
