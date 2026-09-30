import type { StyleSpecification } from "maplibre-gl";

import { token } from "@/lib/utils";

/**
 * CARTO's free raster-free vector basemaps. No API key, no account, and the
 * light/dark pair matches our own theme closely enough to live under it.
 */
export const CARTO = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

/**
 * If CARTO cannot be reached -- offline demo, locked-down network -- fall back
 * to drawing the coastline we already hold server-side. The console keeps
 * working; it just loses the street-level context.
 */
export function offlineStyle(coastline: GeoJSON.FeatureCollection): StyleSpecification {
  return {
    version: 8,
    glyphs: undefined,
    sources: {
      land: { type: "geojson", data: coastline },
    },
    layers: [
      { id: "sea", type: "background", paint: { "background-color": token("--ocean") || "#D5E5F3" } },
      {
        id: "land",
        type: "fill",
        source: "land",
        paint: { "fill-color": token("--land") || "#F1F3F5", "fill-outline-color": token("--coast") || "#97A7BC" },
      },
    ],
  } as StyleSpecification;
}

export const INITIAL_VIEW = { longitude: 77.5, latitude: 8.85, zoom: 6.6 } as const;
export const MAX_BOUNDS: [[number, number], [number, number]] = [[73.6, 5.6], [81.8, 12.2]];
