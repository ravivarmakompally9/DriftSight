import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon, title, hint, action, className,
}: {
  icon?: LucideIcon; title: string; hint?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("grid place-items-center gap-2 px-6 py-10 text-center", className)}>
      {Icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-sunken text-ink-3">
          <Icon size={18} />
        </span>
      )}
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-[12.5px] text-ink-2">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-10 text-center">
      <p className="text-[13.5px] font-semibold text-crit">Could not load this</p>
      <p className="max-w-sm text-[12.5px] text-ink-2">{message}</p>
      {retry && (
        <button onClick={retry} className="text-[12.5px] font-semibold text-brand underline-offset-4 hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}
