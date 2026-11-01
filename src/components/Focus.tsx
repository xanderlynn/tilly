import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SquareArrowOutUpRight, X } from "lucide-react";
import { api, type LiveSession, type RiverLane } from "../api";
import { STATUS } from "../status";
import { duration, projectName } from "../format";
import { Button, cx } from "./ui";

export type FocusItem =
  | { kind: "session"; id: string; session: LiveSession; lane: string | null }
  | { kind: "human"; id: string; lane: RiverLane; title: string }
  | { kind: "confirm"; id: string; count: number };

/** "Later" hides an item this long. */
const LATER_MS = 30 * 60_000;

/** Items you pushed back, until when; kept across restarts. */
export function useLater() {
  const [until, setUntil] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("later") ?? "{}");
    } catch {
      return {};
    }
  });
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const now = Date.now();
  return {
    has: (id: string) => (until[id] ?? 0) > now,
    add: (id: string) => {
      const next = Object.fromEntries(Object.entries({ ...until, [id]: Date.now() + LATER_MS }).filter(([, t]) => t > Date.now()));
      setUntil(next);
      try {
        localStorage.setItem("later", JSON.stringify(next));
      } catch {
        // Without storage, Later lasts until the window closes.
      }
    },
  };
}

/**
 * One thing at a time: the item you opened as a big card, the rest stacked
 * behind it. Enter goes to it, L pushes it back half an hour, D says you
 * handled it, arrows move through the stack, Esc closes.
 */
export function Focus({
  items,
  at,
  onMove,
  onClose,
  onLater,
  onOpen,
  onLane,
  confirm,
}: {
  items: FocusItem[];
  at: number;
  onMove: (id: string) => void;
  onClose: () => void;
  onLater: (id: string) => void;
  onOpen: (id: string) => void;
  onLane: (lane: RiverLane) => void;
  confirm: ReactNode;
}) {
  const qc = useQueryClient();
  const item = items[at];
  const go = useMutation({ mutationFn: (id: string) => api.goToAgent(id) });
  const dismiss = useMutation({ mutationFn: (id: string) => api.dismissSession(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["live"] }) });
  const next = () => {
    const after = items[at + 1] ?? items[at - 1];
    if (after) onMove(after.id);
    else onClose();
  };
  const primary = () => {
    if (item.kind === "session") go.mutate(item.session.id);
    else if (item.kind === "human") onLane(item.lane);
  };
  const later = () => {
    onLater(item.id);
    next();
  };
  const handled = () => {
    if (item.kind === "session") dismiss.mutate(item.session.id);
    else onLater(item.id);
    next();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "escape") onClose();
      else if (k === "enter" && item.kind !== "confirm") primary();
      else if (k === "l") later();
      else if (k === "d" && item.kind !== "confirm") handled();
      else if (k === "arrowdown" || k === "arrowright") items[at + 1] && onMove(items[at + 1].id);
      else if (k === "arrowup" || k === "arrowleft") items[at - 1] && onMove(items[at - 1].id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!item) return null;
  const behind = Math.min(2, items.length - at - 1);
  const note = go.isError ? String((go.error as { message?: string })?.message ?? go.error) : go.data;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/70 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Needs you">
        {behind >= 2 && <div className="absolute inset-x-10 -bottom-5 h-24 rounded-3xl bg-zinc-800/50" aria-hidden />}
        {behind >= 1 && <div className="absolute inset-x-5 -bottom-2.5 h-24 rounded-3xl bg-zinc-800/80" aria-hidden />}
        <article key={item.id} className="m-rise relative rounded-3xl border border-zinc-700 bg-zinc-900 p-7 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {item.kind === "session" && (
                <>
                  <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", STATUS[item.session.status].bg, STATUS[item.session.status].text)}>
                    {STATUS[item.session.status].label} · {duration(Date.now() - item.session.statusSince)}
                  </span>
                  <span className="text-zinc-400">{item.lane ?? projectName(item.session.projectPath)}</span>
                </>
              )}
              {item.kind === "human" && <span className="rounded-full border border-dashed border-zinc-500 px-2.5 py-1 text-xs text-zinc-300">Your step · {item.lane.title}</span>}
              {item.kind === "confirm" && <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300">Outcomes to confirm</span>}
              <span className="text-xs text-zinc-500">
                {at + 1} of {items.length}
              </span>
            </div>
            <button aria-label="Close" className="text-zinc-500 hover:text-zinc-200" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {item.kind === "session" && (
            <>
              <h2 className="text-2xl font-semibold leading-snug text-zinc-50">{item.session.title ?? "Untitled session"}</h2>
              {item.session.pendingTool && <p className="mt-2 text-sm text-zinc-300">It wants to use {item.session.pendingTool}.</p>}
              {item.session.lastMessage && <p className="mt-3 line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{item.session.lastMessage}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button variant="primary" busy={go.isPending} onClick={primary}>
                  <SquareArrowOutUpRight size={14} /> Go to agent
                </Button>
                <Button onClick={later}>Later</Button>
                <Button onClick={handled} busy={dismiss.isPending}>
                  I handled it
                </Button>
                <Button variant="ghost" onClick={() => onOpen(item.session.id)}>
                  Details
                </Button>
              </div>
              {note && <p className={cx("mt-2 text-xs", go.isError ? "text-amber-300" : "text-zinc-500")}>{note}</p>}
            </>
          )}

          {item.kind === "human" && (
            <>
              <h2 className="text-2xl font-semibold leading-snug text-zinc-50">{item.title}</h2>
              <p className="mt-3 text-sm text-zinc-300">Only a person can do this step of {item.lane.title}. Agents can't finish it for you.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="primary" onClick={primary}>
                  Open the workstream
                </Button>
                <Button onClick={later}>Later</Button>
              </div>
            </>
          )}

          {item.kind === "confirm" && (
            <>
              <h2 className="mb-3 text-2xl font-semibold leading-snug text-zinc-50">
                Did {item.count === 1 ? "this" : `these ${item.count}`} ship?
              </h2>
              {confirm}
              <div className="mt-4">
                <Button onClick={later}>Later</Button>
              </div>
            </>
          )}

          <p className="mt-6 text-xs text-zinc-500">
            {item.kind === "confirm" ? "L later · ← → move · Esc close" : "Enter go · L later · D handled · ← → move · Esc close"}
          </p>
        </article>
      </div>
    </div>
  );
}
