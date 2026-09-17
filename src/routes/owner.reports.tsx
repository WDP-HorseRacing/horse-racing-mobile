import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/raceos/shell";
import { CompareBars, Legend, LoadBars, TrendArea } from "@/components/raceos/charts";
import { MetricCard, Panel, SectionTitle } from "@/components/raceos/primitives";
import { clubFinance, fitnessTrend, speedTrend } from "@/lib/raceos-data";

export const Route = createFileRoute("/owner/reports")({
  head: () => ({
    meta: [
      { title: "Owner reports — RACEOS" },
      {
        name: "description",
        content:
          "Monthly summaries of training progress, medical status, maintenance and training costs, and prize revenue.",
      },
      { property: "og:title", content: "Owner reports — RACEOS" },
      { property: "og:description", content: "One clear monthly picture of performance and money." },
    ],
  }),
  component: OwnerReports,
});

function OwnerReports() {
  return (
    <AppShell role="owner" title="Reports" subtitle="September summary">
      <section className="grid grid-cols-2 gap-2.5">
        <MetricCard label="Training cost" value="$10.2k" hint="3 horses" />
        <MetricCard label="Medical cost" value="$2.4k" tone="monitor" hint="+18% vs Aug" />
        <MetricCard label="Prize revenue" value="$18.5k" tone="fit" hint="1 win, 2 places" />
        <MetricCard label="Net" value="+$5.9k" tone="fit" hint="Month to date" />
      </section>

      <section>
        <SectionTitle>Costs vs revenue</SectionTitle>
        <Panel>
          <CompareBars
            data={clubFinance}
            xKey="m"
            keys={[
              { key: "cost", color: "var(--monitor)" },
              { key: "revenue", color: "var(--fit)" },
            ]}
          />
          <Legend
            items={[
              { label: "Costs ($k)", color: "var(--monitor)" },
              { label: "Revenue ($k)", color: "var(--fit)" },
            ]}
          />
        </Panel>
      </section>

      <section>
        <SectionTitle>Training progress</SectionTitle>
        <Panel>
          <TrendArea data={fitnessTrend} xKey="d" yKey="v" domain={[55, 90]} />
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">Weekly load</p>
            <LoadBars data={fitnessTrend} xKey="d" yKey="load" height={90} />
          </div>
        </Panel>
      </section>

      <section>
        <SectionTitle>Speed development</SectionTitle>
        <Panel>
          <TrendArea data={speedTrend} xKey="d" yKey="speed" color="var(--raceready)" domain={[44, 60]} />
        </Panel>
      </section>

      <section>
        <SectionTitle>Medical status</SectionTitle>
        <Panel className="space-y-2.5 text-xs">
          {[
            ["Thunder King", "Training locked · cardiac review in progress"],
            ["Red Storm", "Rehabilitation · recovery 38%"],
            ["Pale Comet", "No findings · vaccination due in 3 days"],
          ].map(([h, s]) => (
            <div key={h} className="flex items-start justify-between gap-3">
              <p className="font-medium">{h}</p>
              <p className="text-right text-muted-foreground">{s}</p>
            </div>
          ))}
        </Panel>
      </section>
    </AppShell>
  );
}
