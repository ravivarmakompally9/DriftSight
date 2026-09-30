import * as React from "react";
import { cn } from "@/lib/utils";

export function TableWrap({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn("w-full border-collapse text-[13px]", className)} {...props} />
  ),
);
Table.displayName = "Table";

export function Th({ className, numeric, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-line px-3.5 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-3",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn("whitespace-nowrap border-b border-line px-3.5 py-2.5", numeric && "text-right font-mono tnum", className)}
      {...props}
    />
  );
}

export function Tr({ className, selected, clickable, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; clickable?: boolean }) {
  return (
    <tr
      aria-selected={selected}
      className={cn(clickable && "cursor-pointer hover:bg-surface-2", selected && "bg-brand-soft", className)}
      {...props}
    />
  );
}
