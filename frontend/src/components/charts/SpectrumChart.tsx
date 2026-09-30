import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { axisProps, tooltipStyle, useChartTheme } from "@/components/charts/theme";

const BANDS = ["B2", "B3", "B4", "B6", "B8", "B11"];
const NM = [490, 560, 665, 740, 842, 1610];

/** Detected pixels against the surrounding water and the plastic reference. */
export function SpectrumChart({
  detected, water, reference, height = 200,
}: { detected: number[]; water: number[]; reference: number[]; height?: number }) {
  const t = useChartTheme();
  const data = BANDS.map((b, i) => ({
    band: `${b} ${NM[i]}`,
    Detected: detected[i],
    Water: water[i],
    Plastic: reference[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="band" {...axisProps(t.axis)} tick={{ fill: t.axis, fontSize: 9.5 }} interval={0} />
        <YAxis {...axisProps(t.axis)} tickFormatter={(v) => v.toFixed(2)} />
        <Tooltip {...tooltipStyle(t)} formatter={(v: number, n: string) => [v.toFixed(4), n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11.5, color: t.text, paddingTop: 4 }} />
        <Line dataKey="Detected" name="Detected pixels" stroke={t.brand} strokeWidth={2.5} dot={{ r: 2.5 }} isAnimationActive={false} />
        <Line dataKey="Water" name="Surrounding water" stroke={t.axis} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
        <Line dataKey="Plastic" name="Plastic reference" stroke={t.warn} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SpectralLibrary({
  spectra, wavelengths, bands, height = 240,
}: { spectra: Record<string, number[]>; wavelengths: number[]; bands: string[]; height?: number }) {
  const t = useChartTheme();
  const keys: [string, string][] = [
    ["debris", t.brand], ["foam", t.axis], ["algae", t.ok], ["water", t.current],
  ];
  const data = bands.map((b, i) => {
    const row: Record<string, string | number> = { band: `${b} ${wavelengths[i]}` };
    keys.forEach(([k]) => { row[k] = spectra[k]?.[i] ?? 0; });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis dataKey="band" {...axisProps(t.axis)} tick={{ fill: t.axis, fontSize: 9.5 }} interval={0} />
        <YAxis {...axisProps(t.axis)} tickFormatter={(v) => v.toFixed(2)} />
        <Tooltip {...tooltipStyle(t)} formatter={(v: number, n: string) => [v.toFixed(3), n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11.5, color: t.text, paddingTop: 4 }} />
        {keys.map(([k, c]) => (
          <Line key={k} dataKey={k} name={k} stroke={c} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
