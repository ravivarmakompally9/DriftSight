import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  AttributionControl, Layer, Marker, NavigationControl, Source, type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { CARTO, INITIAL_VIEW, MAX_BOUNDS, offlineStyle } from "@/components/map/basemap";
import {
  EMPTY, arrowFeatures, circleFeature, fc, particleFeatures, rectFeature,
} from "@/components/map/geometry";
import { useCurrents, useGeo, usePasses } from "@/hooks/queries";
import { levelColor, statusColor } from "@/lib/colors";
import type { Backtrace, Detection, Frame, Zone } from "@/lib/types";
import { pct, token } from "@/lib/utils";
import { useAppStore, type LayerState, type Selection } from "@/store/useAppStore";

export interface MapViewProps {
  frame?: Frame;
  zones?: Zone[];
  detections?: Detection[];
  backtrace?: Backtrace | null;
  layers: LayerState;
  selection?: Selection;
  onSelect?: (s: Selection) => void;
  interactive?: boolean;
  className?: string;
}

const DETECTION_VISIBLE_HOURS = 20;

export function MapView({
  frame, zones = [], detections = [], backtrace, layers,
  selection, onSelect, interactive = true, className,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const hour = useAppStore((s) => s.hour);
  const { data: geo } = useGeo();
  const { data: passes } = usePasses();
  const [dark, setDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");
  const [styleFailed, setStyleFailed] = useState(false);
  const [bbox, setBbox] = useState("75.4,7.2,80.0,10.2");

  useEffect(() => {
    const onTheme = () => setDark(document.documentElement.getAttribute("data-theme") === "dark");
    window.addEventListener("ds-theme", onTheme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onTheme);
    return () => { window.removeEventListener("ds-theme", onTheme); mq.removeEventListener("change", onTheme); };
  }, []);

  const { data: currents } = useCurrents(hour, bbox, layers.currents && interactive);

  const syncBbox = useCallback(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;
    const b = m.getBounds();
    setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(2)).join(","));
  }, []);

  // ---- sources -------------------------------------------------------
  const currentGeo = useMemo(
    () => (currents ? arrowFeatures(currents.cells, currents.max_speed) : { shafts: EMPTY, heads: EMPTY }),
    [currents],
  );

  const pelletGeo = useMemo(
    () => (frame ? fc(particleFeatures(frame.pellets.x, frame.pellets.y, frame.pellets.state)) : EMPTY),
    [frame],
  );

  const trackGeo = useMemo(() => {
    if (!frame) return EMPTY;
    const out: GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>[] = [];
    for (const t of frame.tracks) {
      out.push(...particleFeatures(t.x, t.y, t.state, { status: t.status, track: t.id }));
    }
    return fc(out);
  }, [frame]);

  const zoneGeo = useMemo(
    () => fc(zones.slice(0, 4).map((z) =>
      circleFeature(z.lon, z.lat, 6 + z.norm * 9, {
        id: z.id, level: z.level, name: z.name,
        selected: selection?.type === "zone" && selection.id === z.id ? 1 : 0,
      }))),
    [zones, selection],
  );

  const cloudGeo = useMemo(() => {
    const p = passes?.find((q) => hour >= q.h - 10 && hour <= q.h + 12);
    if (!p || p.sky === "clear") return EMPTY;
    if (p.sky === "cloud") {
      return fc([rectFeature([74.8, 6.8, 80.6, 11.0], { kind: "full" })]);
    }
    return fc((p.cloud_cells ?? []).map(([lo, la, r]) => circleFeature(lo, la, r, { kind: "cell" })));
  }, [passes, hour]);

  const truthGeo = useMemo(
    () => fc((frame?.truth ?? []).map((t) => circleFeature(t.lon, t.lat, 6, { id: t.id }))),
    [frame],
  );

  const backtraceGeo = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!backtrace) return EMPTY;
    return fc([{
      type: "Feature", properties: {},
      geometry: { type: "LineString", coordinates: backtrace.path.map(([lo, la]) => [lo, la]) },
    } as GeoJSON.Feature<GeoJSON.LineString, Record<string, never>>]);
  }, [backtrace]);

  const protectedGeo = useMemo(
    () => fc((geo?.protected ?? []).map((s) => rectFeature(s.box, { name: s.n }))),
    [geo],
  );

  const recentDetections = useMemo(
    () => detections.filter((d) => hour >= d.h && hour <= d.h + DETECTION_VISIBLE_HOURS),
    [detections, hour],
  );

  const style = styleFailed && geo ? offlineStyle(geo.coastline) : (dark ? CARTO.dark : CARTO.light);
  const ink = token("--text");
  const surface = token("--surface");

  return (
    <div className={className}>
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        mapStyle={style}
        maxBounds={MAX_BOUNDS}
        minZoom={5.5}
        maxZoom={13}
        attributionControl={false}
        scrollZoom={interactive}
        dragPan={interactive}
        doubleClickZoom={interactive}
        touchZoomRotate={interactive}
        dragRotate={false}
        onLoad={syncBbox}
        onMoveEnd={syncBbox}
        onError={(e) => {
          // A blocked or unreachable basemap should degrade, not break the console.
          if (!styleFailed && /style|sprite|glyph|tiles?/i.test(String(e.error?.message ?? ""))) setStyleFailed(true);
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl compact position="bottom-left" />
        {interactive && <NavigationControl position="bottom-right" showCompass={false} />}

        {/* protected water */}
        <Source id="protected" type="geojson" data={protectedGeo}>
          <Layer id="protected-line" type="line"
            paint={{ "line-color": token("--ok"), "line-width": 1.2, "line-dasharray": [5, 4], "line-opacity": 0.85 }} />
        </Source>

        {/* ocean currents */}
        {layers.currents && (
          <>
            <Source id="current-shafts" type="geojson" data={currentGeo.shafts}>
              <Layer id="current-shafts-line" type="line"
                paint={{
                  "line-color": token("--current"),
                  "line-width": 1.1,
                  "line-opacity": ["interpolate", ["linear"], ["get", "speed"], 0.03, 0.22, 0.45, 0.7],
                }} />
            </Source>
            <Source id="current-heads" type="geojson" data={currentGeo.heads}>
              <Layer id="current-heads-fill" type="fill"
                paint={{
                  "fill-color": token("--current"),
                  "fill-opacity": ["interpolate", ["linear"], ["get", "speed"], 0.03, 0.25, 0.45, 0.75],
                }} />
            </Source>
          </>
        )}

        {/* pellet forecast */}
        {layers.pellets && (
          <Source id="pellets" type="geojson" data={pelletGeo}>
            <Layer id="pellets-dots" type="circle"
              paint={{
                "circle-color": token("--pellet"),
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, ["case", ["==", ["get", "ashore"], 1], 2.2, 1.6], 11, ["case", ["==", ["get", "ashore"], 1], 4.5, 3]],
                "circle-opacity": ["case", ["==", ["get", "ashore"], 1], 0.95, 0.4],
              }} />
          </Source>
        )}

        {/* debris track particles */}
        {layers.tracks && (
          <Source id="tracks" type="geojson" data={trackGeo}>
            <Layer id="track-dots" type="circle"
              paint={{
                "circle-color": [
                  "match", ["get", "status"],
                  "confirmed", statusColor("confirmed"),
                  "rejected", statusColor("rejected"),
                  "landed", statusColor("landed"),
                  statusColor("watch"),
                ],
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1.6, 11, 4],
                "circle-opacity": ["case", ["==", ["get", "status"], "rejected"], 0.18, 0.6],
              }} />
          </Source>
        )}

        {/* cloud cover */}
        {layers.cloud && (
          <Source id="cloud" type="geojson" data={cloudGeo}>
            <Layer id="cloud-fill" type="fill"
              paint={{
                "fill-color": dark ? "#8FA3C0" : "#C8D0DC",
                "fill-opacity": ["case", ["==", ["get", "kind"], "full"], 0.22, 0.3],
              }} />
          </Source>
        )}

        {/* hidden truth (demo only) */}
        {layers.truth && (
          <Source id="truth" type="geojson" data={truthGeo}>
            <Layer id="truth-line" type="line"
              paint={{ "line-color": token("--violet"), "line-width": 1.5, "line-dasharray": [3, 3] }} />
          </Source>
        )}

        {/* priority zones */}
        {layers.zones && (
          <Source id="zones" type="geojson" data={zoneGeo}>
            <Layer id="zones-fill" type="fill"
              paint={{
                "fill-color": ["match", ["get", "level"], "HIGH", levelColor("HIGH"), "MEDIUM", levelColor("MEDIUM"), levelColor("LOW")],
                "fill-opacity": 0.1,
              }} />
            <Layer id="zones-line" type="line"
              paint={{
                "line-color": ["match", ["get", "level"], "HIGH", levelColor("HIGH"), "MEDIUM", levelColor("MEDIUM"), levelColor("LOW")],
                "line-width": ["case", ["==", ["get", "selected"], 1], 3, 1.5],
                "line-dasharray": [6, 5],
              }} />
          </Source>
        )}

        {/* reverse-drift path — a soft halo under a dashed line, so it reads
            over both the light and the dark basemap */}
        {backtrace && (
          <Source id="backtrace" type="geojson" data={backtraceGeo}>
            <Layer id="backtrace-halo" type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": token("--violet"), "line-width": 8, "line-opacity": 0.18, "line-blur": 3 }} />
            <Layer id="backtrace-line" type="line"
              layout={{ "line-cap": "round" }}
              paint={{ "line-color": token("--violet"), "line-width": 3, "line-dasharray": [4, 3] }} />
          </Source>
        )}

        {/* harbours */}
        {interactive && geo?.harbours.map((h) => (
          <Marker key={h.n} longitude={h.lon} latitude={h.lat}>
            <span title={`${h.n} (harbour)`}
              className="block h-2 w-2 rotate-45 border border-ink-2 bg-surface" aria-hidden />
          </Marker>
        ))}

        {/* AI detections from a recent pass */}
        {layers.detections && recentDetections.map((d) => (
          <Marker key={d.id} longitude={d.lon} latitude={d.lat}
            onClick={() => d.track && onSelect?.({ type: "track", id: d.track })}>
            <button
              aria-label={`AI detection ${d.ref}, ${pct(d.score)} plastic-like`}
              title={`AI detection · ${pct(d.score)} plastic-like · ${d.area_m2.toLocaleString()} m²`}
              className="grid place-items-center"
              style={{ opacity: 1 - (hour - d.h) / (DETECTION_VISIBLE_HOURS + 6) }}
            >
              <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden>
                <circle cx="20" cy="20" r="12" fill="none" stroke={ink} strokeWidth="1.5" />
                <path d="M20 2v8M20 30v8M2 20h8M30 20h8" stroke={ink} strokeWidth="1.5" />
              </svg>
            </button>
          </Marker>
        ))}

        {/* tracked patch centroids */}
        {layers.tracks && frame?.tracks.map((t) => {
          if (!t.centroid) return null;
          const selected = selection?.type === "track" && selection.id === t.id;
          const c = statusColor(t.status);
          return (
            <Marker key={t.id} longitude={t.centroid[0]} latitude={t.centroid[1]}
              onClick={() => onSelect?.({ type: "track", id: t.id })}>
              <button className="flex items-center gap-1.5" aria-label={`${t.id}, ${pct(t.confidence)} confidence`}>
                <span
                  className="block rounded-full transition-all"
                  style={{
                    width: selected ? 20 : 15, height: selected ? 20 : 15,
                    border: `${selected ? 3.5 : 2.5}px solid ${c}`, background: surface, opacity: 0.95,
                  }}
                />
                {interactive && (
                  <span className="font-display text-[12.5px] font-bold text-ink drop-shadow-[0_0_3px_var(--surface)]">
                    {t.id.replace("Patch ", "")} · {pct(t.confidence)}
                  </span>
                )}
              </button>
            </Marker>
          );
        })}

        {/* the wreck */}
        {geo && (
          <Marker longitude={geo.wreck.lon} latitude={geo.wreck.lat} onClick={() => onSelect?.({ type: "wreck" })}>
            <button className="font-bold leading-none text-crit" style={{ fontSize: 17 }}
              aria-label="MSC ELSA 3 wreck" title="MSC ELSA 3 — sank 25 May 2025 · approximate position">
              ✕
            </button>
          </Marker>
        )}
      </Map>

      {styleFailed && (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-surface/90 px-2 py-1 text-[11px] text-ink-3 shadow-card">
          Basemap unavailable — drawing the GSHHS coastline instead
        </p>
      )}
    </div>
  );
}
