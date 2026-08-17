/**
 * SeatGrid — cinema-style seat selection UI for QuickWork slot booking.
 *
 * Features:
 * - Slots grouped by category, each category gets a distinct color palette
 * - available: outline only + subtle pulse animation
 * - selected (locked): filled + glow ring + countdown timer
 * - booked: muted fill + checkmark, not clickable
 * - Confirm booking animates the slot with fill + bounce + success toast
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Lock, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  useBookingStore,
  useBookingTransaction,
  seedMockData,
  LOCK_DURATION_MS,
  type Slot,
  type Category,
  type Job,
} from "@/lib/booking-model";

// ─── Category colour palettes ─────────────────────────────────────────────────
// Each palette: border, bg-available, bg-selected, bg-booked, glow, label-text
const CATEGORY_PALETTES = [
  {
    // Orange — brand primary
    label: "text-brand",
    available:
      "border-brand/50 hover:border-brand hover:bg-brand/10 hover:shadow-[0_0_12px_0] hover:shadow-brand/20",
    selected:
      "border-brand bg-brand/20 shadow-[0_0_0_3px] shadow-brand/40 ring-2 ring-brand/60",
    booked: "border-brand/20 bg-brand/8",
    confirming: "border-brand bg-brand shadow-[0_0_0_4px] shadow-brand/50",
    dot: "bg-brand",
    dotMuted: "bg-brand/30",
  },
  {
    // Blue
    label: "text-blue-500",
    available:
      "border-blue-400/50 hover:border-blue-400 hover:bg-blue-400/10 hover:shadow-[0_0_12px_0] hover:shadow-blue-400/20",
    selected:
      "border-blue-500 bg-blue-500/20 shadow-[0_0_0_3px] shadow-blue-500/40 ring-2 ring-blue-500/60",
    booked: "border-blue-400/20 bg-blue-400/8",
    confirming:
      "border-blue-500 bg-blue-500 shadow-[0_0_0_4px] shadow-blue-500/50",
    dot: "bg-blue-500",
    dotMuted: "bg-blue-400/30",
  },
  {
    // Emerald / success
    label: "text-success",
    available:
      "border-success/50 hover:border-success hover:bg-success/10 hover:shadow-[0_0_12px_0] hover:shadow-success/20",
    selected:
      "border-success bg-success/20 shadow-[0_0_0_3px] shadow-success/40 ring-2 ring-success/60",
    booked: "border-success/20 bg-success/8",
    confirming:
      "border-success bg-success shadow-[0_0_0_4px] shadow-success/50",
    dot: "bg-success",
    dotMuted: "bg-success/30",
  },
  {
    // Gold
    label: "text-gold",
    available:
      "border-gold/50 hover:border-gold hover:bg-gold/10 hover:shadow-[0_0_12px_0] hover:shadow-gold/20",
    selected:
      "border-gold bg-gold/20 shadow-[0_0_0_3px] shadow-gold/40 ring-2 ring-gold/60",
    booked: "border-gold/20 bg-gold/8",
    confirming: "border-gold bg-gold shadow-[0_0_0_4px] shadow-gold/50",
    dot: "bg-gold",
    dotMuted: "bg-gold/30",
  },
  {
    // Violet
    label: "text-violet-500",
    available:
      "border-violet-400/50 hover:border-violet-400 hover:bg-violet-400/10 hover:shadow-[0_0_12px_0] hover:shadow-violet-400/20",
    selected:
      "border-violet-500 bg-violet-500/20 shadow-[0_0_0_3px] shadow-violet-500/40 ring-2 ring-violet-500/60",
    booked: "border-violet-400/20 bg-violet-400/8",
    confirming:
      "border-violet-500 bg-violet-500 shadow-[0_0_0_4px] shadow-violet-500/50",
    dot: "bg-violet-500",
    dotMuted: "bg-violet-400/30",
  },
];

function getPalette(index: number) {
  return CATEGORY_PALETTES[index % CATEGORY_PALETTES.length];
}

// ─── Countdown timer hook ─────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

// ─── Individual Seat ──────────────────────────────────────────────────────────

interface SeatProps {
  slot: Slot;
  paletteIndex: number;
  isSelected: boolean;
  isConfirming: boolean;
  onSelect: (slotId: string) => void;
}

function Seat({ slot, paletteIndex, isSelected, isConfirming, onSelect }: SeatProps) {
  const palette = getPalette(paletteIndex);
  const remaining = useCountdown(isSelected ? slot.expiresAt : null);

  const isBooked = slot.status === "booked";
  const isLocked = slot.status === "locked" && !isSelected;
  const isExpired = slot.status === "expired";
  const isAvailable = slot.status === "available";

  const shortId = slot.id.slice(-3).toUpperCase();

  return (
    <button
      type="button"
      disabled={isBooked || isLocked || isExpired}
      onClick={() => !isBooked && !isLocked && !isExpired && onSelect(slot.id)}
      aria-label={`Slot ${shortId} — ${isBooked ? "booked" : isSelected ? "selected" : isLocked ? "locked" : "available"}`}
      className={cn(
        // Base
        "relative flex h-14 w-14 flex-col items-center justify-center rounded-xl border-2 transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // Available — outline only + subtle pulse
        isAvailable && !isSelected && [palette.available, "animate-[seat-pulse_3s_ease-in-out_infinite]"],
        // Selected — filled + glow ring
        isSelected && !isConfirming && palette.selected,
        // Confirming — bounce + fill
        isConfirming && [palette.confirming, "animate-[bounce-in_0.55s_cubic-bezier(0.22,1.2,0.36,1)_both]"],
        // Booked — muted, not clickable
        isBooked && "cursor-not-allowed border-border bg-muted/60",
        // Locked by someone else
        isLocked && "cursor-not-allowed border-border/30 bg-muted/30 opacity-50",
        // Expired
        isExpired && "cursor-not-allowed border-border/20 bg-muted/20 opacity-30",
      )}
    >
      {/* Booked state */}
      {isBooked && (
        <>
          <Check className="size-5 text-muted-foreground/60" strokeWidth={2.5} />
          <span className="mt-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground/50">
            {shortId}
          </span>
        </>
      )}

      {/* Locked by someone else */}
      {isLocked && (
        <>
          <Lock className="size-4 text-muted-foreground/50" />
          <span className="mt-0.5 text-[9px] font-semibold tracking-wide text-muted-foreground/40">
            {shortId}
          </span>
        </>
      )}

      {/* Expired */}
      {isExpired && (
        <>
          <X className="size-4 text-muted-foreground/40" />
          <span className="mt-0.5 text-[9px] text-muted-foreground/30">{shortId}</span>
        </>
      )}

      {/* Available or Selected */}
      {(isAvailable || isSelected) && !isBooked && !isLocked && !isExpired && (
        <>
          <span
            className={cn(
              "text-[11px] font-bold tracking-wider",
              isSelected ? "text-foreground" : "text-muted-foreground",
              isConfirming && "text-white",
            )}
          >
            {shortId}
          </span>
          {/* Countdown on selected */}
          {isSelected && !isConfirming && remaining > 0 && (
            <span className="mt-0.5 flex items-center gap-0.5 text-[8px] font-semibold tabular-nums text-foreground/70">
              <Timer className="size-2.5" />
              {Math.ceil(remaining / 1000)}s
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: Category;
  paletteIndex: number;
  selectedSlots: Set<string>;
  confirmingSlots: Set<string>;
  onSelect: (slotId: string) => void;
}

function CategorySection({
  category,
  paletteIndex,
  selectedSlots,
  confirmingSlots,
  onSelect,
}: CategorySectionProps) {
  const palette = getPalette(paletteIndex);
  const available = category.slots.filter((s) => s.status === "available").length;
  const booked = category.slots.filter((s) => s.status === "booked").length;

  return (
    <div className="space-y-3">
      {/* Category header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", palette.dot)} />
          <h4 className={cn("font-display text-sm font-semibold", palette.label)}>
            {category.name}
          </h4>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            ₹{category.wage}/shift
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", palette.dot)} />
            {available} open
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            {booked} taken
          </span>
        </div>
      </div>

      {/* Seat grid */}
      <div className="flex flex-wrap gap-2.5">
        {category.slots.map((slot) => (
          <Seat
            key={slot.id}
            slot={slot}
            paletteIndex={paletteIndex}
            isSelected={selectedSlots.has(slot.id)}
            isConfirming={confirmingSlots.has(slot.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-success/50 bg-transparent" />
        Available
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-brand bg-brand/20 ring-2 ring-brand/40" />
        Selected
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-border bg-muted/60">
          <Check className="size-3 text-muted-foreground/50" />
        </span>
        Booked
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-border/30 bg-muted/30 opacity-50">
          <Lock className="size-2.5 text-muted-foreground/50" />
        </span>
        Held by other
      </span>
    </div>
  );
}

// ─── Countdown Badge ─────────────────────────────────────────────────────────

function CountdownBadge({ expiresAt }: { expiresAt: string | null }) {
  const remaining = useCountdown(expiresAt);
  if (!expiresAt || remaining <= 0) return null;

  const seconds = Math.ceil(remaining / 1000);
  const pct = (remaining / LOCK_DURATION_MS) * 100;
  const urgent = seconds <= 30;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums",
        urgent
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-gold/40 bg-gold/10 text-gold-foreground",
      )}
    >
      <Clock className={cn("size-3.5", urgent && "animate-pulse")} />
      <span>Held for {seconds}s</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-current/20">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            urgent ? "bg-destructive" : "bg-gold",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main SeatGrid component ─────────────────────────────────────────────────

interface SeatGridProps {
  job: Job;
}

export function SeatGrid({ job }: SeatGridProps) {
  const { user, isLoggedIn, openLoginModal } = useAuth();
  const { lockSlot, bookSlot, releaseLock } = useBookingStore();

  // slotId → expiresAt for the current user's selected slots
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  // slots currently playing the "confirm" bounce animation
  const [confirmingSlots, setConfirmingSlots] = useState<Set<string>>(new Set());

  const selectedSlotIds = new Set(Object.keys(selectedMap));

  // Use a ref to hold the latest selectedMap for cleanup in effects
  const selectedMapRef = useRef(selectedMap);
  selectedMapRef.current = selectedMap;

  // Auto-release locks when they expire
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const expired = Object.entries(selectedMapRef.current).filter(
        ([, exp]) => new Date(exp).getTime() <= now,
      );
      if (expired.length > 0) {
        expired.forEach(([slotId]) => {
          releaseLock(slotId);
          toast.error("Hold expired — slot released", { id: `expire-${slotId}` });
        });
        setSelectedMap((prev) => {
          const next = { ...prev };
          expired.forEach(([slotId]) => delete next[slotId]);
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [releaseLock]);

  // Release all locks on unmount
  useEffect(() => {
    return () => {
      Object.keys(selectedMapRef.current).forEach((slotId) => {
        releaseLock(slotId);
      });
    };
  }, [releaseLock]);

  const handleSelect = useCallback(
    (slotId: string) => {
      if (!isLoggedIn || !user) {
        openLoginModal({ type: "book-shift", payload: { jobId: job.id, slotId } });
        return;
      }

      // Deselect if already selected
      if (selectedMap[slotId]) {
        releaseLock(slotId);
        setSelectedMap((prev) => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
        return;
      }

      // Lock the slot
      const result = lockSlot(slotId, user.id);
      if (result.success && result.slot?.expiresAt) {
        setSelectedMap((prev) => ({
          ...prev,
          [slotId]: result.slot!.expiresAt!,
        }));
      } else {
        toast.error(
          result.reason === "already_booked"
            ? "This slot was just booked by someone else."
            : "Slot is temporarily unavailable.",
        );
      }
    },
    [isLoggedIn, user, job.id, selectedMap, lockSlot, releaseLock, openLoginModal],
  );

  const handleConfirm = useCallback(async () => {
    if (!user) return;
    const ids = Object.keys(selectedMap);
    if (ids.length === 0) return;

    const results = ids.map((slotId) => ({
      slotId,
      result: bookSlot(slotId, user.id),
    }));

    const succeeded = results.filter((r) => r.result.success);
    const failed = results.filter((r) => !r.result.success);

    if (succeeded.length > 0) {
      // Play bounce animation on confirmed slots
      const successIds = new Set(succeeded.map((r) => r.slotId));
      setConfirmingSlots(successIds);
      setTimeout(() => setConfirmingSlots(new Set()), 700);

      setSelectedMap((prev) => {
        const next = { ...prev };
        succeeded.forEach((r) => delete next[r.slotId]);
        return next;
      });

      toast.success(
        `${succeeded.length} slot${succeeded.length > 1 ? "s" : ""} confirmed!`,
        {
          description: `You're all set for ${job.title}.`,
          duration: 4000,
        },
      );
    }

    if (failed.length > 0) {
      failed.forEach(({ slotId }) => releaseLock(slotId));
      setSelectedMap((prev) => {
        const next = { ...prev };
        failed.forEach(({ slotId }) => delete next[slotId]);
        return next;
      });
      toast.error(`${failed.length} slot${failed.length > 1 ? "s" : ""} could not be confirmed.`);
    }
  }, [user, selectedMap, bookSlot, releaseLock, job.title]);

  const handleClearAll = useCallback(() => {
    Object.keys(selectedMap).forEach((slotId) => releaseLock(slotId));
    setSelectedMap({});
  }, [selectedMap, releaseLock]);

  // Earliest expiry among selected slots (for the timer badge)
  const earliestExpiry = Object.values(selectedMap).sort()[0] ?? null;
  const selectedCount = selectedSlotIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-xl font-bold">{job.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.location} · {new Date(job.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {job.startTime}–{job.endTime}
          </p>
        </div>
        {/* Countdown badge for selected slots */}
        {earliestExpiry && <CountdownBadge expiresAt={earliestExpiry} />}
      </div>

      {/* Category seat grids */}
      <div className="space-y-6">
        {job.categories.map((category, i) => (
          <CategorySection
            key={category.id}
            category={category}
            paletteIndex={i}
            selectedSlots={selectedSlotIds}
            confirmingSlots={confirmingSlots}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Legend */}
      <Legend />

      {/* Confirm bar */}
      {selectedCount > 0 && (
        <div className="animate-[rise_0.3s_cubic-bezier(0.22,1,0.36,1)_both] flex items-center justify-between rounded-2xl border border-brand/30 bg-brand/5 px-5 py-4">
          <div className="space-y-0.5">
            <p className="font-display text-sm font-semibold">
              {selectedCount} slot{selectedCount > 1 ? "s" : ""} selected
            </p>
            {earliestExpiry && (
              <p className="text-xs text-muted-foreground">
                Hold expires in {Math.ceil((new Date(earliestExpiry).getTime() - Date.now()) / 1000)}s
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white shadow-brand transition-all hover:shadow-brand-lg active:scale-95"
            >
              Confirm Booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Full-page wrapper with job selection ─────────────────────────────────────

export function SeatGridDemo() {
  const { jobs, expireLocks } = useBookingStore();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Seed data on first load
  useEffect(() => {
    if (Object.keys(jobs).length === 0) {
      seedMockData();
    }

    const id = setInterval(() => {
      expireLocks();
    }, 5000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const jobList = Object.values(jobs);
  const activeJob = activeJobId ? jobs[activeJobId] : (jobList[0] ?? null);

  if (jobList.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border">
        <p className="text-muted-foreground">Loading jobs…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Job tabs */}
      {jobList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {jobList.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setActiveJobId(job.id)}
              className={cn(
                "shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                activeJob?.id === job.id
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground",
              )}
            >
              {job.title}
            </button>
          ))}
        </div>
      )}

      {/* Active job seat grid */}
      {activeJob && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <SeatGrid job={activeJob} />
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <h4 className="mb-3 font-display text-sm font-semibold text-foreground/70">How it works</h4>
        <ol className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-bold text-brand">1.</span>
            Click any available seat to hold it (2‑minute timer starts)
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand">2.</span>
            Select as many slots as you need across any category
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand">3.</span>
            Hit <strong>Confirm Booking</strong> before your hold expires
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand">4.</span>
            Booked seats show a checkmark and can't be selected again
          </li>
        </ol>
      </div>
    </div>
  );
}
