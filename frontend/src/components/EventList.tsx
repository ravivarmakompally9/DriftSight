import { Check, Cloud, Crosshair, Umbrella, Waves, X } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { dtIst } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { DriftEvent } from "@/lib/types";

const ICONS: Record<string, { icon: typeof Check; tone: string }> = {
  match: { icon: Check, tone: "bg-ok-soft text-ok" },
  confirmed: { icon: Check, tone: "bg-ok-soft text-ok" },
  miss: { icon: X, tone: "bg-crit-soft text-crit" },
  rejected: { icon: X, tone: "bg-crit-soft text-crit" },
  cloud: { icon: Cloud, tone: "bg-brand-soft text-brand" },
  landed: { icon: Umbrella, tone: "bg-violet-soft text-violet" },
  new: { icon: Crosshair, tone: "bg-warn-soft text-warn" },
};

export function EventList({
  events, limit = 8, loading, className,
}: { events?: DriftEvent[]; limit?: number; loading?: boolean; className?: string }) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
    );
  }
  const rows = (events ?? [])
    .filter((e) => !(e.kind === "cloud" && e.track))
    .slice(-limit)
    .reverse();

  if (!rows.length) {
    return (
      <EmptyState
        icon={Waves}
        title="No events yet"
        hint="The first clear satellite pass is 27 May, 11:00 IST. Move the time forward in the top bar."
      />
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {rows.map((e, i) => {
        const { icon: Icon, tone } = ICONS[e.kind] ?? ICONS.new;
        return (
          <div key={`${e.h}-${e.track}-${i}`} className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
            <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md", tone)}>
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] leading-snug">{e.text}</p>
              <time className="font-mono text-[11.5px] text-ink-3">{dtIst(e.h)}</time>
            </div>
          </div>
        );
      })}
    </div>
  );
}
