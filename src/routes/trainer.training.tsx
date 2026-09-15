import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/raceos/shell";
import { FilterChips, Panel, SectionTitle, StatusBadge } from "@/components/raceos/primitives";
import { horses } from "@/lib/raceos-data";

export const Route = createFileRoute("/trainer/training")({
  head: () => ({
    meta: [
      { title: "Training calendar & plans — RACEOS" },
      {
        name: "description",
        content: "Week-at-a-glance training calendar, active plans and assigned grooms for every horse.",
      },
      { property: "og:title", content: "Training calendar & plans — RACEOS" },
      { property: "og:description", content: "Plan phases, workload and surface, then assign the work." },
    ],
  }),
  component: TrainerTraining,
});

const week = [
  { d: "Mon", n: 12, today: true },
  { d: "Tue", n: 10 },
  { d: "Wed", n: 14 },
  { d: "Thu", n: 9 },
  { d: "Fri", n: 13 },
  { d: "Sat", n: 7 },
  { d: "Sun", n: 3 },
];

function TrainerTraining() {
  const [tab, setTab] = useState("Calendar");
  const planned = horses.filter((h) => h.status !== "INJURED");

  return (
    <AppShell role="trainer" title="Training">
      <FilterChips options={["Calendar", "Plans", "Live"]} value={tab} onChange={setTab} />

      {tab === "Calendar" ? (
        <>
          <section>
            <SectionTitle>This week</SectionTitle>
            <Panel className="p-3">
              <div className="grid grid-cols-7 gap-1.5">
                {week.map((w) => (
                  <div
                    key={w.d}
                    className={`rounded-lg border px-1 py-2.5 text-center ${
                      w.today ? "border-primary bg-primary/10" : "border-border bg-elevated"
                    }`}
                  >
                    <p className="text-[10px] text-muted-foreground uppercase">{w.d}</p>
                    <p className="num mt-1 text-sm font-semibold">{w.n}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Sessions scheduled per day · tap a horse below to adjust its plan
              </p>
            </Panel>
          </section>

          <section>
            <SectionTitle>Monday schedule</SectionTitle>
            <Panel className="divide-y divide-border p-0">
              {[
                ["06:00", "Thunder King", "Recovery walk · 800 m", "Mai Tran"],
                ["06:40", "Night Quartz", "Speed work · 800 m", "Mai Tran"],
                ["07:10", "Silver Arrow", "Base · 1,200 m", "Peter Osei"],
                ["07:40", "Iron Verdict", "Base · 1,600 m", "Peter Osei"],
                ["08:20", "Golden Hour", "Taper · 1,400 m", "Mai Tran"],
              ].map(([time, name, detail, groom]) => (
                <div key={name} className="flex items-center gap-3 px-4 py-3">
                  <p className="num w-12 shrink-0 text-sm text-muted-foreground">{time}</p>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {detail} · groom {groom}
                    </p>
                  </div>
                </div>
              ))}
            </Panel>
          </section>
        </>
      ) : null}

      {tab === "Plans" ? (
        <section>
          <SectionTitle>Active plans</SectionTitle>
          <div className="space-y-2">
            {planned.map((h) => (
              <Link
                key={h.id}
                to="/trainer/plan/$id"
                params={{ id: h.id }}
                className="panel flex items-center gap-3 p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold">{h.name}</p>
                    <StatusBadge status={h.status} />
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {h.phase} · {h.lastSession}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "Live" ? (
        <section>
          <SectionTitle>Sensor sessions</SectionTitle>
          <div className="space-y-2">
            {horses
              .filter((h) => h.status === "TRAINING" || h.status === "RACE READY")
              .map((h) => (
                <Link
                  key={h.id}
                  to="/live/$role/$horseId"
                  params={{ role: "trainer", horseId: h.id }}
                  className="panel flex items-center justify-between gap-3 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{h.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {h.status === "TRAINING" ? "Streaming live" : "Vest ready · idle"}
                    </p>
                  </div>
                  <p className="num text-sm text-training">{h.hr} bpm</p>
                </Link>
              ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
