import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/raceos/shell";
import { Panel, SectionTitle, StatusBadge } from "@/components/raceos/primitives";
import { horses } from "@/lib/raceos-data";
import type { HorseStatus } from "@/lib/raceos-data";

export const Route = createFileRoute("/groom/stable")({
  head: () => ({
    meta: [
      { title: "Stable map — RACEOS" },
      {
        name: "description",
        content: "Visual stall layout showing which horse is where and its health status at a glance.",
      },
      { property: "og:title", content: "Stable map — RACEOS" },
      { property: "og:description", content: "Stall by stall: horse, status and feeding state." },
    ],
  }),
  component: StableMap,
});

const stallTone: Record<HorseStatus, string> = {
  FIT: "border-fit/45 bg-fit-soft",
  MONITOR: "border-monitor/45 bg-monitor-soft",
  INJURED: "border-injured/50 bg-injured-soft",
  LOCKED: "border-border-strong bg-locked-soft",
  TRAINING: "border-training/45 bg-training-soft",
  "RACE READY": "border-raceready/45 bg-raceready-soft",
};

function StableMap() {
  const wings = [
    { name: "A wing", list: horses.filter((h) => h.stall.startsWith("A")) },
    { name: "B wing", list: horses.filter((h) => h.stall.startsWith("B")) },
  ];

  return (
    <AppShell role="groom" title="Stable" subtitle="16 stalls · 8 in your care">
      {wings.map((w) => (
        <section key={w.name}>
          <SectionTitle>{w.name}</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {w.list.map((h) => (
              <Link
                key={h.id}
                to={`/horse/groom/${h.id}` as never}
                className={`rounded-xl border p-3 ${stallTone[h.status]}`}
              >
                <p className="num text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  {h.stall}
                </p>
                <p className="mt-1 truncate text-sm font-semibold">{h.name}</p>
                <div className="mt-2">
                  <StatusBadge status={h.status} />
                </div>
              </Link>
            ))}
            <div className="grid place-items-center rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
              Empty stalls
            </div>
          </div>
        </section>
      ))}

      <section>
        <SectionTitle>Feeding round · 15:00</SectionTitle>
        <Panel className="divide-y divide-border p-0">
          {horses.slice(0, 5).map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{h.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Hard feed 3.2 kg · hay 5 kg · electrolytes
                </p>
              </div>
              <span className="num shrink-0 text-[11px] text-muted-foreground">{h.stall}</span>
            </div>
          ))}
        </Panel>
      </section>
    </AppShell>
  );
}
