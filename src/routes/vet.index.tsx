import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/raceos/shell";
import {
  ActionButton,
  AlertCard,
  HorseCard,
  MetricCard,
  Panel,
  SectionTitle,
} from "@/components/raceos/primitives";
import { alerts, horses } from "@/lib/raceos-data";

export const Route = createFileRoute("/vet/")({
  head: () => ({
    meta: [
      { title: "Veterinary overview — RACEOS" },
      {
        name: "description",
        content:
          "Critical cases, monitoring cases, vaccination and farrier due lists, and the authority to lock training.",
      },
      { property: "og:title", content: "Veterinary overview — RACEOS" },
      { property: "og:description", content: "Health status map for the whole stable, triaged by urgency." },
    ],
  }),
  component: VetHome,
});

function VetHome() {
  const critical = horses.filter((h) => h.status === "LOCKED" || h.status === "INJURED");
  const monitoring = horses.filter((h) => h.status === "MONITOR");

  return (
    <AppShell role="vet" title="Health overview" subtitle="Monday · 24 horses under care">
      <section className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Critical" value={critical.length} unit="cases" tone="injured" hint="Needs today" />
        <MetricCard label="Monitoring" value={monitoring.length} unit="cases" tone="monitor" hint="Recheck 48 h" />
        <MetricCard label="Healthy" value={5} unit="horses" tone="fit" hint="No open findings" />
        <MetricCard label="Due" value={4} unit="tasks" hint="Vaccine · farrier" />
      </section>

      <section>
        <SectionTitle>Critical cases</SectionTitle>
        <div className="space-y-2">
          {critical.map((h) => (
            <HorseCard key={h.id} horse={h} to={`/horse/vet/${h.id}`} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Medical alerts</SectionTitle>
        <div className="space-y-2">
          {alerts.slice(0, 3).map((a) => (
            <AlertCard key={a.id} alert={a} to={`/horse/vet/${a.horseId}`} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Preventive schedule</SectionTitle>
        <Panel className="divide-y divide-border p-0">
          {[
            ["Vaccination", "Pale Comet", "Due in 3 days"],
            ["Deworming", "Iron Verdict", "Due in 6 days"],
            ["Farrier check", "Golden Hour", "Tomorrow 11:00"],
            ["Dental", "Brave Ledger", "Next week"],
          ].map(([k, h, when]) => (
            <div key={k + h} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{k}</p>
                <p className="truncate text-[11px] text-muted-foreground">{h}</p>
              </div>
              <p className="shrink-0 text-[11px] text-muted-foreground">{when}</p>
            </div>
          ))}
        </Panel>
      </section>

      <section className="space-y-2">
        <ActionButton to="/vet/exam/thunder-king">Record examination</ActionButton>
        <ActionButton variant="secondary" to="/vet/injury/red-storm">
          Injury mapping
        </ActionButton>
      </section>
    </AppShell>
  );
}
