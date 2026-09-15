import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/raceos/shell";
import { ActionButton, AlertCard, Panel, SectionTitle } from "@/components/raceos/primitives";
import { alerts } from "@/lib/raceos-data";

export const Route = createFileRoute("/trainer/alerts")({
  head: () => ({
    meta: [
      { title: "Critical health alerts — RACEOS" },
      {
        name: "description",
        content:
          "Safety-critical alerts escalated from sensor telemetry and veterinary decisions, with the next action attached.",
      },
      { property: "og:title", content: "Critical health alerts — RACEOS" },
      { property: "og:description", content: "Every alert carries the decision the trainer must make next." },
    ],
  }),
  component: TrainerAlerts,
});

function TrainerAlerts() {
  return (
    <AppShell role="trainer" title="Alerts" subtitle="2 critical · 1 warning · 1 info">
      <section>
        <SectionTitle>Critical — action required</SectionTitle>
        <Panel className="border-injured/45 bg-injured-soft">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-injured uppercase">
            Training locked by veterinarian
          </p>
          <h3 className="mt-2 text-xl font-semibold">Thunder King</h3>
          <p className="mt-1 text-sm text-foreground/85">
            Reason: abnormal heart-rate response during 1,600 m moderate work.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-injured/30 pt-3">
            {[
              ["Peak HR", "188 bpm"],
              ["Normal range", "60–180 bpm"],
              ["Locked at", "10:24"],
              ["Locked by", "Dr. S. Rao"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{k}</dt>
                <dd className="num mt-1 text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 space-y-2">
            <Link to="/horse/$role/$id" params={{ role: "trainer", id: "thunder-king" }}>
              <ActionButton variant="secondary">View health report</ActionButton>
            </Link>
            <Link to="/trainer/plan/$id" params={{ id: "thunder-king" }}>
              <ActionButton>Adjust training plan</ActionButton>
            </Link>
          </div>
        </Panel>
      </section>

      <section>
        <SectionTitle>Alert stream</SectionTitle>
        <div className="space-y-2">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} to={`/horse/trainer/${a.horseId}`} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
