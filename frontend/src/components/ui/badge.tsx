import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-ink-2",
        brand: "bg-brand-soft text-brand",
        ok: "bg-ok-soft text-ok",
        warn: "bg-warn-soft text-warn",
        crit: "bg-crit-soft text-crit",
        violet: "bg-violet-soft text-violet",
        outline: "border border-dashed border-line-strong text-ink-2",
      },
      dot: { true: "", false: "" },
    },
    defaultVariants: { tone: "neutral", dot: false },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, dot, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  ),
);
Badge.displayName = "Badge";
