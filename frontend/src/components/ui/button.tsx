import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand-2 shadow-sm",
        outline: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
        subtle: "bg-sunken text-ink hover:bg-line",
        danger: "bg-crit text-white hover:opacity-90",
        link: "text-brand underline-offset-4 hover:underline",
        navy: "bg-white/10 text-white hover:bg-white/15",
      },
      size: {
        sm: "h-8 px-2.5 text-[12.5px]",
        default: "h-9 px-3.5 text-[13px]",
        lg: "h-11 px-5 text-sm",
        icon: "h-8 w-8",
        "icon-lg": "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
export { buttonVariants };
