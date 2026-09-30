import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { api, tokenStore } from "@/lib/api";
import { HOURS } from "@/lib/time";
import { clamp } from "@/lib/utils";
import type { Backtrace, User } from "@/lib/types";

export type Theme = "light" | "dark" | "system";
export type Selection =
  | { type: "track"; id: string }
  | { type: "zone"; id: string }
  | { type: "wreck" }
  | null;

export interface LayerState {
  currents: boolean; pellets: boolean; tracks: boolean;
  detections: boolean; zones: boolean; cloud: boolean; truth: boolean;
}

interface AppState {
  /** Global "as of" hour, shared by every page. */
  hour: number;
  playing: boolean;
  speed: 1 | 3 | 6;
  runId: number | "latest";
  selection: Selection;
  layers: LayerState;
  theme: Theme;
  user: User | null;
  navOpen: boolean;
  /** Reverse-drift results, kept per track for the current session. */
  traces: Record<string, Backtrace>;

  setHour: (h: number) => void;
  nudgeHour: (delta: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlaying: () => void;
  setSpeed: (s: 1 | 3 | 6) => void;
  setRunId: (id: number | "latest") => void;
  select: (s: Selection) => void;
  toggleLayer: (k: keyof LayerState) => void;
  setTheme: (t: Theme) => void;
  setUser: (u: User | null) => void;
  setNavOpen: (o: boolean) => void;
  setTrace: (t: Backtrace) => void;
  signOut: () => void;
}

export function applyTheme(theme: Theme) {
  const dark = theme === "dark"
    || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.documentElement.dataset.themePref = theme;
  // Let listeners (map, charts) know the tokens changed.
  window.dispatchEvent(new CustomEvent("ds-theme", { detail: { theme, dark } }));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 1 Jun 12:00 IST — just after the 1 Jun pass, where the story reads best:
      // two patches confirmed, the first look-alike already rejected.
      hour: 180,
      playing: false,
      speed: 3,
      runId: "latest",
      selection: null,
      layers: {
        currents: true, pellets: true, tracks: true,
        detections: true, zones: true, cloud: true, truth: false,
      },
      theme: "system",
      user: null,
      navOpen: false,
      traces: {},

      setHour: (h) => set({ hour: clamp(Math.round(h), 0, HOURS) }),
      nudgeHour: (d) => set({ hour: clamp(get().hour + d, 0, HOURS) }),
      setPlaying: (playing) => set({ playing }),
      togglePlaying: () => set({ playing: !get().playing }),
      setSpeed: (speed) => set({ speed }),
      setRunId: (runId) => set({ runId }),
      select: (selection) => set({ selection }),
      toggleLayer: (k) => set({ layers: { ...get().layers, [k]: !get().layers[k] } }),
      setTheme: (theme) => { applyTheme(theme); set({ theme }); },
      setUser: (user) => set({ user }),
      setNavOpen: (navOpen) => set({ navOpen }),
      setTrace: (t) => set({ traces: { ...get().traces, [t.track]: t } }),
      signOut: () => { tokenStore.set(null); set({ user: null }); },
    }),
    {
      name: "ds-app",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ layers: s.layers, theme: s.theme, speed: s.speed, user: s.user }),
      onRehydrateStorage: () => (state) => { if (state) applyTheme(state.theme); },
    },
  ),
);

/** Restore a session on boot: a stored token still has to be accepted by the API. */
export async function restoreSession() {
  if (!tokenStore.get()) { useAppStore.getState().setUser(null); return; }
  try {
    useAppStore.getState().setUser(await api.me());
  } catch {
    useAppStore.getState().signOut();
  }
}
