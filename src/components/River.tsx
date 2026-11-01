import { memo, useState } from "react";
import type { LiveSession, RiverLane } from "../api";
import { STATUS, isActive, waitingNow } from "../status";
import { duration, projectName } from "../format";
import { WAIT_FILL } from "./Swimlanes";
import { cx } from "./ui";

/** Lanes shown before "Show all". */
const LANES = 12;

/**
 * Today as one lane per workstream. Bars are agent work and flow while an
 * agent is working; hatched amber is time an agent waited on you; an amber
 * gate at "now" is a session waiting on you this minute; a dashed box is the
 * next step only you can do. Only the oldest gate pulses.
 */
export const River = memo(function River({
  lanes,
  live,
  onGate,
  onLane,
}: {
  lanes: RiverLane[];
  live: LiveSession[];
  onGate: (id: string) => void;
  onLane: (lane: RiverLane) => void;
}) {
  const [all, setAll] = useState(false);
  const now = Date.now();
  const first = Math.min(now - 2 * 3_600_000, ...lanes.flatMap((l) => l.spans.map((s) => s[0])));
  const startHour = new Date(first);
  startHour.setMinutes(0, 0, 0);
  const start = startHour.getTime();
  // Leave a little room after "now" for gates and your next step.
  const end = now + Math.max(2 * 3_600_000, (now - start) * 0.3);
  const pos = (t: number) => ((Math.min(Math.max(t, start), end) - start) / (end - start)) * 100;
  const hours: number[] = [];
  for (let t = start; t <= end; t += 3_600_000) hours.push(t);
  const nowX = pos(now);

  const byId = new Map(live.map((s) => [s.id, s]));
  const gates = (l: RiverLane) => l.sessionIds.map((id) => byId.get(id)).filter((s): s is LiveSession => !!s && waitingNow(s));
  const oldest = live.filter(waitingNow).sort((a, b) => a.statusSince - b.statusSince)[0]?.id;
  const shown = all ? lanes : lanes.slice(0, LANES);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="relative ml-[11.75rem] h-5 text-xs tabular-nums text-zinc-500" aria-hidden>
          {hours.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pos(t)}%` }}>
              {new Date(t).getHours()}:00
            </span>
          ))}
        </div>
        <ul className="relative">
          {shown.map((l) => {
            const g = gates(l);
            const working = l.sessionIds.some((id) => {
              const s = byId.get(id);
              return s && isActive(s.status);
            });
            const finished = l.total > 0 && l.done === l.total && !working && g.length === 0;
            const work = l.spans.filter((s) => s[2] !== 0);
            const lastWork = work[work.length - 1];
            return (
              <li key={l.key ?? "quick"} className={cx("flex items-center gap-3 border-b border-zinc-800/60 py-2 last:border-0", finished && "m-settle")}>
                <button className="w-44 shrink-0 text-left" onClick={() => onLane(l)} title={l.key ? "Open this workstream" : "Open these sessions"}>
                  <span className={cx("block truncate text-sm font-medium", l.key ? "text-zinc-100" : "text-zinc-400")}>{l.title}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {l.key ? (l.total > 0 ? `${l.done}/${l.total} done` : projectName(l.repo)) : `${l.sessionIds.length} one-off session${l.sessionIds.length === 1 ? "" : "s"}`}
                    {l.helpers > 0 && ` · ${l.helpers} helper${l.helpers === 1 ? "" : "s"}`}
                  </span>
                </button>
                <div className="relative h-9 flex-1">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-800" aria-hidden />
                  {l.spans.map(([a, b, k], i) => {
                    const left = pos(a);
                    const width = Math.max(0.3, pos(b) - left);
                    const flowing = working && k !== 0 && lastWork && a === lastWork[0];
                    return (
                      <span
                        key={i}
                        className={cx("absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full", k !== 0 && (l.key ? "bg-emerald-500/80" : "bg-zinc-600"), flowing && "m-flow")}
                        style={{ left: `${left}%`, width: `${width}%`, background: k === 0 ? WAIT_FILL : undefined }}
                        title={k === 0 ? `Waited on you ${duration(b - a)}` : `Agent working ${duration(b - a)}`}
                        aria-hidden
                      />
                    );
                  })}
                  {finished && (
                    <span className="absolute top-1/2 -translate-y-1/2 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-300" style={{ left: `calc(${nowX}% + 8px)` }}>
                      Done
                    </span>
                  )}
                  {g.length > 0 && (() => {
                    // One gate per lane: the oldest wait, with how many are waiting.
                    const s = [...g].sort((a, b) => a.statusSince - b.statusSince)[0];
                    return (
                      <button
                        onClick={() => onGate(s.id)}
                        className={cx("absolute top-1/2 flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-lg px-2 text-xs font-medium ring-1 ring-inset", STATUS[s.status].bg, STATUS[s.status].ring, STATUS[s.status].text)}
                        style={{ left: `calc(${nowX}% + 4px)` }}
                        aria-label={`${g.length === 1 ? (s.title ?? "A session") + " is" : `${g.length} sessions are`} waiting on you, longest ${duration(now - s.statusSince)}`}
                      >
                        <span className={cx("relative h-2 w-2 rounded-full", STATUS[s.status].dot)}>{s.id === oldest && <span className="m-pulse" />}</span>
                        {g.length > 1 && `${g.length} · `}
                        {duration(now - s.statusSince)}
                      </button>
                    );
                  })()}
                  {l.humanNext && g.length === 0 && !finished && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 truncate rounded-md border border-dashed border-zinc-500 px-2 py-0.5 text-xs text-zinc-300"
                      style={{ left: `calc(${nowX}% + 8px)`, maxWidth: `calc(${100 - nowX}% - 8px)` }}
                      title={`Your next step: ${l.humanNext}`}
                    >
                      You: {l.humanNext}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          <span className="pointer-events-none absolute inset-y-0 w-px bg-zinc-300/70" style={{ left: `calc(11.75rem + (100% - 11.75rem) * ${nowX / 100})` }} aria-hidden />
        </ul>
        {lanes.length > LANES && (
          <button className="mt-2 text-xs text-zinc-400 hover:text-zinc-200" onClick={() => setAll((a) => !a)}>
            {all ? "Show fewer" : `Show all ${lanes.length} lanes`}
          </button>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full bg-emerald-500/80" /> agents working
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full" style={{ background: WAIT_FILL }} /> waited on you
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> waiting on you now
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded border border-dashed border-zinc-500" /> your next step
          </span>
        </div>
      </div>
    </div>
  );
});
