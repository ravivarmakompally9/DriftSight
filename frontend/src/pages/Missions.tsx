import { useMemo, useState } from "react";
import { Check, Download, Flag, Play, Plus, Trash2, Users, X } from "lucide-react";

import { CreateMissionDialog } from "@/components/CreateMissionDialog";
import { EmptyState } from "@/components/EmptyState";
import { LevelPill, MissionPill } from "@/components/Pills";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteMission, useFieldResults, useMissions, usePriorities, useRun, useUpdateMission,
} from "@/hooks/queries";
import { api } from "@/lib/api";
import { dtIst } from "@/lib/time";
import type { Mission, Zone } from "@/lib/types";
import { latlon, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function Missions() {
  const hour = useAppStore((s) => s.hour);
  const user = useAppStore((s) => s.user);
  const [zone, setZone] = useState<Zone | null>(null);

  const zones = usePriorities(hour);
  const missions = useMissions();
  const labels = useFieldResults();
  const run = useRun();
  const update = useUpdateMission();
  const remove = useDeleteMission();

  const suggested = useMemo(() => {
    const taken = new Set((missions.data ?? []).filter((m) => m.status !== "completed").map((m) => m.zone_id));
    return (zones.data ?? []).filter((z) => !taken.has(z.id)).slice(0, 5);
  }, [zones.data, missions.data]);

  const byStatus = (s: Mission["status"]) => (missions.data ?? []).filter((m) => m.status === s);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-[260px] flex-1 text-[13px] text-ink-2">
          Suggested zones update with the replay time ({dtIst(hour)}). Field results flow back as labels for
          retraining the detector — <b className="text-ink">{labels.data?.count ?? 0}</b> collected so far.
          {user?.role === "field" && " You are signed in as a field team, so this board shows only your taskings."}
        </p>
        <Button asChild>
          <a href={api.geojsonUrl(run.data?.id ?? "latest", hour)} download>
            <Download size={15} />
            Export GeoJSON
          </a>
        </Button>
      </div>

      <div className="grid gap-3.5 overflow-x-auto pb-1.5 lg:grid-cols-4">
        <Column title="Suggested by DriftSight" count={suggested.length} loading={zones.isLoading}>
          {suggested.length ? suggested.map((z) => (
            <article key={z.id} className="grid gap-2 rounded-lg border border-line bg-surface p-3 shadow-card">
              <div className="flex items-center gap-2">
                <LevelPill level={z.level} />
                <span className="text-xs text-ink-3">{z.kind === "sea" ? "at sea" : "coast"}</span>
              </div>
              <b className="text-sm">{z.name}</b>
              <p className="text-xs leading-snug text-ink-2">
                {z.kind === "sea" && z.area_m2
                  ? <><b className="text-ink">{z.area_m2.toLocaleString()} m²</b> of floating plastic, {z.where ?? latlon(z.lat, z.lon)}</>
                  : <>Pellet landfall {z.where ?? latlon(z.lat, z.lon)}</>}
              </p>
              <div className="flex flex-wrap gap-x-1.5 text-xs text-ink-3">
                <span>confidence {pct(z.confidence)}</span>
                <span aria-hidden>·</span>
                <span>launch from {z.nearest_harbour} ({z.harbour_km.toFixed(0)} km)</span>
              </div>
              <div>
                <Button size="sm" variant="default" onClick={() => setZone(z)}>
                  <Plus size={14} />
                  Create mission
                </Button>
              </div>
            </article>
          )) : <Empty text="No zones need action right now." />}
        </Column>

        {(["planned", "in_progress", "completed"] as const).map((status) => (
          <Column
            key={status}
            title={{ planned: "Planned", in_progress: "In progress", completed: "Completed" }[status]}
            count={byStatus(status).length}
            loading={missions.isLoading}
          >
            {byStatus(status).length ? byStatus(status).map((m) => (
              <article key={m.id} className="grid gap-2 rounded-lg border border-line bg-surface p-3 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <MissionPill status={m.status} />
                  <LevelPill level={m.level} />
                </div>
                <b className="text-sm">{m.name}</b>
                <div className="flex flex-wrap gap-2 text-xs text-ink-2">
                  <span className="flex items-center gap-1"><Users size={12} />{m.team}</span>
                  <span>{m.planned_date}</span>
                </div>
                <div className="font-mono text-[11px] text-ink-3">{latlon(m.lat, m.lon)}</div>
                {m.notes && <p className="text-xs text-ink-2">{m.notes}</p>}
                {m.result && (
                  <p className={`text-xs font-semibold ${m.result === "debris_found" ? "text-ok" : "text-crit"}`}>
                    Field result: {m.result === "debris_found" ? "debris found" : "nothing found"} · label queued
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {m.status === "planned" && (
                    <Button size="sm" onClick={() => update.mutate({ id: m.id, status: "in_progress" })}>
                      <Play size={13} />
                      Start
                    </Button>
                  )}
                  {m.status === "in_progress" && (
                    <>
                      <Button size="sm" onClick={() => update.mutate({ id: m.id, result: "debris_found" })}>
                        <Check size={13} />
                        Debris found
                      </Button>
                      <Button size="sm" onClick={() => update.mutate({ id: m.id, result: "nothing_found" })}>
                        <X size={13} />
                        Nothing found
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => remove.mutate(m.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </article>
            )) : <Empty text="Nothing here yet." />}
          </Column>
        ))}
      </div>

      <CreateMissionDialog zone={zone} open={!!zone} onOpenChange={(o) => !o && setZone(null)} />
    </div>
  );
}

function Column({
  title, count, loading, children,
}: { title: string; count: number; loading?: boolean; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[240px] min-w-[250px] flex-col gap-2.5 rounded-xl bg-sunken p-2.5">
      <h4 className="flex items-center gap-2 px-1 pt-0.5 text-[13px] font-semibold">
        {title}
        <span className="rounded-full bg-surface px-2 py-px font-mono text-[11px] font-semibold text-ink-2 tnum">
          {count}
        </span>
      </h4>
      {loading ? <Skeleton className="h-24" /> : children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <EmptyState icon={Flag} title={text} className="py-6" />;
}
