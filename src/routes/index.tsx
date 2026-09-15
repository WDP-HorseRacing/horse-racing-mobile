import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitBranch } from "lucide-react";
import { Brand } from "@/components/raceos/shell";
import { roleList } from "@/lib/raceos-roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RACEOS — Racehorse Training & Management System" },
      {
        name: "description",
        content:
          "RACEOS connects training plans, realtime sensor telemetry, veterinary care and racing performance into one calm operating system for a professional racing stable.",
      },
      { property: "og:title", content: "RACEOS — Operating system for a modern racing stable" },
      {
        property: "og:description",
        content:
          "Role-based mobile workspace for trainers, grooms, veterinarians, owners and club managers.",
      },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-6 py-10">
        <Brand />

        <div className="mt-12">
          <h1 className="text-[32px] leading-[1.1] font-semibold">
            The operating system
            <br />
            for a racing stable.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Training, people, realtime sensors, veterinary care, racing and ownership — one connected,
            trustworthy system.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <label className="block">
            <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              Stable ID
            </span>
            <input
              defaultValue="meadowline"
              className="mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              Passcode
            </span>
            <input
              type="password"
              defaultValue="••••••••"
              className="mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <p className="mt-8 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Continue as
        </p>
        <ul className="mt-3 space-y-2">
          {roleList.map((r) => (
            <li key={r.id}>
              <Link
                to={r.home as never}
                className="panel flex items-center gap-3 p-3.5 transition-colors hover:bg-elevated"
              >
                <span className="num grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-elevated text-[11px] font-semibold">
                  {r.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {r.person} · {r.scope}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>

        <Link
          to="/flow"
          className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-xs font-medium text-muted-foreground hover:bg-elevated"
        >
          <GitBranch className="h-4 w-4" />
          See the end-to-end stable workflow
        </Link>

        <p className="mt-auto pt-8 text-center text-[10px] text-muted-foreground">
          Access is governed by role-based permissions. Every action is audited.
        </p>
      </div>
    </div>
  );
}
