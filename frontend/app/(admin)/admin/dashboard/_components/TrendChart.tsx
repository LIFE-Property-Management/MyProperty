"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface TrendSeries {
  // Key into each data point.
  key: string;
  // Human label shown in the legend / tooltip.
  name: string;
  // CSS color (a design-system token var, so it auto-flips in dark mode).
  color: string;
}

interface TrendChartProps {
  title: string;
  // Each point already carries a formatted x-axis label plus one numeric field
  // per series key.
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: TrendSeries[];
  // Optional value formatter for the tooltip (e.g. currency amounts).
  valueFormatter?: (value: number) => string;
}

const AXIS_COLOR = "var(--color-muted-text)";
const GRID_COLOR = "var(--color-border)";

// One reusable line chart, fed different series by the dashboard page (user
// growth, lease growth, invites sent vs accepted, revenue per currency). Client
// component — recharts needs the DOM. Data fetching stays in the TanStack hook.
export function TrendChart({ title, data, xKey, series, valueFormatter }: TrendChartProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-text mb-4">{title}</h3>
      <div className="h-64 w-full" data-testid="trend-chart" aria-label={title} role="img">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke={AXIS_COLOR}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
            />
            <YAxis
              stroke={AXIS_COLOR}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              formatter={
                valueFormatter
                  ? (value: unknown) => valueFormatter(Number(value))
                  : undefined
              }
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                fontSize: "0.8125rem",
              }}
            />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.8125rem" }} />}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default TrendChart;
