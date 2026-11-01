import { useQuery } from "@tanstack/react-query";
import { api, type Totals } from "../api";
import { duration, money, pct } from "../format";
import { cx } from "./ui";

/** A move smaller than this isn't news. */
const MIN_CHANGE = 0.2;
/** Fewer than this many on either side and a change is noise. */
const MIN_N = 5;

export interface Change {
  id: string;
  label: string;
  before: string;
  after: string;
  /** after / max(before, after), for the bar. */
  share: number;
  better: boolean;
  /** One plain sentence on what it means. */
  says: string;
}

const rel = (a: number, b: number) => (a > 0 ? (b - a) / a : 0);

/** Two proportions differ by more than chance, at 95%. */
function significant(a: number, na: number, b: number, nb: number) {
  if (na < MIN_N || nb < MIN_N) return false;
  const p = (a * na + b * nb) / (na + nb);
  const se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
  return se > 0 && Math.abs(a - b) / se > 1.96;
}

/** This week against last: only what moved enough to matter. */
export function weekChanges(t: Totals, p: Totals | null): Change[] {
  if (!p) return [];
  const out: Change[] = [];
  if (t.shipped >= MIN_N || p.shipped >= MIN_N) {
    const r = rel(p.shipped, t.shipped);
    if (Math.abs(r) >= MIN_CHANGE && p.shipped > 0)
      out.push({
        id: "shipped",
        label: "Shipped this week",
        before: String(p.shipped),
        after: String(t.shipped),
        share: t.shipped / Math.max(t.shipped, p.shipped),
        better: r > 0,
        says: r > 0 ? `${Math.round(r * 100)}% more work shipped than last week.` : `${Math.round(-r * 100)}% less shipped than last week.`,
      });
  }
  if (t.avgWaitSeconds != null && p.avgWaitSeconds != null && p.avgWaitSeconds > 0) {
    const r = rel(p.avgWaitSeconds, t.avgWaitSeconds);
    if (Math.abs(r) >= MIN_CHANGE)
      out.push({
        id: "reply",
        label: "Agents waited on you",
        before: duration(p.avgWaitSeconds * 1000),
        after: duration(t.avgWaitSeconds * 1000),
        share: t.avgWaitSeconds / Math.max(t.avgWaitSeconds, p.avgWaitSeconds),
        better: r < 0,
        says: r < 0 ? `You answered agents ${Math.round(-r * 100)}% faster.` : `Agents waited ${Math.round(r * 100)}% longer for you.`,
      });
  }
  if (t.shipped >= MIN_N && p.shipped >= MIN_N) {
    const a = p.costUsd / p.shipped;
    const b = t.costUsd / t.shipped;
    const r = rel(a, b);
    if (Math.abs(r) >= MIN_CHANGE)
      out.push({
        id: "cost",
        label: "Cost per shipped session",
        before: money(a),
        after: money(b),
        share: b / Math.max(a, b),
        better: r < 0,
        says: r < 0 ? "Each shipped piece of work cost less." : "Each shipped piece of work cost more.",
      });
  }
  if (t.successRate != null && p.successRate != null && significant(p.successRate, p.rated, t.successRate, t.rated))
    out.push({
      id: "success",
      label: "Success rate",
      before: pct(p.successRate),
      after: pct(t.successRate),
      share: t.successRate / Math.max(t.successRate, p.successRate, 0.01),
      better: t.successRate > p.successRate,
      says: t.successRate > p.successRate ? "More of your rated sessions shipped, and it's more than chance." : "Fewer of your rated sessions shipped, and it's more than chance.",
    });
  return out;
}

/**
 * What changed this week, as cards that grow from before to after. Says
 * nothing when nothing moved: no "same as usual" cards.
 */
export function ChangeCards() {
  const o = useQuery({ queryKey: ["overview", 7], queryFn: () => api.overview(7) });
  if (!o.data) return null;
  const changes = weekChanges(o.data.totals, o.data.previous);
  if (!changes.length) return null;
  return (
    <section aria-label="What changed this week" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {changes.map((c) => (
        <div key={c.id} className="m-rise rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-400">{c.label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-sm tabular-nums text-zinc-500">{c.before}</span>
            <span className="text-zinc-500" aria-hidden>
              →
            </span>
            <span className="text-xl font-semibold tabular-nums text-zinc-50">{c.after}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
            <div className={cx("m-grow h-1.5 rounded-full", c.better ? "bg-green-500" : "bg-amber-500")} style={{ width: `${Math.round(c.share * 100)}%` }} />
          </div>
          <p className={cx("mt-2 text-sm", c.better ? "text-green-300" : "text-amber-300")}>{c.says}</p>
        </div>
      ))}
    </section>
  );
}
