import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { FEATURES, FEATURE_KEY, STARTER_SETS, enabledFeatures, featuresValue, type Feature } from "../features";
import { MOTIONS, loadMotion, loadPresenting, saveMotion, savePresenting, type Motion } from "../motion";
import { Card, ErrorNote, Segmented, cx } from "./ui";

/**
 * Which parts of Tilly you see. Now, Live agents, Sessions and Settings are
 * always on; everything else is a switch, with ready-made sets.
 */
export function FeatureSettings() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const on = enabledFeatures(settings.data?.values);
  const save = useMutation({
    mutationFn: (next: Iterable<Feature>) => api.setSetting(FEATURE_KEY, featuresValue(next)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  const same = (list: Feature[]) => list.length === on.size && list.every((f) => on.has(f));
  const toggle = (f: Feature) => {
    const next = new Set(on);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    save.mutate(next);
  };

  return (
    <Card title="Features" className="xl:col-span-2">
      <p className="text-sm text-zinc-400">
        Show only what you use. A feature that's off has no tab and does no work in the background. Now, Live agents, Sessions and Settings are always on.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {STARTER_SETS.map((s) => (
          <button
            key={s.id}
            onClick={() => save.mutate(s.features)}
            className={cx("rounded-xl border px-3 py-2.5 text-left transition-colors", same(s.features) ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 hover:bg-zinc-800/60")}
          >
            <span className="block text-sm font-medium text-zinc-100">{s.label}</span>
            <span className="block text-xs text-zinc-400">{s.help}</span>
          </button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.id}>
            <label className="flex cursor-pointer items-start gap-3 py-1">
              <input type="checkbox" className="mt-1 accent-emerald-500" checked={on.has(f.id)} onChange={() => toggle(f.id)} />
              <span>
                <span className="block text-sm text-zinc-200">{f.label}</span>
                <span className="block text-xs text-zinc-500">{f.help}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <ErrorNote error={save.error} />
    </Card>
  );
}

/** How much moves on screen, and a switch for while you share your screen. */
export function MotionSettings() {
  const [motion, setMotion] = useState<Motion>(loadMotion);
  const [presenting, setPresenting] = useState(loadPresenting);
  return (
    <Card title="Motion">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-zinc-300">How much moves</span>
        <Segmented
          options={MOTIONS.map((m) => ({ value: m.value, label: m.label }))}
          value={motion}
          onChange={(m) => {
            setMotion(m);
            saveMotion(m);
          }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{MOTIONS.find((m) => m.value === motion)?.help} Charts never animate, and your computer's reduce-motion setting always wins.</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 accent-emerald-500"
          checked={presenting}
          onChange={(e) => {
            setPresenting(e.target.checked);
            savePresenting(e.target.checked);
          }}
        />
        <span>
          <span className="block text-sm text-zinc-200">Presenting</span>
          <span className="block text-xs text-zinc-500">Turns all motion off while you share your screen. Untick it when you're done.</span>
        </span>
      </label>
    </Card>
  );
}
