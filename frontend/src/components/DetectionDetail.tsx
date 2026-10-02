import { ArrowRight, Check, Clock, MapPin, Ruler, Satellite, X } from "lucide-react";

import { SpectrumChart } from "@/components/charts/SpectrumChart";
import { LikelihoodMeter } from "@/components/LikelihoodMeter";
import { StatusPill } from "@/components/Pills";
import { Button } from "@/components/ui/button";
import { Card, CardActions, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Detection, ModelReport } from "@/lib/types";
import { cn, num } from "@/lib/utils";

const CHIP_SPAN_M = 240;

/**
 * The chips are the only real pixels in the product. They were being shown at
 * thumbnail size inside a stats list; here they lead, at a size you can
 * actually judge, with the scale they cover and the verdict that followed.
 */
export function DetectionDetail({
  detection, model, onShowOnMap, loading,
}: {
  detection?: Detection;
  model?: ModelReport;
  onShowOnMap: () => void;
  loading?: boolean;
}) {
  if (loading || !detection) {
    return (
      <Card className="p-4">
        <Skeleton className="mb-3 h-5 w-24" />
        <Skeleton className="mb-3 aspect-[2/1] w-full" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  const d = detection;
  const outcome = d.outcome;
  const confirmed = outcome?.status === "confirmed";
  const rejected = outcome?.status === "rejected";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-[15px]">{d.ref}</CardTitle>
        <StatusPill status={d.status} />
        <CardActions>
          <Button size="sm" onClick={onShowOnMap}>
            <MapPin size={14} />
            Show on map
          </Button>
        </CardActions>
      </CardHeader>

      {/* ---- the evidence, at a size worth looking at ---- */}
      <div className="grid grid-cols-2 gap-px bg-line">
        <figure className="relative bg-surface">
          {d.thumb && (
            <img src={d.thumb} alt="True-colour satellite chip"
                 className="block aspect-square w-full [image-rendering:pixelated]" />
          )}
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-1.5 pt-6 text-[11px] font-medium text-white">
            True colour · B4 B3 B2
          </figcaption>
        </figure>
        <figure className="relative bg-surface">
          {d.thumb_probability && (
            <img src={d.thumb_probability} alt="Per-pixel plastic probability"
                 className="block aspect-square w-full [image-rendering:pixelated]" />
          )}
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-1.5 pt-6 text-[11px] font-medium text-white">
            Plastic probability
          </figcaption>
        </figure>
      </div>

      {/* scale bar: the chips mean nothing without knowing what they cover */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-9 border-x border-b border-ink-3" aria-hidden />
          {CHIP_SPAN_M} m
        </span>
        <span>10 m pixels</span>
        <span>{d.sensor}</span>
        <span className="ml-auto whitespace-nowrap font-mono">
          {d.lat.toFixed(3)}°N {d.lon.toFixed(3)}°E
        </span>
      </div>

      <CardBody className="grid gap-4">
        {/* ---- what the detector said, and what became of it ---- */}
        <div className="grid gap-2">
          <Fact icon={Satellite} label="Flagged" value={`${d.as_of} · ${d.pass} pass`} />
          <Fact icon={Ruler} label="How much" value={d.area_phrase ?? `${num(d.area_m2)} m²`} />
          <Fact icon={MapPin} label="Where" value={d.where ?? ""} />
          <div className="flex items-center gap-2 text-[13px]">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sunken text-ink-3">
              <Check size={13} />
            </span>
            <span className="w-[86px] shrink-0 text-ink-3">Likelihood</span>
            <LikelihoodMeter value={d.score} width={90} />
          </div>
        </div>

        {outcome && (
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
              confirmed ? "border-ok/30 bg-ok-soft" : rejected ? "border-crit/30 bg-crit-soft" : "border-line bg-surface-2",
            )}
          >
            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
              confirmed ? "bg-ok text-white" : rejected ? "bg-crit text-white" : "bg-line-strong text-ink-2")}>
              {confirmed ? <Check size={12} /> : rejected ? <X size={12} /> : <Clock size={12} />}
            </span>
            <div className="min-w-0 text-[12.5px] leading-snug">
              <p className={cn("font-semibold", confirmed ? "text-ok" : rejected ? "text-crit" : "text-ink")}>
                {outcome.text}
              </p>
              <p className="mt-0.5 text-ink-2">
                {outcome.decided_at
                  ? <>Decided at the {outcome.decided_pass} pass · {outcome.sightings} sighting{outcome.sightings === 1 ? "" : "s"} in total</>
                  : <>{outcome.sightings} sighting{outcome.sightings === 1 ? "" : "s"} so far</>}
              </p>
            </div>
          </div>
        )}

        {/* ---- why the detector thought so ---- */}
        {d.spectrum && model && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Spectral signature
            </p>
            <SpectrumChart
              detected={d.spectrum.detected}
              water={d.spectrum.water}
              reference={model.spectra.debris}
              height={170}
            />
            <p className="text-[11.5px] leading-snug text-ink-3">
              Floating plastic lifts the near-infrared band (B8) above what water does.
              Mean FDI here is <b className="font-mono text-ink-2">{d.fdi.toFixed(3)}</b> against
              roughly <b className="font-mono text-ink-2">0.00</b> for open water — that gap is the signal.
            </p>
          </div>
        )}

        <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
          A single image cannot separate plastic from look-alikes reliably. DriftSight waits
          for the next clear pass: real debris re-appears where the currents predicted.
        </p>
      </CardBody>
    </Card>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sunken text-ink-3">
        <Icon size={13} />
      </span>
      <span className="w-[86px] shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{value}</span>
    </div>
  );
}

export { ArrowRight };
