import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Flag, Map as MapIcon, Plus, Ruler, ScanSearch, Waves, X } from "lucide-react";

import { ConfidenceChart } from "@/components/charts/ConfidenceChart";
import { CreateMissionDialog } from "@/components/CreateMissionDialog";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { EventList } from "@/components/EventList";
import { KpiCard } from "@/components/KpiCard";
import { VerdictBanner } from "@/components/VerdictBanner";
import { MapView } from "@/components/map/MapView";
import { PassStrip } from "@/components/PassStrip";
import { LevelPill } from "@/components/Pills";
import { Row } from "@/components/TrackDetail";
import { Button } from "@/components/ui/button";
import { Card, CardActions, CardBody, CardHeader, CardSub, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDetections, useEvents, useFrame, usePriorities, useSummary, useTimeline, useTracks,
} from "@/hooks/queries";
import { dtIst } from "@/lib/time";
import type { Zone } from "@/lib/types";
import { latlon, num, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function Overview() {
  const navigate = useNavigate();
  const hour = useAppStore((s) => s.hour);
  const select = useAppStore((s) => s.select);
  const [missionZone, setMissionZone] = useState<Zone | null>(null);

  const summary = useSummary(hour);
  const frame = useFrame(hour, false);
  const zones = usePriorities(hour);
  const events = useEvents(hour);
  const tracks = useTracks(hour);
  const timeline = useTimeline();
  const detections = useDetections(hour);

  const s = summary.data;
  const top = zones.data?.[0];
  // sparklines show only the elapsed part of the replay — a KPI must never
  // quietly reveal the future
  const past = (timeline.data?.series ?? []).filter((p) => p.h <= hour);
  const d = s?.delta;

  if (summary.isError) {
    return <ErrorState message={(summary.error as Error).message} retry={() => summary.refetch()} />;
  }

  return (
    <div className="grid gap-4">
      <VerdictBanner headline={s?.headline} loading={summary.isLoading} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          icon={Ruler} tone="crit" label="Plastic afloat" loading={summary.isLoading}
          value={s ? `${num(s.plastic.confirmed_area_m2)} m²` : "—"}
          spark={past.map((p) => p.plastic_m2)}
          delta={d?.at_last_pass ? {
            value: d.at_last_pass.plastic_m2, label: d.at_last_pass.label,
            format: (v) => `${num(v)} m²`, riseIsBad: true,
          } : null}
          sub={s ? (s.plastic.confirmed_fields
            ? `${s.plastic.confirmed_fields} confirmed field${s.plastic.confirmed_fields === 1 ? "" : "s"} · ${s.plastic.confirmed_pitches} football pitches`
            : "none confirmed yet") : undefined}
        />
        <KpiCard
          icon={Waves} tone="warn" label="Coast affected" loading={summary.isLoading}
          value={s ? `${s.coast.km.toFixed(0)} km` : "—"}
          spark={past.map((p) => p.coast_km)}
          delta={d?.last_24h ? {
            value: d.last_24h.coast_km, label: d.last_24h.label,
            format: (v) => `${v.toFixed(1)} km`, riseIsBad: true,
          } : null}
          sub={s ? `${s.coast.district_count} district${s.coast.district_count === 1 ? "" : "s"} · ${s.coast.places.slice(0, 2).join(", ") || "none yet"}` : undefined}
        />
        <KpiCard
          icon={Check} tone="ok" label="Confirmed fields" loading={summary.isLoading}
          value={num(s?.confirmed)}
          spark={past.map((p) => p.confirmed)}
          delta={d?.at_last_pass ? {
            value: d.at_last_pass.confirmed_fields, label: d.at_last_pass.label, riseIsBad: true,
          } : null}
          sub="re-found where the currents predicted"
        />
        <KpiCard
          icon={X} tone="violet" label="Look-alikes rejected" loading={summary.isLoading}
          value={num(s?.rejected)} sub="foam, glint — never sent to the field"
        />
        <KpiCard
          icon={ScanSearch} tone="brand" label="Satellite passes" loading={summary.isLoading}
          value={s ? `${s.passes_done} / ${s.passes_total}` : "—"}
          sub={s ? `${s.detections} candidate detections` : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader>
            <CardTitle>Situation map</CardTitle>
            <CardSub>{dtIst(hour)}</CardSub>
            <CardActions>
              <Button size="sm" onClick={() => navigate("/map")}>
                <MapIcon size={15} />
                Open operations map
              </Button>
            </CardActions>
          </CardHeader>
          <div className="relative mt-3 h-[400px]">
            <MapView
              className="absolute inset-0"
              frame={frame.data}
              zones={zones.data}
              detections={detections.data}
              layers={{ currents: false, pellets: true, tracks: true, detections: true, zones: true, cloud: true, truth: false }}
              interactive={false}
              onSelect={(sel) => { select(sel); navigate("/map"); }}
            />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest alerts</CardTitle>
            <CardActions>
              <Button size="sm" variant="ghost" onClick={() => navigate("/report")}>Situation report</Button>
            </CardActions>
          </CardHeader>
          <CardBody>
            <EventList events={events.data} limit={5} loading={events.isLoading} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confidence per tracked patch</CardTitle>
          <CardSub>
            every step is a satellite pass · confirmed ≥ {pct(s?.params.confirm ?? 0.8)} · rejected below {pct(s?.params.reject ?? 0.25)}
          </CardSub>
        </CardHeader>
        <CardBody>
          {tracks.isLoading ? (
            <Skeleton className="h-[240px]" />
          ) : tracks.data?.length ? (
            <ConfidenceChart tracks={tracks.data} hour={hour} />
          ) : (
            <EmptyState icon={ScanSearch} title="No patches detected yet"
              hint="The first clear satellite pass is 27 May, 11:00 IST." />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Satellite passes</CardTitle>
            <CardSub>click a pass to jump to it</CardSub>
          </CardHeader>
          <CardBody><PassStrip /></CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top priority now</CardTitle></CardHeader>
          <CardBody>
            {zones.isLoading ? (
              <Skeleton className="h-28" />
            ) : top ? (
              <div className="grid gap-2.5">
                <div className="flex items-center gap-2">
                  <LevelPill level={top.level} />
                  <b className="truncate">{top.name}</b>
                </div>
                <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
                  <Row label="Where" value={top.where ?? latlon(top.lat, top.lon)} />
                  {top.area_m2 ? <Row label="How much" value={`${num(top.area_m2)} m²`} /> : null}
                  <Row label="Confidence" value={pct(top.confidence)} />
                  <Row label="Launch from" value={`${top.nearest_harbour} · ${top.harbour_km.toFixed(0)} km`} />
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="default" onClick={() => setMissionZone(top)}>
                    <Plus size={14} />
                    Create mission
                  </Button>
                  <Button size="sm" onClick={() => { select({ type: "zone", id: top.id }); navigate("/map"); }}>
                    View on map
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={Flag} title="No active zones" hint="Nothing needs tasking at this time." />
            )}
          </CardBody>
        </Card>
      </div>

      <CreateMissionDialog zone={missionZone} open={!!missionZone} onOpenChange={(o) => !o && setMissionZone(null)} />
    </div>
  );
}
