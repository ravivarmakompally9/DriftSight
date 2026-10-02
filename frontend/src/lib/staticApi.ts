/**
 * The API served from JSON snapshots, for the static (GitHub Pages) build.
 *
 * `backend/scripts/export_static.py` writes every GET answer for the latest run
 * into `data/`. The replay is deterministic, so reads come straight from those
 * files. Missions live in this browser's localStorage; re-running the analysis
 * and uploading imagery need the real backend and say so.
 */
import type { Api } from "./api";
import { ApiError, tokenStore } from "./api";
import type {
  DemoAccount, FieldResults, ForecastReport, MassEstimate, Mission, MissionStatus, RunInfo, RunSummary, User,
} from "./types";


interface Meta {
  run: RunInfo; accounts: DemoAccount[]; users: Record<string, User>;
  incident: unknown; passes: unknown; model: unknown; timeline: unknown;
  missions: Mission[]; mass_ref_tonnes: number; hours: number;
}

const DATA = `${import.meta.env.BASE_URL}data`;
const MISSIONS_KEY = "ds-static-missions";
const RESULTS_KEY = "ds-static-field-results";

const cache = new Map<string, Promise<unknown>>();
function load<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(`${DATA}/${path}`).then((r) => {
      if (!r.ok) throw new ApiError(r.status === 404 ? "Not found" : r.statusText, r.status);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const meta = () => load<Meta>("meta.json");
const hourData = (h: number) => load<Record<string, any>>(`hour/${Math.round(h)}.json`);
const allData = () => load<Record<string, any>>("all.json");
const slug = (trackId: string) => trackId.replace(/ /g, "_");

/** Rescale a mass estimate exported at the reference release to the operator's figure. */
function scaleMass(mass: MassEstimate | null | undefined, ref: number,
                   tonnes: number | null | undefined): MassEstimate | null {
  if (!mass || !tonnes || tonnes <= 0) return null;
  const k = tonnes / ref;
  return {
    ...mass,
    assumed_release_tonnes: tonnes,
    ashore_tonnes: Math.round(mass.ashore_tonnes * k * 10) / 10,
    afloat_tonnes: Math.round(mass.afloat_tonnes * k * 10) / 10,
    note: mass.note.replace(/assumed [\d.e+]+ t/, `assumed ${tonnes} t`),
  };
}

// ---- local mission board -------------------------------------------------
function readList<T>(key: string, seed: T[]): T[] {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : seed; } catch { return seed; }
}
function writeList<T>(key: string, rows: T[]) {
  try { localStorage.setItem(key, JSON.stringify(rows)); } catch { /* private mode */ }
}
type FieldResult = FieldResults["results"][number];

async function currentUser(): Promise<User> {
  const token = tokenStore.get();
  const email = token?.startsWith("static:") ? token.slice(7) : null;
  const user = email ? (await meta()).users[email] : undefined;
  if (!user) throw new ApiError("Not signed in", 401);
  return user;
}

async function missionsFor(user: User): Promise<Mission[]> {
  const rows = readList<Mission>(MISSIONS_KEY, (await meta()).missions);
  return user.role === "field" ? rows.filter((m) => m.team === user.team) : rows;
}

const offline = (what: string) =>
  Promise.reject(new ApiError(
    `${what} needs the DriftSight backend. This hosted demo is a fixed replay of the analysis.`, 0));

export function createStaticApi(): Api {
  return {
    // auth
    login: async (email, password) => {
      const m = await meta();
      const acct = m.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (!acct || acct.password !== password) throw new ApiError("Incorrect email or password", 401);
      return { access_token: `static:${acct.email}`, token_type: "bearer", expires_in: 30 * 86400,
               user: m.users[acct.email] };
    },
    me: currentUser,
    demoAccounts: async () => (await meta()).accounts,

    // incident + static furniture
    incident: async () => (await meta()).incident as any,
    passes: async () => (await meta()).passes as any,
    geo: () => load("geo.json"),

    // runs
    latestRun: async () => (await meta()).run,
    createRun: () => offline("Re-running the analysis"),
    summary: async (_runId, h, tonnes) => {
      const [m, d] = await Promise.all([meta(), hourData(h)]);
      const s = d.summary as RunSummary;
      return { ...s, headline: { ...s.headline, mass: scaleMass(s.headline.mass, m.mass_ref_tonnes, tonnes) } };
    },
    frame: (_runId, h, truth = false) => load(`${truth ? "truth" : "frame"}/${Math.round(h)}.json`),
    detections: async (_runId, h) => (h === undefined ? (await allData()).detections : (await hourData(h)).detections),
    detection: (id) => load(`detection/${id}.json`),
    tracks: async (_runId, h) => ({
      tracks: h === undefined ? (await allData()).tracks : (await hourData(h)).tracks.tracks,
    }),
    track: async (id, _runId, h) => {
      const rows: any[] = h === undefined ? (await allData()).tracks : (await hourData(h)).tracks.tracks;
      const hit = rows.find((t) => t.id === id) ?? (await allData()).tracks.find((t: any) => t.id === id);
      if (!hit) throw new ApiError(`No track ${id}`, 404);
      return hit;
    },
    backtrace: (id) => load(`backtrace/${slug(id)}.json`),
    forecast: async (_runId, h, tonnes) => {
      const [m, f] = await Promise.all([
        meta(), h === undefined ? allData().then((d) => d.forecast) : hourData(h).then((d) => d.forecast),
      ]);
      const fr = f as ForecastReport;
      return { ...fr, mass: scaleMass(fr.mass, m.mass_ref_tonnes, tonnes) };
    },
    priorities: async (_runId, h) => (await hourData(h)).priorities,
    events: async (_runId, until) => (await hourData(until)).events,
    timeline: async () => (await meta()).timeline as any,
    currents: (h) => load(`currents/${Math.round(h)}.json`),

    // missions
    missions: async () => missionsFor(await currentUser()),
    createMission: async (body) => {
      const user = await currentUser();
      const rows = readList<Mission>(MISSIONS_KEY, (await meta()).missions);
      const now = new Date().toISOString();
      const m = {
        kind: "sea", level: "MEDIUM", hour: 0, team: "Indian Coast Guard patrol", planned_date: "", notes: "",
        run_id: null, ...body,
        id: rows.reduce((mx, r) => Math.max(mx, r.id), 0) + 1, status: "planned" as MissionStatus,
        result: null, created_by: user.email, created_at: now, updated_at: now,
      } as Mission;
      writeList(MISSIONS_KEY, [m, ...rows]);
      return m;
    },
    patchMission: async (id, body) => {
      const user = await currentUser();
      const rows = readList<Mission>(MISSIONS_KEY, (await meta()).missions);
      const m = rows.find((r) => r.id === id);
      if (!m) throw new ApiError(`No mission ${id}`, 404);
      if (user.role === "field" && m.team !== user.team) throw new ApiError("Not your team's mission", 403);
      Object.assign(m, body, { updated_at: new Date().toISOString() });
      if (body.result && !body.status) m.status = "completed";
      writeList(MISSIONS_KEY, rows);
      if (body.result) {
        const results = readList<FieldResult>(RESULTS_KEY, []);
        const existing = results.find((r) => r.mission_id === id);
        if (existing) existing.label = body.result;
        else results.unshift({
          id: results.reduce((mx, r) => Math.max(mx, r.id), 0) + 1, mission_id: id, zone_id: m.zone_id,
          label: body.result, lon: m.lon, lat: m.lat, hour: m.hour, reported_by: user.email,
          used_for_training: false, created_at: new Date().toISOString(),
        });
        writeList(RESULTS_KEY, results);
      }
      return m;
    },
    deleteMission: async (id) => {
      await currentUser();
      writeList(MISSIONS_KEY, readList<Mission>(MISSIONS_KEY, (await meta()).missions).filter((m) => m.id !== id));
      writeList(RESULTS_KEY, readList<FieldResult>(RESULTS_KEY, []).filter((r) => r.mission_id !== id));
    },
    fieldResults: async () => {
      await currentUser();
      const results = readList<FieldResult>(RESULTS_KEY, []);
      return {
        count: results.length,
        debris_found: results.filter((r) => r.label === "debris_found").length,
        nothing_found: results.filter((r) => r.label === "nothing_found").length,
        pending_training: results.filter((r) => !r.used_for_training).length,
        results,
      };
    },

    // model + reports
    model: async () => (await meta()).model as any,
    sitrep: async (_runId, h) => (await hourData(h)).sitrep,
    uploadGeotiff: () => offline("Running the detector on an uploaded GeoTIFF"),

    // download URLs
    geojsonUrl: (_runId, h) => `${DATA}/geojson/zones-${Math.round(h)}.geojson`,
    sitrepPdfUrl: (_runId, h) => `${DATA}/pdf/sitrep-${Math.round(h)}.pdf`,
  };
}
