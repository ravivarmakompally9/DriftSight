import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { axisProps, tooltipStyle, useChartTheme } from "@/components/charts/theme";
import { seriesColor } from "@/lib/colors";
import { dayLabel, dtIst, HOURS } from "@/lib/time";
import type { ForecastReport } from "@/lib/types";

export function CumulativeLandfall({
  report, hour, height = 280,
}: { report: ForecastReport; hour: number; height?: number }) {
  const t = useChartTheme();
  const series = report.districts.filter((d) => d.pellets > 0);
  const data = report.hours.map((h, i) => {
    const row: Record<string, number> = { h };
    series.forEach((d) => { row[d.district] = d.cumulative_pct[i]; });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
        <defs>
          {series.map((d, i) => (
            <linearGradient key={d.district} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor(i)} stopOpacity={0.22} />
              <stop offset="100%" stopColor={seriesColor(i)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="h" type="number" domain={[0, HOURS]} ticks={[0, 48, 96, 144, 192, 240, 288, 336]}
          tickFormatter={dayLabel} {...axisProps(t.axis)}
        />
        <YAxis tickFormatter={(v) => `${v}%`} {...axisProps(t.axis)} />
        <Tooltip {...tooltipStyle(t)} labelFormatter={(h) => dtIst(Number(h))} formatter={(v: number, n: string) => [`${v}%`, n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.text, paddingTop: 6 }} />
        <ReferenceLine
          x={hour} stroke={t.crit} strokeDasharray="4 4"
          label={{ value: "now", position: "top", fill: t.crit, fontSize: 11 }}
        />
        {series.map((d, i) => (
          <Area key={`a-${d.district}`} type="monotone" dataKey={d.district} stroke="none"
            fill={`url(#fill-${i})`} isAnimationActive={false} legendType="none" />
        ))}
        {series.map((d, i) => (
          <Line key={d.district} type="monotone" dataKey={d.district} stroke={seriesColor(i)}
            strokeWidth={2} dot={false} isAnimationActive={false} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
