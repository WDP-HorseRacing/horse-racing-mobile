import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/raceos/shell";
import { DualLine, Legend, LoadBars, TrendArea } from "@/components/raceos/charts";
import {
  ActionButton,
  FilterChips,
  FitnessScore,
  HorseAvatar,
  KeyValue,
  Meter,
  Panel,
  SectionTitle,
  StatusBadge,
  TimelineItem,
} from "@/components/raceos/primitives";
import { fitnessTrend, getHorse, recoveryTrend, speedTrend } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";
import { roles } from "@/lib/raceos-roles";

export const Route = createFileRoute("/horse/$role/$id")({
  head: () => ({
    meta: [
      { title: "Horse profile — RACEOS" },
      {
        name: "description",
        content:
          "One shared horse profile: identity, pedigree, training, health, performance, racing and timeline — filtered by role permissions.",
      },
      { property: "og:title", content: "Horse profile — RACEOS" },
      {
        property: "og:description",
        content: "The horse is the central object; every role sees the view its work requires.",
      },
    ],
  }),
  component: HorseProfile,
});

const tabsByRole: Record<RoleId, string[]> = {
  trainer: ["Overview", "Training", "Health", "Performance", "Racing", "Timeline"],
  vet: ["Overview", "Health", "Injuries", "Treatment", "Timeline"],
  groom: ["Overview", "Care", "Timeline"],
  owner: ["Overview", "Health", "Performance", "Racing", "Timeline"],
  manager: ["Overview", "Health", "Performance", "Costs", "Timeline"],
};

function HorseProfile() {
  const { role, id } = Route.useParams();
  const roleId = (role as RoleId) in roles ? (role as RoleId) : "trainer";
  const horse = getHorse(id);
  const tabs = tabsByRole[roleId];
  const [tab, setTab] = useState(tabs[0]);

  return (
    <AppShell
      role={roleId}
      title={horse.name}
      subtitle={`${roles[roleId].label} view · same horse, role-scoped data`}
      back={roles[roleId].home}
    >
      <section className="panel p-4">
        <div className="flex items-start gap-3">
          <HorseAvatar horse={horse} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{horse.name}</h2>
              <StatusBadge status={horse.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {horse.age} yo {horse.sex} · {horse.breed} · {horse.color}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Stall {horse.stall} · {horse.weight} kg · owner {horse.owner}
            </p>
          </div>
          <FitnessScore value={horse.fitness} />
        </div>

        {horse.note ? (
          <p className="mt-3 rounded-lg border border-injured/40 bg-injured-soft px-3 py-2 text-xs text-injured">
            {horse.note}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
          {[
            ["Readiness", horse.readiness],
            ["Phase", horse.phase],
            ["Resting HR", `${horse.hr} bpm`],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{k}</p>
              <p className="mt-1 truncate text-sm font-medium">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <FilterChips options={tabs} value={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <>
          <section>
            <SectionTitle>Identity & pedigree</SectionTitle>
            <Panel>
              <KeyValue
                items={[
                  ["Sire", horse.sire],
                  ["Dam", horse.dam],
                  ["Age", `${horse.age} years`],
                  ["Weight", `${horse.weight} kg`],
                  ["Breed", horse.breed],
                  ["Stall", horse.stall],
                ]}
              />
            </Panel>
          </section>
          <section>
            <SectionTitle>Fitness trend</SectionTitle>
            <Panel>
              <TrendArea data={fitnessTrend} xKey="d" yKey="v" domain={[60, 95]} />
            </Panel>
          </section>
        </>
      ) : null}

      {tab === "Training" || tab === "Care" ? (
        <section>
          <SectionTitle>Current plan</SectionTitle>
          <Panel>
            <KeyValue
              items={[
                ["Phase", horse.phase],
                ["Distance", "1,600 m"],
                ["Workload", "60–80%"],
                ["Surface", "Dirt"],
                ["Intensity", "Moderate"],
                ["Assigned groom", "Mai Tran"],
              ]}
            />
            {roleId === "trainer" ? (
              <div className="mt-4">
                <ActionButton to={`/trainer/plan/${horse.id}`}>Edit training plan</ActionButton>
              </div>
            ) : null}
          </Panel>
          <div className="mt-3">
            <SectionTitle>Training load</SectionTitle>
            <Panel>
              <LoadBars data={fitnessTrend} xKey="d" yKey="load" />
            </Panel>
          </div>
        </section>
      ) : null}

      {tab === "Health" || tab === "Injuries" || tab === "Treatment" ? (
        <>
          <section>
            <SectionTitle>Vitals & status</SectionTitle>
            <Panel>
              <KeyValue
                items={[
                  ["Status", horse.status],
                  ["Temperature", "38.2 °C"],
                  ["Resting HR", `${horse.hr} bpm`],
                  ["Respiration", "16 /min"],
                  ["Weight", `${horse.weight} kg`],
                  ["Hydration", "Normal"],
                ]}
              />
            </Panel>
          </section>
          <section>
            <SectionTitle>Recovery</SectionTitle>
            <Panel>
              <div className="flex items-center justify-between">
                <p className="text-sm">Left hind leg · monitoring</p>
                <p className="num text-sm font-semibold text-monitor">{horse.recovery ?? 100}%</p>
              </div>
              <div className="mt-2">
                <Meter value={horse.recovery ?? 100} tone="monitor" />
              </div>
              <div className="mt-3">
                <TrendArea data={recoveryTrend} xKey="d" yKey="v" color="var(--monitor)" height={110} />
              </div>
            </Panel>
          </section>
          {roleId === "vet" ? (
            <section className="space-y-2">
              <ActionButton to={`/vet/exam/${horse.id}`}>Record examination</ActionButton>
              <ActionButton variant="secondary" to={`/vet/injury/${horse.id}`}>
                Open injury mapping
              </ActionButton>
              <ActionButton variant="danger" to={`/vet/lock/${horse.id}`}>
                Lock training
              </ActionButton>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "Performance" ? (
        <>
          <section>
            <SectionTitle>Speed & heart rate</SectionTitle>
            <Panel>
              <DualLine
                data={speedTrend}
                xKey="d"
                keys={[
                  { key: "speed", color: "var(--fit)" },
                  { key: "hr", color: "var(--injured)" },
                ]}
              />
              <Legend
                items={[
                  { label: "Top speed km/h", color: "var(--fit)" },
                  { label: "Peak HR bpm", color: "var(--injured)" },
                ]}
              />
            </Panel>
          </section>
          <section>
            <SectionTitle>Weekly distance</SectionTitle>
            <Panel>
              <LoadBars data={fitnessTrend} xKey="d" yKey="load" color="var(--raceready)" />
            </Panel>
          </section>
        </>
      ) : null}

      {tab === "Racing" ? (
        <section>
          <SectionTitle>Racing</SectionTitle>
          <Panel>
            <p className="text-sm font-semibold">{horse.nextRace ?? "No entry scheduled"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Readiness {horse.readiness} · fitness {horse.fitness}%
            </p>
            <div className="mt-4 space-y-3 border-t border-border pt-3">
              {[
                ["Summer Dash", "Aug 24", "1st · $24,000"],
                ["Evening Plate", "Aug 10", "3rd · $6,500"],
                ["Coastal Mile", "Jul 27", "2nd · $11,000"],
              ].map(([r, d, res]) => (
                <div key={r} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{r}</p>
                    <p className="text-[11px] text-muted-foreground">{d}</p>
                  </div>
                  <p className="num shrink-0 text-xs text-fit">{res}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      ) : null}

      {tab === "Costs" ? (
        <section>
          <SectionTitle>Cost of ownership</SectionTitle>
          <Panel>
            <KeyValue
              items={[
                ["Training / month", "$3,400"],
                ["Medical / month", "$820"],
                ["Feed & bedding", "$610"],
                ["Prize earnings YTD", "$41,500"],
              ]}
            />
          </Panel>
        </section>
      ) : null}

      {tab === "Timeline" ? (
        <section>
          <SectionTitle>Timeline</SectionTitle>
          <Panel>
            <TimelineItem
              time="10:41"
              title="Trainer published recovery plan"
              detail="800 m · 50% workload · light · soft surface"
              tone="good"
            />
            <TimelineItem
              time="10:24"
              title="Training locked by veterinarian"
              detail="Abnormal heart-rate response · status LOCKED"
              tone="critical"
            />
            <TimelineItem
              time="10:06"
              title="System raised HR threshold alert"
              detail="188 bpm sustained 42 s"
              tone="system"
            />
            <TimelineItem time="06:20" title="Training session executed" detail="1,600 m · moderate · dirt" />
            <TimelineItem
              time="06:00"
              title="Groom completed training preparation"
              detail="Sensor vest fitted by Mai Tran"
              last
            />
          </Panel>
        </section>
      ) : null}
    </AppShell>
  );
}
