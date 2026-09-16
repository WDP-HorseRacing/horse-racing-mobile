import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/raceos/shell";
import {
  ActionButton,
  FilterChips,
  Meter,
  Panel,
  SectionTitle,
  TimelineItem,
} from "@/components/raceos/primitives";

export const Route = createFileRoute("/vet/medical")({
  head: () => ({
    meta: [
      { title: "Medical records — RACEOS" },
      {
        name: "description",
        content: "Examinations, diagnoses, treatments, medication courses and vaccination history in one record.",
      },
      { property: "og:title", content: "Medical records — RACEOS" },
      { property: "og:description", content: "A structured clinical record for every horse in the club." },
    ],
  }),
  component: VetMedical,
});

function VetMedical() {
  const [tab, setTab] = useState("Records");

  return (
    <AppShell role="vet" title="Medical">
      <FilterChips options={["Records", "Treatment", "Vaccination"]} value={tab} onChange={setTab} />

      {tab === "Records" ? (
        <section>
          <SectionTitle>Recent examinations</SectionTitle>
          <div className="space-y-2">
            {[
              ["Thunder King", "Exercise intolerance", "Abnormal HR recovery", "Today 10:18"],
              ["Red Storm", "Left fore tendon strain", "Grade 2 · rehab week 3", "Yesterday"],
              ["Silver Arrow", "Reduced appetite", "Mild gastric irritation", "Sat 08:40"],
            ].map(([h, symptom, dx, when]) => (
              <Panel key={h}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{h}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Symptom: {symptom}</p>
                    <p className="text-xs text-muted-foreground">Diagnosis: {dx}</p>
                  </div>
                  <p className="shrink-0 text-[11px] text-muted-foreground">{when}</p>
                </div>
              </Panel>
            ))}
          </div>
          <div className="mt-3">
            <ActionButton to="/vet/exam/thunder-king">New examination</ActionButton>
          </div>
        </section>
      ) : null}

      {tab === "Treatment" ? (
        <section>
          <SectionTitle>Active treatment courses</SectionTitle>
          <div className="space-y-2">
            {[
              ["Red Storm", "Anti-inflammatory · 5 days", 60],
              ["Silver Arrow", "Gastric protectant · 14 days", 35],
              ["Thunder King", "Rest & cardiac monitoring · 10 days", 20],
            ].map(([h, plan, pct]) => (
              <Panel key={h as string}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold">{h}</p>
                  <p className="num text-xs text-monitor">{pct}%</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{plan}</p>
                <div className="mt-2">
                  <Meter value={pct as number} tone="monitor" />
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "Vaccination" ? (
        <section>
          <SectionTitle>Vaccination & farrier history</SectionTitle>
          <Panel>
            <TimelineItem time="Sep 10" title="Tetanus booster · Iron Verdict" detail="Batch TT-2291" tone="good" />
            <TimelineItem time="Aug 28" title="Farrier · full set · Golden Hour" detail="No hoof findings" />
            <TimelineItem time="Aug 14" title="Influenza booster · Night Quartz" detail="Batch EI-8842" tone="good" />
            <TimelineItem time="Jul 30" title="Deworming round · A wing" detail="8 horses treated" last />
          </Panel>
        </section>
      ) : null}
    </AppShell>
  );
}
