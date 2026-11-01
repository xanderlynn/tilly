import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type CellState, type Wall, type WallCell, type WallRow } from "../api";
import { duration } from "../format";
import { Card, ErrorNote, Loading, Segmented, cx } from "./ui";

/** Stuck work is hatched, so it reads without colour. */
const STUCK = "repeating-linear-gradient(135deg, var(--color-zinc-400) 0 1px, transparent 1px 3px)";
const HALF = "linear-gradient(180deg, var(--color-emerald-500) 50%, var(--color-zinc-700) 50%)";

type Look = { className: string; style?: React.CSSProperties; label: string };

/** Simple: done, needs a person, stuck, working, not started. Detail splits done by proof. */
const SIMPLE: Record<CellState, Look> = {
  merged: { className: "bg-emerald-500", label: "Done" },
  committed: { className: "bg-emerald-500", label: "Done" },
  confirmed: { className: "bg-emerald-500", label: "Done" },
  word: { className: "bg-emerald-500", label: "Done" },
  you: { className: "bg-amber-400", label: "Needs a person" },
  others: { className: "bg-amber-400", label: "Needs a person" },
  working: { className: "bg-sky-500", label: "Agent working" },
  stuck: { className: "ring-1 ring-inset ring-zinc-500", style: { background: STUCK }, label: "Stuck" },
  todo: { className: "bg-zinc-700", label: "Not started" },
};
const DETAIL: Record<CellState, Look> = {
  ...SIMPLE,
  merged: { className: "bg-emerald-500", label: "Merged" },
  committed: { className: "", style: { background: HALF }, label: "Committed, not merged" },
  confirmed: { className: "bg-emerald-300", label: "Closed by a person" },
  word: { className: "ring-1 ring-inset ring-emerald-400", label: "Agent's word only" },
  you: { className: "bg-amber-400", label: "Waiting on you" },
  others: { className: "ring-1 ring-inset ring-amber-400", label: "Waiting on someone else" },
};

type Lens = "all" | "mine" | "you" | "people" | "review" | "stuck" | "word" | "slow";
const LENSES: { id: Lens; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "you", label: "Needs a person" },
  { id: "people", label: "People" },
  { id: "review", label: "Review" },
  { id: "stuck", label: "Stuck" },
  { id: "word", label: "Agent's word" },
  { id: "slow", label: "Delays" },
];

const matches = (c: WallCell, lens: Lens) =>
  lens === "all" ||
  (lens === "mine" && c.mine) ||
  (lens === "you" && (c.state === "you" || c.state === "others")) ||
  (lens === "people" && c.human) ||
  (lens === "review" && c.phase === "review") ||
  (lens === "stuck" && c.state === "stuck") ||
  (lens === "word" && c.state === "word") ||
  (lens === "slow" && c.ageHours >= 24);

const PHASES = ["build", "review", "release"] as const;
const PHASE_LABEL = { build: "Build", review: "Review", release: "Release · decide" };
/** Column widths in px, so cells wrap the same in every row. */
const WIDTH = { build: 420, review: 170, release: 110 };
const CELL = 7;

const done = (s: CellState) => s === "merged" || s === "committed" || s === "confirmed" || s === "word";
const proven = (s: CellState) => s === "merged" || s === "confirmed";
const days = (h: number) => (h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)} days`);

/**
 * One workstream's every task on one screen: a row per feature (or
 * session), Build, Review and Release columns, agents above the dashed line
 * and people below. Lenses fade everything else; a row opens into its
 * stories. Beside it: what needs you here, where time is going, and the
 * stories holding up the most.
 */
export function WallView({ wsKey, days: range, onOpenSession }: { wsKey: string; days: number; onOpenSession: (id: string) => void }) {
  const q = useQuery({ queryKey: ["wall", wsKey, range], queryFn: () => api.wall(wsKey, range) });
  const [lens, setLens] = useState<Lens>("all");
  const [detail, setDetail] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorNote error={q.error} />;
  if (!q.data) return null;
  return <WallBody wall={q.data} lens={lens} setLens={setLens} detail={detail} setDetail={setDetail} open={open} setOpen={setOpen} onOpenSession={onOpenSession} />;
}

function WallBody({
  wall,
  lens,
  setLens,
  detail,
  setDetail,
  open,
  setOpen,
  onOpenSession,
}: {
  wall: Wall;
  lens: Lens;
  setLens: (l: Lens) => void;
  detail: boolean;
  setDetail: (d: boolean) => void;
  open: string | null;
  setOpen: (k: string | null) => void;
  onOpenSession: (id: string) => void;
}) {
  const now = Date.now();
  const look = detail ? DETAIL : SIMPLE;
  const all = useMemo(() => wall.rows.flatMap((r) => r.cells), [wall]);
  const count = (f: (c: WallCell) => boolean) => all.filter(f).length;
  const hasMine = all.some((c) => c.mine) && all.some((c) => !c.mine);
  // Each phase's agent and people bands are as tall as the tallest row's, so rows line up.
  const perLine = (p: (typeof PHASES)[number]) => Math.floor((WIDTH[p] + 1) / CELL);
  const bandHeight = (p: (typeof PHASES)[number], human: boolean) =>
    Math.ceil(Math.max(0, ...wall.rows.map((r) => r.cells.filter((c) => c.phase === p && c.human === human).length)) / perLine(p)) * CELL;
  const lost = wall.lost;
  const lostRows = [
    { label: "agents waiting on you (2 weeks)", h: lost.waitingOnYou, className: "bg-amber-400" },
    { label: "steps waiting on others", h: lost.waitingOnOthers, className: "ring-1 ring-inset ring-amber-400" },
    { label: "stuck", h: lost.stuck, className: "ring-1 ring-inset ring-zinc-500", style: { background: STUCK } },
    { label: "in review", h: lost.inReview, className: "bg-sky-500" },
  ];
  const lostTotal = lostRows.reduce((a, r) => a + r.h, 0) || 1;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-50">
            {count((c) => proven(c.state)).toLocaleString()} of {all.length.toLocaleString()} proven
            <span className="ml-2 text-sm font-normal text-zinc-400">
              {count((c) => c.state === "committed")} committed · {count((c) => c.state === "word")} on the agent's word
            </span>
          </div>
          <div className="text-sm text-zinc-400">
            <span className="text-amber-300">{count((c) => c.state === "you" || c.state === "others")} need a person</span> · {count((c) => c.state === "stuck")} stuck ·{" "}
            {count((c) => c.state === "todo")} not started
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={LENSES.filter((l) => l.id !== "mine" || hasMine).map((l) => ({ value: l.id, label: l.label }))} value={lens} onChange={setLens} />
          <Segmented
            options={[
              { value: "simple" as const, label: "Simple" },
              { value: "detail" as const, label: "Detail" },
            ]}
            value={detail ? "detail" : "simple"}
            onChange={(v) => setDetail(v === "detail")}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Act now, in this workstream">
          {wall.needs.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing needs you here.</p>
          ) : (
            <ul className="space-y-1">
              {wall.needs.slice(0, 5).map((n, i) => (
                <li key={i}>
                  <button onClick={() => n.sessionId && onOpenSession(n.sessionId)} className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left text-sm hover:bg-zinc-800/50">
                    <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", n.sessionId ? "bg-amber-400" : "ring-2 ring-inset ring-zinc-300")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-zinc-200">{n.title}</span>
                    <span className="text-xs text-zinc-500">frees {n.frees}</span>
                    <span className={cx("w-12 text-right text-xs tabular-nums", now - n.since >= 86_400_000 ? "text-amber-300" : "text-zinc-400")}>{duration(now - n.since)}</span>
                  </button>
                </li>
              ))}
              {wall.needs.length > 5 && <li className="px-1 text-xs text-zinc-500">+{wall.needs.length - 5} more</li>}
            </ul>
          )}
        </Card>
        <Card title="Where time is going">
          {lostRows.every((r) => !r.h) ? (
            <p className="text-sm text-zinc-500">Nothing to show yet: Tilly counts waits from agents' sessions, and how long steps sit stuck or in review once it sees them change.</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded bg-zinc-800" role="img" aria-label="Where time is going">
                {lostRows.map((r) => (r.h ? <span key={r.label} className={r.className} style={{ ...r.style, width: `${(r.h / lostTotal) * 100}%` }} /> : null))}
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {lostRows.map((r) => (
                  <li key={r.label} className="flex justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-zinc-400">
                      <span className={cx("h-2 w-2 rounded-[1px]", r.className)} style={r.style} aria-hidden />
                      {r.label}
                    </span>
                    <span className="tabular-nums text-zinc-300">{r.h ? days(r.h) : "—"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-500">Open steps add up their ages, and they overlap, so this isn't calendar time.</p>
            </>
          )}
          {wall.delays.length > 0 && (
            <>
              <div className="mb-1 mt-3 text-xs text-zinc-500">Biggest delays</div>
              <ul className="space-y-1 text-sm">
                {wall.delays.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-zinc-300" title={`${d.row} · ${d.item}`}>
                      {d.item} <span className="text-zinc-500">· {d.row}</span>
                    </span>
                    <span className="text-xs text-zinc-500">{{ you: "on you", others: "on others", stuck: "stuck", review: "in review" }[d.cause]}</span>
                    <span className="w-14 text-right text-xs tabular-nums text-zinc-300">{days(d.hours)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <div className="min-w-[60rem]">
            <div className="grid grid-cols-[12rem_420px_170px_110px_minmax(6rem,1fr)] gap-3 border-b border-zinc-800 pb-1.5 text-xs text-zinc-500">
              <span>{wall.rowsAre === "feature" ? "Feature" : "Session"}</span>
              {PHASES.map((p) => (
                <span key={p}>{PHASE_LABEL[p]}</span>
              ))}
              <span>Proof</span>
            </div>
            {wall.rows.map((r) => (
              <Row key={r.key} row={r} look={look} lens={lens} open={open === r.key} onToggle={() => setOpen(open === r.key ? null : r.key)} bandHeight={bandHeight} />
            ))}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              {Object.values(look)
                .filter((l, i, a) => a.findIndex((x) => x.label === l.label) === i)
                .map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5">
                    <span className={cx("h-2 w-2 rounded-[1px]", l.className)} style={l.style} aria-hidden />
                    {l.label}
                  </span>
                ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-zinc-500" aria-hidden /> agents above, people below
              </span>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function Row({
  row,
  look,
  lens,
  open,
  onToggle,
  bandHeight,
}: {
  row: WallRow;
  look: Record<CellState, Look>;
  lens: Lens;
  open: boolean;
  onToggle: () => void;
  bandHeight: (p: (typeof PHASES)[number], human: boolean) => number;
}) {
  const total = row.cells.length;
  const n = (f: (c: WallCell) => boolean) => row.cells.filter(f).length;
  const finished = n((c) => done(c.state));
  const stuck = n((c) => c.state === "stuck");
  const say =
    finished === total
      ? { text: "done", amber: false }
      : row.waitsOn.length && finished / total < 0.5
        ? { text: `waits on ${row.waitsOn.join(", ")}`, amber: true }
        : stuck > total * 0.1
          ? { text: `${stuck} stuck`, amber: true }
          : finished === 0
            ? { text: "not started", amber: false }
            : { text: `${Math.round((finished / total) * 100)}% done`, amber: false };
  const order: CellState[] = ["merged", "confirmed", "committed", "word", "you", "others", "working", "stuck", "todo"];
  const sorted = (cells: WallCell[]) => [...cells].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
  const cell = (c: WallCell, size = 6) => (
    <span
      key={c.key}
      title={`${c.title} · ${look[c.state].label}${c.ageHours >= 1 ? ` · ${days(c.ageHours)}` : ""}`}
      className={cx("rounded-[1px]", look[c.state].className, !matches(c, lens) && "opacity-10")}
      style={{ ...look[c.state].style, width: size, height: size }}
    />
  );
  const share = (f: (c: WallCell) => boolean) => `${(n(f) / (total || 1)) * 100}%`;
  return (
    <div className={cx("border-b border-zinc-900", open && "bg-zinc-900/60")}>
      <div className="grid grid-cols-[12rem_420px_170px_110px_minmax(6rem,1fr)] items-center gap-3 py-1.5">
        <button onClick={onToggle} aria-expanded={open} className="min-w-0 text-left">
          <span className="block truncate text-sm font-medium text-zinc-100">{row.title}</span>
          <span className={cx("block truncate text-xs", say.amber ? "text-amber-300" : "text-zinc-500")}>{say.text}</span>
        </button>
        {PHASES.map((p) => (
          <div key={p} className="flex flex-col gap-[3px]">
            <div className="flex flex-wrap content-start gap-px" style={{ minHeight: bandHeight(p, false) }}>
              {sorted(row.cells.filter((c) => c.phase === p && !c.human)).map((c) => cell(c))}
            </div>
            <div className="border-t border-dashed border-zinc-700" />
            <div className="flex flex-wrap content-start gap-px" style={{ minHeight: bandHeight(p, true) }}>
              {sorted(row.cells.filter((c) => c.phase === p && c.human)).map((c) => cell(c))}
            </div>
          </div>
        ))}
        <div>
          <span className="block text-xs tabular-nums text-zinc-300">
            {n((c) => proven(c.state))} / {total}
          </span>
          <span className="mt-1 flex h-1.5 overflow-hidden rounded bg-zinc-800">
            <span className="bg-emerald-500" style={{ width: share((c) => proven(c.state)) }} />
            <span style={{ width: share((c) => c.state === "committed"), background: HALF }} />
            <span className="ring-1 ring-inset ring-emerald-400" style={{ width: share((c) => c.state === "word") }} />
          </span>
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap gap-2 pb-3 pl-[12.75rem]">
          {row.items.map((it) => {
            const cells = sorted(row.cells.filter((c) => c.item === it.key));
            const waiting = cells.some((c) => c.state === "you" || c.state === "others");
            return (
              <div key={it.key} className={cx("w-52 rounded-lg border bg-zinc-950 p-2", waiting ? "border-amber-500/60" : "border-zinc-800")}>
                <div className="mb-1.5 truncate text-xs text-zinc-400" title={it.title}>
                  {it.title} · {cells.filter((c) => done(c.state)).length}/{cells.length}
                </div>
                <div className="flex flex-wrap gap-px">{cells.map((c) => cell(c, 8))}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
