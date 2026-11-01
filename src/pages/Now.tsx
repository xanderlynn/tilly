import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Flag, Lightbulb } from "lucide-react";
import { api, useLive, type LiveSession, type Outcome, type RiverLane } from "../api";
import type { Drill, Page } from "../App";
import { FirstRun } from "../components/FirstRun";
import { River } from "../components/River";
import { ChangeCards } from "../components/ChangeCards";
import { Focus, type FocusItem, useLater } from "../components/Focus";
import { StatusBadge } from "../components/status";
import { STATUS, isActive, isAwaiting, urgency, waitingNow } from "../status";
import { Button, Card, ErrorNote, SourceBadge, cx } from "../components/ui";
import { OUTCOME_LABEL, duration, projectName } from "../format";

/** Items on the Needs you list before "+N more". */
const SHOWN = 5;

/**
 * The home page: one sentence on where things stand, today as a River of
 * workstreams, and what needs you, most urgent first. Open an item for the
 * Focus panel. What changed this week shows only when something did.
 */
export default function Now({
  onOpen,
  go,
  drill,
  plan,
}: {
  onOpen: (id: string) => void;
  go: (p: Page) => void;
  drill: (d: Drill) => void;
  plan?: () => void;
}) {
  const live = useLive();
  const midnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const river = useQuery({ queryKey: ["river", midnight], queryFn: () => api.river(midnight), refetchInterval: 60_000 });
  const unrated = useQuery({ queryKey: ["sessions", { days: 30, outcome: "unrated" }], queryFn: () => api.sessions({ days: 30, outcome: "unrated" }) });
  const later = useLater();
  const [focus, setFocus] = useState<string | null>(null);
  const away = useAway();

  const sessions = live.data?.sessions ?? [];
  const lanes = river.data ?? [];
  const laneOf = (id: string) => lanes.find((l) => l.sessionIds.includes(id));
  const suggested = (unrated.data ?? []).filter((s) => s.suggestedOutcome === "shipped" || s.suggestedOutcome === "abandoned");

  // Waiting sessions (oldest and most urgent first), then your own next
  // steps on workstreams, then outcomes to confirm.
  const items: FocusItem[] = [
    ...sessions
      .filter((s) => waitingNow(s) && !later.has(s.id))
      .sort((a, b) => urgency(a.status) - urgency(b.status) || a.statusSince - b.statusSince)
      .map((s): FocusItem => ({ kind: "session", id: s.id, session: s, lane: laneOf(s.id)?.title ?? null })),
    ...lanes
      // A lane already waiting on you is covered by its session above.
      .filter((l) => l.key && l.humanNext && !later.has(`human:${l.key}`) && !l.sessionIds.some((id) => sessions.some((s) => s.id === id && waitingNow(s))))
      .map((l): FocusItem => ({ kind: "human", id: `human:${l.key}`, lane: l, title: l.humanNext! })),
    ...(suggested.length && !later.has("confirm") ? [{ kind: "confirm", id: "confirm", count: suggested.length } as FocusItem] : []),
  ];
  const [more, setMore] = useState(false);
  const shown = more ? items : items.slice(0, SHOWN);

  const working = sessions.filter((s) => isActive(s.status)).length;
  const waiting = sessions.filter(waitingNow).length;
  const parked = sessions.filter((s) => isAwaiting(s.status) && s.parked);

  const openLane = (l: RiverLane) => {
    if (l.key) {
      try {
        localStorage.setItem("workstream", l.key);
      } catch {
        // Without storage the list opens instead.
      }
      go("workstreams");
    } else drill({ label: "today's quick fixes", ids: l.sessionIds });
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">
            <Headline working={working} waiting={waiting} />
          </h1>
        </div>
        {plan && (
          <Button onClick={plan}>
            <ClipboardList size={15} /> Plan a task
          </Button>
        )}
      </header>

      <FirstRun />
      {away && <AwayDigest since={away} onOpen={onOpen} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Today" className="xl:col-span-2">
          {lanes.length ? (
            <River lanes={lanes} live={sessions} onGate={setFocus} onLane={openLane} />
          ) : (
            <p className="text-sm text-zinc-500">{river.isLoading ? "Loading today…" : "No agent work yet today. It shows up here as soon as an agent starts."}</p>
          )}
        </Card>

        <Card title={items.length ? `Needs you (${items.length})` : "Needs you"}>
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing needs you right now.</p>
          ) : (
            <ul className="space-y-2">
              {shown.map((it, i) => (
                <li key={it.id}>
                  <NeedRow item={it} first={i === 0} onClick={() => setFocus(it.id)} />
                </li>
              ))}
            </ul>
          )}
          {items.length > SHOWN && (
            <button className="mt-2 text-xs text-zinc-400 hover:text-zinc-200" onClick={() => setMore((m) => !m)}>
              {more ? "Show fewer" : `+${items.length - SHOWN} more`}
            </button>
          )}
          {parked.length > 0 && (
            <p className="mt-3 text-xs text-zinc-500">
              {parked.length} parked (waiting over 3 hours) ·{" "}
              <button className="underline-offset-2 hover:underline" onClick={() => go("control")}>
                see them
              </button>
            </p>
          )}
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        <ChangeCards />
        <WorthALook onOpen={onOpen} drill={drill} />
      </div>

      {focus && items.some((it) => it.id === focus) && (
        <Focus
          items={items}
          at={items.findIndex((it) => it.id === focus)}
          onMove={(id) => setFocus(id)}
          onClose={() => setFocus(null)}
          onLater={(id) => later.add(id)}
          onOpen={onOpen}
          onLane={openLane}
          confirm={<SuggestedOutcomes onOpen={onOpen} onDone={() => setFocus(null)} />}
        />
      )}
    </>
  );
}

function Headline({ working, waiting }: { working: number; waiting: number }) {
  const agents = `${working} agent${working === 1 ? " is" : "s are"} working.`;
  if (waiting === 0) return <>{working ? `${agents} Nothing needs you.` : "All quiet. Nothing needs you."}</>;
  return (
    <>
      {working ? `${agents} ` : ""}
      <span className="text-amber-300">
        {waiting === 1 ? "One needs" : `${waiting} need`} you.
      </span>
    </>
  );
}

function NeedRow({ item, first, onClick }: { item: FocusItem; first: boolean; onClick: () => void }) {
  const base = "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition-colors m-rise";
  if (item.kind === "session") {
    const s = item.session;
    const t = STATUS[s.status];
    return (
      <button onClick={onClick} className={cx(base, first ? `${t.bg} ${t.ring}` : "ring-zinc-800 hover:bg-zinc-800/40")}>
        <span className={cx("relative mt-1.5 h-2 w-2 shrink-0 rounded-full", t.dot)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-100">{s.title ?? "Untitled session"}</span>
          <span className="block truncate text-xs text-zinc-400">
            {t.label} · {duration(Date.now() - s.statusSince)} · {item.lane ?? projectName(s.projectPath)}
          </span>
        </span>
      </button>
    );
  }
  if (item.kind === "human") {
    return (
      <button onClick={onClick} className={cx(base, "ring-zinc-800 hover:bg-zinc-800/40")}>
        <span className="mt-1 h-3 w-3 shrink-0 rounded border border-dashed border-zinc-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-100">{item.title}</span>
          <span className="block truncate text-xs text-zinc-400">Your step · {item.lane.title}</span>
        </span>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={cx(base, "ring-zinc-800 hover:bg-zinc-800/40")}>
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-400" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-100">
          Did {item.count === 1 ? "this" : `these ${item.count}`} ship?
        </span>
        <span className="block text-xs text-zinc-400">Their pull requests or commits say so. One tap confirms.</span>
      </span>
    </button>
  );
}

/** Insights and unusual sessions, as one short list: the top three. */
function WorthALook({ onOpen, drill }: { onOpen: (id: string) => void; drill: (d: Drill) => void }) {
  const insights = useQuery({ queryKey: ["insights", 30], queryFn: () => api.insights(30) });
  const unusual = useQuery({ queryKey: ["anomalies", 14], queryFn: () => api.anomalies(14) });
  const rows = [
    ...(insights.data ?? [])
      .filter((i) => i.kind !== "info" && i.sessionIds.length > 0)
      .map((i) => ({ id: i.id, icon: Lightbulb, title: i.title, says: i.detail, run: () => drill({ label: i.title, ids: i.sessionIds }) })),
    ...(unusual.data ?? []).map((a) => ({ id: a.id, icon: Flag, title: a.title ?? "Untitled session", says: a.reasons.join("; "), run: () => onOpen(a.id) })),
  ].slice(0, 3);
  if (!rows.length) return null;
  return (
    <Card title="Worth a look">
      <ul className="divide-y divide-zinc-800/70">
        {rows.map((r) => (
          <li key={r.id}>
            <button className="flex w-full items-start gap-3 py-2 text-left hover:bg-zinc-800/30" onClick={r.run}>
              <r.icon size={15} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm text-zinc-100">{r.title}</span>
                <span className="block text-xs text-zinc-400">{r.says}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Away at least this long, the home page says what happened meanwhile. */
const AWAY_MS = 30 * 60_000;

/**
 * When you last had Tilly in front of you, if it was a while ago: kept in
 * local storage and updated whenever the window loses focus or hides.
 */
function useAway() {
  const [away] = useState<number | null>(() => {
    try {
      const last = Number(localStorage.getItem("lastSeen"));
      return last && Date.now() - last > AWAY_MS ? last : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const mark = () => {
      try {
        localStorage.setItem("lastSeen", String(Date.now()));
      } catch {
        // Without storage there's no digest; nothing else depends on it.
      }
    };
    mark();
    const tick = window.setInterval(() => document.hasFocus() && mark(), 60_000);
    window.addEventListener("blur", mark);
    document.addEventListener("visibilitychange", mark);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("blur", mark);
      document.removeEventListener("visibilitychange", mark);
    };
  }, []);
  return away;
}

/** What finished, failed or started waiting on you while you were away. */
function AwayDigest({ since, onOpen }: { since: number; onOpen: (id: string) => void }) {
  const q = useQuery({ queryKey: ["since", since], queryFn: () => api.since(since) });
  const list = q.data ?? [];
  if (!list.length) return null;
  const waiting = list.filter((s) => isAwaiting(s.status));
  const failed = list.filter((s) => s.status === "failed");
  const done = list.filter((s) => !isAwaiting(s.status));
  return (
    <Card title={`Since you left · ${duration(Date.now() - since)}`} className="m-rise mb-4">
      <p className="text-sm text-zinc-400">
        {done.length} finished{failed.length ? `, ${failed.length} failed` : ""}
        {waiting.length ? `, ${waiting.length} waiting on you` : ""}.
      </p>
      <ul className="mt-2 divide-y divide-zinc-800/70">
        {[...waiting, ...done].slice(0, 6).map((s: LiveSession) => (
          <li key={s.id}>
            <button className="flex w-full items-center gap-3 py-1.5 text-left text-sm hover:text-zinc-100" onClick={() => onOpen(s.id)}>
              <StatusBadge status={s.status} size="xs" />
              <span className="min-w-0 flex-1 truncate text-zinc-300">{s.title ?? "Untitled session"}</span>
              <SourceBadge source={s.source} entrypoint={s.entrypoint} />
              <span className="shrink-0 text-xs text-zinc-500">{projectName(s.projectPath)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Sessions whose git work says how they ended (a merged PR, commits that
 * stood, a PR closed unmerged), confirmed in one click instead of rated one
 * by one.
 */
function SuggestedOutcomes({ onOpen, onDone }: { onOpen: (id: string) => void; onDone: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sessions", { days: 30, outcome: "unrated" }], queryFn: () => api.sessions({ days: 30, outcome: "unrated" }) });
  const confirm = useMutation({
    mutationFn: (v: { ids: string[]; outcome: Outcome }) => api.bulkReview(v.ids, v.outcome),
    onSuccess: () => {
      qc.invalidateQueries();
      onDone();
    },
  });
  const groups = (["shipped", "abandoned"] as Outcome[])
    .map((o) => ({ outcome: o, rows: (q.data ?? []).filter((s) => s.suggestedOutcome === o) }))
    .filter((g) => g.rows.length > 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-300">From your pull requests and commits. Confirm them all, or open one to say otherwise.</p>
      {groups.map((g) => (
        <div key={g.outcome}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-200">
              {g.rows.length} look {OUTCOME_LABEL[g.outcome].toLowerCase()}
            </span>
            <Button size="sm" variant="primary" busy={confirm.isPending && confirm.variables?.outcome === g.outcome} onClick={() => confirm.mutate({ ids: g.rows.map((s) => s.id), outcome: g.outcome })}>
              Confirm all {g.rows.length}
            </Button>
          </div>
          <ul className="mt-1 max-h-48 divide-y divide-zinc-800/60 overflow-y-auto">
            {g.rows.map((s) => (
              <li key={s.id}>
                <button className="flex w-full items-center gap-3 py-1.5 text-left text-sm hover:text-zinc-100" onClick={() => onOpen(s.id)}>
                  <span className="min-w-0 flex-1 truncate text-zinc-300">{s.title ?? s.firstPrompt ?? "Untitled session"}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{s.evidence}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ErrorNote error={confirm.error} />
    </div>
  );
}
