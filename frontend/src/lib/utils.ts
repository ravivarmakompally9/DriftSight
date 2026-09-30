import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Read a CSS design token, so charts and the map follow the theme. */
export function token(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const pct = (p: number | null | undefined, dp = 0) =>
  p === null || p === undefined || Number.isNaN(p) ? "—" : `${(p * 100).toFixed(dp)}%`;

export const num = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString("en-IN");

export const latlon = (lat: number, lon: number) =>
  `${lat.toFixed(3)}°N ${lon.toFixed(3)}°E`;

export const km = (v: number | null | undefined, dp = 1) =>
  v === null || v === undefined ? "—" : `${v.toFixed(dp)} km`;

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
