import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/raceos/shell";
import { TrendArea } from "@/components/raceos/charts";
import {
  HorseAvatar,
  MetricCard,
  Meter,
  Panel,
  SectionTitle,
  StatusBadge,
} from "@/components/raceos/primitives";
import { fitnessTrend, horses } from "@/lib/raceos-data";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/owner/")({
  head: () => ({
    meta: [
      { title: "My horses — RACEOS for owners" },
      {
        name: "description",
        content:
          "Follow your horse like a professional athlete: health, fitness, training progress, race readiness and upcoming entries.",
      },
      { property: "og:title", content: "My horses — RACEOS for owners" },
      { property: "og:description", content: "Calm, transparent updates without operational noise." },
    ],
  }),
  component: OwnerHome,
});

function OwnerHome() {
  const mine = horses.filter((h) => h.owner === "Marlow Bloodstock");

  return (
    <AppShell role="owner" title="My horses" subtitle="Marlow Bloodstock · 3 horses">
      <section className="grid grid-cols-3 gap-2.5">
        <MetricCard label="Avg fitness" value="64%" tone="monitor" />
        <MetricCard label="Race ready" value={0} hint="Next: Sep 28" />
        <MetricCard label="Prize YTD" value="$41.5k" tone="fit" />
      </section>

      <section className="space-y-2.5">
        {mine.map((h) => (
          <Link key={h.id} to={`/horse/owner/${h.id}` as never} className="panel block p-4">
            <div className="flex items-start gap-3">
              <HorseAvatar horse={h} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-base font-semibold">{h.name}</p>
                  <StatusBadge status={h.status} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {h.age} yo {h.sex} · {h.breed}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["Fitness", `${h.fitness}%`],
                ["Race readiness", h.readiness],
                ["Latest training", h.lastSession.split("·")[0]],
                ["Health", h.status === "FIT" ? "Stable" : h.status === "LOCKED" ? "Under vet care" : "Monitored"],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{k}</p>
                  <p className="mt-1 truncate text-sm font-medium">{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Meter value={h.fitness} tone={h.fitness >= 80 ? "fit" : "monitor"} />
            </div>

            {h.nextRace ? (
              <p className="mt-3 text-[11px] text-muted-foreground">Upcoming race · {h.nextRace}</p>
            ) : null}
          </Link>
        ))}
      </section>

      <section>
        <SectionTitle>Fitness across your horses</SectionTitle>
        <Panel>
          <TrendArea data={fitnessTrend} xKey="d" yKey="v" domain={[55, 90]} />
        </Panel>
      </section>

      <section>
        <SectionTitle>Latest updates</SectionTitle>
        <Panel className="divide-y divide-border p-0">
          {[
            ["Thunder King", "Training paused by veterinarian — recovery plan started", "Today"],
            ["Red Storm", "Rehabilitation week 3 · recovery 38%", "Yesterday"],
            ["Pale Comet", "Foundation work progressing well", "Saturday"],
          ].map(([h, msg, when]) => (
            <div key={h} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">{h}</p>
                <p className="shrink-0 text-[11px] text-muted-foreground">{when}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{msg}</p>
            </div>
          ))}
        </Panel>
      </section>
    </AppShell>
  );
}
