import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { axisProps, tooltipStyle, useChartTheme } from "@/components/charts/theme";
import type { DistrictForecast } from "@/lib/types";

export function LandfallBars({ districts, height = 240 }: { districts: DistrictForecast[]; height?: number }) {
  const t = useChartTheme();
  const data = districts.map((d) => ({
    name: d.district + (d.reported_ashore ? " ✓" : ""),
    share: Number(d.share_pct.toFixed(1)),
    reported: d.reported_ashore,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 14, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => `${v}%`} {...axisProps(t.axis)} />
        <YAxis type="category" dataKey="name" width={132} {...axisProps(t.axis)} />
        <Tooltip {...tooltipStyle(t)} formatter={(v: number) => [`${v}% of pellets`, "Forecast"]} cursor={{ fill: t.grid, opacity: 0.4 }} />
        <Bar dataKey="share" radius={[0, 5, 5, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.name} fill={d.reported ? t.brand : t.muted} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
