import { Switch } from "@/components/ui/switch";
import { token } from "@/lib/utils";
import { useAppStore, type LayerState } from "@/store/useAppStore";

const LAYERS: { key: keyof LayerState; label: string; swatch: () => string }[] = [
  { key: "currents", label: "Ocean currents", swatch: () => token("--current") },
  { key: "pellets", label: "Pellet forecast", swatch: () => token("--pellet") },
  { key: "tracks", label: "Debris tracks", swatch: () => token("--ok") },
  { key: "detections", label: "AI detections", swatch: () => token("--text") },
  { key: "zones", label: "Priority zones", swatch: () => token("--crit") },
  { key: "cloud", label: "Cloud cover", swatch: () => "#AEB8C8" },
  { key: "truth", label: "Hidden truth (demo)", swatch: () => token("--violet") },
];

const LEGEND = [
  { label: "Confirmed plastic", color: "--ok" },
  { label: "Unconfirmed candidate", color: "--warn" },
  { label: "Rejected — not plastic", color: "--crit" },
  { label: "Washed ashore", color: "--violet" },
  { label: "Forecast pellets", color: "--pellet" },
];

export function LayerPanel() {
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);

  return (
    <div className="panel-blur absolute left-4 top-4 z-20 w-[228px] rounded-xl border border-line p-3 shadow-float max-sm:hidden">
      <h4 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">Layers</h4>
      {LAYERS.map((l) => (
        <label
          key={l.key}
          className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-[13px] hover:bg-sunken"
        >
          <span className="h-3 w-3 shrink-0 rounded" style={{ background: l.swatch() }} aria-hidden />
          <span className="flex-1 truncate">{l.label}</span>
          <Switch checked={layers[l.key]} onCheckedChange={() => toggleLayer(l.key)} aria-label={l.label} />
        </label>
      ))}
      <div className="mt-2.5 grid gap-1.5 border-t border-line pt-2.5 text-[12px] text-ink-2">
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
      <p className="mt-2.5 border-t border-line pt-2.5 text-[11.5px] leading-snug text-ink-3">
        Rings are debris fields the detector flagged, coloured by whether a later pass
        confirmed them. Orange dots are forecast pellet positions — nurdles are too
        small to see from orbit, so they are modelled, never detected.
      </p>
    </div>
  );
}
