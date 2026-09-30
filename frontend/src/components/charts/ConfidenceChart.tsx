import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { axisProps, tooltipStyle, useChartTheme } from "@/components/charts/theme";
import { seriesColor } from "@/lib/colors";
import { dayLabel, dtIst, HOURS } from "@/lib/time";
import type { Track } from "@/lib/types";

/**
 * Confidence as a stepped line: it only ever changes when a satellite looks.
 * Flat stretches are the model predicting through cloud.
 */
export function ConfidenceChart({
  tracks, hour, height = 240, legend = true,
}: { tracks: Track[]; hour: number; height?: number; legend?: boolean }) {
  const t = useChartTheme();

  const data: Record<string, number | null>[] = [];
  const hours = new Set<number>([0]);
  tracks.forEach((tr) => tr.history.forEach((p) => p.h <= hour && hours.add(p.h)));
  hours.add(hour);

  for (const h of [...hours].sort((a, b) => a - b)) {
    const row: Record<string, number | null> = { h };
    tracks.forEach((tr) => {
      const seen = tr.history.filter((p) => p.h <= Math.min(h, hour));
      const last = seen[seen.length - 1];
      const ended = tr.landed_hour !== null && h > tr.landed_hour;
      row[tr.id] = last && !ended ? Math.round(last.confidence * 100) : null;
    });
    data.push(row);
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="h" type="number" domain={[0, HOURS]} ticks={[0, 48, 96, 144, 192, 240, 288, 336]}
          tickFormatter={dayLabel} {...axisProps(t.axis)}
        />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} {...axisProps(t.axis)} />
        <Tooltip
          {...tooltipStyle(t)}
          labelFormatter={(h) => dtIst(Number(h))}
          formatter={(v: number, name: string) => [`${v}%`, name]}
        />
        {legend && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.text, paddingTop: 6 }} />}
        {tracks.map((tr, i) => (
          <Line
            key={tr.id} type="stepAfter" dataKey={tr.id}
            stroke={seriesColor(i)} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: seriesColor(i) }}
            activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
