import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/raceos/shell";
import { TrendArea } from "@/components/raceos/charts";
import { ActionButton, Meter, Panel, SectionTitle } from "@/components/raceos/primitives";
import { getHorse, recoveryTrend } from "@/lib/raceos-data";

export const Route = createFileRoute("/vet/injury/$id")({
  head: () => ({
    meta: [
      { title: "Injury mapping — RACEOS" },
      {
        name: "description",
        content:
          "Mark injury location, type, severity and recovery progress directly on a horse anatomy diagram.",
      },
      { property: "og:title", content: "Injury mapping — RACEOS" },
      { property: "og:description", content: "Anatomy-based injury records instead of free-text notes." },
    ],
  }),
  component: InjuryMapping,
});

type Region = { id: string; label: string; x: number; y: number; severity?: string; recovery?: number };

const regions: Region[] = [
  { id: "head", label: "Head & neck", x: 76, y: 26 },
  { id: "shoulder", label: "Left shoulder", x: 58, y: 38 },
  { id: "back", label: "Back", x: 46, y: 30 },
  { id: "left-fore", label: "Left fore", x: 60, y: 70, severity: "Grade 2 tendon strain", recovery: 38 },
  { id: "right-fore", label: "Right fore", x: 66, y: 72 },
  { id: "hind-quarter", label: "Hindquarter", x: 26, y: 38 },
  { id: "left-hind", label: "Left hind", x: 24, y: 72, severity: "Soft-tissue inflammation", recovery: 65 },
  { id: "hoof", label: "Right hind hoof", x: 32, y: 84 },
];

function InjuryMapping() {
  const { id } = Route.useParams();
  const horse = getHorse(id);
  const [active, setActive] = useState<Region>(regions[3]);

  return (
    <AppShell
      role="vet"
      title="Injury mapping"
      subtitle={`${horse.name} · tap a region`}
      back={`/horse/vet/${horse.id}`}
    >
      <Panel className="p-3">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-elevated">
          <svg viewBox="0 0 100 75" className="absolute inset-0 h-full w-full text-muted-foreground/45">
            <path
              d="M14 30c4-7 12-9 20-9h20l6-8 8-2 6 3 4 6-6 3-3 6c-1 6-4 11-8 15l-2 12h-6l1-11-14 3-2 8h-6l2-11c-6 2-10 6-11 12h-6l1-14c-4-3-6-8-4-13z"
              fill="currentColor"
            />
          </svg>
          {regions.map((r) => {
            const injured = Boolean(r.severity);
            const isActive = active.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActive(r)}
                aria-label={r.label}
                style={{ left: `${r.x}%`, top: `${r.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${
                  injured
                    ? "h-6 w-6 border-injured bg-injured/40"
                    : "h-4 w-4 border-border-strong bg-surface"
                } ${isActive ? "ring-2 ring-primary" : ""}`}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Red markers are open findings · grey markers are clear
        </p>
      </Panel>

      <section>
        <SectionTitle>{active.label}</SectionTitle>
        <Panel>
          {active.severity ? (
            <>
              <p className="text-sm font-semibold">{active.severity}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded Sep 02 · monitoring · re-scan in 5 days
              </p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Recovery</span>
                <span className="num text-monitor">{active.recovery}%</span>
              </div>
              <div className="mt-1.5">
                <Meter value={active.recovery ?? 0} tone="monitor" />
              </div>
              <div className="mt-3">
                <TrendArea data={recoveryTrend} xKey="d" yKey="v" color="var(--monitor)" height={110} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No findings recorded for this region. Tap below to add one.
            </p>
          )}
        </Panel>
      </section>

      <section className="space-y-2">
        <ActionButton>Add finding to {active.label.toLowerCase()}</ActionButton>
        <ActionButton variant="secondary" to={`/vet/exam/${horse.id}`}>
          Open examination
        </ActionButton>
      </section>
    </AppShell>
  );
}
