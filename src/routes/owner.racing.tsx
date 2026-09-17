import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/raceos/shell";
import { Panel, SectionTitle } from "@/components/raceos/primitives";
import { raceResults, races } from "@/lib/raceos-data";

export const Route = createFileRoute("/owner/racing")({
  head: () => ({
    meta: [
      { title: "Racing calendar & results — RACEOS" },
      {
        name: "description",
        content: "Upcoming entries, purses and past results for the horses you own.",
      },
      { property: "og:title", content: "Racing calendar & results — RACEOS" },
      { property: "og:description", content: "Entries, placings and prize money in one view." },
    ],
  }),
  component: OwnerRacing,
});

function OwnerRacing() {
  return (
    <AppShell role="owner" title="Racing">
      <section>
        <SectionTitle>Upcoming</SectionTitle>
        <div className="space-y-2">
          {races.map((r) => (
            <Panel key={r.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.track}</p>
                  <p className="text-[11px] text-muted-foreground">{r.entries} entries from this stable</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-sm font-semibold text-raceready">{r.date}</p>
                  <p className="num mt-0.5 text-[11px] text-muted-foreground">{r.purse}</p>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Results</SectionTitle>
        <Panel className="divide-y divide-border p-0">
          {raceResults.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.horse}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {r.name} · {r.date}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`num text-sm font-semibold ${r.place === "1st" ? "text-fit" : "text-foreground"}`}>
                  {r.place}
                </p>
                <p className="num text-[11px] text-muted-foreground">{r.prize}</p>
              </div>
            </div>
          ))}
        </Panel>
      </section>
    </AppShell>
  );
}
