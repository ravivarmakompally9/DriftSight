import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { LogoMark, Wordmark } from "@/components/Logo";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import { restoreSession, useAppStore } from "@/store/useAppStore";

const OpsMap = lazy(() => import("@/pages/OpsMap"));
const Detections = lazy(() => import("@/pages/Detections"));
const Tracks = lazy(() => import("@/pages/Tracks"));
const Forecast = lazy(() => import("@/pages/Forecast"));
const Missions = lazy(() => import("@/pages/Missions"));
const Report = lazy(() => import("@/pages/Report"));
const DataModels = lazy(() => import("@/pages/DataModels"));

/** GitHub Pages cannot rewrite deep links to index.html, so the static build routes on the hash. */
const Router = import.meta.env.VITE_STATIC ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function Splash({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-navy text-center text-onnavy">
      <div>
        <div className="flex items-center justify-center gap-3">
          <LogoMark size={38} />
          <Wordmark className="text-[38px]" />
        </div>
        <p className="mt-2 text-[13.5px] text-onnavy-2">{message}</p>
        <div className="mx-auto mt-5 h-1 w-[220px] overflow-hidden rounded-full bg-white/10">
          <i className="block h-full w-2/5 animate-slide rounded-full bg-[#5AD6D6]" />
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setBooted(true));
  }, []);

  if (!booted) return <Splash message="Connecting to the DriftSight API…" />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<Overview />} />
              <Route path="map" element={<Suspense fallback={<Splash message="Loading the operations map…" />}><OpsMap /></Suspense>} />
              <Route path="detections" element={<Suspense fallback={null}><Detections /></Suspense>} />
              <Route path="tracks" element={<Suspense fallback={null}><Tracks /></Suspense>} />
              <Route path="forecast" element={<Suspense fallback={null}><Forecast /></Suspense>} />
              <Route path="missions" element={<Suspense fallback={null}><Missions /></Suspense>} />
              <Route path="report" element={<Suspense fallback={null}><Report /></Suspense>} />
              <Route path="data" element={<Suspense fallback={null}><DataModels /></Suspense>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "Figtree, system-ui, sans-serif",
              fontSize: "13px",
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
