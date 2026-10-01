import { AlertTriangle, CheckCircle2, Eye, MapPin, Ruler, Satellite, Waves } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Headline } from "@/lib/types";
import { cn, num } from "@/lib/utils";

const TONE = {
  crit: { bar: "bg-crit", chip: "bg-crit-soft text-crit", icon: AlertTriangle },
  warn: { bar: "bg-warn", chip: "bg-warn-soft text-warn", icon: Eye },
  ok: { bar: "bg-ok", chip: "bg-ok-soft text-ok", icon: CheckCircle2 },
  neutral: { bar: "bg-line-strong", chip: "bg-sunken text-ink-2", icon: Satellite },
} as const;

/**
 * The first thing on the screen, and the only thing that has to be read: is
 * there plastic, where is it, how much. Everything else on the page is
 * supporting evidence for this sentence.
 */
export function VerdictBanner({ headline, loading }: { headline?: Headline; loading?: boolean }) {
  if (loading || !headline) {
    return (
      <div className="card-surface flex gap-4 overflow-hidden p-0">
        <div className="w-1.5 bg-sunken" />
        <div className="flex-1 space-y-2 py-4 pr-4">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
      </div>
    );
  }

  const tone = TONE[headline.tone] ?? TONE.neutral;
  const Icon = tone.icon;
  const { afloat, coast, mass } = headline;

  return (
    <section
      className="card-surface flex overflow-hidden"
      aria-label="Current assessment"
    >
      <div className={cn("w-1.5 shrink-0", tone.bar)} aria-hidden />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold", tone.chip)}>
            <Icon size={13} />
            {headline.verdict}
          </span>
          <span className="font-mono text-[12px] text-ink-3">as of {headline.as_of}</span>
        </div>

        <p className="mt-2 max-w-4xl text-[16px] leading-relaxed text-ink">
          {headline.sentence}
        </p>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          <Fact
            icon={Ruler}
            label="Plastic afloat"
            value={afloat.confirmed_area_m2 > 0
              ? `${num(afloat.confirmed_area_m2)} m²`
              : afloat.watching_area_m2 > 0 ? `${num(afloat.watching_area_m2)} m² unconfirmed` : "none"}
            sub={afloat.confirmed_fields > 0
              ? `${afloat.confirmed_fields} confirmed field${afloat.confirmed_fields === 1 ? "" : "s"}`
              : `${afloat.watching_fields} candidate${afloat.watching_fields === 1 ? "" : "s"}`}
          />
          <Fact
            icon={MapPin}
            label="Nearest field"
            value={afloat.largest ? afloat.largest.where : "—"}
            sub={afloat.largest ? `boat from ${afloat.largest.nearest_harbour}` : undefined}
          />
          <Fact
            icon={Waves}
            label="Coast affected"
            value={coast.km > 0 ? `${coast.km.toFixed(0)} km` : "none yet"}
            sub={coast.places.length ? coast.places.slice(0, 3).join(" · ") : undefined}
          />
          {mass && (
            <Fact
              icon={AlertTriangle}
              label="Est. pellets ashore"
              value={`${mass.ashore_tonnes} t`}
              sub={`assumes ${mass.assumed_release_tonnes} t released`}
              assumption
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Fact({
  icon: Icon, label, value, sub, assumption,
}: {
  icon: typeof MapPin; label: string; value: string; sub?: string; assumption?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-3">
        <Icon size={11} />
        {label}
      </div>
      <div className="mt-0.5 font-semibold tnum">{value}</div>
      {sub && (
        <div className={cn("text-[11.5px]", assumption ? "italic text-warn" : "text-ink-3")}>{sub}</div>
      )}
    </div>
  );
}
