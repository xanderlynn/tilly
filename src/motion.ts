// Motion: five moves, each with one job (see index.css).
//   pulse  an agent is waiting on you     (Full, Calm)
//   rise   something new arrived          (Full, Calm)
//   flow   an agent is working            (Full)
//   grow   a number really changed        (Full)
//   settle work is done                   (Full)
// Off is still. Presenting turns motion off while you share your screen,
// and the computer's reduce-motion setting always wins.

export type Motion = "full" | "calm" | "off";

export const MOTIONS: { value: Motion; label: string; help: string }[] = [
  { value: "full", label: "Full", help: "All five moves." },
  { value: "calm", label: "Calm", help: "Only what needs you pulses, and new items slide in." },
  { value: "off", label: "Off", help: "Nothing moves." },
];

const KEY = "motion";
const PRESENTING = "presenting";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the choice lasts until the window closes.
  }
}

export function loadMotion(): Motion {
  const m = read(KEY);
  return m === "full" || m === "off" ? m : "calm";
}

export function loadPresenting(): boolean {
  return read(PRESENTING) === "true";
}

/** Sets `data-motion` on the root, which index.css keys its moves off. */
export function applyMotion(motion: Motion = loadMotion(), presenting = loadPresenting()) {
  document.documentElement.dataset.motion = presenting ? "off" : motion;
}

export function saveMotion(motion: Motion) {
  write(KEY, motion);
  applyMotion(motion);
}

export function savePresenting(on: boolean) {
  write(PRESENTING, String(on));
  applyMotion(loadMotion(), on);
}
