import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/raceos/shell";
import { TrendArea } from "@/components/raceos/charts";
import { ActionButton, AlertCard, Panel, SectionTitle } from "@/components/raceos/primitives";
import { alerts, liveSeries } from "@/lib/raceos-data";

export const Route = createFileRoute("/vet/alerts")({
  head: () => ({
    meta: [
      { title: "Critical sensor alert — RACEOS" },
      {
        name: "description",
        content:
          "Safety-critical telemetry alerts escalated to the veterinarian, with vitals, trend and the option to lock training.",
      },
      { property: "og:title", content: "Critical sensor alert — RACEOS" },
      { property: "og:description", content: "Investigate, examine, then clear or lock the horse." },
    ],
  }),
  component: VetAlerts,
});

function VetAlerts() {
  return (
    <AppShell role="vet" title="Alerts" subtitle="1 awaiting decision">
      <section className="rounded-xl border border-injured/50 bg-injured-soft p-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-injured uppercase">
          Abnormal condition detected
        </p>
        <h2 className="mt-2 text-xl font-semibold">Thunder King</h2>
        <p className="mt-1 text-sm text-foreground/85">
          Heart rate exceeded the configured safety threshold during moderate work.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-injured/30 pt-3">
          {[
            ["Peak HR", "188 bpm"],
            ["Normal range", "60–180 bpm"],
            ["Speed at peak", "52 km/h"],
            ["Session length", "14 min 20 s"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{k}</p>
              <p className="num mt-1 text-sm font-medium">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <TrendArea
            data={liveSeries}
            xKey="t"
            yKey="hr"
            color="var(--injured)"
            domain={[60, 200]}
            height={130}
          />
        </div>

        <div className="mt-4 space-y-2">
          <ActionButton to="/live/vet/thunder-king">Open live session</ActionButton>
          <ActionButton variant="secondary" to="/vet/exam/thunder-king">
            Examine horse
          </ActionButton>
          <ActionButton variant="danger" to="/vet/lock/thunder-king">
            Lock training
          </ActionButton>
        </div>
      </section>

      <section>
        <SectionTitle>Alert stream</SectionTitle>
        <div className="space-y-2">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} to={`/horse/vet/${a.horseId}`} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Escalation policy</SectionTitle>
        <Panel className="space-y-2 text-xs text-muted-foreground">
          <p>HR above threshold for 30 s → vet paged, trainer notified</p>
          <p>No vet acknowledgement in 5 min → club manager paged</p>
          <p>Vet lock → training stopped, groom instructions rewritten</p>
        </Panel>
      </section>
    </AppShell>
  );
}
