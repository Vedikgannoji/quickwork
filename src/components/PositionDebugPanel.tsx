/**
 * PositionDebugPanel
 *
 * Internal / employer-only debug view for inspecting the position state
 * of any job or category directly from Supabase.
 *
 * Usage:
 *   <PositionDebugPanel jobId="..." />
 *
 * Features:
 *   • Fetches live stats via fn_get_job_position_stats RPC
 *   • Subscribes to Realtime updates — refreshes automatically
 *   • Shows per-category position grid (one chip per position)
 *   • Lets employer increase/decrease headcount and see safe-edit results
 *   • Shows the AdjustPositionsResult detail (action, capped_by_bookings, etc.)
 *   • "Release expired locks" button (calls cleanup_expired_locks)
 *
 * NOT intended for the worker-facing booking UI.
 * Remove or gate behind an admin flag in production.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw, Zap, ChevronDown, ChevronUp, Plus, Minus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getJobPositionStats,
  adjustCategoryHeadcount,
  releaseExpiredLocks,
  subscribeToJobPositions,
  statusLabel,
  statusColour,
  formatPositionNumber,
  type JobPositionStats,
  type AdjustPositionsResult,
} from "@/lib/position-service";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  jobId: string;
  /** Collapse panel by default */
  defaultCollapsed?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PositionDebugPanel({ jobId, defaultCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<JobPositionStats | null>(null);
  const [lastResult, setLastResult] = useState<AdjustPositionsResult | null>(null);

  // Per-category headcount inputs (category_id → draft count)
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});

  const channelRef = useRef<ReturnType<typeof subscribeToJobPositions> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const result = await getJobPositionStats(jobId);
    setLoading(false);

    if (!result.ok) {
      toast.error("Stats fetch failed", { description: result.error });
      return;
    }

    setStats(result.data);

    // Seed draft counts from DB
    const seeds: Record<string, number> = {};
    for (const cat of result.data.categories ?? []) {
      seeds[cat.category_id] = cat.required_workers;
    }
    setDraftCounts(seeds);
  }, [jobId]);

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (collapsed) return;

    fetchStats();

    channelRef.current = subscribeToJobPositions(jobId, () => {
      // Debounce: wait 400 ms then re-fetch
      setTimeout(() => fetchStats(), 400);
    });

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [jobId, collapsed, fetchStats]);

  // ── Adjust headcount ─────────────────────────────────────────────────────────

  async function handleAdjust(categoryId: string) {
    const newCount = draftCounts[categoryId];
    if (newCount == null || newCount < 1) return;

    setLoading(true);
    const result = await adjustCategoryHeadcount(categoryId, newCount);
    setLoading(false);

    if (!result.ok) {
      toast.error("Adjustment failed", { description: result.error });
      return;
    }

    setLastResult(result.data);

    if (result.data.capped_by_bookings) {
      toast.warning("Headcount capped by bookings", {
        description: `${result.data.locked_positions} booked/held position(s) could not be removed. Effective count: ${result.data.effective_count}.`,
      });
    } else {
      toast.success(`Headcount → ${result.data.effective_count ?? result.data.new_active_count ?? newCount}`, {
        description:
          result.data.action === "increased"
            ? `Added ${result.data.positions_added} position(s).`
            : result.data.action === "decreased"
              ? `Cancelled ${result.data.positions_cancelled} position(s).`
              : "No change needed.",
      });
    }

    await fetchStats();
  }

  // ── Release expired locks ────────────────────────────────────────────────────

  async function handleReleaseLocks() {
    const result = await releaseExpiredLocks();
    if (!result.ok) {
      toast.error("Release failed", { description: result.error });
      return;
    }
    toast.info(`Released ${result.data} expired lock(s).`);
    await fetchStats();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 font-mono text-xs">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-amber-500/10"
        id={`pos-debug-toggle-${jobId}`}
      >
        <span className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
          <Zap className="size-4" />
          Position Debug Panel
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px]">
            internal
          </span>
        </span>
        {collapsed ? (
          <ChevronDown className="size-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronUp className="size-4 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-amber-500/20 px-4 pb-5 pt-4">
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-amber-600/80 dark:text-amber-400/80">
              job: <span className="select-all">{jobId}</span>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReleaseLocks}
                disabled={loading}
                className="h-7 gap-1.5 border-amber-500/40 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                id="debug-release-locks-btn"
              >
                <Zap className="size-3" /> Release locks
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={loading}
                className="h-7 gap-1.5 border-amber-500/40 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                id="debug-refresh-btn"
              >
                {loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {/* Job-level totals */}
          {stats && (
            <div className="mb-4 flex flex-wrap gap-3">
              {(
                [
                  ["total",     stats.total,     "bg-muted"],
                  ["available", stats.available, "bg-success/20 text-success"],
                  ["pending",   stats.pending,   "bg-gold/20 text-gold-foreground"],
                  ["booked",    stats.booked,    "bg-primary/20 text-primary"],
                  ["cancelled", stats.cancelled, "bg-muted text-muted-foreground"],
                ] as const
              ).map(([label, value, cls]) => (
                <div
                  key={label}
                  className={`rounded-lg border border-border px-3 py-1.5 ${cls}`}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {label}
                  </span>
                  <span className="block text-xl font-bold">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Last RPC result */}
          {lastResult && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-1 font-semibold text-amber-600 dark:text-amber-400">
                Last adjust result:
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] text-amber-700 dark:text-amber-300">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
              {lastResult.capped_by_bookings && (
                <div className="mt-2 flex items-start gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>
                    Headcount reduction was capped — {lastResult.locked_positions} booked/held
                    position(s) could not be removed.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Per-category breakdown */}
          {stats?.categories?.map((cat) => {
            const draft = draftCounts[cat.category_id] ?? cat.required_workers;
            const isDirty = draft !== cat.required_workers;

            return (
              <div
                key={cat.category_id}
                className="mb-4 rounded-xl border border-border bg-background/80 p-4"
              >
                {/* Category header */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{cat.category_name}</p>
                    <p className="text-muted-foreground">
                      id: <span className="select-all">{cat.category_id}</span>
                    </p>
                  </div>

                  {/* Headcount adjuster */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7 text-sm"
                      onClick={() =>
                        setDraftCounts((prev) => ({
                          ...prev,
                          [cat.category_id]: Math.max(1, (prev[cat.category_id] ?? cat.required_workers) - 1),
                        }))
                      }
                      disabled={draft <= 1}
                      aria-label="Decrease headcount"
                      id={`debug-dec-${cat.category_id}`}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <input
                      type="number"
                      min={1}
                      className="h-7 w-12 rounded-md border border-border bg-background px-2 text-center font-bold"
                      value={draft}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (!isNaN(v) && v >= 1)
                          setDraftCounts((prev) => ({ ...prev, [cat.category_id]: v }));
                      }}
                      aria-label={`Headcount for ${cat.category_name}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-7 text-sm"
                      onClick={() =>
                        setDraftCounts((prev) => ({
                          ...prev,
                          [cat.category_id]: (prev[cat.category_id] ?? cat.required_workers) + 1,
                        }))
                      }
                      aria-label="Increase headcount"
                      id={`debug-inc-${cat.category_id}`}
                    >
                      <Plus className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant={isDirty ? "hero" : "outline"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      disabled={!isDirty || loading}
                      onClick={() => handleAdjust(cat.category_id)}
                      id={`debug-apply-${cat.category_id}`}
                    >
                      {isDirty ? "Apply" : "No change"}
                    </Button>
                  </div>
                </div>

                {/* Stats chips */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["active",    cat.active,     "bg-muted"],
                      ["available", cat.available,   "bg-success/15 text-success"],
                      ["pending",   cat.pending,     "bg-gold/15 text-gold-foreground"],
                      ["booked",    cat.booked,      "bg-primary/15 text-primary"],
                      ["cancelled", cat.cancelled,   "bg-muted/50 text-muted-foreground"],
                    ] as const
                  ).map(([label, value, cls]) => (
                    <span
                      key={label}
                      className={`rounded-lg border border-border px-2 py-0.5 ${cls}`}
                    >
                      {label}: <strong>{value}</strong>
                    </span>
                  ))}
                </div>

                {/* Position grid */}
                <div className="flex flex-wrap gap-1.5">
                  {cat.positions?.map((pos) => (
                    <span
                      key={pos.id}
                      title={`id: ${pos.id}${pos.locked_until ? `\nlocked until: ${pos.locked_until}` : ""}`}
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${statusColour(pos.status)}`}
                    >
                      {formatPositionNumber(pos.position_number, cat.active)}
                      <span className="ml-1 opacity-60">
                        {pos.status === "BOOKED"
                          ? "🔒"
                          : pos.status === "PENDING"
                            ? "⏳"
                            : pos.status === "CANCELLED"
                              ? "✕"
                              : "✓"}
                      </span>
                    </span>
                  ))}
                  {(!cat.positions || cat.positions.length === 0) && (
                    <span className="text-muted-foreground">No positions generated yet.</span>
                  )}
                </div>
              </div>
            );
          })}

          {!stats && !loading && (
            <p className="text-muted-foreground">No stats — click Refresh.</p>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
