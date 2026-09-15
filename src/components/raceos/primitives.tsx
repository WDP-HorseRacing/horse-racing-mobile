import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Horse, HorseStatus, Task, AlertItem } from "@/lib/raceos-data";

/* ---------------------------------- status --------------------------------- */

const statusStyles: Record<HorseStatus, string> = {
  FIT: "bg-fit-soft text-fit",
  MONITOR: "bg-monitor-soft text-monitor",
  INJURED: "bg-injured-soft text-injured",
  LOCKED: "bg-locked-soft text-locked",
  TRAINING: "bg-training-soft text-training",
  "RACE READY": "bg-raceready-soft text-raceready",
};

export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: HorseStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium tracking-wide uppercase",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        statusStyles[status],
        className,
      )}
    >
      {status === "LOCKED" ? <LockGlyph /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {status}
    </span>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/* --------------------------------- sections -------------------------------- */

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel p-4", className)}>{children}</div>;
}

/* ------------------------------- metric card ------------------------------- */

export function MetricCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "default" | "fit" | "monitor" | "injured" | "training" | "raceready";
  className?: string;
}) {
  const toneText: Record<string, string> = {
    default: "text-foreground",
    fit: "text-fit",
    monitor: "text-monitor",
    injured: "text-injured",
    training: "text-training",
    raceready: "text-raceready",
  };
  return (
    <div className={cn("panel min-w-0 p-3.5", className)}>
      <p className="truncate text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{label}</p>
      <p className={cn("num mt-2 text-2xl leading-none font-semibold", toneText[tone])}>
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* --------------------------------- avatar ---------------------------------- */

const coatTone: Record<string, string> = {
  Bay: "from-monitor/50 to-injured/40",
  Grey: "from-muted-foreground/40 to-border-strong",
  Chestnut: "from-injured/50 to-monitor/30",
  Black: "from-foreground/25 to-background",
  Palomino: "from-monitor/60 to-monitor/20",
  "Dark bay": "from-injured/35 to-foreground/20",
};

export function HorseAvatar({
  horse,
  size = 44,
  className,
}: {
  horse: Horse;
  size?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-gradient-to-br",
        coatTone[horse.color] ?? "from-muted to-elevated",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-foreground/70" fill="currentColor">
        <path d="M4 20v-4c0-3.3 2.7-6 6-6h1.2l1.6-3.2 1.2-2.6c.2-.5.9-.5 1.1 0L17 6h2.2c.4 0 .8.4.8.8v2c0 1.3-.9 2.4-2.1 2.7l-.6.2-.3 2.4c-.2 1.5-.6 2.9-1.3 4.2l-.3.5h-2.6l.7-2.4-2.9.6-.6 1.8H7.4l.6-2.4c-1.1.4-2 1.3-2 2.4H4z" />
      </svg>
      {horse.alerts > 0 ? (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-injured ring-2 ring-surface" />
      ) : null}
    </div>
  );
}

/* -------------------------------- horse card ------------------------------- */

export function HorseCard({ horse, to }: { horse: Horse; to: string }) {
  return (
    <Link
      to={to as never}
      className="panel flex items-center gap-3 p-3 transition-colors hover:bg-elevated active:bg-elevated"
    >
      <HorseAvatar horse={horse} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[15px] font-semibold">{horse.name}</p>
          <StatusBadge status={horse.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {horse.phase} · {horse.stall} · {horse.weight} kg
        </p>
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{horse.lastSession}</p>
      </div>
      <div className="shrink-0 text-right">
        <FitnessScore value={horse.fitness} />
      </div>
    </Link>
  );
}

export function FitnessScore({ value, label = "fitness" }: { value: number; label?: string }) {
  const tone = value >= 85 ? "text-fit" : value >= 65 ? "text-monitor" : "text-injured";
  return (
    <div className="text-right">
      <p className={cn("num text-lg leading-none font-semibold", tone)}>{value}%</p>
      <p className="mt-1 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

export function Meter({ value, tone = "fit" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700",
          tone === "fit" && "bg-fit",
          tone === "monitor" && "bg-monitor",
          tone === "injured" && "bg-injured",
          tone === "training" && "bg-training",
          tone === "raceready" && "bg-raceready",
        )}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

/* -------------------------------- task card -------------------------------- */

export function TaskCard({
  task,
  onComplete,
}: {
  task: Task;
  onComplete?: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "panel p-4 transition-colors",
        task.done && "opacity-60",
        task.priority && !task.done && "border-monitor/40",
      )}
    >
      <div className="flex items-start gap-3">
        <p className="num w-12 shrink-0 pt-0.5 text-sm text-muted-foreground">{task.time}</p>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{task.horse}</p>
          <p className="mt-0.5 text-sm text-foreground/85">{task.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {task.kind} · {task.detail}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={task.done}
        onClick={() => onComplete?.(task.id)}
        className={cn(
          "mt-3 h-11 w-full rounded-lg text-sm font-semibold transition-all active:scale-[0.99]",
          task.done
            ? "bg-fit-soft text-fit"
            : "bg-primary text-primary-foreground hover:brightness-110",
        )}
      >
        {task.done ? "Completed" : "Complete"}
      </button>
    </div>
  );
}

/* ------------------------------- alert card -------------------------------- */

export function AlertCard({ alert, to }: { alert: AlertItem; to?: string }) {
  const tone =
    alert.severity === "critical"
      ? "border-injured/45 bg-injured-soft"
      : alert.severity === "warning"
        ? "border-monitor/40 bg-monitor-soft"
        : "border-border bg-surface";
  const text =
    alert.severity === "critical"
      ? "text-injured"
      : alert.severity === "warning"
        ? "text-monitor"
        : "text-muted-foreground";
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-[10px] font-semibold tracking-[0.16em] uppercase", text)}>
          {alert.severity}
        </p>
        <p className="num text-[11px] text-muted-foreground">{alert.time}</p>
      </div>
      <p className="mt-1.5 text-sm font-semibold">{alert.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {alert.horse} — {alert.detail}
      </p>
    </>
  );
  return to ? (
    <Link to={to as never} className={cn("block rounded-xl border p-4 transition-colors", tone)}>
      {body}
    </Link>
  ) : (
    <div className={cn("rounded-xl border p-4", tone)}>{body}</div>
  );
}

/* -------------------------------- controls --------------------------------- */

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            value === o
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-muted-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search horses",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

export function ActionButton({
  children,
  variant = "primary",
  onClick,
  className,
  type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "h-12 w-full rounded-xl text-sm font-semibold transition-all active:scale-[0.99]",
        variant === "primary" && "bg-primary text-primary-foreground hover:brightness-110",
        variant === "secondary" && "border border-border-strong bg-surface text-foreground hover:bg-elevated",
        variant === "danger" && "bg-injured text-destructive-foreground hover:brightness-110",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel grid place-items-center px-6 py-12 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-[24ch] text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function TimelineItem({
  time,
  title,
  detail,
  tone = "default",
  last,
}: {
  time: string;
  title: string;
  detail: string;
  tone?: "default" | "critical" | "system" | "good";
  last?: boolean;
}) {
  const dot =
    tone === "critical"
      ? "bg-injured"
      : tone === "system"
        ? "bg-training"
        : tone === "good"
          ? "bg-fit"
          : "bg-muted-foreground";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
        {!last ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
      </div>
      <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="num shrink-0 text-[11px] text-muted-foreground">{time}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function KeyValue({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{k}</dt>
          <dd className="mt-1 truncate text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
