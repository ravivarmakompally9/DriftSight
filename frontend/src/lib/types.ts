export type Role = "analyst" | "field";

export interface User {
  email: string; name: string; role: Role; org: string; initials: string; team?: string | null;
}
export interface DemoAccount {
  email: string; password: string; name: string; role: Role; org: string; initials: string;
}
export interface TokenResponse {
  access_token: string; token_type: string; expires_in: number; user: User;
}

export interface Ship {
  name: string; flag: string; imo: string; route: string; listed: string; sank: string;
  offshore_nm: number; containers: number; hazardous_containers: number;
  cargo_of_concern: string; wreck: { lon: number; lat: number; label: string }; note: string;
}
export interface SatellitePass {
  label: string; h: number; at: string; time_ist: string; day: string; sensor: string;
  sky: "clear" | "cloud" | "partial"; sky_label: string;
  cloud_cells: [number, number, number][] | null; detections: number | null;
}
export interface Incident {
  id: string; name: string; short: string; subtitle: string; status: string;
  ship: Ship; t0: string; t0_label: string; hours: number;
  reported: { districts: string[]; kanyakumari_survey_hour: number; kanyakumari_survey: string; note: string };
  passes: SatellitePass[]; latest_run: number | null; simulated: boolean; disclaimer: string;
}

export interface RunMetrics {
  detections_total: number; detections_false: number; tracks_total: number;
  false_tracks: number; false_confirmed: number; real_tracks: number; real_confirmed: number;
  rejected: number; mean_error_km: number | null; max_error_km: number | null;
  kanyakumari_first_hour: number | null; kanyakumari_error_days: number | null;
  reported_districts_hit: number; reported_districts_total: number; nurdles: number;
}
export interface RunParams {
  gate_km: number; confirm: number; reject: number; cloud_decay: number;
  miss_lr: number; nurdles: number; particles?: number; seed: number;
}
export interface RunInfo {
  id: number; created_at: string; runtime_ms: number; params: RunParams; metrics: RunMetrics;
  hours?: number; t0?: string;
}

export interface PelletState {
  total: number; ashore: number; afloat: number; ashore_pct: number; afloat_pct: number;
}
export interface Zone {
  kind: "sea" | "coast"; id: string; name: string; lon: number; lat: number;
  confidence: number; score: number; norm: number; level: "HIGH" | "MEDIUM" | "LOW";
  status: string; window: [number, number]; window_label: string;
  nearest_harbour: string; harbour_km: number; action: string;
  coast_km?: number; area_m2?: number; share?: number;
}
export interface RunSummary {
  run_id: number; h: number; at: string; as_of: string; hours: number;
  detections: number; detections_total: number; passes_done: number; passes_total: number;
  confirmed: number; watching: number; rejected: number; landed: number;
  pellets: PelletState; high_priority: number; top_zones: Zone[];
  metrics: RunMetrics; params: RunParams; simulated: boolean;
}

export interface FrameTrack {
  id: string; status: TrackStatusName; confidence: number;
  centroid: [number, number] | null; x: number[]; y: number[]; state: number[];
}
export type TrackStatusName = "confirmed" | "watch" | "rejected" | "landed";
export interface Frame {
  run_id: number; h: number; at: string; as_of: string;
  tracks: FrameTrack[];
  pellets: { x: number[]; y: number[]; state: number[]; ashore: number; afloat: number; total: number };
  truth?: { id: string; lon: number; lat: number; n: number; sd_km: number }[];
}

export interface ChipData {
  size: number; pixel_m: number; extent_m: number;
  bands: number[][]; band_names: string[]; probability: number[]; classes: number[]; source: string;
}
export interface Detection {
  id: number; ref: string; h: number; at: string; as_of: string; pass: string; sensor: string;
  lon: number; lat: number; area_m2: number; pixels: number; score: number; fdi: number;
  track: string | null; status: TrackStatusName; simulated: boolean;
  chip?: ChipData; spectrum?: { detected: number[]; water: number[] };
}

export interface TrackHistoryPoint {
  h: number; at: string; confidence: number; event: string; pass: string | null; km: number | null;
}
export interface DriftEvent { h: number; track: string | null; kind: string; text: string; at?: string; as_of?: string; }
export interface Track {
  id: string; status: TrackStatusName; confidence: number; born: number; born_at: string;
  area_m2: number; score: number; sightings: number; detections: number[];
  landed_hour: number | null; centroid: [number, number] | null;
  history: TrackHistoryPoint[];
  forecast_errors: { h: number; km: number; spread_km: number }[];
  events: DriftEvent[];
  truth: { real: boolean; origin: string };
  latest_detection?: Detection;
}

export interface Backtrace {
  track: string; from_detection: number; from_hour: number;
  path: [number, number, number][]; closest_km: number; closest_hour: number | null;
  closest_at: string | null; score: number; verdict: string;
  wreck: { lon: number; lat: number; label: string };
}

export interface DistrictForecast {
  district: string; pellets: number; share: number; share_pct: number;
  first_hour: number | null; first_at: string | null; p10_hour: number | null;
  median_hour: number | null; median_at: string | null;
  reported_ashore: boolean; cumulative_pct: number[];
}
export interface ForecastReport {
  run_id: number; hours: number[]; nurdles: number; districts: DistrictForecast[];
  validation: {
    forecast_first_arrival_kanyakumari: string | null; reported_survey: string;
    reported_finding: string; lead_time_days: number | null; ahead_of_report: boolean | null;
    reported_districts_hit: number; reported_districts_total: number;
    reported_districts: string[]; missed_districts: string[]; source: string; caveat: string;
  };
  simulated: boolean;
}

export type MissionStatus = "planned" | "in_progress" | "completed";
export interface Mission {
  id: number; run_id: number | null; zone_id: string; name: string; kind: "sea" | "coast";
  level: "HIGH" | "MEDIUM" | "LOW"; lon: number; lat: number; hour: number;
  team: string; planned_date: string; notes: string; status: MissionStatus;
  result: "debris_found" | "nothing_found" | null;
  created_by: string | null; created_at: string; updated_at: string;
}
export interface FieldResults {
  count: number; debris_found: number; nothing_found: number; pending_training: number;
  results: { id: number; mission_id: number; zone_id: string; label: string; lon: number; lat: number;
    hour: number; reported_by: string | null; used_for_training: boolean; created_at: string }[];
}

export interface DataSource {
  icon: string; name: string; purpose: string;
  state: "simulated" | "planned" | "used"; detail: string; production: string;
}
export interface ModelReport {
  classes: string[]; features: string[]; accuracy: number; confusion: number[][];
  n_train: number; n_test: number; seed: number; algorithm: string; simulated: boolean;
  production_plan: string; bands: string[]; wavelengths_nm: number[];
  spectra: Record<string, number[]>; data_sources: DataSource[];
  ocean: { provider: string; simulated: boolean; note: string };
}

export interface CurrentField {
  h: number; bbox: number[]; cells: { lon: number; lat: number; u: number; v: number }[];
  max_speed: number; units: string; provider: string; simulated: boolean;
}

export interface SitRep {
  incident: string; as_of_hour: number; as_of: string; generated: string; summary: string;
  facts: { value: number | string; label: string }[];
  counts: Record<string, number>; pellets: PelletState;
  passes: { total: number; done: number; usable: number };
  tracks: { id: string; first_seen: string; area_m2: number; confidence: number; status: string }[];
  landfall_line: string;
  priorities: { level: string; name: string; lat: number; lon: number; action: string; harbour: string }[];
  missions: { total: number; planned: number; in_progress: number; completed: number };
  method: string; caveat: string; simulated: boolean;
}

export interface GeoFurniture {
  bbox: number[];
  coastline: GeoJSON.FeatureCollection;
  places: { n: string; lon: number; lat: number }[];
  harbours: { n: string; lon: number; lat: number }[];
  protected: { n: string; box: number[]; w: number }[];
  districts: string[];
  wreck: { lon: number; lat: number; label: string };
}

export interface UploadResult {
  filename: string; width: number; height: number; bands: string[]; crs: string | null;
  bounds: number[]; pixels_above_threshold: number;
  detections: { px: number; area_m2: number; mean_probability: number; mean_fdi: number;
    centre: { x: number; y: number } }[];
  probability_preview: { width: number; height: number; values: number[] };
  note: string;
}
