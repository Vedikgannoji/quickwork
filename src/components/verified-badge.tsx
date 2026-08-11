import { BadgeCheck, ShieldCheck, Star } from "lucide-react";

export function VerifiedBadge({
  label = "Verified Professional",
  tone = "gold",
}: {
  label?: string;
  tone?: "gold" | "success";
}) {
  const toneClasses =
    tone === "gold"
      ? "border-gold/45 bg-gold/15 text-gold-foreground dark:text-gold"
      : "border-success/45 bg-success/15 text-success";
  return (
    <span
      className={`inline-flex animate-bounce-in items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${toneClasses}`}
    >
      <BadgeCheck className="size-3.5" />
      {label}
    </span>
  );
}

export function ShieldMotif({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div className="absolute size-56 rounded-full bg-gold/20 blur-3xl" />
      <div className="absolute size-72 rounded-full border border-gold/25" />
      <div className="absolute size-56 rounded-full border border-gold/35" />
      <div className="relative flex size-40 animate-bounce-in items-center justify-center rounded-3xl bg-[image:linear-gradient(140deg,var(--gold),var(--brand))] shadow-gold">
        <ShieldCheck className="size-20 text-gold-foreground" />
      </div>
      <span className="absolute -right-2 bottom-4 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold shadow-lift">
        <Star className="size-3.5 fill-gold text-gold" /> 4.9 avg rating
      </span>
    </div>
  );
}
