import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { usePasses } from "@/hooks/queries";
import { dtLabel, HOURS } from "@/lib/time";
import { useAppStore } from "@/store/useAppStore";

/** Drives the replay clock. One interval for the whole app, owned here. */
export function useReplayClock() {
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const { hour, setHour, setPlaying } = useAppStore.getState();
      if (hour >= HOURS) { setPlaying(false); return; }
      setHour(Math.min(HOURS, hour + speed));
    }, 120);
    return () => window.clearInterval(id);
  }, [playing, speed]);
}

export function AsOfControl() {
  const hour = useAppStore((s) => s.hour);
  const setHour = useAppStore((s) => s.setHour);
  const playing = useAppStore((s) => s.playing);
  const toggle = useAppStore((s) => s.togglePlaying);
  const { data: passes } = usePasses();

  const { prev, next } = useMemo(() => {
    const list = passes ?? [];
    return {
      prev: [...list].reverse().find((p) => p.h + 1 < hour),
      next: list.find((p) => p.h >= hour),
    };
  }, [passes, hour]);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5" role="group" aria-label="Analysis time">
      <Hint label={prev ? `Previous pass — ${prev.label}` : "No earlier pass"}>
        <Button variant="ghost" size="icon" disabled={!prev} onClick={() => prev && setHour(prev.h + 1)} aria-label="Previous satellite pass">
          <ChevronLeft size={16} />
        </Button>
      </Hint>
      <div className="px-2 text-center">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-ink-3 max-sm:hidden">As of</span>
        <span className="block whitespace-nowrap font-mono text-[13px] tnum">{dtLabel(hour)} IST</span>
      </div>
      <Hint label={next ? `Next pass — ${next.label}` : "No later pass"}>
        <Button variant="ghost" size="icon" disabled={!next} onClick={() => next && setHour(next.h + 1)} aria-label="Next satellite pass">
          <ChevronRight size={16} />
        </Button>
      </Hint>
      <Hint label={playing ? "Pause replay" : "Play replay"}>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={playing ? "Pause replay" : "Play replay"}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </Button>
      </Hint>
    </div>
  );
}
