import { cn } from "@/lib/utils";

/**
 * A plastic likelihood with the decision threshold drawn on it. A bare
 * percentage does not tell you whether the detector acted on it; the tick at
 * 50 % is what turns the number into a verdict you can read.
 */
export function LikelihoodMeter({ value, width = 72 }: { value: number; width?: number }) {
  const pct = Math.round(value * 100);
  const above = value >= 0.5;
  return (
    <span className="flex items-center gap-2" title={`${pct}% — detector threshold is 50%`}>
      <span className="relative h-1.5 shrink-0 overflow-hidden rounded-full bg-sunken" style={{ width }}>
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", above ? "bg-brand" : "bg-ink-3")}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden />
      </span>
      <span className={cn("font-mono text-[12px] tnum", above ? "text-ink" : "text-ink-3")}>{pct}%</span>
    </span>
  );
}
