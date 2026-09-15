import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { AppShell } from "@/components/raceos/shell";
import { DualLine, Legend, TrendArea } from "@/components/raceos/charts";
import { ActionButton, MetricCard, Panel, SectionTitle } from "@/components/raceos/primitives";
import { getHorse, liveSeries } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";
import { roles } from "@/lib/raceos-roles";

export const Route = createFileRoute("/live/$role/$horseId")({
  head: () => ({
    meta: [
      { title: "Live training telemetry — RACEOS" },
      {
        name: "description",
        content:
          "Realtime heart rate, speed, distance and temperature streamed from the sensor vest, with safety-threshold detection.",
      },
      { property: "og:title", content: "Live training telemetry — RACEOS" },
      {
        property: "og:description",
        content: "Calm realtime charts that surface abnormal conditions the moment they happen.",
      },
    ],
  }),
  component: LiveTraining,
});

function LiveTraining() {
  const { role, horseId } = Route.useParams();
  const roleId = (role as RoleId) in roles ? (role as RoleId) : "trainer";
  const horse = getHorse(horseId);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1600);
    return () => clearInterval(t);
  }, []);

  const window = liveSeries.slice(0, 26 + (tick % 14));
  const latest = window[window.length - 1];
  const abnormal = latest.hr > 180;

  return (
    <AppShell
      role={roleId}
      title={horse.name}
      subtitle="Live training · sensor vest #A14"
      back={`/horse/${roleId}/${horse.id}`}
      action={
        <span className="inline-flex items-center gap-2 rounded-full border border-training/40 bg-training-soft px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-training uppercase">
          <span className="live-dot inline-flex">
            <Radio className="h-3 w-3" />
          </span>
          Live
        </span>
      }
    >
      {abnormal ? (
        <section className="rise rounded-xl border border-injured/50 bg-injured-soft p-4">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-injured uppercase">
            Abnormal condition detected
          </p>
          <h2 className="mt-2 text-xl font-semibold">{horse.name}</h2>
          <p className="mt-1 text-sm text-foreground/85">
            Heart rate exceeds the configured safety threshold for this horse.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-injured/30 pt-3">
            {[
              ["Current HR", `${latest.hr} bpm`],
              ["Normal range", "60–180 bpm"],
              ["Speed", `${latest.speed} km/h`],
              ["Duration", "14 min 20 s"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{k}</p>
                <p className="num mt-1 text-sm font-medium">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <ActionButton to={`/horse/${roleId}/${horse.id}`}>Review horse</ActionButton>
            <ActionButton variant="secondary" to="/vet/alerts">
              Contact veterinarian
            </ActionButton>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="Heart rate"
          value={latest.hr}
          unit="bpm"
          tone={abnormal ? "injured" : "training"}
          hint={abnormal ? "Above threshold" : "Within range"}
        />
        <MetricCard label="Speed" value={latest.speed} unit="km/h" hint="Peak 58 km/h" />
        <MetricCard label="Distance" value="1.2" unit="km" hint="Target 1.6 km" />
        <MetricCard label="Temperature" value="38.2" unit="°C" hint="Normal" tone="fit" />
      </section>

      <section>
        <SectionTitle>Heart rate — last 4 minutes</SectionTitle>
        <Panel>
          <TrendArea
            data={window}
            xKey="t"
            yKey="hr"
            color={abnormal ? "var(--injured)" : "var(--training)"}
            domain={[60, 200]}
            height={150}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Safety threshold 180 bpm · updating every 1.6 s
          </p>
        </Panel>
      </section>

      <section>
        <SectionTitle>Speed vs heart rate</SectionTitle>
        <Panel>
          <DualLine
            data={window}
            xKey="t"
            keys={[
              { key: "speed", color: "var(--fit)" },
              { key: "hr", color: "var(--injured)" },
            ]}
          />
          <Legend
            items={[
              { label: "Speed km/h", color: "var(--fit)" },
              { label: "HR bpm", color: "var(--injured)" },
            ]}
          />
        </Panel>
      </section>

      <section>
        <SectionTitle>Session</SectionTitle>
        <Panel className="divide-y divide-border p-0">
          {[
            ["Phase", horse.phase],
            ["Surface", "Dirt · dry"],
            ["Assigned groom", "Mai Tran"],
            ["Plan", "1,600 m · moderate · 60–80% workload"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="truncate text-sm font-medium">{v}</p>
            </div>
          ))}
        </Panel>
      </section>
    </AppShell>
  );
}
