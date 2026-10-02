import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, token } from "@/lib/utils";

const TONES = {
  brand: { chip: "bg-brand-soft text-brand", line: "--brand" },
  ok: { chip: "bg-ok-soft text-ok", line: "--ok" },
  warn: { chip: "bg-warn-soft text-warn", line: "--warn" },
  crit: { chip: "bg-crit-soft text-crit", line: "--crit" },
  violet: { chip: "bg-violet-soft text-violet", line: "--violet" },
} as const;

export interface KpiDelta {
  /** Signed change. 0 renders as "no change" rather than a misleading arrow. */
  value: number;
  /** What it changed against, e.g. "at the 30 May pass". */
  label: string;
  format?: (v: number) => string;
  /** True when a rise is bad news — more plastic, more coast hit. */
  riseIsBad?: boolean;
}

export function KpiCard({
  icon: Icon, tone = "brand", label, value, sub, loading, delta, spark, className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
  delta?: KpiDelta | null;
  /** Series for the background sparkline; drawn only when it actually varies. */
  spark?: number[];
  className?: string;
}) {
  const t = TONES[tone];

  const path = useMemo(() => {
    // Drop anything non-finite before measuring: a single undefined from a
    // stale API shape would otherwise poison the whole path with NaN.
    const pts0 = (spark ?? []).filter((v) => Number.isFinite(v));
    if (pts0.length < 3) return null;
    const lo = Math.min(...pts0);
    const hi = Math.max(...pts0);
    if (hi - lo < 1e-9) return null;
    const series = pts0;
    const W = 100, H = 28;
    const pts = series.map((v, i) => {
      const x = (i / (series.length - 1)) * W;
      const y = H - ((v - lo) / (hi - lo)) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { line: `M${pts.join(" L")}`, area: `M0,${H} L${pts.join(" L")} L${W},${H} Z` };
  }, [spark]);

  return (
    <Card className={cn("group relative grid gap-2 overflow-hidden p-4", className)}>
      {path && (
        <svg
          viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-11 w-full opacity-55 transition-opacity group-hover:opacity-80"
        >
          <defs>
            <linearGradient id={`spark-${label.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={token(t.line)} stopOpacity="0.28" />
              <stop offset="100%" stopColor={token(t.line)} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={path.area} fill={`url(#spark-${label.replace(/\W/g, "")})`} />
          <path d={path.line} fill="none" stroke={token(t.line)} strokeWidth="1.25"
                vectorEffect="non-scaling-stroke" strokeOpacity="0.8" />
        </svg>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md", t.chip)}>
          <Icon size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          {label}
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-[32px] font-bold leading-none tnum">{value}</span>
          {delta && <DeltaChip {...delta} />}
        </div>
      )}

      {sub !== undefined && (
        <div className="min-w-0 text-[12px] leading-snug text-ink-3">
          {loading ? <Skeleton className="h-3 w-28" /> : sub}
        </div>
      )}
    </Card>
  );
}

function DeltaChip({ value, label, format, riseIsBad }: KpiDelta) {
  const flat = value === 0;
  const up = value > 0;
  const bad = riseIsBad ? up : !up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const text = flat ? "no change" : `${up ? "+" : "−"}${format ? format(Math.abs(value)) : Math.abs(value)}`;

  return (
    <span
      title={flat ? `No change ${label}` : `${text} ${label}`}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tnum",
        flat ? "bg-sunken text-ink-3" : bad ? "bg-crit-soft text-crit" : "bg-ok-soft text-ok",
      )}
    >
      <Icon size={11} />
      {text}
    </span>
  );
}
