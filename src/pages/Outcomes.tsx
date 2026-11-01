import type { Drill, Page } from "../App";
import { PageHeader, RANGE_OPTIONS, Segmented } from "../components/ui";
import Overview from "./Overview";
import Progress from "./Progress";
import Scorecard from "./Scorecard";

/**
 * One page for how work is going: this period's summary, the months behind
 * it, and what turned into commits. Summary and Delivery follow the range;
 * Progress always covers the last year.
 */
export default function Outcomes({
  days,
  setDays,
  onOpen,
  go,
  drill,
}: {
  days: number;
  setDays: (d: number) => void;
  onOpen: (id: string) => void;
  go: (p: Page) => void;
  drill: (d: Drill) => void;
}) {
  return (
    <>
      <PageHeader title="Outcomes" subtitle="How often your work ships, month by month, and what pays off." actions={<Segmented options={RANGE_OPTIONS} value={days} onChange={setDays} />} />
      <Overview section days={days} setDays={setDays} onOpen={onOpen} go={go} drill={drill} />
      <Progress section />
      <Scorecard section days={days} setDays={setDays} drill={drill} />
    </>
  );
}
