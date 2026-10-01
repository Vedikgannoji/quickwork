/**
 * Work Position Selection Screen
 *
 * Route: /work/$jobId/positions
 *
 * Cinema-seat-selection inspired UX adapted for work positions.
 * Workers browse categories, pick one position, then proceed to confirm.
 *
 * Data flow:
 *  1. fetchJobPositions() → loads categories + positions from Supabase
 *  2. subscribeToJobPositions() → Supabase Realtime updates position states
 *  3. handleSelect(positionId) → calls reserve_position RPC (AVAILABLE → PENDING)
 *  4. handleDeselect() → calls release_position RPC (PENDING → AVAILABLE)
 *  5. "Continue" → navigates to /checkout with reservationId
 *
 * Animation approach:
 *  - Pure CSS transitions + keyframes (already defined in styles.css)
 *  - data-state attributes drive selected/deselected transitions
 *  - No Framer Motion / extra bundle cost
 *  - Respects prefers-reduced-motion via existing tw-animate-css import
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RapidJobBadge } from "@/components/rapid-job-badge";
import { useAuth } from "@/lib/auth-context";
import {
  type CategoryPositionStats,
  type JobPositionStats,
  type PositionStatus,
  getJobPositionStats,
  subscribeToJobPositions,
  releaseExpiredLocks,
} from "@/lib/position-service";
import { supabase } from "@/lib/supabase";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/work/$jobId/positions")({
  head: () => ({
    meta: [
      { title: "Select Position — QuickWork" },
      {
        name: "description",
        content:
          "Pick your work position for this shift. One position per worker.",
      },
    ],
  }),
  component: PositionSelectionPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobMeta {
  jobTitle: string;
  venueName: string;
  area: string;
  city: string;
  jobDate: string;
  startTime: string;
  endTime: string;
  isRapidJob: boolean;
  rapidJobExpiresAt: string | null;
  status: string;
}

interface Selection {
  categoryId: string;
  categoryName: string;
  positionId: string;
  positionNumber: number;
  wage: number;
  lockExpiresAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY_ISO = new Date().toISOString().split("T")[0]!;
const TOMORROW_ISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
})();

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h! >= 12 ? "PM" : "AM";
  const dh = h! > 12 ? h! - 12 : h! === 0 ? 12 : h!;
  return `${dh}:${String(m!).padStart(2, "0")} ${suffix}`;
}

function formatDateLabel(isoDate: string, start: string, end: string): string {
  let day: string;
  if (isoDate === TODAY_ISO) day = "Today";
  else if (isoDate === TOMORROW_ISO) day = "Tomorrow";
  else {
    const d = new Date(isoDate + "T00:00");
    day = d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  return `${day} · ${fmt12(start)} – ${fmt12(end)}`;
}

function posLabel(n: number, total: number): string {
  const digits = total >= 100 ? 3 : 2;
  return String(n).padStart(digits, "0");
}

// ─── Mock data (graceful fallback) ────────────────────────────────────────────

function makeMockStats(jobId: string): JobPositionStats {
  const cats: CategoryPositionStats[] = [
    {
      category_id: "cat-1",
      category_name: "Food Serving",
      required_workers: 5,
      total: 5,
      available: 3,
      pending: 0,
      pending_live: 0,
      pending_expired: 0,
      booked: 2,
      cancelled: 0,
      active: 5,
      positions: [
        { id: "p1", position_number: 1, status: "BOOKED",    locked_until: null },
        { id: "p2", position_number: 2, status: "BOOKED",    locked_until: null },
        { id: "p3", position_number: 3, status: "AVAILABLE", locked_until: null },
        { id: "p4", position_number: 4, status: "AVAILABLE", locked_until: null },
        { id: "p5", position_number: 5, status: "AVAILABLE", locked_until: null },
      ],
    },
    {
      category_id: "cat-2",
      category_name: "Liquor Serving",
      required_workers: 3,
      total: 3,
      available: 1,
      pending: 1,
      pending_live: 1,
      pending_expired: 0,
      booked: 2,
      cancelled: 0,
      active: 3,
      positions: [
        { id: "p6", position_number: 1, status: "BOOKED",    locked_until: null },
        { id: "p7", position_number: 2, status: "BOOKED",    locked_until: null },
        { id: "p8", position_number: 3, status: "PENDING",   locked_until: new Date(Date.now() + 90000).toISOString() },
        // Note: available=1 means there's an available position we add below
      ],
    },
    {
      category_id: "cat-3",
      category_name: "Starters Serving",
      required_workers: 2,
      total: 2,
      available: 2,
      pending: 0,
      pending_live: 0,
      pending_expired: 0,
      booked: 0,
      cancelled: 0,
      active: 2,
      positions: [
        { id: "p9",  position_number: 1, status: "AVAILABLE", locked_until: null },
        { id: "p10", position_number: 2, status: "AVAILABLE", locked_until: null },
      ],
    },
    {
      category_id: "cat-4",
      category_name: "Juice Serving",
      required_workers: 2,
      total: 2,
      available: 2,
      pending: 0,
      pending_live: 0,
      pending_expired: 0,
      booked: 0,
      cancelled: 0,
      active: 2,
      positions: [
        { id: "p11", position_number: 1, status: "AVAILABLE", locked_until: null },
        { id: "p12", position_number: 2, status: "AVAILABLE", locked_until: null },
      ],
    },
  ];

  return {
    job_id: jobId,
    total: 12,
    available: 8,
    pending: 1,
    booked: 3,
    cancelled: 0,
    active: 12,
    categories: cats,
  };
}

const MOCK_JOB_META: JobMeta = {
  jobTitle: "Wedding Event Staff — Grand Sapphire Banquets",
  venueName: "Grand Sapphire Banquets",
  area: "Gachibowli",
  city: "Hyderabad",
  jobDate: TODAY_ISO,
  startTime: "19:00",
  endTime: "23:30",
  isRapidJob: true,
  rapidJobExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  status: "Open",
};

// mock wage map — real data comes from job_categories
const MOCK_WAGES: Record<string, number> = {
  "cat-1": 1200,
  "cat-2": 1400,
  "cat-3": 1200,
  "cat-4": 1100,
};

// ─── RPC wrappers ─────────────────────────────────────────────────────────────

async function rpcReservePosition(
  positionId: string,
  workerId: string,
): Promise<{ ok: boolean; lockExpiresAt: string | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("reserve_position", {
    p_position_id: positionId,
    p_worker_id: workerId,
  });
  if (error) return { ok: false, lockExpiresAt: null, error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d?.success) return { ok: false, lockExpiresAt: null, error: d?.error ?? "reserve_failed" };
  return { ok: true, lockExpiresAt: d.lock_expires_at ?? null, error: null };
}

async function rpcReleasePosition(
  positionId: string,
  workerId: string,
): Promise<{ ok: boolean; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("release_position", {
    p_position_id: positionId,
    p_worker_id: workerId,
  });
  if (error) return { ok: false, error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d?.success) return { ok: false, error: d?.error ?? "release_failed" };
  return { ok: true, error: null };
}

// ─── Position tile ────────────────────────────────────────────────────────────

type TileVariant = "available" | "selected" | "pending" | "booked";

function tileVariant(status: PositionStatus, isSelected: boolean): TileVariant {
  if (isSelected) return "selected";
  if (status === "AVAILABLE") return "available";
  if (status === "PENDING") return "pending";
  return "booked";
}

const TILE_STYLES: Record<TileVariant, string> = {
  available:
    "border-success/60 bg-success/8 text-success hover:border-success hover:bg-success/15 hover:scale-[1.06] hover:shadow-[0_0_14px_color-mix(in_oklab,var(--color-success)_30%,transparent)] cursor-pointer active:scale-[0.97]",
  selected:
    "border-primary bg-primary text-primary-foreground shadow-brand scale-[1.06] ring-4 ring-primary/30 cursor-pointer",
  pending:
    "border-gold/60 bg-gold/10 text-gold-foreground cursor-not-allowed opacity-80",
  booked:
    "border-border bg-muted/50 text-muted-foreground/50 cursor-not-allowed",
};

function PositionTile({
  positionId,
  positionNumber,
  status,
  isSelected,
  totalInCategory,
  onClick,
  isAnimatingIn,
}: {
  positionId: string;
  positionNumber: number;
  status: PositionStatus;
  isSelected: boolean;
  totalInCategory: number;
  onClick: (id: string) => void;
  isAnimatingIn: boolean;
}) {
  const variant = tileVariant(status, isSelected);
  const isInteractable = variant === "available" || variant === "selected";
  const label = posLabel(positionNumber, totalInCategory);

  return (
    <button
      type="button"
      id={`position-tile-${positionId}`}
      aria-label={`Position ${label} — ${variant}`}
      aria-pressed={isSelected}
      aria-disabled={!isInteractable}
      disabled={!isInteractable}
      onClick={() => isInteractable && onClick(positionId)}
      className={[
        // base
        "relative flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-200 select-none",
        // size
        "h-[72px] w-full sm:h-[80px]",
        // variant
        TILE_STYLES[variant],
        // entrance animation
        isAnimatingIn ? "animate-bounce-in" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Position number */}
      <span className="font-display text-lg font-bold leading-none">{label}</span>

      {/* Status indicator */}
      <span
        className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${
          variant === "selected"
            ? "text-primary-foreground/80"
            : variant === "available"
              ? "text-success/70"
              : variant === "pending"
                ? "text-gold-foreground/70"
                : "text-muted-foreground/40"
        }`}
      >
        {variant === "selected"
          ? "Selected"
          : variant === "pending"
            ? "On hold"
            : variant === "booked"
              ? "Filled"
              : "Open"}
      </span>

      {/* Check icon when selected */}
      {isSelected && (
        <div className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary-foreground shadow-sm">
          <CheckCircle2
            className="size-4 text-primary"
            strokeWidth={3}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Pending lock indicator */}
      {variant === "pending" && (
        <div className="absolute -right-1 -top-1 size-2.5 rounded-full bg-gold animate-pulse" />
      )}
    </button>
  );
}

// ─── Category tab ─────────────────────────────────────────────────────────────

function CategoryTab({
  cat,
  isActive,
  selectedCategoryId,
  onClick,
}: {
  cat: CategoryPositionStats;
  isActive: boolean;
  selectedCategoryId: string | null;
  onClick: () => void;
}) {
  const hasSelection = selectedCategoryId === cat.category_id;
  const isFull = cat.available === 0 && cat.booked === cat.required_workers;

  return (
    <button
      type="button"
      id={`cat-tab-${cat.category_id}`}
      aria-selected={isActive}
      role="tab"
      onClick={onClick}
      className={[
        "relative shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
        isActive
          ? "bg-primary text-primary-foreground shadow-brand"
          : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      ].join(" ")}
    >
      {hasSelection && !isActive && (
        <span className="size-2 rounded-full bg-primary animate-pulse" />
      )}
      <span>{cat.category_name}</span>
      {/* availability count */}
      <span
        className={`rounded-lg px-1.5 py-0.5 text-xs font-bold ${
          isActive
            ? "bg-primary-foreground/20 text-primary-foreground"
            : isFull
              ? "bg-muted text-muted-foreground"
              : cat.available <= 2
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "bg-success/15 text-success"
        }`}
      >
        {isFull ? "Full" : cat.available}
      </span>
    </button>
  );
}

// ─── Lock countdown ───────────────────────────────────────────────────────────

function LockCountdown({ expiresAt }: { expiresAt: string }) {
  const [secs, setSecs] = useState(() => {
    const diff = Math.max(
      0,
      Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000),
    );
    return diff;
  });

  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => {
      setSecs((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secs]);

  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const label = `${mins}:${String(s).padStart(2, "0")}`;
  const isUrgent = secs <= 30;

  return (
    <span
      className={`font-display font-bold tabular-nums ${
        isUrgent ? "text-destructive animate-pulse" : "text-primary"
      }`}
    >
      {label}
    </span>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items: { variant: TileVariant; label: string; desc: string }[] = [
    { variant: "available", label: "Available",  desc: "Open for booking" },
    { variant: "selected",  label: "Selected",   desc: "Your pick" },
    { variant: "pending",   label: "On Hold",    desc: "Reserved — 2 min" },
    { variant: "booked",    label: "Filled",     desc: "Already booked" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map(({ variant, label, desc }) => (
        <div key={variant} className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className={`h-5 w-7 rounded-md border-2 text-[9px] font-bold ${
              variant === "available"
                ? "border-success/60 bg-success/10"
                : variant === "selected"
                  ? "border-primary bg-primary"
                  : variant === "pending"
                    ? "border-gold/60 bg-gold/10"
                    : "border-border bg-muted/50"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            <strong className="text-foreground">{label}</strong> — {desc}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PositionSelectionPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { isLoggedIn, openLoginModal, user } = useAuth();

  // Data
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [jobMeta, setJobMeta] = useState<JobMeta | null>(null);
  const [stats, setStats] = useState<JobPositionStats | null>(null);
  const [wages, setWages] = useState<Record<string, number>>({});
  const [dataError, setDataError] = useState<string | null>(null);

  // UI state
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lostPositionId, setLostPositionId] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [categoryAnimKey, setCategoryAnimKey] = useState(0);

  const tabsRef = useRef<HTMLDivElement>(null);
  const currentWorkerId = user?.id ?? null;

  // ── Load job meta ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Fetch job meta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: jobRow, error: jobError } = await (supabase as any)
        .from("jobs")
        .select(
          "job_title, venue_name, area, city, job_date, start_time, end_time, is_rapid_job, rapid_job_expires_at, status, job_categories(id, wage)",
        )
        .eq("id", jobId)
        .single();

      if (cancelled) return;

      if (jobError || !jobRow) {
        // Use mock
        setJobMeta(MOCK_JOB_META);
        setWages(MOCK_WAGES);
        setStats(makeMockStats(jobId));
        setActiveCategoryId("cat-1");
        setIsMock(true);
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = jobRow as any;
      setJobMeta({
        jobTitle: r.job_title,
        venueName: r.venue_name,
        area: r.area,
        city: r.city,
        jobDate: r.job_date,
        startTime: (r.start_time as string).slice(0, 5),
        endTime: (r.end_time as string).slice(0, 5),
        isRapidJob: r.is_rapid_job,
        rapidJobExpiresAt: r.rapid_job_expires_at,
        status: r.status,
      });

      // Build wage map
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wageMap: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const cat of (r.job_categories ?? []) as any[]) {
        wageMap[cat.id as string] = cat.wage as number;
      }
      setWages(wageMap);

      // Release expired locks before loading stats
      await releaseExpiredLocks();

      // Load position stats
      const statsResult = await getJobPositionStats(jobId);
      if (cancelled) return;

      if (!statsResult.ok) {
        setDataError(statsResult.error);
        setLoading(false);
        return;
      }

      setStats(statsResult.data);
      if (statsResult.data.categories.length > 0) {
        setActiveCategoryId(statsResult.data.categories[0]!.category_id);
      }
      setIsMock(false);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [jobId]);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!stats || isMock) return;

    const channel = subscribeToJobPositions(jobId, ({ eventType, newRow, oldRow: _oldRow }) => {
      if (eventType === "UPDATE" && newRow) {
        const posId = newRow["id"] as string;
        const newStatus = newRow["status"] as PositionStatus;
        const newLock = newRow["lock_expires_at"] as string | null;
        const newWorkerId = newRow["worker_id"] as string | null;

        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            categories: prev.categories.map((cat) => ({
              ...cat,
              positions: cat.positions.map((p) =>
                p.id === posId ? { ...p, status: newStatus, locked_until: newLock } : p,
              ),
            })),
          };
        });

        // If the position this worker selected was taken by someone else
        if (
          selection?.positionId === posId &&
          (newStatus === "BOOKED" || (newStatus === "PENDING" && newWorkerId !== currentWorkerId))
        ) {
          setLostPositionId(posId);
          setSelection(null);
          toast.warning("Position taken", {
            description: "Another worker just booked this position. Please choose another.",
            duration: 5000,
          });
        }
      }
    });

    return () => { channel.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, stats, isMock]);

  // ── Tab scroll to active ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCategoryId || !tabsRef.current) return;
    const btn = tabsRef.current.querySelector<HTMLElement>(
      `#cat-tab-${activeCategoryId}`,
    );
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCategoryId]);

  // ── Handle position click ─────────────────────────────────────────────────
  const handlePositionClick = useCallback(
    async (positionId: string) => {
      if (!isLoggedIn) {
        openLoginModal({ type: "book-shift", payload: jobId });
        return;
      }
      if (!currentWorkerId || !stats) return;

      const activeCategory = stats.categories.find(
        (c) => c.category_id === activeCategoryId,
      );
      if (!activeCategory) return;

      const clickedPosition = activeCategory.positions.find(
        (p) => p.id === positionId,
      );
      if (!clickedPosition) return;

      // Deselect
      if (selection?.positionId === positionId) {
        setReleasing(true);
        if (!isMock) {
          await rpcReleasePosition(positionId, currentWorkerId);
        }
        setSelection(null);
        setReleasing(false);
        return;
      }

      // Release existing selection first
      if (selection && !isMock) {
        await rpcReleasePosition(selection.positionId, currentWorkerId);
      }
      if (selection) {
        setSelection(null);
      }

      // Reserve new position
      setReserving(true);
      let lockExpiresAt: string | null = null;

      if (!isMock) {
        const result = await rpcReservePosition(positionId, currentWorkerId);
        if (!result.ok) {
          setReserving(false);
          const friendlyErrors: Record<string, string> = {
            position_not_found: "This position no longer exists.",
            position_locked_by_another_worker: "This position was just reserved by another worker.",
            position_already_booked: "This position is already booked.",
            job_not_accepting: "This job is no longer accepting bookings.",
            worker_already_has_active_application: "You already have an active application for this job.",
          };
          toast.error("Cannot select position", {
            description: friendlyErrors[result.error ?? ""] ?? result.error ?? "Please try again.",
          });
          // Refresh stats to sync UI
          const refreshed = await getJobPositionStats(jobId);
          if (refreshed.ok) setStats(refreshed.data);
          return;
        }
        lockExpiresAt = result.lockExpiresAt;
      } else {
        // Mock: just accept
        lockExpiresAt = new Date(Date.now() + 120000).toISOString();
      }

      setSelection({
        categoryId: activeCategoryId!,
        categoryName: activeCategory.category_name,
        positionId,
        positionNumber: clickedPosition.position_number,
        wage: wages[activeCategoryId!] ?? 0,
        lockExpiresAt,
      });

      // Optimistically update local state
      if (isMock) {
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            categories: prev.categories.map((cat) => ({
              ...cat,
              positions: cat.positions.map((p) =>
                p.id === positionId ? { ...p, status: "PENDING" as PositionStatus } : p,
              ),
            })),
          };
        });
      }

      setReserving(false);
      setLostPositionId(null);
    },
    [
      isLoggedIn,
      openLoginModal,
      jobId,
      currentWorkerId,
      stats,
      activeCategoryId,
      selection,
      isMock,
      wages,
    ],
  );

  // ── Handle category switch ────────────────────────────────────────────────
  const handleCategoryChange = (catId: string) => {
    setActiveCategoryId(catId);
    setCategoryAnimKey((k) => k + 1);
    setLostPositionId(null);
  };

  // ── Handle continue ──────────────────────────────────────────────────────
  const handleContinue = () => {
    if (!selection) return;
    if (isMock) {
      toast.info("Preview mode", {
        description: "Connect Supabase to complete real bookings.",
      });
      return;
    }
    // Pass booking intent via sessionStorage (same-tab, no sensitive data persisted)
    sessionStorage.setItem(
      "qw_pending_booking",
      JSON.stringify({
        positionId: selection.positionId,
        categoryId: selection.categoryId,
        categoryName: selection.categoryName,
        positionNumber: selection.positionNumber,
        wage: selection.wage,
        lockExpiresAt: selection.lockExpiresAt,
        jobId,
        jobTitle: jobMeta?.jobTitle,
      }),
    );
    void navigate({ to: "/checkout" });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return <PositionSelectionSkeleton />;
  }

  if (dataError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto size-12 text-destructive/60" />
        <h2 className="mt-4 text-xl font-bold">Could not load positions</h2>
        <p className="mt-2 text-sm text-muted-foreground">{dataError}</p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!stats || !jobMeta) return null;

  const activeCategory = stats.categories.find(
    (c) => c.category_id === activeCategoryId,
  );

  const totalAvailable = stats.available;
  const isJobFull = totalAvailable === 0;
  const isJobClosed = ["FullyFilled", "Completed", "Cancelled"].includes(jobMeta.status);

  return (
    <div className="min-h-screen pb-44 lg:pb-32">

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/work/$jobId" params={{ jobId }}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Back to details</span>
              </Link>
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <p className="hidden truncate text-sm font-semibold text-muted-foreground sm:block">
              {jobMeta.jobTitle}
            </p>
          </div>
        </div>
      </div>

      {/* ── Job header ──────────────────────────────────────────────────────── */}
      <div
        className={`animate-rise border-b border-border ${
          jobMeta.isRapidJob ? "bg-gradient-to-br from-orange-500/10 to-transparent" : "bg-surface"
        }`}
        style={{ animationFillMode: "both" }}
      >
        <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {/* Rapid badge */}
              {jobMeta.isRapidJob && (
                <div className="mb-2">
                  {jobMeta.rapidJobExpiresAt ? (
                    <RapidJobBadge
                      rapidJobExpiresAt={jobMeta.rapidJobExpiresAt}
                      variant="compact"
                    />
                  ) : (
                    <RapidJobBadge variant="compact" />
                  )}
                </div>
              )}

              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                {jobMeta.jobTitle}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  {jobMeta.venueName} · {jobMeta.area}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                  {formatDateLabel(jobMeta.jobDate, jobMeta.startTime, jobMeta.endTime)}
                </span>
              </div>
            </div>

            {/* Stats summary */}
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <div className="text-center">
                <p className="font-display text-xl font-bold text-success">{totalAvailable}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="font-display text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>

          {/* Preview mode badge */}
          {isMock && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Info className="size-3.5" aria-hidden="true" />
              Preview mode — connect Supabase to enable real bookings
            </div>
          )}
        </div>
      </div>

      {/* ── Job closed state ────────────────────────────────────────────────── */}
      {(isJobFull || isJobClosed) && (
        <div className="mx-auto max-w-4xl px-4 py-10 text-center lg:px-8">
          <div className="rounded-2xl border-2 border-border bg-muted/20 py-14">
            <Users className="mx-auto size-12 text-muted-foreground/40" />
            <h2 className="mt-4 text-xl font-bold text-muted-foreground">
              {isJobClosed ? "This job is closed" : "All positions filled"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isJobClosed
                ? "This job is no longer accepting bookings."
                : "Every position has been booked. Check other shifts!"}
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link to="/work">Browse other shifts</Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      {!isJobFull && !isJobClosed && (
        <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">

          {/* ── Category tabs ──────────────────────────────────────────────── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">Choose a category</h2>
              <p className="text-xs text-muted-foreground">
                {stats.categories.length} categories · select one position
              </p>
            </div>

            <div
              ref={tabsRef}
              role="tablist"
              aria-label="Work categories"
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none" }}
            >
              {stats.categories.map((cat) => (
                <CategoryTab
                  key={cat.category_id}
                  cat={cat}
                  isActive={activeCategoryId === cat.category_id}
                  selectedCategoryId={selection?.categoryId ?? null}
                  onClick={() => handleCategoryChange(cat.category_id)}
                />
              ))}
            </div>
          </div>

          {/* ── Position grid ──────────────────────────────────────────────── */}
          {activeCategory && (
            <div
              key={`${activeCategoryId}-${categoryAnimKey}`}
              className="mt-8"
              role="tabpanel"
              aria-label={`${activeCategory.category_name} positions`}
            >
              {/* Category header */}
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">{activeCategory.category_name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {activeCategory.available > 0
                      ? `${activeCategory.available} of ${activeCategory.required_workers} positions open`
                      : "All positions filled for this category"}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                  <span className="text-xs font-semibold text-muted-foreground">Wage</span>
                  <span
                    className={`font-display text-lg font-bold ${
                      jobMeta.isRapidJob
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-primary"
                    }`}
                  >
                    ₹{(wages[activeCategoryId!] ?? 0).toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground">/ shift</span>
                </div>
              </div>

              {/* WORK POSITIONS label */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                  Work Positions
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Tiles grid */}
              <div
                className={`grid gap-3 ${
                  activeCategory.positions.length <= 4
                    ? "grid-cols-2 sm:grid-cols-4"
                    : activeCategory.positions.length <= 9
                      ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
                      : "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6"
                }`}
              >
                {activeCategory.positions
                  .filter((p) => p.status !== "CANCELLED")
                  .map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        animationDelay: `${i * 40}ms`,
                        animationFillMode: "both",
                      }}
                    >
                      <PositionTile
                        positionId={p.id}
                        positionNumber={p.position_number}
                        status={p.status}
                        isSelected={selection?.positionId === p.id}
                        totalInCategory={activeCategory.required_workers}
                        onClick={handlePositionClick}
                        isAnimatingIn
                      />
                    </div>
                  ))}
              </div>

              {/* Lost position notice */}
              {lostPositionId && (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-orange-500/40 bg-orange-500/8 px-4 py-3 text-sm text-orange-700 dark:text-orange-400 animate-rise">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  <p>
                    <strong>Position taken.</strong> Another worker just booked it. Pick a different one.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLostPositionId(null)}
                    className="ml-auto shrink-0"
                    aria-label="Dismiss"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {/* Loading overlay for reserve/release */}
              {(reserving || releasing) && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {reserving ? "Reserving position…" : "Releasing hold…"}
                </div>
              )}
            </div>
          )}

          {/* ── Legend ─────────────────────────────────────────────────────── */}
          <div className="mt-10 border-t border-border pt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Legend
            </p>
            <Legend />
          </div>
        </div>
      )}

      {/* ── Sticky bottom booking bar ────────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 border-t-2 bg-surface/98 backdrop-blur-md transition-all duration-300 ${
          selection
            ? "border-primary/30 shadow-[0_-8px_32px_-8px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]"
            : "border-border"
        }`}
      >
        <div className="mx-auto max-w-4xl px-4 py-4 lg:px-8">
          {selection ? (
            <div className="flex items-center justify-between gap-4">
              {/* Selection summary */}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Selected position
                </p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="font-display text-lg font-bold leading-tight">
                    {selection.categoryName}
                    <span className="ml-2 text-base text-muted-foreground">
                      · {posLabel(selection.positionNumber, stats?.categories.find(c => c.category_id === selection.categoryId)?.required_workers ?? 99)}
                    </span>
                  </p>
                  <p
                    className={`font-display text-xl font-bold ${
                      jobMeta?.isRapidJob
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-primary"
                    }`}
                  >
                    ₹{selection.wage.toLocaleString("en-IN")}
                  </p>
                </div>

                {/* Lock countdown */}
                {selection.lockExpiresAt && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Hold expires in</span>
                    <LockCountdown expiresAt={selection.lockExpiresAt} />
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentWorkerId || !selection) return;
                    setReleasing(true);
                    if (!isMock) {
                      await rpcReleasePosition(selection.positionId, currentWorkerId);
                    }
                    setSelection(null);
                    setReleasing(false);
                  }}
                  className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  aria-label="Cancel selection"
                  disabled={releasing}
                >
                  {releasing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </button>
                <Button
                  variant={jobMeta?.isRapidJob ? "destructive" : "hero"}
                  size="lg"
                  onClick={handleContinue}
                  className={`min-w-[140px] transition-all duration-200 active:scale-[0.97] ${
                    jobMeta?.isRapidJob
                      ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600"
                      : ""
                  }`}
                  id="continue-booking-btn"
                >
                  Continue
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : (
            // Nothing selected
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {isJobFull
                    ? "All positions filled"
                    : "Select one available position to continue"}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  One position per worker · wage shown before booking
                </p>
              </div>
              <Button
                variant="outline"
                size="lg"
                disabled
                className="min-w-[140px] opacity-50"
                id="continue-booking-disabled-btn"
              >
                Continue
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PositionSelectionSkeleton() {
  return (
    <div className="min-h-screen pb-32">
      {/* Topbar */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-3 lg:px-8">
          <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8 space-y-3">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
          <div className="flex gap-4">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8 space-y-8">
        {/* Category tabs */}
        <div className="flex gap-2">
          {[100, 120, 90, 110].map((w, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-xl bg-muted"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* Category header */}
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>

        {/* Position grid */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-muted"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom bar skeleton */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-12 w-36 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
