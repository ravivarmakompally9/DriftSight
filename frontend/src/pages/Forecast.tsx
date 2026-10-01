import { CheckCircle2, MapPin, Route, Scale, Umbrella, Waves } from "lucide-react";

import { CumulativeLandfall } from "@/components/charts/CumulativeLandfall";
import { ErrorState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardSub, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForecast, useSummary } from "@/hooks/queries";
import { num } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Row } from "@/components/TrackDetail";

export default function Forecast() {
  const hour = useAppStore((s) => s.hour);
  const forecast = useForecast(hour);
  const summary = useSummary(hour);
  const assumedTonnes = useAppStore((st) => st.assumedTonnes);
  const setAssumedTonnes = useAppStore((st) => st.setAssumedTonnes);

  if (forecast.isError) {
    return <ErrorState message={(forecast.error as Error).message} retry={() => forecast.refetch()} />;
  }

  const f = forecast.data;
  const s = summary.data;
  const v = f?.validation;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Waves} tone="crit" label="Coast affected" loading={forecast.isLoading}
          value={f?.coast ? `${f.coast.km.toFixed(0)} km` : "—"}
          sub={f?.coast ? `${f.coast.district_count} district${f.coast.district_count === 1 ? "" : "s"} · ${f.coast.places.slice(0, 2).join(", ") || "none yet"}` : undefined}
        />
        <KpiCard
          icon={MapPin} tone="warn" label="Worst-hit stretch" loading={forecast.isLoading}
          value={f?.districts?.[0]?.district ?? "—"}
          sub={f?.districts?.[0] ? `${f.districts[0].coast_km?.toFixed(0) ?? "—"} km · first pellets ${f.districts[0].first_at ?? "—"}` : undefined}
        />
        <KpiCard
          icon={Umbrella} tone="violet" label="Ashore by now" loading={summary.isLoading}
          value={s ? `${s.pellets.ashore_pct}%` : "—"}
          sub={s ? `${num(s.pellets.ashore)} of ${num(s.pellets.total)} modelled pellets` : undefined}
        />
        <KpiCard
          icon={Route} tone="brand" label="Still afloat" loading={summary.isLoading}
          value={s ? `${s.pellets.afloat_pct}%` : "—"}
          sub="still moving; can still reach new coast"
        />
      </div>

      {/* Mass is the one figure nothing in the model constrains, so it is an
          operator input, shown as one, and absent until it is supplied. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scale size={15} className="text-ink-3" />Scale to a release estimate</CardTitle>
          <CardSub>optional · nothing we observe measures spill mass</CardSub>
        </CardHeader>
        <CardBody className="flex flex-wrap items-end gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="tonnes">Assumed nurdles released (tonnes)</Label>
            <Input
              id="tonnes" type="number" min={0} step={5} className="w-44"
              placeholder="not set"
              value={assumedTonnes ?? ""}
              onChange={(e) => setAssumedTonnes(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
          {f?.mass ? (
            <>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-3">Est. ashore by now</div>
                <div className="font-display text-[26px] font-bold leading-none tnum">{f.mass.ashore_tonnes} t</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-3">Est. still afloat</div>
                <div className="font-display text-[26px] font-bold leading-none tnum">{f.mass.afloat_tonnes} t</div>
              </div>
              <p className="max-w-md text-[12px] italic leading-relaxed text-warn">{f.mass.note}</p>
            </>
          ) : (
            <p className="max-w-lg text-[12.5px] leading-relaxed text-ink-3">
              Enter a figure and every pellet percentage on this page converts to mass.
              DriftSight will not guess one: imagery and drift tell you <em>where</em> and{" "}
              <em>how far</em>, never <em>how much</em> was spilled. Area afloat and
              kilometres of coast above need no such assumption.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cumulative landfall by district</CardTitle>
          <CardSub>share of all simulated pellets · dashed line = now</CardSub>
        </CardHeader>
        <CardBody>
          {forecast.isLoading || !f ? <Skeleton className="h-[280px]" /> : <CumulativeLandfall report={f} hour={hour} />}
        </CardBody>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle>District outlook</CardTitle></CardHeader>
          <TableWrap className="mt-2.5">
            <Table>
              <thead>
                <tr>
                  <Th>District</Th><Th numeric>Coast hit</Th><Th numeric>Share of pellets</Th>
                  <Th>First arrival</Th><Th>Half arrived by</Th><Th>Reported ashore</Th>
                </tr>
              </thead>
              <tbody>
                {(f?.districts ?? []).map((d) => (
                  <Tr key={d.district}>
                    <Td><b>{d.district}</b></Td>
                    <Td numeric>{d.coast_km ? `${d.coast_km.toFixed(0)} km` : "—"}</Td>
                    <Td numeric>{d.share_pct.toFixed(1)}%</Td>
                    <Td className="font-mono">{d.first_at ?? "—"}</Td>
                    <Td className="font-mono">{d.median_at ?? "—"}</Td>
                    <Td>
                      {d.reported_ashore
                        ? <Badge tone="ok" dot>Yes</Badge>
                        : <span className="text-ink-3">—</span>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Check against the real event</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3">
            {forecast.isLoading || !v ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <dl className="m-0 grid grid-cols-[minmax(130px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
                  <Row label="Forecast first arrival · Kanyakumari" value={v.forecast_first_arrival_kanyakumari ?? "—"} />
                  <Row label="Beach survey · Kanyakumari" value={v.reported_survey} />
                  <Row label="Survey finding" value={v.reported_finding} />
                  <Row
                    label="Result"
                    tone={v.ahead_of_report ? "text-ok" : "text-warn"}
                    value={
                      v.lead_time_days === null ? "—"
                        : v.ahead_of_report
                          ? `forecast ${v.lead_time_days.toFixed(1)} d ahead`
                          : `${Math.abs(v.lead_time_days).toFixed(1)} d late`
                    }
                  />
                  <Row label="Reported districts reached" value={`${v.reported_districts_hit} / ${v.reported_districts_total}`} />
                </dl>
                {v.ahead_of_report && (
                  <p className="flex items-start gap-2 rounded-lg bg-ok-soft px-3 py-2 text-[12.5px] text-ok">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                    The forecast put pellets on the Kanyakumari shore before the survey found them there.
                  </p>
                )}
                <p className="text-xs leading-relaxed text-ink-3">
                  {v.source}
                  {v.missed_districts.length > 0 && ` Missed in this run: ${v.missed_districts.join(" and ")}.`}{" "}
                  {v.caveat}
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
