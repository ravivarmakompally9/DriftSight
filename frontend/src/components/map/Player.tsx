import { useMemo } from "react";
import { Pause, Play } from "lucide-react";

import { useTimeline } from "@/hooks/queries";
import { dayLabel, dtLabel, HOURS } from "@/lib/time";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn, token } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const SKY_COLOR = { clear: "var(--ok)", cloud: "var(--text-3)", partial: "var(--warn)" } as const;
const DAY_TICKS = [0, 2, 4, 6, 8, 10, 12];

/**
 * A scrubber that is only a slider throws away the most informative axis in
 * the product. This one draws the incident: the filled area is pellets ashore
 * over the 14 days, so the shape of the event is readable before anyone
 * presses play. Borrowed from how Global Fishing Watch treats its timeline.
 */
export function Player() {
  const hour = useAppStore((s) => s.hour);
  const setHour = useAppStore((s) => s.setHour);
  const playing = useAppStore((s) => s.playing);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const speed = useAppStore((s) => s.speed);
  const setSpeed = useAppStore((s) => s.setSpeed);
  const { data } = useTimeline();

  const path = useMemo(() => {
    const pts = data?.series ?? [];
    if (pts.length < 2) return null;
    const W = 1000, H = 100;
    const x = (h: number) => (h / HOURS) * W;
    const y = (p: number) => H - (p / 100) * H;
    const line = pts.map((p) => `${x(p.h).toFixed(1)},${y(p.ashore_pct).toFixed(1)}`).join(" L");
    return { area: `M0,${H} L${line} L${W},${H} Z`, line: `M${line}` };
  }, [data]);

  const progress = (hour / HOURS) * 100;

  return (
    <div className="panel-blur absolute inset-x-4 bottom-4 z-20 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-line px-4 py-2.5 shadow-float sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-4">
      <Button
        size="icon-lg" variant="default"
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? "Pause replay" : "Play replay"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </Button>

      <div className="max-sm:hidden">
        <div className="whitespace-nowrap font-mono text-sm font-semibold tnum">{dtLabel(hour)}</div>
        <div className="text-[11px] text-ink-3">IST · replay</div>
      </div>

      <div className="relative h-14">
        {/* the incident, drawn: share of pellets ashore across the replay */}
        <svg
          viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden
          className="absolute inset-x-0 top-1 h-7 w-full overflow-visible"
        >
          {path && (
            <>
              <defs>
                <linearGradient id="ds-ashore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={token("--pellet")} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={token("--pellet")} stopOpacity="0.04" />
                </linearGradient>
                <clipPath id="ds-elapsed"><rect x="0" y="-10" width={progress * 10} height="120" /></clipPath>
              </defs>
              <path d={path.area} fill="var(--sunken)" />
              <path d={path.area} fill="url(#ds-ashore)" clipPath="url(#ds-elapsed)" />
              <path d={path.line} fill="none" stroke={token("--pellet")} strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke" strokeOpacity="0.85" />
            </>
          )}
        </svg>
        <span className="pointer-events-none absolute left-0 top-0 text-[9.5px] uppercase tracking-wide text-ink-3 max-sm:hidden">
          pellets ashore
        </span>

        <input
          type="range" min={0} max={HOURS} value={hour}
          aria-label="Replay time" aria-valuetext={`${dtLabel(hour)} IST`}
          onChange={(e) => { setPlaying(false); setHour(+e.target.value); }}
          className="absolute inset-x-0 top-[30px] w-full accent-brand"
        />

        {data?.passes.map((p) => (
          <span
            key={p.label}
            title={`${p.label} · ${p.detections} detection${p.detections === 1 ? "" : "s"} · ${p.sky}`}
            className={cn("absolute top-[26px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-surface")}
            style={{ left: `${(p.h / HOURS) * 100}%`, background: SKY_COLOR[p.sky] }}
          />
        ))}

        {DAY_TICKS.map((d) => (
          <span
            key={d}
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap font-mono text-[10.5px] text-ink-3 max-sm:hidden"
            style={{ left: `${((d * 24) / HOURS) * 100}%` }}
          >
            {dayLabel(d * 24)}
          </span>
        ))}
      </div>

      <Tabs value={String(speed)} onValueChange={(v) => setSpeed(Number(v) as 1 | 3 | 6)} className="max-sm:hidden">
        <TabsList aria-label="Replay speed">
          {[1, 3, 6].map((s) => <TabsTrigger key={s} value={String(s)}>{s}×</TabsTrigger>)}
        </TabsList>
      </Tabs>
    </div>
  );
}
