import { GitBranch, Plus } from "lucide-react";

import { LevelPill } from "@/components/Pills";
import { Row } from "@/components/TrackDetail";
import { Button } from "@/components/ui/button";
import { useBacktrace } from "@/hooks/queries";
import { dayLabel, dtIst } from "@/lib/time";
import type { Zone } from "@/lib/types";
import { latlon, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export function ZoneBrief({ zone, onCreate }: { zone: Zone; onCreate: (z: Zone) => void }) {
  const trace = useAppStore((s) => s.traces[zone.id]);
  const backtrace = useBacktrace();

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <LevelPill level={zone.level} />
        <span className="text-[13px] text-ink-2">
          {zone.kind === "sea" ? "Floating debris at sea" : "Forecast pellet landfall"}
        </span>
      </div>

      <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
        <Row label="Target" value={latlon(zone.lat, zone.lon)} />
        <Row
          label="Window"
          value={zone.kind === "sea" ? "next 24–48 h" : `${dtIst(zone.window[0])} → ${dayLabel(zone.window[1])}`}
        />
        <Row label="Confidence" value={pct(zone.confidence)} />
        {zone.kind === "sea"
          ? <Row label="Distance to coast" value={`${zone.coast_km} km`} />
          : <Row label="Pellets due (72 h)" value={`${((zone.share ?? 0) * 100).toFixed(1)}%`} />}
        <Row label="Nearest harbour" value={`${zone.nearest_harbour} · ${zone.harbour_km.toFixed(0)} km`} />
        <Row
          label="Source"
          value={zone.kind === "sea"
            ? (trace ? `${pct(trace.score)} match to ELSA 3` : "trace not run")
            : "ELSA 3 pellet forecast"}
        />
      </dl>

      <p className="text-xs text-ink-3">Recommended: {zone.action.charAt(0).toLowerCase() + zone.action.slice(1)}</p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="default" onClick={() => onCreate(zone)}>
          <Plus size={14} />
          Create mission
        </Button>
        {zone.kind === "sea" && !trace && (
          <Button size="sm" onClick={() => backtrace.mutate(zone.id)} disabled={backtrace.isPending}>
            <GitBranch size={14} />
            {backtrace.isPending ? "Tracing…" : "Trace source"}
          </Button>
        )}
      </div>
    </div>
  );
}
