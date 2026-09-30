import { useEffect, useState } from "react";
import { Cloud, Database, Flag, Loader2, RotateCcw, Satellite, Waves } from "lucide-react";

import { SpectralLibrary } from "@/components/charts/SpectrumChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardSub, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useModel, usePasses, useRerun, useRun } from "@/hooks/queries";
import type { RunParams } from "@/lib/types";
import { cn, num, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const DEFAULTS: RunParams = {
  gate_km: 16, confirm: 0.8, reject: 0.25, cloud_decay: 0.9, miss_lr: 0.25, nurdles: 1600, seed: 2025,
};

const CONTROLS: {
  key: keyof RunParams; label: string; min: number; max: number; step: number;
  format: (v: number) => string; hint: string;
}[] = [
  { key: "gate_km", label: "Search radius around forecast", min: 6, max: 30, step: 1,
    format: (v) => `${v} km`,
    hint: "How far from the predicted spot a new sighting still counts as the same patch." },
  { key: "confirm", label: "Confirm threshold", min: 0.6, max: 0.95, step: 0.01,
    format: (v) => pct(v), hint: "Confidence needed to mark a patch as real debris." },
  { key: "reject", label: "Reject threshold", min: 0.05, max: 0.45, step: 0.01,
    format: (v) => pct(v), hint: "Below this, the patch is dropped as a look-alike." },
  { key: "cloud_decay", label: "Confidence kept under cloud", min: 0.7, max: 1, step: 0.01,
    format: (v) => pct(v), hint: "Odds multiplier per clouded pass." },
  { key: "nurdles", label: "Virtual pellets", min: 400, max: 3000, step: 100,
    format: (v) => num(v), hint: "More pellets give a smoother landfall forecast and a slower run." },
];

const SOURCE_ICON: Record<string, typeof Satellite> = {
  satellite: Satellite, waves: Waves, wind: Cloud, database: Database, flag: Flag,
};

const SOURCE_TONE = { used: "ok", simulated: "warn", planned: "neutral" } as const;

export default function DataModels() {
  const model = useModel();
  const run = useRun();
  const passes = usePasses();
  const rerun = useRerun();
  const setHour = useAppStore((s) => s.setHour);
  const [params, setParams] = useState<RunParams>(DEFAULTS);

  useEffect(() => { if (run.data) setParams(run.data.params); }, [run.data]);

  const m = model.data;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Debris detector</CardTitle>
            <CardSub>per-pixel classifier · trained on synthetic labelled spectra</CardSub>
          </CardHeader>
          <CardBody className="grid gap-3">
            {model.isLoading || !m ? <Skeleton className="h-52" /> : (
              <>
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <Figure value={`${(m.accuracy * 100).toFixed(1)}%`} label="held-out accuracy" />
                  <Figure value={num(m.n_train)} label="training pixels" />
                  <Figure value={m.features.length} label="features: 6 bands + FDI, NDVI, NDWI" />
                </div>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>True ↓ / predicted →</Th>
                        {m.classes.map((c) => <Th key={c} numeric>{c}</Th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {m.confusion.map((row, i) => (
                        <Tr key={i}>
                          <Td><b>{m.classes[i]}</b></Td>
                          {row.map((v, j) => (
                            <Td key={j} numeric
                              className={cn(i === j && "font-semibold text-ok", i !== j && v > 5 && "text-warn")}>
                              {v}
                            </Td>
                          ))}
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>

                <p className="text-xs leading-relaxed text-ink-3">
                  The boundary is kept deliberately soft: a model that never confuses sun glint with plastic
                  would not match any published single-image detector, and would make tracking pointless.
                  Production: {m.production_plan}
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spectral library</CardTitle>
            <CardSub>what the detector separates</CardSub>
          </CardHeader>
          <CardBody>
            {model.isLoading || !m ? <Skeleton className="h-[240px]" /> : (
              <SpectralLibrary spectra={m.spectra} wavelengths={m.wavelengths_nm} bands={m.bands} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tracking parameters</CardTitle>
            <CardSub>change and re-run the full 14-day analysis</CardSub>
          </CardHeader>
          <CardBody className="grid gap-5">
            {CONTROLS.map((c) => (
              <div key={c.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`r-${c.key}`}>{c.label}</Label>
                  <output className="font-mono text-[13px] font-semibold tnum">
                    {c.format(params[c.key] as number)}
                  </output>
                </div>
                <Slider
                  id={`r-${c.key}`}
                  min={c.min} max={c.max} step={c.step}
                  value={[params[c.key] as number]}
                  onValueChange={([v]) => setParams((p) => ({ ...p, [c.key]: v }))}
                  aria-label={c.label}
                />
                <span className="text-xs text-ink-3">{c.hint}</span>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button variant="default" disabled={rerun.isPending} onClick={() => rerun.mutate(params)}>
                {rerun.isPending ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                {rerun.isPending ? "Re-running…" : "Re-run analysis"}
              </Button>
              <Button variant="ghost" onClick={() => setParams(DEFAULTS)}>Reset defaults</Button>
            </div>

            {run.data && (
              <p className="text-xs text-ink-3">
                Current run #{run.data.id} finished in {run.data.runtime_ms} ms ·{" "}
                {run.data.metrics.real_confirmed} real fields confirmed ·{" "}
                {run.data.metrics.false_confirmed} false alarms confirmed ·{" "}
                {run.data.metrics.rejected} look-alikes rejected.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Data sources</CardTitle></CardHeader>
          <CardBody>
            <div className="flex flex-col">
              {(m?.data_sources ?? []).map((src) => {
                const Icon = SOURCE_ICON[src.icon] ?? Database;
                return (
                  <div key={src.name} className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold">{src.name}</div>
                      <div className="text-xs text-ink-3">{src.purpose}</div>
                      <div className="text-xs text-ink-3">{src.detail}</div>
                    </div>
                    <Badge tone={SOURCE_TONE[src.state]} dot className="capitalize">{src.state}</Badge>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Satellite passes</CardTitle>
          <CardSub>click a row to jump the replay to that pass</CardSub>
        </CardHeader>
        <TableWrap className="mt-2.5">
          <Table>
            <thead>
              <tr><Th>Date</Th><Th>Time (IST)</Th><Th>Sensor</Th><Th>Sky</Th><Th numeric>Detections</Th></tr>
            </thead>
            <tbody>
              {(passes.data ?? []).map((p) => (
                <Tr key={p.label} clickable onClick={() => setHour(p.h + 1)}>
                  <Td>{p.label}</Td>
                  <Td className="font-mono">{p.time_ist}</Td>
                  <Td>{p.sensor}</Td>
                  <Td>
                    <span className={cn("font-semibold",
                      p.sky === "clear" ? "text-ok" : p.sky === "partial" ? "text-warn" : "text-ink-3")}>
                      {p.sky_label}
                    </span>
                  </Td>
                  <Td numeric>{p.detections ?? 0}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}

function Figure({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="font-display text-[30px] font-bold leading-none tnum">{value}</div>
      <div className="mt-1 text-xs text-ink-3">{label}</div>
    </div>
  );
}
