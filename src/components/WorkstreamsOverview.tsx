import { useState } from "react";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import type { Pulse, Workstream } from "../api";
import { actNow, wsGroup, waitTrend, type WsGroup } from "../workstreams";
import { ago, duration, money, projectName } from "../format";
import { cx } from "./ui";

/** Stuck work is hatched, so it reads without colour. */
const STUCK = "repeating-linear-gradient(135deg, var(--color-zinc-500) 0 2px, transparent 2px 5px)";

/** The bar's parts, in order: the same colours as the cards' progress bars. */
const SEGMENTS: {
  key: keyof Pulse | "unproven";
  label: string;
  className: string;
  style?: React.CSSProperties;
}[] = [
  { key: "proven", label: "Done (proven)", className: "bg-emerald-500" },
  { key: "unproven", label: "Waiting on you", className: "bg-amber-400" },
  {
    key: "stuck",
    label: "Stuck",
    className: "ring-1 ring-inset ring-zinc-600",
    style: { background: STUCK },
  },
  {
    key: "inProgress",
    label: "In progress, or done on the agent's word",
    className: "bg-sky-500",
  },
  { key: "notStarted", label: "Not started", className: "bg-zinc-700" },
];

const GROUPS: { id: WsGroup; label: string; dot: string; hint?: string }[] = [
  { id: "need", label: "Needs you", dot: "bg-amber-400" },
  { id: "moving", label: "Moving", dot: "bg-sky-500" },
  {
    id: "stalled",
    label: "Stalled",
    dot: "ring-1 ring-inset ring-zinc-500",
    hint: "open work, quiet 3+ days",
  },
  { id: "done", label: "Done", dot: "ring-1 ring-inset ring-zinc-600" },
];

/** Stalled starts open only when it's this short. */
const STALLED_OPEN = 8;

/** Act now cards shown before "+N more". */
const ACTS = 4;

const hours = (h: number) => (h < 1 ? "under an hour" : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)} days`);

/**
 * Every workstream at once: what needs you across all of them (Act now),
 * then one row each, grouped Needs you, Moving, Stalled and Done. Each row
 * shows its tasks as one same-width bar, how much of the done work is
 * proven, what needs you, and how long its agents waited on you this week.
 */
export function WorkstreamsOverview({
  list,
  onOpenWs,
  onOpenSession,
  onStar,
}: {
  list: Workstream[];
  onOpenWs: (key: string) => void;
  onOpenSession: (id: string) => void;
  onStar: (ws: Workstream) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const now = Date.now();
  // Done starts folded, and so does a long Stalled list.
  const [folded, setFolded] = useState<Record<WsGroup, boolean>>(() => ({
    need: false,
    moving: false,
    stalled: list.filter((w) => wsGroup(w, now) === "stalled").length > STALLED_OPEN,
    done: true,
  }));
  const acts = actNow(list, now);
  const byGroup = (g: WsGroup) => list.filter((w) => wsGroup(w, now) === g);

  return (
    <>
      {acts.length > 0 && (
        <section aria-label="Act now, across all workstreams" className="mb-6 flex flex-wrap items-stretch gap-2.5">
          <div className="flex flex-col justify-center pr-1">
            <span className="text-sm text-zinc-300">Act now</span>
            <span className="text-xs text-zinc-500">most work freed × longest wait</span>
          </div>
          {acts.slice(0, ACTS).map(({ ws, need }, i) => {
            const late = now - need.since >= 86_400_000;
            return (
              <button
                key={`${ws.key}:${i}`}
                onClick={() => (need.sessionId ? onOpenSession(need.sessionId) : onOpenWs(ws.key))}
                className={cx(
                  "m-rise flex min-h-16 min-w-52 flex-1 items-center gap-3 rounded-xl border bg-zinc-900/60 px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-800/60",
                  late ? "border-amber-500/60" : "border-zinc-800",
                )}
              >
                <span
                  className={cx("shrink-0 rounded-full", need.sessionId ? "bg-amber-400" : "ring-2 ring-inset ring-zinc-300")}
                  style={{
                    width: 12 + Math.min(14, need.frees * 2),
                    height: 12 + Math.min(14, need.frees * 2),
                  }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-zinc-500">{ws.title}</span>
                  <span className="block truncate text-sm font-medium text-zinc-100">{need.title}</span>
                  <span className="block text-xs text-zinc-400">
                    frees {need.frees} {need.frees === 1 ? "task" : "tasks"} · <span className={late ? "text-amber-300" : ""}>waiting {duration(now - need.since)}</span>
                  </span>
                </span>
              </button>
            );
          })}
          {acts.length > ACTS && <span className="self-center text-sm text-zinc-500">+{acts.length - ACTS} more</span>}
        </section>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[60rem]">
          <div className="grid grid-cols-[15rem_minmax(14rem,1fr)_10rem_9rem_11rem] gap-4 border-b border-zinc-800 pb-2 text-xs text-zinc-500">
            <span>Workstream</span>
            <span>Its tasks</span>
            <span>Done (proven)</span>
            <span>Needs you</span>
            <span>Waited on you, this week</span>
          </div>
          {GROUPS.map((g) => {
            const rows = byGroup(g.id);
            if (!rows.length) return null;
            const open = !folded[g.id];
            return (
              <section key={g.id} className="mt-4" aria-label={g.label}>
                <button
                  onClick={() => setFolded((f) => ({ ...f, [g.id]: open }))}
                  aria-expanded={open}
                  className="flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-200 hover:text-zinc-50"
                >
                  {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                  <span className={cx("h-2.5 w-2.5 rounded-full", g.dot)} aria-hidden />
                  {g.label} <span className="font-normal text-zinc-500">{rows.length}</span>
                  {!open && <span className="font-normal text-zinc-500">· show</span>}
                  {g.hint && <span className="font-normal text-zinc-600">{g.hint}</span>}
                </button>
                {open &&
                  rows.map((w) => (
                    <Row
                      key={w.key}
                      ws={w}
                      now={now}
                      expanded={expanded === w.key}
                      onToggle={() => setExpanded((k) => (k === w.key ? null : w.key))}
                      onOpenWs={onOpenWs}
                      onOpenSession={onOpenSession}
                      onStar={onStar}
                    />
                  ))}
              </section>
            );
          })}
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-zinc-500">
            {SEGMENTS.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className={cx("h-2.5 w-3.5 rounded-sm", s.className)} style={s.style} aria-hidden />
                {s.label}
              </span>
            ))}
            <span>· every bar is the same width; the number beside it is how many tasks</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({
  ws,
  now,
  expanded,
  onToggle,
  onOpenWs,
  onOpenSession,
  onStar,
}: {
  ws: Workstream;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  onOpenWs: (key: string) => void;
  onOpenSession: (id: string) => void;
  onStar: (ws: Workstream) => void;
}) {
  const p = ws.pulse;
  const total = p?.total ?? ws.counts.done + ws.counts.inProgress + ws.counts.pending;
  const needs = p?.needs ?? [];
  const oldest = needs.length ? Math.min(...needs.map((n) => n.since)) : null;
  const parts: Record<string, number> = p
    ? {
        proven: p.proven,
        unproven: needs.length,
        stuck: p.stuck,
        inProgress: p.inProgress + p.committed + p.word,
        notStarted: Math.max(0, p.notStarted - needs.length),
      }
    : {
        proven: ws.counts.done,
        unproven: 0,
        stuck: 0,
        inProgress: ws.counts.inProgress,
        notStarted: ws.counts.pending,
      };
  const sum = Object.values(parts).reduce((a, b) => a + b, 0) || 1;
  const unproven = [p?.committed ? `${p.committed} committed, not merged` : "", p?.word ? `${p.word} on the agent's word` : ""].filter(Boolean).join(" · ");
  // Only say how waiting compares when there was some this week.
  const trend = p && p.waitHours > 0 ? waitTrend(p) : null;
  const where = ws.sourceKind
    ? `${ws.sourceKind}${ws.trackerRepo ? ` · ${ws.trackerRepo}` : ""}`
    : ws.branch
      ? `${projectName(ws.repo)} · ${ws.branch}`
      : ws.custom
        ? "made by you"
        : `${ws.sessionCount} ${ws.sessionCount === 1 ? "session" : "sessions"} · an agent's task list`;

  return (
    <div className={cx("border-b border-zinc-900", expanded && "bg-zinc-900/50")}>
      <button onClick={onToggle} aria-expanded={expanded} className="grid w-full grid-cols-[15rem_minmax(14rem,1fr)_10rem_9rem_11rem] items-center gap-4 py-2.5 text-left hover:bg-zinc-900/40">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-100">
            {ws.starred && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Starred" />}
            <span className="truncate">{ws.title}</span>
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {now - ws.lastActivity < 30 * 60_000 ? "active now" : ago(now - ws.lastActivity)} · {where}
          </span>
        </span>
        <span className="flex items-center gap-2.5">
          {total === 0 ? (
            <span className="flex-1 text-xs text-zinc-600">no tasks yet</span>
          ) : (
            <span className="flex h-3 flex-1 overflow-hidden rounded bg-zinc-800" role="img" aria-label={`${total} tasks`}>
              {SEGMENTS.map((s) => {
                const n = parts[s.key as string] ?? 0;
                if (!n) return null;
                return (
                  <span
                    key={s.key}
                    className={s.className}
                    style={{
                      ...s.style,
                      width: `${(n / sum) * 100}%`,
                      minWidth: s.key === "unproven" || s.key === "stuck" ? 4 : 0,
                    }}
                  />
                );
              })}
            </span>
          )}
          <span className="w-12 text-right text-xs tabular-nums text-zinc-400">{total.toLocaleString()}</span>
        </span>
        <span>
          <span className="block text-sm tabular-nums text-zinc-200">
            {total === 0 ? "—" : p ? (p.proven === total ? `all ${total} done` : `${p.proven.toLocaleString()} of ${total.toLocaleString()}`) : `${ws.counts.done} of ${total}`}
          </span>
          {total > 0 && <span className={cx("block truncate text-xs", p?.word ? "text-amber-300/80" : "text-zinc-600")}>{unproven || "nothing unproven"}</span>}
        </span>
        <span className="flex items-center gap-2">
          {needs.length > 0 && (
            <span
              className="shrink-0 rounded-full bg-amber-400"
              style={{
                width: Math.min(22, 10 + needs.length),
                height: Math.min(22, 10 + needs.length),
              }}
              aria-hidden
            />
          )}
          <span>
            <span className={cx("block text-sm", needs.length ? "text-amber-300" : "text-zinc-600")}>{needs.length ? `${needs.length} ${needs.length === 1 ? "thing" : "things"}` : "—"}</span>
            {oldest != null && <span className="block text-xs text-zinc-500">oldest {duration(now - oldest)}</span>}
          </span>
        </span>
        <span>
          <span className="block text-sm text-zinc-300">{p && p.waitHours > 0 ? hours(p.waitHours) : "no waiting"}</span>
          {trend && trend !== "same" && p && (
            <span className={cx("block text-xs", trend === "worse" ? "text-amber-300" : "text-zinc-500")}>
              {trend}: {hours(p.waitHoursPrev)} last week
            </span>
          )}
          {trend === "same" && <span className="block text-xs text-zinc-500">about the same as last week</span>}
        </span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-6 pb-4 pl-[16rem] pr-2 pt-1">
          <div className="min-w-72 flex-1">
            <div className="mb-1.5 text-xs text-zinc-500">What needs you here</div>
            {needs.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing right now.</p>
            ) : (
              <ul className="space-y-1">
                {needs.slice(0, 5).map((n, i) => (
                  <li key={i}>
                    <button
                      onClick={() => (n.sessionId ? onOpenSession(n.sessionId) : onOpenWs(ws.key))}
                      className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left text-sm hover:bg-zinc-800/50"
                    >
                      <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", n.sessionId ? "bg-amber-400" : "ring-2 ring-inset ring-zinc-300")} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-zinc-200">{n.title}</span>
                      <span className="text-xs text-zinc-500">frees {n.frees}</span>
                      <span className={cx("w-14 text-right text-xs tabular-nums", now - n.since >= 86_400_000 ? "text-amber-300" : "text-zinc-400")}>{duration(now - n.since)}</span>
                    </button>
                  </li>
                ))}
                {needs.length > 5 && <li className="px-1 text-xs text-zinc-500">+{needs.length - 5} more inside</li>}
              </ul>
            )}
          </div>
          <div className="min-w-60 space-y-1 text-sm text-zinc-300">
            <div className="mb-1.5 text-xs text-zinc-500">At a glance</div>
            <div>{p?.stuck ? `${p.stuck} stuck` : "Nothing stuck"}</div>
            <div>Cost this week: {money(p?.costWeek ?? 0)}</div>
            <div className="flex gap-3 pt-1.5">
              <button onClick={() => onOpenWs(ws.key)} className="font-medium text-emerald-400 hover:underline">
                Open its tasks →
              </button>
              <button onClick={() => onStar(ws)} className="text-zinc-400 hover:text-zinc-200">
                {ws.starred ? "Unstar" : "Star"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
