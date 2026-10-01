import type {
  Backtrace, CurrentField, Detection, FieldResults, ForecastReport, Frame, GeoFurniture,
  Incident, Mission, MissionStatus, ModelReport, RunInfo, RunSummary, SatellitePass,
  SitRep, TokenResponse, Track, UploadResult, Zone, DemoAccount, DriftEvent,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";
const TOKEN_KEY = "ds-token";

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  },
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "ApiError"; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Cannot reach the DriftSight API. Is the backend running on :8000?", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail
        : Array.isArray(body.detail) ? body.detail.map((d: { msg: string }) => d.msg).join(", ")
        : detail;
    } catch { /* not JSON */ }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  // auth
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<TokenResponse["user"]>("/auth/me"),
  demoAccounts: () => request<DemoAccount[]>("/auth/demo-accounts"),

  // incident + static furniture
  incident: (id = "elsa3") => request<Incident>(`/incidents/${id}`),
  passes: () => request<SatellitePass[]>("/passes"),
  geo: () => request<GeoFurniture>("/geo"),

  // runs
  latestRun: () => request<RunInfo>("/runs/latest"),
  createRun: (body: Partial<RunInfo["params"]>) =>
    request<RunInfo>("/runs", { method: "POST", body: JSON.stringify(body) }),
  summary: (runId: number | "latest", h: number, tonnes?: number | null) =>
    request<RunSummary>(`/runs/${runId}/summary${qs({ h, tonnes: tonnes ?? undefined })}`),
  frame: (runId: number | "latest", h: number, truth = false) =>
    request<Frame>(`/runs/${runId}/frame/${h}${qs({ truth: truth ? 1 : undefined })}`),
  detections: (runId: number | "latest", h?: number) =>
    request<{ detections: Detection[]; count: number; total: number }>(`/runs/${runId}/detections${qs({ h })}`),
  detection: (id: number, runId: number | "latest" = "latest") =>
    request<Detection>(`/detections/${id}${qs({ run_id: runId })}`),
  tracks: (runId: number | "latest", h?: number) =>
    request<{ tracks: Track[] }>(`/runs/${runId}/tracks${qs({ h })}`),
  track: (id: string, runId: number | "latest" = "latest", h?: number) =>
    request<Track>(`/tracks/${encodeURIComponent(id)}${qs({ run_id: runId, h })}`),
  backtrace: (id: string, runId: number | "latest" = "latest") =>
    request<Backtrace>(`/tracks/${encodeURIComponent(id)}/backtrace${qs({ run_id: runId })}`, { method: "POST" }),
  forecast: (runId: number | "latest", h?: number, tonnes?: number | null) =>
    request<ForecastReport>(`/runs/${runId}/forecast${qs({ h, tonnes: tonnes ?? undefined })}`),
  priorities: (runId: number | "latest", h: number) =>
    request<{ zones: Zone[] }>(`/runs/${runId}/priorities${qs({ h })}`),
  events: (runId: number | "latest", until: number) =>
    request<{ events: DriftEvent[]; count: number }>(`/runs/${runId}/events${qs({ until })}`),
  currents: (h: number, bbox: string, nx = 20, ny = 20) =>
    request<CurrentField>(`/currents${qs({ h, bbox, nx, ny })}`),

  // missions
  missions: () => request<Mission[]>("/missions"),
  createMission: (body: Record<string, unknown>) =>
    request<Mission>("/missions", { method: "POST", body: JSON.stringify(body) }),
  patchMission: (id: number, body: { status?: MissionStatus; result?: string; notes?: string }) =>
    request<Mission>(`/missions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteMission: (id: number) => request<void>(`/missions/${id}`, { method: "DELETE" }),
  fieldResults: () => request<FieldResults>("/field-results"),

  // model + reports
  model: () => request<ModelReport>("/model"),
  sitrep: (runId: number | "latest", h: number) => request<SitRep>(`/reports/sitrep${qs({ run_id: runId, h })}`),
  uploadGeotiff: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<UploadResult>("/detect/upload", { method: "POST", body: fd });
  },

  // download URLs (hit directly by the browser)
  geojsonUrl: (runId: number | "latest", h: number) => `${BASE}/export/geojson${qs({ run_id: runId, h })}`,
  sitrepPdfUrl: (runId: number | "latest", h: number) =>
    `${BASE}/reports/sitrep${qs({ run_id: runId, h, format: "pdf" })}`,
};
