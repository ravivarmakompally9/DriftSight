import { NavLink } from "react-router-dom";

import { LogoMark, Wordmark } from "@/components/Logo";
import { NAV } from "@/components/layout/nav";
import { useIncident, useMissions, useSummary } from "@/hooks/queries";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const navOpen = useAppStore((s) => s.navOpen);
  const setNavOpen = useAppStore((s) => s.setNavOpen);
  const user = useAppStore((s) => s.user);
  const hour = useAppStore((s) => s.hour);
  const { data: incident } = useIncident();
  const { data: summary } = useSummary(hour);
  const { data: missions } = useMissions();

  const counters: Record<string, number> = {
    detections: summary?.detections ?? 0,
    zones: summary?.high_priority ?? 0,
    missions: (missions ?? []).filter((m) => m.status !== "completed").length,
  };

  let lastGroup = "";
  return (
    <>
      {navOpen && (
        <button
          className="fixed inset-0 z-[45] bg-black/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col gap-4 overflow-y-auto bg-navy px-3.5 py-4 text-onnavy",
          "transition-transform duration-200 lg:static lg:z-auto lg:w-[248px] lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-1.5 pt-0.5">
          <LogoMark />
          <Wordmark />
        </div>

        <div className="grid gap-1 rounded-lg border border-white/[0.07] bg-navy-2 px-3 py-2.5">
          <small className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-onnavy-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F2685F] shadow-[0_0_0_3px_rgba(242,104,95,.25)]" />
            Active incident
          </small>
          <strong className="text-sm text-white">{incident?.name ?? "MSC ELSA 3 · Kerala"}</strong>
          <span className="text-xs leading-snug text-onnavy-2">
            {incident?.subtitle ?? "Container ship sank 25 May 2025 · nurdle spill"}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const head = item.group !== lastGroup ? ((lastGroup = item.group), item.group) : null;
            const count = item.counter ? counters[item.counter] : 0;
            return (
              <div key={item.to}>
                {head && (
                  <div className="px-2.5 pb-1 pt-3 text-[10.5px] uppercase tracking-[1px] text-onnavy-2">{head}</div>
                )}
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                      isActive ? "bg-[rgba(90,214,214,.13)] text-white" : "text-onnavy hover:bg-white/5",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={isActive ? "text-[#5AD6D6]" : undefined} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px font-mono text-[11px] font-semibold tnum",
                            item.counter === "zones" ? "bg-crit text-white" : "bg-white/10 text-onnavy",
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </div>
            );
          })}
        </div>

        <div className="mt-auto flex items-center gap-2.5 border-t border-white/[0.07] px-2 pt-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1D4F59] font-display text-[13px] font-bold text-[#BDF0F0]">
            {user?.initials ?? "··"}
          </span>
          <div className="min-w-0 text-[12.5px] leading-tight">
            <div className="truncate">{user?.name ?? "Signed out"}</div>
            <small className="truncate text-onnavy-2">{user?.org ?? ""}</small>
          </div>
        </div>
      </nav>
    </>
  );
}
