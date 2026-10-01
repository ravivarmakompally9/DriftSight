import { Check, Cloud, Crosshair, GitBranch, Umbrella, X } from "lucide-react";

import { ChipPair } from "@/components/ChipCanvas";
import { ConfidenceChart } from "@/components/charts/ConfidenceChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBacktrace } from "@/hooks/queries";
import { dtIst } from "@/lib/time";
import type { Track } from "@/lib/types";
import { cn, km, latlon, num, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const EVENT_ICON: Record<string, typeof Check> = {
  match: Check, confirmed: Check, miss: X, rejected: X, cloud: Cloud, landed: Umbrella, new: Crosshair,
};
const EVENT_TONE: Record<string, string> = {
  match: "bg-ok-soft text-ok", confirmed: "bg-ok-soft text-ok",
  miss: "bg-crit-soft text-crit", rejected: "bg-crit-soft text-crit",
  cloud: "bg-brand-soft text-brand", landed: "bg-violet-soft text-violet",
  new: "bg-warn-soft text-warn",
};

export function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <>
      <dt className="text-ink-2">{label}</dt>
      <dd className={cn("m-0 max-w-[240px] text-right font-mono text-[12.5px]", tone)}>{value}</dd>
    </>
  );
}

export function TrackDetail({
  track, hour, compact = false, showTruth = false,
}: { track: Track; hour: number; compact?: boolean; showTruth?: boolean }) {
  const trace = useAppStore((s) => s.traces[track.id]);
  const backtrace = useBacktrace();
  const errors = track.forecast_errors;

  return (
    <div className="grid gap-3.5">
      <div className="grid gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[34px] font-bold leading-none tnum">{pct(track.confidence)}</span>
          <span className="text-[13px] text-ink-2">confidence it is real floating plastic</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
          <span>
            <span className="text-ink-3">How much </span>
            <b className="tnum">{num(track.area_m2)} m²</b>
            {track.pitches ? <span className="text-ink-3"> · {track.pitches} pitches</span> : null}
          </span>
          {track.where && (
            <span><span className="text-ink-3">Where </span><b>{track.where}</b></span>
          )}
        </div>
      </div>

      <ConfidenceChart tracks={[track]} hour={hour} height={140} legend={false} />

      {track.latest_detection?.chip && (
        <div>
          <p className="mb-1.5 text-xs text-ink-2">
            Latest sighting · {track.latest_detection.sensor} · {track.latest_detection.as_of}
          </p>
          <ChipPair chip={track.latest_detection.chip} />
        </div>
      )}

      <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
        <Row label="First seen" value={track.born_at} />
        <Row label="Sightings" value={track.sightings} />
        {track.centroid && <Row label="Now (forecast)" value={latlon(track.centroid[1], track.centroid[0])} />}
        {errors.length > 0 && (
          <Row label="Forecast miss before fix" value={errors.map((e) => e.km.toFixed(1)).join(", ") + " km"} />
        )}
        {track.landed_hour !== null && <Row label="Came ashore" value={dtIst(track.landed_hour)} />}
        {showTruth && (
          <Row
            label="Hidden truth"
            tone="text-violet"
            value={track.truth.real ? "real debris" : `${track.truth.origin} look-alike`}
          />
        )}
      </dl>

      <div className="rounded-lg border border-line bg-surface-2 p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <GitBranch size={15} className="text-ink-2" />
          <b className="text-[13.5px]">Source trace</b>
        </div>
        {trace ? (
          <>
            <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
              <Row
                label="Match to MSC ELSA 3"
                value={pct(trace.score)}
                tone={trace.score > 0.5 ? "text-ok" : "text-ink-2"}
              />
              <Row label="Closest approach" value={`${km(trace.closest_km)} · ${trace.closest_at}`} />
            </dl>
            <p className="mt-2 text-xs text-ink-3">
              The dashed violet line on the map is the reverse drift path.
            </p>
          </>
        ) : backtrace.isPending ? (
          <Skeleton className="h-9" />
        ) : (
          <>
            <p className="mb-2 text-xs text-ink-3">
              Run the drift model backwards from the first sighting to test whether this patch came from the wreck.
            </p>
            <Button size="sm" onClick={() => backtrace.mutate(track.id)}>
              <GitBranch size={14} />
              Trace to source
            </Button>
          </>
        )}
      </div>

      {!compact && track.events.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-ink-2">History</p>
          <div className="flex flex-col">
            {track.events.map((e, i) => {
              const Icon = EVENT_ICON[e.kind] ?? Crosshair;
              return (
                <div key={i} className="flex items-start gap-2.5 border-t border-line py-2 first:border-t-0 first:pt-0">
                  <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md", EVENT_TONE[e.kind])}>
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug">{e.text}</p>
                    <time className="font-mono text-[11px] text-ink-3">{dtIst(e.h)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
