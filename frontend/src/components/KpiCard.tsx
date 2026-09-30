import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONES = {
  brand: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  crit: "bg-crit-soft text-crit",
  violet: "bg-violet-soft text-violet",
} as const;

export function KpiCard({
  icon: Icon, tone = "brand", label, value, sub, loading, className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("grid min-w-0 gap-1.5 p-4", className)}>
      <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink-2">
        <span className={cn("grid h-6 w-6 place-items-center rounded-md", TONES[tone])}>
          <Icon size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <div className="font-display text-[30px] font-bold leading-none tnum">{value}</div>
      )}
      {sub !== undefined && (
        <div className="min-w-0 text-xs text-ink-3">{loading ? <Skeleton className="h-3 w-28" /> : sub}</div>
      )}
    </Card>
  );
}
