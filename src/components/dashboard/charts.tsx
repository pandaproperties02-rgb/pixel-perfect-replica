import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactKes, kes } from "@/lib/format";

const axis = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const grid = "var(--color-border)";
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const tooltipStyle = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
  },
};

export function TrendChart({ data, height = 260 }: { data: { label: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => compactKes(v)} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => kes(v)} />
        <Area type="monotone" dataKey="value" name="Revenue" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({
  data,
  height = 260,
  horizontal,
  money = true,
  series = [{ key: "value", name: "Value" }],
}: {
  data: Record<string, string | number>[];
  height?: number;
  horizontal?: boolean;
  money?: boolean;
  series?: { key: string; name: string }[];
}) {
  const fmt = (v: number) => (money ? compactKes(v) : String(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid stroke={grid} vertical={!horizontal} horizontal={!!horizontal ? false : true} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={fmt} />
            <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={130} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={60} tickFormatter={fmt} />
          </>
        )}
        <Tooltip {...tooltipStyle} formatter={(v: number) => (money ? kes(v) : v)} cursor={{ fill: "var(--color-muted)" }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={CHART_COLORS[i % 5]} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 260, money = true }: { data: { label: string; value: number }[]; height?: number; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % 5]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v: number) => (money ? kes(v) : v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
