import { Cloud, CloudSun, Satellite } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { usePasses } from "@/hooks/queries";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const SKY = {
  clear: { icon: Satellite, tone: "text-ok" },
  cloud: { icon: Cloud, tone: "text-ink-3" },
  partial: { icon: CloudSun, tone: "text-warn" },
} as const;

export function PassStrip() {
  const { data, isLoading } = usePasses();
  const hour = useAppStore((s) => s.hour);
  const setHour = useAppStore((s) => s.setHour);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[74px]" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {data.map((p) => {
        const { icon: Icon, tone } = SKY[p.sky];
        const now = hour >= p.h && hour < p.h + 24;
        return (
          <button
            key={p.label}
            onClick={() => setHour(p.h + 1)}
            aria-current={now ? "true" : undefined}
            className={cn(
              "grid gap-0.5 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-left transition-shadow hover:border-line-strong",
              now && "border-brand ring-2 ring-brand-soft",
            )}
          >
            <b className="font-display text-sm">{p.label}</b>
            <small className="truncate text-[11px] text-ink-3">{p.sensor}</small>
            <span className={cn("flex items-center gap-1.5 text-[11.5px] font-semibold", tone)}>
              <Icon size={12} />
              {p.sky_label}
            </span>
            <small className="text-[11px] text-ink-3">
              {p.sky === "cloud" ? "no detections" : `${p.detections ?? 0} detection${p.detections === 1 ? "" : "s"}`}
            </small>
          </button>
        );
      })}
    </div>
  );
}
