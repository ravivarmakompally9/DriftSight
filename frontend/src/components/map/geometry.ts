/** Small GeoJSON builders. Everything is plain data, so MapLibre can style it. */
const KM_LAT = 110.95;
const kmLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

export function circlePolygon(lon: number, lat: number, radiusKm: number, steps = 64): number[][] {
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    ring.push([lon + (radiusKm * Math.cos(a)) / kmLon(lat), lat + (radiusKm * Math.sin(a)) / KM_LAT]);
  }
  return ring;
}

export function circleFeature<P extends Record<string, unknown>>(
  lon: number, lat: number, radiusKm: number, properties: P,
): GeoJSON.Feature<GeoJSON.Polygon, P> {
  return {
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [circlePolygon(lon, lat, radiusKm)] },
  };
}

export function rectFeature<P extends Record<string, unknown>>(
  box: number[], properties: P,
): GeoJSON.Feature<GeoJSON.Polygon, P> {
  const [x0, y0, x1, y1] = box;
  return {
    type: "Feature",
    properties,
    geometry: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
  };
}

export const fc = <G extends GeoJSON.Geometry, P>(features: GeoJSON.Feature<G, P>[]) =>
  ({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection<G, P>);

export const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * One current vector becomes a shaft plus a filled arrowhead, so direction
 * reads at a glance instead of needing a legend.
 */
export function arrowFeatures(
  cells: { lon: number; lat: number; u: number; v: number }[],
  maxSpeed: number,
) {
  const shafts: GeoJSON.Feature<GeoJSON.LineString, { speed: number }>[] = [];
  const heads: GeoJSON.Feature<GeoJSON.Polygon, { speed: number }>[] = [];

  for (const c of cells) {
    const speed = Math.hypot(c.u, c.v);
    if (speed < 0.03) continue;
    const lenKm = 4 + (speed / Math.max(maxSpeed, 0.05)) * 12;
    const dx = (c.u / speed) * lenKm;
    const dy = (c.v / speed) * lenKm;
    const toLon = (k: number) => k / kmLon(c.lat);
    const toLat = (k: number) => k / KM_LAT;

    const x0 = c.lon - toLon(dx / 2), y0 = c.lat - toLat(dy / 2);
    const x1 = c.lon + toLon(dx / 2), y1 = c.lat + toLat(dy / 2);
    shafts.push({
      type: "Feature", properties: { speed },
      geometry: { type: "LineString", coordinates: [[x0, y0], [x1, y1]] },
    });

    // arrowhead: a triangle at the tip, rotated with the flow
    const ang = Math.atan2(dy, dx);
    const hk = lenKm * 0.42;
    const wing = 0.55;
    const p = (a: number, r: number): number[] => [x1 + toLon(r * Math.cos(a)), y1 + toLat(r * Math.sin(a))];
    const tip = [x1 + toLon(hk * 0.5 * Math.cos(ang)), y1 + toLat(hk * 0.5 * Math.sin(ang))];
    heads.push({
      type: "Feature", properties: { speed },
      geometry: { type: "Polygon", coordinates: [[tip, p(ang + Math.PI - wing, hk), p(ang + Math.PI + wing, hk), tip]] },
    });
  }
  return { shafts: fc(shafts), heads: fc(heads) };
}

/** Particle arrays -> one point feature per particle, tagged for styling. */
export function particleFeatures(
  x: number[], y: number[], state: number[], extra: Record<string, unknown> = {},
) {
  const features: GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>[] = [];
  for (let i = 0; i < x.length; i++) {
    if (state[i] === 2 || state[i] === 3) continue;   // gone, or not yet released
    features.push({
      type: "Feature",
      properties: { ashore: state[i] === 1 ? 1 : 0, ...extra },
      geometry: { type: "Point", coordinates: [x[i], y[i]] },
    });
  }
  return features;
}
