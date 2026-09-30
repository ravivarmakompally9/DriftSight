import { Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useRun, useSitrep } from "@/hooks/queries";
import { api } from "@/lib/api";
import { latlon, num, pct } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

export default function Report() {
  const hour = useAppStore((s) => s.hour);
  const run = useRun();
  const { data, isLoading, isError, error, refetch } = useSitrep(hour);

  if (isError) return <ErrorState message={(error as Error).message} retry={() => refetch()} />;

  const copy = () => {
    const el = document.getElementById("sitrep");
    if (!el) return;
    navigator.clipboard?.writeText(el.innerText).then(
      () => toast.success("Report copied"),
      () => toast.error("Copy blocked — select the text instead"),
    );
  };

  return (
    <div className="grid gap-3.5">
      <div className="mx-auto flex w-full max-w-[860px] justify-end gap-2">
        <Button onClick={copy} disabled={isLoading}>
          <Copy size={15} />
          Copy report text
        </Button>
        <Button variant="default" asChild>
          <a href={api.sitrepPdfUrl(run.data?.id ?? "latest", hour)} download>
            <Download size={15} />
            Download PDF
          </a>
        </Button>
      </div>

      {isLoading || !data ? (
        <div className="mx-auto w-full max-w-[860px] card-surface p-10">
          <Skeleton className="mb-3 h-7 w-2/3" />
          <Skeleton className="mb-6 h-4 w-1/3" />
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="mb-2 h-3.5" />)}
        </div>
      ) : (
        <article
          id="sitrep"
          className="mx-auto w-full max-w-[860px] rounded-xl border border-line bg-surface px-6 py-8 shadow-card sm:px-12 sm:py-10"
        >
          <header className="mb-6 grid gap-4 border-b-2 border-ink pb-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-3">Situation report · marine debris</div>
              <h2 className="mt-1 font-display text-[26px] font-extrabold leading-tight">
                {data.incident} — floating debris &amp; pellet drift
              </h2>
            </div>
            <div className="font-mono text-[12.5px] sm:text-right">
              <div>As of {data.as_of}</div>
              <div className="text-ink-3">Prepared by DriftSight · prototype</div>
            </div>
          </header>

          <p className="mb-3 max-w-[70ch] leading-relaxed">
            <b>Summary.</b> {data.summary}
          </p>

          <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.facts.map((f) => (
              <div key={f.label} className="rounded-lg border border-line px-3 py-2.5">
                <b className="block font-display text-[24px] leading-none text-brand tnum">{f.value}</b>
                <small className="mt-1 block text-xs text-ink-2">{f.label}</small>
              </div>
            ))}
          </div>

          <Section title="Tracked patches">
            {data.tracks.length ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th>Patch</Th><Th>First seen</Th><Th numeric>Area</Th><Th numeric>Confidence</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {data.tracks.map((t) => (
                      <Tr key={t.id}>
                        <Td>{t.id}</Td>
                        <Td>{t.first_seen}</Td>
                        <Td numeric>{num(t.area_m2)} m²</Td>
                        <Td numeric>{pct(t.confidence)}</Td>
                        <Td className="capitalize">{t.status}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : <p>No patches detected yet.</p>}
          </Section>

          <Section title="Pellet landfall outlook">
            <p className="max-w-[70ch] leading-relaxed">{data.landfall_line}</p>
          </Section>

          <Section title="Priority actions">
            {data.priorities.length ? (
              <ol className="ml-5 list-decimal space-y-1.5">
                {data.priorities.map((z) => (
                  <li key={z.name} className="max-w-[70ch] leading-relaxed">
                    <b>{z.level}</b> — {z.name} (<span className="font-mono text-[12.5px]">{latlon(z.lat, z.lon)}</span>):{" "}
                    {z.action} Nearest harbour {z.harbour}.
                  </li>
                ))}
              </ol>
            ) : <p>No zones need action at this time.</p>}
          </Section>

          <Section title="Missions">
            <p>
              {data.missions.total
                ? `${data.missions.planned} planned, ${data.missions.in_progress} in progress, ${data.missions.completed} completed.`
                : "No missions created yet."}
            </p>
          </Section>

          <Section title="Data & method">
            <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-ink-2">{data.method}</p>
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-sunken px-3 py-2 text-[12px] text-ink-2">
              <FileText size={13} className="mt-0.5 shrink-0" />
              {data.caveat}
            </p>
          </Section>
        </article>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 mt-6 text-[13px] font-bold uppercase tracking-wider text-ink-2">{title}</h3>
      {children}
    </section>
  );
}
