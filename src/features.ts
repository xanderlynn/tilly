// Feature switches: built-in modules you can turn on or off. Nothing is
// loaded from outside the app. A module that's off has no tab and runs no
// queries; "trackers" also stops background syncing (tracker_sync.rs).
// Stored as a JSON list in the `features.enabled` setting; missing means
// the Essentials set.

export type Feature =
  | "workstreams"
  | "trackers"
  | "outcomes"
  | "usage"
  | "teams"
  | "patterns"
  | "execution"
  | "toolkit"
  | "journal"
  | "playbooks"
  | "retro"
  | "experiments";

export const FEATURE_KEY = "features.enabled";

export const FEATURES: { id: Feature; label: string; help: string }[] = [
  { id: "workstreams", label: "Workstreams", help: "Bigger pieces of work across sessions, with their tasks." },
  { id: "trackers", label: "GitHub and Azure DevOps", help: "Import issues and work items, sync them, and check pull requests in the background." },
  { id: "outcomes", label: "Outcomes", help: "How often work ships, month by month, and what pays off." },
  { id: "usage", label: "Usage", help: "Spend and tokens, by app and model." },
  { id: "teams", label: "Teams", help: "Sessions where the lead agent handed work to helpers." },
  { id: "patterns", label: "Patterns", help: "When you work, how you delegate, tool reliability." },
  { id: "execution", label: "Execution", help: "Where agent time goes, context use." },
  { id: "toolkit", label: "Toolkit", help: "Agent roles, tools, MCP servers and skills you use." },
  { id: "journal", label: "Journal", help: "Plan a task, then compare plan with what happened." },
  { id: "playbooks", label: "Playbooks", help: "Versions of your CLAUDE.md and agent files, and how each did." },
  { id: "retro", label: "Weekly retro", help: "A weekly review written by Claude. Sends a summary to Claude." },
  { id: "experiments", label: "Experiments and goals", help: "Try one habit change and measure it; set goals." },
];

/** Ready-made sets; you can still switch each feature on its own. */
export const STARTER_SETS: { id: string; label: string; help: string; features: Feature[] }[] = [
  { id: "essentials", label: "Essentials", help: "What needs you, your workstreams, outcomes and spend. Good for most people, PMs included.", features: ["workstreams", "trackers", "outcomes", "usage"] },
  { id: "learning", label: "Learning", help: "Fewer moving parts while you build habits. No tracker syncing.", features: ["workstreams", "outcomes", "usage"] },
  { id: "lead", label: "Many streams", help: "Essentials plus agent teams, for running lots of work in parallel.", features: ["workstreams", "trackers", "outcomes", "usage", "teams"] },
  { id: "everything", label: "Everything", help: "Every page Tilly has.", features: FEATURES.map((f) => f.id) },
];

export const DEFAULT_FEATURES = STARTER_SETS[0].features;

/** The enabled features from the settings map. */
export function enabledFeatures(values: Record<string, string> | undefined): Set<Feature> {
  const raw = values?.[FEATURE_KEY];
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return new Set(list.filter((x): x is Feature => FEATURES.some((f) => f.id === x)));
    } catch {
      // A broken value falls back to the default set.
    }
  }
  return new Set(DEFAULT_FEATURES);
}

export const featuresValue = (on: Iterable<Feature>) => JSON.stringify(FEATURES.map((f) => f.id).filter((id) => new Set(on).has(id)));
