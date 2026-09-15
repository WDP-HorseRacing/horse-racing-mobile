import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { AppShell } from "@/components/raceos/shell";
import { Legend, TrendArea, LoadBars } from "@/components/raceos/charts";
import {
  AlertCard,
  HorseAvatar,
  HorseCard,
  MetricCard,
  Panel,
  SectionTitle,
  StatusBadge,
} from "@/components/raceos/primitives";
import { alerts, fitnessTrend, horses } from "@/lib/raceos-data";

export const Route = createFileRoute("/trainer/")({
  head: () => ({
    meta: [
      { title: "Trainer command centre — RACEOS" },
      {
        name: "description",
        content:
          "Stable fitness, live training sessions, horses requiring attention and race-ready runners in one trainer dashboard.",
      },
      { property: "og:title", content: "Trainer command centre — RACEOS" },
      {
        property: "og:description",
        content: "Plan, assign and monitor stable training from a single mobile command centre.",
      },
    ],
  }),
  component: TrainerHome,
});

function TrainerHome() {
  const training = horses.filter((h) => h.status === "TRAINING");
  const attention = horses.filter((h) => ["MONITOR", "INJURED", "LOCKED"].includes(h.status));
  const raceReady = horses.filter((h) => h.status === "RACE READY");

  return (
    <AppShell role="trainer" title="Good morning, Elena" subtitle="Monday · 24 horses in work">
      <section>
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard label="Stable fitness" value="78%" hint="+3 pts this week" tone="fit" />
          <MetricCard label="Training today" value={12} unit="horses" hint="4 sessions remaining" />
          <MetricCard
            label="Attention required"
            value={attention.length}
            unit="horses"
            hint="1 locked · 1 injured"
            tone="monitor"
          />
          <MetricCard
            label="Race ready"
            value={raceReady.length}
            unit="horses"
            hint="Autumn Sprint Sep 28"
            tone="raceready"
          />
        </div>
      </section>

      <section>
        <SectionTitle>Stable fitness trend</SectionTitle>
        <Panel>
          <TrendArea data={fitnessTrend} xKey="d" yKey="v" domain={[60, 90]} />
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
              Training load
            </p>
            <LoadBars data={fitnessTrend} xKey="d" yKey="load" height={90} />
          </div>
          <Legend
            items={[
              { label: "Fitness index", color: "var(--fit)" },
              { label: "Load", color: "var(--training)" },
            ]}
          />
        </Panel>
      </section>

      {training.length ? (
        <section>
          <SectionTitle>Live now</SectionTitle>
          <div className="space-y-2">
            {training.map((h) => (
              <Link
                key={h.id}
                to="/live/$role/$horseId"
                params={{ role: "trainer", horseId: h.id }}
                className="panel flex items-center gap-3 border-training/40 p-3.5"
              >
                <HorseAvatar horse={h} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold">{h.name}</p>
                    <span className="live-dot flex items-center gap-1 text-training">
                      <Radio className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{h.phase} · sensor vest active</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-lg leading-none font-semibold text-training">{h.hr}</p>
                  <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">bpm</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle
          action={
            <Link to="/trainer/alerts" className="text-xs font-medium text-primary">
              All alerts
            </Link>
          }
        >
          Needs a decision
        </SectionTitle>
        <div className="space-y-2">
          {alerts.slice(0, 2).map((a) => (
            <AlertCard key={a.id} alert={a} to={`/horse/trainer/${a.horseId}`} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Link to="/trainer/horses" className="text-xs font-medium text-primary">
              All horses
            </Link>
          }
        >
          Attention list
        </SectionTitle>
        <div className="space-y-2">
          {attention.map((h) => (
            <HorseCard key={h.id} horse={h} to={`/horse/trainer/${h.id}`} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Today's sessions</SectionTitle>
        <Panel className="divide-y divide-border p-0">
          {[
            ["06:00", "Thunder King", "1,600 m · Moderate", "LOCKED"],
            ["06:40", "Night Quartz", "Speed work · 800 m", "TRAINING"],
            ["07:10", "Silver Arrow", "1,200 m · Light", "MONITOR"],
            ["07:40", "Iron Verdict", "1,600 m · Moderate", "FIT"],
          ].map(([time, name, detail, status]) => (
            <div key={name} className="flex items-center gap-3 px-4 py-3">
              <p className="num w-12 shrink-0 text-sm text-muted-foreground">{time}</p>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
              </div>
              <StatusBadge status={status as never} />
            </div>
          ))}
        </Panel>
      </section>
    </AppShell>
  );
}
