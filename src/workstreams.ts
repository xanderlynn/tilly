// Pure helpers for the Workstreams page, kept apart so they can be tested.
import type { Need, Pulse, Workstream, WsTask } from "./api";

/** Shares of the progress bar: done, in progress, and waiting on you, from the counts. */
export function progress(ws: Workstream) {
  const c = ws.counts;
  const total = c.done + c.inProgress + c.pending;
  if (total === 0) return { done: 0, doing: 0, waiting: 0, total };
  const waiting = Math.min(c.decisions, total - c.done);
  const doing = Math.min(c.inProgress, total - c.done - waiting);
  return { done: c.done / total, doing: doing / total, waiting: waiting / total, total };
}

/** What the sessions behind a workstream, or one of its items, cost and delivered. */
export function value(sessions: Workstream["sessions"]) {
  const prs = new Set(sessions.flatMap((s) => s.prs));
  const rated = sessions.filter((s) => s.outcome);
  return {
    sessions: sessions.length,
    activeMs: sessions.reduce((a, s) => a + s.activeMs, 0),
    costUsd: sessions.some((s) => s.costUsd != null) ? sessions.reduce((a, s) => a + (s.costUsd ?? 0), 0) : null,
    costIsEstimate: sessions.some((s) => s.costIsEstimate),
    tokens: sessions.reduce((a, s) => a + s.tokens, 0),
    commits: sessions.reduce((a, s) => a + s.commits, 0),
    prs: prs.size,
    rated: rated.length,
    shipped: rated.filter((s) => s.outcome === "shipped").length,
  };
}

/** Days without activity before an unfinished workstream shows as idle. */
export const IDLE_AFTER_DAYS = 7;
/** Days without activity, unfinished, before it's called stalled. */
export const STALLED_AFTER_DAYS = 14;

/** What a card's badge says, most important first. */
export function cardState(ws: Workstream, now = Date.now()): { tone: "amber" | "green" | "grey"; label: string; hint?: string } {
  const c = ws.counts;
  const total = c.done + c.inProgress + c.pending;
  if (ws.closed) return { tone: "grey", label: "Closed" };
  if (c.needsYou > 0) {
    const parts = [c.decisions && `${c.decisions} for you`, c.waiting && `${c.waiting} waiting`].filter(Boolean);
    return { tone: "amber", label: parts.join(" · "), hint: "Your tasks (assigned to you or nobody), and agents waiting on you" };
  }
  if (ws.syncError) return { tone: "amber", label: "Out of date" };
  if (total > 0 && c.done === total) return { tone: "green", label: "Done" };
  const idle = Math.floor((now - ws.lastActivity) / 86_400_000);
  if (idle >= STALLED_AFTER_DAYS) return { tone: "amber", label: `Stalled ${idle}d`, hint: "No activity for two weeks and not finished: pick it up, or archive it" };
  if (idle >= IDLE_AFTER_DAYS) return { tone: "grey", label: `Idle ${idle}d` };
  return { tone: "green", label: "On track" };
}

/** What a task looks like in the tree. */
export type TaskState = "done" | "doing" | "yours" | "blocked" | "todo";

export function taskState(t: WsTask): TaskState {
  if (t.status === "done") return "done";
  if (t.kind === "human") return "yours";
  if (t.status === "blocked" || t.blockedBy.length > 0) return "blocked";
  if (t.status === "in_progress") return "doing";
  return "todo";
}

/**
 * The tree: each session with its tasks, in the order they were worked.
 * Sessions without a task list are left out, except in ones you made, where
 * every session you put in shows.
 */
export function tree(ws: Workstream) {
  return ws.sessions
    .map((s) => ({ session: s, tasks: ws.tasks.filter((t) => t.sessionId === s.id) }))
    .filter((n) => n.tasks.length > 0 || ws.custom || ws.sessions.length === 1);
}

/** "GitHub issue" or "Azure DevOps user story": what a workstream was imported from. */
export function importedLabel(ws: Pick<Workstream, "sourceUrl" | "sourceKind">) {
  return ws.sourceUrl ? `${trackerName(ws.sourceUrl)} ${(ws.sourceKind ?? "item").toLowerCase()}` : "";
}

/** Items from the issue or work item it was imported from, in their order. */
export const trackerTasks = (ws: Workstream) => ws.tasks.filter((t) => !t.sessionId);

/** "GitHub" or "Azure DevOps", from an imported workstream's link. */
export function trackerName(url: string) {
  return /^https:\/\/github\.com\//.test(url) ? "GitHub" : "Azure DevOps";
}

/** Two-letter initials for an agent's avatar. */
export function initials(label: string) {
  const words = label.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.length === 1 ? words[0].slice(0, 2).replace(/^./, (c) => c.toUpperCase()) : (words[0][0] + words[1][0]).toUpperCase();
}

/** Starred first, closed ones last, then ones that need you, then the most recently active. */
export function sortForYou(list: Workstream[]) {
  return [...list].sort(
    (a, b) =>
      Number(b.starred) - Number(a.starred) ||
      Number(a.closed) - Number(b.closed) ||
      Number(b.counts.needsYou > 0) - Number(a.counts.needsYou > 0) ||
      b.lastActivity - a.lastActivity,
  );
}

/** Groups on the list of all workstreams, in order. */
export type WsGroup = "need" | "moving" | "stalled" | "done";

/** Open work quiet this long is stalled. */
export const STALLED_LIST_DAYS = 3;

export function wsGroup(ws: Workstream, now = Date.now()): WsGroup {
  if ((ws.pulse?.needs.length ?? 0) > 0 || ws.counts.needsYou > 0) return "need";
  const c = ws.counts;
  const total = c.done + c.inProgress + c.pending;
  if (ws.closed || ws.archived || (total > 0 && c.done === total)) return "done";
  if (now - ws.lastActivity >= STALLED_LIST_DAYS * 86_400_000) return "stalled";
  return "moving";
}

/** How Act now ranks: work freed × (1 + days waited), as in pulse.rs. */
export const needScore = (n: Need, now = Date.now()) => n.frees * (1 + Math.max(0, now - n.since) / 86_400_000);

/** Everything that needs you across these workstreams, most urgent first. */
export function actNow(list: Workstream[], now = Date.now()): { ws: Workstream; need: Need }[] {
  return list
    .flatMap((ws) => (ws.pulse?.needs ?? []).map((need) => ({ ws, need })))
    .sort((a, b) => needScore(b.need, now) - needScore(a.need, now));
}

/** A change in waiting worth flagging: at least 3 hours and a fifth. */
export function waitTrend(p: Pulse): "worse" | "better" | "same" | null {
  if (!p.waitHours && !p.waitHoursPrev) return null;
  const d = p.waitHours - p.waitHoursPrev;
  if (Math.abs(d) < 3 || Math.abs(d) < 0.2 * Math.max(p.waitHoursPrev, 1)) return "same";
  return d > 0 ? "worse" : "better";
}
