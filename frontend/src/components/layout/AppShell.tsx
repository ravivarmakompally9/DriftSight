import { Outlet, useLocation } from "react-router-dom";

import { useReplayClock } from "@/components/layout/AsOfControl";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { pathname } = useLocation();
  const flush = pathname === "/map";
  useReplayClock();

  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
        <Topbar />
        <main
          id="main"
          className={cn("min-h-0 min-w-0", flush ? "overflow-hidden" : "overflow-y-auto px-4 pb-10 pt-5 sm:px-6")}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
