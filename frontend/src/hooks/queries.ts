import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { MissionStatus, RunParams, Zone } from "@/lib/types";

const STATIC = { staleTime: Infinity, gcTime: Infinity } as const;
/** Run-derived data is deterministic for a given (run, hour) — cache it hard. */
const DERIVED = { staleTime: 5 * 60_000 } as const;

export const useRun = () => useQuery({ queryKey: ["run"], queryFn: api.latestRun, ...DERIVED });
export const useIncident = () => useQuery({ queryKey: ["incident"], queryFn: () => api.incident(), ...STATIC });
export const useGeo = () => useQuery({ queryKey: ["geo"], queryFn: api.geo, ...STATIC });
export const usePasses = () => useQuery({ queryKey: ["passes"], queryFn: api.passes, staleTime: 60_000 });
export const useModel = () => useQuery({ queryKey: ["model"], queryFn: api.model, ...STATIC });

function useRunId() {
  const { data } = useRun();
  return data?.id ?? ("latest" as const);
}

export function useSummary(hour: number) {
  const runId = useRunId();
  const tonnes = useAppStore((s) => s.assumedTonnes);
  return useQuery({
    queryKey: ["summary", runId, hour, tonnes],
    queryFn: () => api.summary(runId, hour, tonnes),
    ...DERIVED,
    placeholderData: (prev) => prev,
  });
}

export function useFrame(hour: number, truth: boolean) {
  const runId = useRunId();
  return useQuery({
    queryKey: ["frame", runId, hour, truth],
    queryFn: () => api.frame(runId, hour, truth),
    ...DERIVED,
    placeholderData: (prev) => prev,   // keeps the map painted while scrubbing
  });
}

export function usePriorities(hour: number) {
  const runId = useRunId();
  return useQuery({
    queryKey: ["priorities", runId, hour],
    queryFn: () => api.priorities(runId, hour).then((r) => r.zones),
    ...DERIVED,
    placeholderData: (prev) => prev,
  });
}

export function useEvents(until: number) {
  const runId = useRunId();
  return useQuery({
    queryKey: ["events", runId, until],
    queryFn: () => api.events(runId, until).then((r) => r.events),
    ...DERIVED,
  });
}

export function useDetections(hour?: number) {
  const runId = useRunId();
  return useQuery({
    queryKey: ["detections", runId, hour],
    queryFn: () => api.detections(runId, hour).then((r) => r.detections),
    ...DERIVED,
  });
}

export function useDetection(id: number | null) {
  const runId = useRunId();
  return useQuery({
    queryKey: ["detection", runId, id],
    queryFn: () => api.detection(id as number, runId),
    enabled: id !== null,
    ...STATIC,
  });
}

export function useTracks(hour: number) {
  const runId = useRunId();
  return useQuery({
    queryKey: ["tracks", runId, hour],
    queryFn: () => api.tracks(runId, hour).then((r) => r.tracks),
    ...DERIVED,
  });
}

export function useForecast(hour?: number) {
  const runId = useRunId();
  const tonnes = useAppStore((s) => s.assumedTonnes);
  return useQuery({
    queryKey: ["forecast", runId, hour, tonnes],
    queryFn: () => api.forecast(runId, hour, tonnes),
    ...DERIVED,
    placeholderData: (prev) => prev,
  });
}

export function useSitrep(hour: number) {
  const runId = useRunId();
  return useQuery({ queryKey: ["sitrep", runId, hour], queryFn: () => api.sitrep(runId, hour), ...DERIVED });
}

export function useTimeline() {
  const runId = useRunId();
  return useQuery({ queryKey: ["timeline", runId], queryFn: () => api.timeline(runId), ...DERIVED });
}

export function useCurrents(hour: number, bbox: string, enabled: boolean) {
  return useQuery({
    queryKey: ["currents", hour, bbox],
    queryFn: () => api.currents(hour, bbox, 22, 22),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useBacktrace() {
  const runId = useRunId();
  const setTrace = useAppStore((s) => s.setTrace);
  return useMutation({
    mutationFn: (trackId: string) => api.backtrace(trackId, runId),
    onSuccess: (data) => {
      setTrace(data);
      toast.success(`Source trace complete — ${(data.score * 100).toFixed(0)}% match to MSC ELSA 3`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
}

// ---- missions -------------------------------------------------------
export function useMissions() {
  const user = useAppStore((s) => s.user);
  return useQuery({ queryKey: ["missions"], queryFn: api.missions, enabled: !!user, staleTime: 10_000 });
}

export function useFieldResults() {
  const user = useAppStore((s) => s.user);
  return useQuery({ queryKey: ["field-results"], queryFn: api.fieldResults, enabled: !!user, staleTime: 10_000 });
}

export function useCreateMission() {
  const qc = useQueryClient();
  const runId = useRunId();
  return useMutation({
    mutationFn: (v: { zone: Zone; team: string; planned_date: string; notes: string; hour: number }) =>
      api.createMission({
        zone_id: v.zone.id, name: v.zone.name, kind: v.zone.kind, level: v.zone.level,
        lon: v.zone.lon, lat: v.zone.lat, hour: v.hour, team: v.team,
        planned_date: v.planned_date, notes: v.notes,
        run_id: typeof runId === "number" ? runId : undefined,
      }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      toast.success(`Mission created — ${m.name} assigned to ${m.team}`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
}

export function useUpdateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number; status?: MissionStatus; result?: string }) =>
      api.patchMission(v.id, { status: v.status, result: v.result }),
    onSuccess: (_m, v) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["field-results"] });
      if (v.result) toast.success("Field result recorded — label queued for retraining");
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
}

export function useDeleteMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteMission(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["missions"] }); toast.success("Mission removed"); },
    onError: (e: ApiError) => toast.error(e.message),
  });
}

export function useRerun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: Partial<RunParams>) => api.createRun(params),
    onSuccess: (run) => {
      qc.clear();
      qc.setQueryData(["run"], run);
      toast.success(`Analysis re-run in ${run.runtime_ms} ms — ${run.metrics.real_confirmed} debris fields confirmed`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
}
