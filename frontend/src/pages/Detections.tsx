import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2, MapPin, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { ChipPair } from "@/components/ChipCanvas";
import { SpectrumChart } from "@/components/charts/SpectrumChart";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/Pills";
import { Row } from "@/components/TrackDetail";
import { Button } from "@/components/ui/button";
import { Card, CardActions, CardBody, CardHeader, CardSub, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDetection, useDetections, useModel, useSummary } from "@/hooks/queries";
import { api, ApiError } from "@/lib/api";
import type { UploadResult } from "@/lib/types";
import { latlon, num, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const FILTERS = [
  ["all", "All"], ["confirmed", "Confirmed"], ["watch", "Watching"], ["rejected", "Rejected"],
] as const;

export default function Detections() {
  const navigate = useNavigate();
  const hour = useAppStore((s) => s.hour);
  const select = useAppStore((s) => s.select);
  const showTruth = useAppStore((s) => s.layers.truth);
  const [filter, setFilter] = useState<string>("all");
  const [picked, setPicked] = useState<number | null>(null);

  const list = useDetections(hour);
  const summary = useSummary(hour);
  const model = useModel();

  const rows = useMemo(() => {
    const all = list.data ?? [];
    return all.filter((d) => filter === "all" || d.status === filter).slice().reverse();
  }, [list.data, filter]);

  const currentId = rows.find((d) => d.id === picked)?.id ?? rows[0]?.id ?? null;
  const detail = useDetection(currentId);

  if (list.isLoading) {
    return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  }

  if (!list.data?.length) {
    return (
      <Card>
        <EmptyState
          icon={ScanSearch}
          title="No detections yet at this time"
          hint="The first clear pass is 27 May, 11:00 IST — move the time forward in the top bar."
        />
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader>
          <CardTitle>AI detections</CardTitle>
          <CardSub>{list.data.length} from {summary.data?.passes_done ?? 0} passes</CardSub>
          <CardActions className="max-sm:w-full max-sm:justify-start">
            <UploadButton />
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList aria-label="Filter detections">
                {FILTERS.map(([k, label]) => <TabsTrigger key={k} value={k}>{label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </CardActions>
        </CardHeader>

        <TableWrap className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th>ID</Th><Th>Pass</Th><Th>Where</Th><Th numeric>How much</Th>
                <Th>Plastic likelihood</Th><Th>Track</Th><Th>Verdict</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <Tr key={d.id} clickable selected={d.id === currentId} onClick={() => setPicked(d.id)}>
                  <Td className="font-mono">{d.ref}</Td>
                  <Td>{d.as_of}</Td>
                  <Td>
                    <div>{d.where ?? latlon(d.lat, d.lon)}</div>
                    <div className="font-mono text-[11px] text-ink-3">{latlon(d.lat, d.lon)}</div>
                  </Td>
                  <Td numeric>{num(d.area_m2)} m²</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-[60px] overflow-hidden rounded-full bg-sunken">
                        <b className="block h-full rounded-full bg-brand" style={{ width: `${d.score * 100}%` }} />
                      </span>
                      <span className="font-mono text-[12px] tnum">{pct(d.score)}</span>
                    </div>
                  </Td>
                  <Td>{d.track ?? "—"}</Td>
                  <Td><StatusPill status={d.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {!rows.length && <EmptyState icon={ScanSearch} title="No detections match this filter" />}
      </Card>

      {detail.data && (
        <Card className="xl:sticky xl:top-0">
          <CardHeader>
            <CardTitle>{detail.data.ref}</CardTitle>
            <StatusPill status={detail.data.status} />
            <CardActions>
              <Button
                size="sm"
                onClick={() => {
                  if (detail.data?.track) select({ type: "track", id: detail.data.track });
                  navigate("/map");
                }}
              >
                <MapPin size={14} />
                Show on map
              </Button>
            </CardActions>
          </CardHeader>
          <CardBody className="grid gap-3.5">
            {detail.data.chip && <ChipPair chip={detail.data.chip} />}
            {detail.data.spectrum && model.data && (
              <SpectrumChart
                detected={detail.data.spectrum.detected}
                water={detail.data.spectrum.water}
                reference={model.data.spectra.debris}
              />
            )}
            <dl className="m-0 grid grid-cols-[minmax(110px,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px]">
              <Row label="Sensor" value={detail.data.sensor} />
              <Row label="Plastic likelihood" value={pct(detail.data.score)} />
              <Row label="Where" value={detail.data.where ?? "—"} />
              <Row label="How much" value={detail.data.area_phrase ?? `${num(detail.data.area_m2)} m²`} />
              <Row label="Pixels above 50%" value={`${detail.data.pixels} (${num(detail.data.area_m2)} m²)`} />
              <Row label="Mean FDI" value={detail.data.fdi.toFixed(3)} />
              <Row label="Linked track" value={detail.data.track ?? "—"} />
            </dl>
            <p className="text-xs leading-relaxed text-ink-3">
              A single image cannot separate plastic from look-alikes reliably. DriftSight waits for the
              next clear pass: real debris re-appears where the currents predicted.
              {showTruth && detail.data.track && " Turn off the hidden-truth layer to judge it blind."}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function UploadButton() {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    try {
      setResult(await api.uploadGeotiff(file));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={ref} type="file" accept=".tif,.tiff,image/tiff" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Button size="sm" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
        Upload GeoTIFF
      </Button>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>Detector run on {result?.filename}</DialogTitle>
            <DialogDescription>
              {result?.width} × {result?.height} px · {result?.crs ?? "no CRS"} ·{" "}
              {num(result?.pixels_above_threshold ?? 0)} pixels above the 50 % threshold
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {result?.detections.length ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th numeric>Pixels</Th><Th numeric>Area</Th><Th numeric>Mean P(debris)</Th><Th numeric>Mean FDI</Th><Th>Centre</Th></tr>
                  </thead>
                  <tbody>
                    {result.detections.map((d, i) => (
                      <Tr key={i}>
                        <Td numeric>{num(d.px)}</Td>
                        <Td numeric>{num(Math.round(d.area_m2))} m²</Td>
                        <Td numeric>{pct(d.mean_probability)}</Td>
                        <Td numeric>{d.mean_fdi.toFixed(4)}</Td>
                        <Td className="font-mono">{d.centre.x.toFixed(4)}, {d.centre.y.toFixed(4)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState icon={ScanSearch} title="Nothing above the threshold" hint={result?.note} />
            )}
            <p className="text-xs text-ink-3">{result?.note}</p>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
