import { token } from "./utils";

export type TrackStatus = "confirmed" | "watch" | "rejected" | "landed";

export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  watch: "Watching",
  rejected: "Rejected",
  landed: "Came ashore",
  forecast: "Forecast",
};

/** Resolved at call time so a theme switch repaints the map and the charts. */
export function statusColor(status: string): string {
  switch (status) {
    case "confirmed": return token("--ok");
    case "rejected": return token("--crit");
    case "landed": return token("--violet");
    default: return token("--warn");
  }
}

export function levelColor(level: string): string {
  switch (level) {
    case "HIGH": return token("--crit");
    case "MEDIUM": return token("--warn");
    default: return token("--text-3");
  }
}

export const SERIES = [
  "--brand", "--pellet", "--violet", "--crit", "--ok", "--current",
] as const;

export const seriesColor = (i: number) => token(SERIES[i % SERIES.length]);
