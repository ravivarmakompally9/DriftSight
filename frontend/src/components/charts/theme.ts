import { useEffect, useState } from "react";

import { token } from "@/lib/utils";

/** Re-reads the design tokens whenever the theme flips, so charts repaint. */
export function useChartTheme() {
  const [, bump] = useState(0);
  useEffect(() => {
    const onTheme = () => bump((n) => n + 1);
    window.addEventListener("ds-theme", onTheme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onTheme);
    return () => { window.removeEventListener("ds-theme", onTheme); mq.removeEventListener("change", onTheme); };
  }, []);

  return {
    grid: token("--border"),
    axis: token("--text-3"),
    text: token("--text-2"),
    surface: token("--surface"),
    brand: token("--brand"),
    ok: token("--ok"),
    warn: token("--warn"),
    crit: token("--crit"),
    violet: token("--violet"),
    pellet: token("--pellet"),
    current: token("--current"),
    muted: token("--border-2"),
  };
}

export const axisProps = (axis: string) => ({
  stroke: axis,
  tick: { fill: axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

export function tooltipStyle(t: ReturnType<typeof useChartTheme>) {
  return {
    contentStyle: {
      background: t.surface,
      border: `1px solid ${t.grid}`,
      borderRadius: 10,
      fontSize: 12.5,
      boxShadow: "0 8px 30px rgb(14 26 43 / 0.12)",
      color: token("--text"),
    },
    labelStyle: { color: t.text, fontWeight: 600, marginBottom: 2 },
    itemStyle: { padding: 0 },
  };
}
