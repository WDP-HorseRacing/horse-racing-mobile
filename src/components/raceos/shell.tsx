import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarRange,
  ClipboardList,
  Flag,
  Home,
  LayoutGrid,
  Stethoscope,
  User,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { roles } from "@/lib/raceos-roles";
import type { RoleId } from "@/lib/raceos-data";

const icons: Record<string, typeof Home> = {
  home: Home,
  horse: LayoutGrid,
  training: CalendarRange,
  alert: AlertTriangle,
  profile: User,
  task: ClipboardList,
  stable: Boxes,
  report: BarChart3,
  medical: Stethoscope,
  race: Flag,
  ops: Activity,
};

export function AppShell({
  role,
  title,
  subtitle,
  children,
  back,
  action,
}: {
  role: RoleId;
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: string;
  action?: ReactNode;
}) {
  const cfg = roles[role];
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[430px] pb-24">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 pt-5 pb-3 backdrop-blur-xl">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {back ? (
                <Link
                  to={back}
                  className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-elevated"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              ) : null}
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">{title}</h1>
                <p className="truncate text-[11px] text-muted-foreground">
                  {subtitle ?? `${cfg.label} · ${cfg.scope}`}
                </p>
              </div>
            </div>
            {action ?? (
              <Link
                to="/profile/$role"
                params={{ role }}
                className="num grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-[11px] font-semibold"
              >
                {cfg.initials}
              </Link>
            )}
          </div>
        </header>

        <main className="rise space-y-6 px-4 pt-5">{children}</main>
      </div>

      <BottomNav role={role} />
    </div>
  );
}

export function BottomNav({ role }: { role: RoleId }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cfg = roles[role];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl">
      <ul className="mx-auto flex w-full max-w-[430px] items-stretch">
        {cfg.nav.map((item) => {
          const Icon = icons[item.icon] ?? Home;
          const active = pathname === item.to || (item.to !== cfg.home && pathname.startsWith(item.to));
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to as never}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

export function RoleTag({ role }: { role: RoleId }) {
  const cfg = roles[role];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {cfg.label}
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="font-display text-lg font-bold tracking-tight">RACE</span>
      <span className="font-display text-lg font-bold tracking-tight text-primary">OS</span>
    </span>
  );
}
