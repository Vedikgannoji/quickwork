import { Clock, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRapidJobTimeRemaining, getRapidJobTimeRemaining } from "@/lib/job-types";

interface RapidJobBadgeProps {
  rapidJobExpiresAt?: string;
  variant?: "default" | "compact" | "large";
  showIcon?: boolean;
  className?: string;
}

/**
 * Badge component for rapid/urgent jobs with countdown timer.
 * Shows pulsing animation and time remaining until expiration.
 */
export function RapidJobBadge({
  rapidJobExpiresAt,
  variant = "default",
  showIcon = true,
  className = "",
}: RapidJobBadgeProps) {
  const [timeRemaining, setTimeRemaining] = useState(() =>
    formatRapidJobTimeRemaining(rapidJobExpiresAt)
  );

  // Update countdown every minute
  useEffect(() => {
    if (!rapidJobExpiresAt) return;

    const updateTimer = () => {
      setTimeRemaining(formatRapidJobTimeRemaining(rapidJobExpiresAt));
    };

    // Update immediately
    updateTimer();

    // Then update every 30 seconds for more accuracy
    const interval = setInterval(updateTimer, 30000);

    return () => clearInterval(interval);
  }, [rapidJobExpiresAt]);

  const isExpired = timeRemaining === "Expired";
  const minutesLeft = getRapidJobTimeRemaining(rapidJobExpiresAt);
  const isUrgent = minutesLeft > 0 && minutesLeft <= 30; // Last 30 minutes

  if (isExpired) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg border border-muted bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground ${className}`}
      >
        {showIcon && <Clock className="size-3" />}
        Expired
      </span>
    );
  }

  // Variant styles
  const variantStyles = {
    compact: "px-2 py-0.5 text-[10px]",
    default: "px-2.5 py-1 text-xs",
    large: "px-3.5 py-2 text-sm",
  };

  const iconSize = {
    compact: "size-2.5",
    default: "size-3",
    large: "size-4",
  };

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      {/* Pulsing background (more intense when urgent) */}
      <span
        className={`absolute inset-0 rounded-lg ${
          isUrgent
            ? "animate-ping bg-destructive/40"
            : "animate-pulse bg-orange-500/30"
        }`}
      />

      {/* Badge content */}
      <span
        className={`relative flex items-center gap-1.5 rounded-lg border font-semibold ${
          isUrgent
            ? "border-destructive/50 bg-destructive/15 text-destructive"
            : "border-orange-500/50 bg-orange-500/15 text-orange-600 dark:text-orange-400"
        } ${variantStyles[variant]}`}
      >
        {showIcon && <Zap className={`${iconSize[variant]} fill-current`} />}
        <span className="uppercase tracking-wide">Urgent</span>
        <span className="opacity-75">·</span>
        <Clock className={iconSize[variant]} />
        <span>{timeRemaining}</span>
      </span>
    </span>
  );
}

/**
 * Simplified rapid job indicator (just shows URGENT without countdown).
 * Useful for compact displays or when time precision isn't critical.
 */
export function RapidJobIndicator({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 rounded-lg border border-orange-500/50 bg-orange-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 ${className}`}
    >
      <span className="absolute inset-0 animate-pulse rounded-lg bg-orange-500/30" />
      <Zap className="relative size-3 fill-current" />
      <span className="relative">Urgent</span>
    </span>
  );
}

/**
 * Surge pricing indicator for rapid jobs.
 * Shows the premium/surge pricing applied to rapid jobs.
 */
export function SurgePricingBadge({
  surgePercentage = 20,
  className = "",
}: {
  surgePercentage?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success ${className}`}
    >
      <Zap className="size-3 fill-current" />
      +{surgePercentage}% surge
    </span>
  );
}
