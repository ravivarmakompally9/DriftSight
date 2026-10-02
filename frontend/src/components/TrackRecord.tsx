import { Check, Cloud, Crosshair, Minus, X } from "lucide-react";

import { usePasses } from "@/hooks/queries";
import type { Track } from "@/lib/types";
import { cn } from "@/lib/utils";

type Cell = {
  label: string;
  state: "before" | "new" | "match" | "miss" | "cloud" | "ended";
  detail: string;
  confidence: number | null;
};

const STYLE = {
  new: { icon: Crosshair, ring: "border-warn text-warn", bar: "bg-warn" },
  match: { icon: Check, ring: "border-ok text-ok", bar: "bg-ok" },
  miss: { icon: X, ring: "border-crit text-crit", bar: "bg-crit" },
  cloud: { icon: Cloud, ring: "border-line-strong text-ink-3", bar: "bg-line-strong" },
  before: { icon: Minus, ring: "border-line text-ink-3/50", bar: "bg-line" },
  ended: { icon: Minus, ring: "border-line text-ink-3/50", bar: "bg-line" },
} as const;

/**
 * The whole product thesis in one strip: what every satellite pass did to this
 * patch. A confidence line alone shows that the number moved; this shows *why* —
 * found 13.7 km from the forecast, or not found at all, or never looked at
 * because of cloud. It replaces a generic chart and a list of sentences with
 * the one thing both were circling.
 */
export function TrackRecord({ track, hour }: { track: Track; hour: number }) {
  const { data: passes } = usePasses();
  if (!passes) return null;

  const cells: Cell[] = passes.map((p) => {
    const entry = track.history.find((e) => e.pass === p.label && e.h <= hour);
    if (entry) {
      const state = entry.event === "new" ? "new"
        : entry.event === "match" ? "match"
        : entry.event === "miss" ? "miss" : "cloud";
      const detail = entry.event === "new" ? "flagged"
        : entry.event === "match" ? `${entry.km?.toFixed(1)} km`
        : entry.event === "miss" ? "not there"
        : "cloud";
      return { label: p.label, state, detail, confidence: entry.confidence };
    }
    if (p.h < track.born) return { label: p.label, state: "before", detail: "—", confidence: null };
    if (p.h > hour) return { label: p.label, state: "before", detail: "—", confidence: null };
    return { label: p.label, state: "ended", detail: "closed", confidence: null };
  });

  return (
    <section aria-label="Pass-by-pass record">
      <div className="mb-2 flex items-baseline gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          The record
        </h4>
        <span className="text-[11.5px] text-ink-3">
          what each satellite pass did to the confidence
        </span>
      </div>

      <ol className="grid grid-cols-8 gap-0.5 sm:gap-1">
        {cells.map((c) => {
          const st = STYLE[c.state];
          const Icon = st.icon;
          const dim = c.state === "before" || c.state === "ended";
          return (
            <li
              key={c.label}
              title={`${c.label}: ${c.detail}${c.confidence !== null ? ` · ${Math.round(c.confidence * 100)}%` : ""}`}
              className={cn("grid justify-items-center gap-1 rounded-lg px-0.5 py-1.5",
                dim ? "opacity-45" : "bg-surface-2")}
            >
              <span className="w-full truncate text-center text-[10px] font-medium text-ink-3">{c.label}</span>
              <span className={cn("grid h-6 w-6 place-items-center rounded-full border-2 bg-surface", st.ring)}>
                <Icon size={12} />
              </span>
              <span className="w-full truncate text-center text-[9.5px] leading-tight text-ink-2">{c.detail}</span>
              <span className="h-1 w-full overflow-hidden rounded-full bg-sunken">
                {c.confidence !== null && (
                  <span className={cn("block h-full rounded-full", st.bar)}
                        style={{ width: `${Math.round(c.confidence * 100)}%` }} />
                )}
              </span>
              <span className="font-mono text-[9.5px] tnum text-ink-3">
                {c.confidence !== null ? `${Math.round(c.confidence * 100)}%` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
