import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { CreateMissionDialog } from "@/components/CreateMissionDialog";
import { LayerPanel } from "@/components/map/LayerPanel";
import { MapView } from "@/components/map/MapView";
import { Player } from "@/components/map/Player";
import { StatusPill } from "@/components/Pills";
import { Row, TrackDetail } from "@/components/TrackDetail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ZoneBrief } from "@/components/ZoneBrief";
import {
  useDetections, useEvents, useFrame, useIncident, usePriorities, useSummary, useTracks,
} from "@/hooks/queries";
import { timeLabel } from "@/lib/time";
import type { Zone } from "@/lib/types";
import { num } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function OpsMap() {
  const hour = useAppStore((s) => s.hour);
  const layers = useAppStore((s) => s.layers);
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);
  const traces = useAppStore((s) => s.traces);
  const [missionZone, setMissionZone] = useState<Zone | null>(null);

  const frame = useFrame(hour, layers.truth);
  const zones = usePriorities(hour);
  const detections = useDetections(hour);
  const summary = useSummary(hour);
  const tracks = useTracks(hour);
  const events = useEvents(hour);
  const incident = useIncident();

  const latestEvent = useMemo(
    () => (events.data ?? []).filter((e) => e.h > hour - 14 && !(e.kind === "cloud" && e.track)).slice(-1)[0],
    [events.data, hour],
  );

  const activeTrace = selection?.type === "track" ? traces[selection.id]
    : selection?.type === "zone" ? traces[selection.id]
    : null;

  const s = summary.data;

  return (
    <div className="relative h-full min-h-[560px]">
      <MapView
        className="absolute inset-0"
        frame={frame.data}
        zones={zones.data}
        detections={detections.data}
        backtrace={activeTrace ?? null}
        layers={layers}
        selection={selection}
        onSelect={select}
      />

      <LayerPanel />

      {/* KPI strip */}
      <div className="panel-blur absolute left-[268px] top-4 z-20 flex overflow-hidden rounded-xl border border-line shadow-float max-xl:hidden">
        {[
          { label: "Confirmed", value: num(s?.confirmed), tone: "text-ok" },
          { label: "Watching", value: num(s?.watching), tone: "text-warn" },
          { label: "Rejected", value: num(s?.rejected), tone: "text-crit" },
          { label: "Pellets ashore", value: s ? `${s.pellets.ashore_pct}%` : "—", tone: "" },
          { label: "Top zone", value: zones.data?.[0]?.name ?? "—", tone: "", small: true },
        ].map((k) => (
          <div key={k.label} className="border-l border-line px-3.5 py-2 first:border-l-0">
            <small className="block text-[10.5px] uppercase tracking-wider text-ink-3">{k.label}</small>
            <b className={`font-display leading-tight tnum ${k.small ? "text-[14px]" : "text-[18px]"} ${k.tone}`}>
              {k.value}
            </b>
          </div>
        ))}
      </div>

      {/* event toast */}
      {latestEvent && (
        <div className="panel-blur absolute bottom-[104px] left-1/2 z-20 flex max-w-[min(560px,80vw)] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-line px-3.5 py-2 text-[13px] shadow-float max-sm:hidden">
          <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-2">
            {timeLabel(latestEvent.h)}
          </span>
          <span className="truncate">{latestEvent.text}</span>
        </div>
      )}

      {/* detail drawer */}
      {selection && (
        <aside className="panel-blur absolute bottom-[104px] right-4 top-4 z-20 flex w-[360px] flex-col overflow-hidden rounded-xl border border-line shadow-float max-lg:left-4 max-lg:top-auto max-lg:max-h-[46%] max-lg:w-auto">
          <header className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
            <h3 className="truncate font-display text-[18px] font-bold">
              {selection.type === "wreck" ? "MSC ELSA 3"
                : selection.type === "zone" ? (zones.data?.find((z) => z.id === selection.id)?.name ?? selection.id)
                : selection.id}
            </h3>
            {selection.type === "track" && (() => {
              const t = frame.data?.tracks.find((x) => x.id === selection.id);
              return t ? <StatusPill status={t.status} /> : null;
            })()}
            <Button variant="ghost" size="icon" className="ml-auto" aria-label="Close" onClick={() => select(null)}>
              <X size={16} />
            </Button>
          </header>

          <div className="grid gap-3.5 overflow-y-auto px-3.5 py-3.5">
            {selection.type === "wreck" && (
              <>
                <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
                  <Row label="Flag" value={incident.data?.ship.flag ?? "—"} />
                  <Row label="Route" value={incident.data?.ship.route ?? "—"} />
                  <Row label="Listed" value={incident.data?.ship.listed ?? "—"} />
                  <Row label="Sank" value={incident.data?.ship.sank ?? "—"} />
                  <Row label="Distance offshore" value={`~${incident.data?.ship.offshore_nm ?? 13} nm`} />
                  <Row label="Cargo of concern" value={incident.data?.ship.cargo_of_concern ?? "—"} />
                </dl>
                <p className="text-xs text-ink-3">
                  Position shown is approximate. DriftSight releases {num(s?.pellets.total)} virtual
                  pellets here to forecast where the invisible nurdles land.
                </p>
              </>
            )}

            {selection.type === "zone" && (() => {
              const z = zones.data?.find((q) => q.id === selection.id);
              if (!z) return <p className="text-[13px] text-ink-2">This zone is no longer active at this time.</p>;
              return <ZoneBrief zone={z} onCreate={setMissionZone} />;
            })()}

            {selection.type === "track" && (() => {
              const t = tracks.data?.find((x) => x.id === selection.id);
              if (tracks.isLoading) return <Skeleton className="h-40" />;
              if (!t) return <p className="text-[13px] text-ink-2">This patch has not been detected yet at this time.</p>;
              return <TrackDetail track={t} hour={hour} compact showTruth={layers.truth} />;
            })()}
          </div>
        </aside>
      )}

      <Player />

      <CreateMissionDialog zone={missionZone} open={!!missionZone} onOpenChange={(o) => !o && setMissionZone(null)} />
    </div>
  );
}
