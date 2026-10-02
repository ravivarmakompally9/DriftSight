import { Switch } from "@/components/ui/switch";
import { useCurrents } from "@/hooks/queries";
import { token } from "@/lib/utils";
import { useAppStore, type LayerState } from "@/store/useAppStore";

/**
 * Grouped by what the data *is*, and every layer states its provenance.
 * Global Fishing Watch does this and it is the single most useful thing on
 * their map: a toggle that does not say where its data came from, or in what
 * units, leaves the reader guessing. Here it also carries the distinction the
 * whole product turns on — detected versus modelled.
 */
type Row = {
  key: keyof LayerState;
  label: string;
  source: string;
  swatch: () => string;
  modelled?: boolean;
};

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Detected",
    rows: [
      { key: "tracks", label: "Debris fields", source: "Sentinel-2 · classifier", swatch: () => token("--ok") },
      { key: "detections", label: "AI detections", source: "per-pass candidates", swatch: () => token("--text") },
    ],
  },
  {
    title: "Modelled",
    rows: [
      { key: "pellets", label: "Pellet forecast", source: "drift model · never detected", swatch: () => token("--pellet"), modelled: true },
      { key: "currents", label: "Ocean currents", source: "synthetic monsoon field", swatch: () => token("--current"), modelled: true },
      { key: "zones", label: "Priority zones", source: "derived ranking", swatch: () => token("--crit"), modelled: true },
    ],
  },
  {
    title: "Context",
    rows: [
      { key: "cloud", label: "Cloud cover", source: "per-pass sky state", swatch: () => "#AEB8C8" },
      { key: "truth", label: "Hidden truth", source: "demo only — the answer key", swatch: () => token("--violet") },
    ],
  },
];

const LEGEND = [
  { label: "Confirmed plastic", color: "--ok" },
  { label: "Unconfirmed candidate", color: "--warn" },
  { label: "Rejected — not plastic", color: "--crit" },
  { label: "Washed ashore", color: "--violet" },
];

export function LayerPanel() {
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const hour = useAppStore((s) => s.hour);
  const { data: currents } = useCurrents(hour, "75.4,7.2,80.0,10.2", layers.currents);

  return (
    <div className="panel-blur absolute left-4 top-4 z-20 max-h-[calc(100%-150px)] w-[246px] overflow-y-auto rounded-xl border border-line p-3 shadow-float max-sm:hidden">
      {GROUPS.map((g) => (
        <section key={g.title} className="mb-3 last:mb-0">
          <h4 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">{g.title}</h4>
          {g.rows.map((l) => (
            <label key={l.key} className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-sunken">
              <span className="mt-1 h-3 w-3 shrink-0 rounded" style={{ background: l.swatch() }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-tight">{l.label}</span>
                <span className="block truncate text-[10.5px] leading-tight text-ink-3">{l.source}</span>
              </span>
              <Switch checked={layers[l.key]} onCheckedChange={() => toggleLayer(l.key)} aria-label={l.label} className="mt-0.5" />
            </label>
          ))}
        </section>
      ))}

      {/* a colour ramp with real units, rather than a bare swatch */}
      {layers.currents && currents && (
        <div className="mb-3 rounded-md bg-sunken px-2 py-1.5">
          <div className="text-[10.5px] text-ink-3">Current speed</div>
          <div
            className="my-1 h-1.5 rounded-full"
            style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${token("--current")} 25%, transparent), ${token("--current")})` }}
          />
          <div className="flex justify-between font-mono text-[10px] text-ink-3 tnum">
            <span>0</span><span>{currents.max_speed.toFixed(2)} m/s</span>
          </div>
        </div>
      )}

      <div className="grid gap-1.5 border-t border-line pt-2.5 text-[12px] text-ink-2">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${l.color})` }} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <b className="w-2.5 text-center text-crit">✕</b> MSC ELSA 3 wreck
        </span>
      </div>

      <p className="mt-2.5 border-t border-line pt-2.5 text-[11px] leading-snug text-ink-3">
        Nurdles are millimetres across — nothing in orbit can see one. Every orange
        dot is a forecast position, never an observation.
      </p>
    </div>
  );
}
