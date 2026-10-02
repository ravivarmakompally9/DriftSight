import { GitBranch, ImageIcon, MapPin, Ruler } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ConfidenceChart } from "@/components/charts/ConfidenceChart";
import { TrackRecord } from "@/components/TrackRecord";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBacktrace } from "@/hooks/queries";
import { dtIst } from "@/lib/time";
import type { Track } from "@/lib/types";
import { cn, km, num, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

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
  const navigate = useNavigate();
  const trace = useAppStore((s) => s.traces[track.id]);
  const backtrace = useBacktrace();
  const latest = track.latest_detection;

  return (
    <div className="grid gap-4">
      {/* ---- the headline: how sure, how much, where ---- */}
      <div className="grid gap-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[36px] font-bold leading-none tnum">{pct(track.confidence)}</span>
          <span className="text-[13px] text-ink-2">confidence it is real floating plastic</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
          <span className="flex items-center gap-1.5">
            <Ruler size={13} className="text-ink-3" />
            <b className="tnum">{num(track.area_m2)} m²</b>
            {track.pitches ? <span className="text-ink-3">{track.pitches} pitches</span> : null}
          </span>
          {track.where && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-ink-3" />
              <b>{track.where}</b>
            </span>
          )}
        </div>
      </div>

      {/* ---- the argument: what every pass did ---- */}
      <TrackRecord track={track} hour={hour} />

      {!compact && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            Confidence over the replay
          </p>
          <ConfidenceChart tracks={[track]} hour={hour} height={130} legend={false} />
        </div>
      )}

      {/* ---- provenance ---- */}
      <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
        <Row label="First seen" value={track.born_at} />
        <Row label="Sightings" value={`${track.sightings} across ${track.history.length} passes`} />
        {track.landed_hour !== null && <Row label="Came ashore" value={dtIst(track.landed_hour)} />}
        {showTruth && (
          <Row label="Hidden truth" tone="text-violet"
               value={track.truth.real ? "real debris" : `${track.truth.origin} look-alike`} />
        )}
      </dl>

      {latest && (
        <Button size="sm" variant="ghost" className="justify-start px-0 text-brand"
                onClick={() => navigate("/detections")}>
          <ImageIcon size={14} />
          See the {latest.sensor} image behind the latest sighting
        </Button>
      )}

      {/* ---- did it come from the wreck? ---- */}
      <div className="rounded-lg border border-line bg-surface-2 p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <GitBranch size={15} className="text-ink-2" />
          <b className="text-[13.5px]">Source trace</b>
        </div>
        {trace ? (
          <>
            <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
              <Row label="Match to MSC ELSA 3" value={pct(trace.score)}
                   tone={trace.score > 0.5 ? "text-ok" : "text-ink-2"} />
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
              Run the drift model backwards from the first sighting to test whether this patch
              came from the wreck.
            </p>
            <Button size="sm" onClick={() => backtrace.mutate(track.id)}>
              <GitBranch size={14} />
              Trace to source
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
