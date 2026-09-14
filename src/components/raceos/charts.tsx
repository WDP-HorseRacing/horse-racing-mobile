import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted-foreground)", fontSize: 10 },
  tickLine: false,
  axisLine: false,
};

const tooltipProps = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border-strong)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11 },
} as const;

export function TrendArea({
  data,
  xKey,
  yKey,
  color = "var(--fit)",
  height = 130,
  domain,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  domain?: [number, number];
}) {
  const id = `grad-${yKey}-${color.replace(/[^a-z]/gi, "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} domain={domain ?? ["auto", "auto"]} width={40} />
          <Tooltip {...tooltipProps} />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            animationDuration={700}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DualLine({
  data,
  xKey,
  keys,
  height = 150,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  keys: { key: string; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} width={40} />
          <Tooltip {...tooltipProps} />
          {keys.map((k) => (
            <Line
              key={k.key}
              type="monotone"
              dataKey={k.key}
              stroke={k.color}
              strokeWidth={2}
              dot={false}
              animationDuration={700}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LoadBars({
  data,
  xKey,
  yKey,
  height = 120,
  color = "var(--training)",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  color?: string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} width={40} />
          <Tooltip {...tooltipProps} />
          <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompareBars({
  data,
  xKey,
  keys,
  height = 160,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  keys: { key: string; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} {...axis} />
          <YAxis {...axis} width={40} />
          <Tooltip {...tooltipProps} />
          {keys.map((k) => (
            <Bar key={k.key} dataKey={k.key} fill={k.color} radius={[4, 4, 0, 0]} animationDuration={700} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-4 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
