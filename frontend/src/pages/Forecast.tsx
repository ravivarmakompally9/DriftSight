import { CheckCircle2, MapPin, Route, Umbrella, Waves } from "lucide-react";

import { CumulativeLandfall } from "@/components/charts/CumulativeLandfall";
import { ErrorState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardSub, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useForecast, useSummary } from "@/hooks/queries";
import { dtIst } from "@/lib/time";
import { num } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { Row } from "@/components/TrackDetail";

export default function Forecast() {
  const hour = useAppStore((s) => s.hour);
  const forecast = useForecast();
  const summary = useSummary(hour);

  if (forecast.isError) {
    return <ErrorState message={(forecast.error as Error).message} retry={() => forecast.refetch()} />;
  }

  const f = forecast.data;
  const s = summary.data;
  const reached = (f?.districts ?? []).filter((d) => d.first_hour !== null && d.first_hour <= hour).length;
  const v = f?.validation;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          icon={Waves} tone="brand" label="Virtual pellets released" loading={forecast.isLoading}
          value={num(f?.nurdles)} sub="at the wreck, first 12 hours"
        />
        <KpiCard
          icon={Umbrella} tone="warn" label="Ashore by now" loading={summary.isLoading}
          value={s ? `${s.pellets.ashore_pct}%` : "—"}
          sub={s ? `${num(s.pellets.ashore)} pellets · ${dtIst(hour)}` : undefined}
        />
        <KpiCard
          icon={Route} tone="violet" label="Still afloat" loading={summary.isLoading}
          value={s ? `${s.pellets.afloat_pct}%` : "—"} sub="still moving; can still reach new coast"
        />
        <KpiCard
          icon={MapPin} tone="ok" label="Districts reached" loading={forecast.isLoading}
          value={reached}
          sub={v ? `${v.reported_districts_hit} of ${v.reported_districts_total} reported districts in the 14-day forecast` : undefined}
        />
      </div>

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
                  <Th>District</Th><Th numeric>Forecast share</Th><Th>First arrival</Th>
                  <Th>Half arrived by</Th><Th>Reported ashore</Th>
                </tr>
              </thead>
              <tbody>
                {(f?.districts ?? []).map((d) => (
                  <Tr key={d.district}>
                    <Td><b>{d.district}</b></Td>
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
