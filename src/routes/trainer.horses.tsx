import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/raceos/shell";
import { EmptyState, FilterChips, HorseCard, SearchField } from "@/components/raceos/primitives";
import { horses } from "@/lib/raceos-data";

export const Route = createFileRoute("/trainer/horses")({
  head: () => ({
    meta: [
      { title: "Horses in work — RACEOS" },
      {
        name: "description",
        content: "Search and filter every horse by fitness, training phase and health status.",
      },
      { property: "og:title", content: "Horses in work — RACEOS" },
      { property: "og:description", content: "Fitness, phase and status for every horse in the stable." },
    ],
  }),
  component: TrainerHorses,
});

const filters = ["All", "Fit", "Monitor", "Injured", "Training", "Race ready", "Locked"];

export function HorseListScreen({ role, title }: { role: string; title: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");

  const list = useMemo(
    () =>
      horses.filter((h) => {
        const matchQ = h.name.toLowerCase().includes(q.toLowerCase());
        const matchF = filter === "All" || h.status.toLowerCase() === filter.toLowerCase();
        return matchQ && matchF;
      }),
    [q, filter],
  );

  return (
    <AppShell role={role as never} title={title}>
      <div className="space-y-3">
        <SearchField value={q} onChange={setQ} />
        <FilterChips options={filters} value={filter} onChange={setFilter} />
      </div>

      <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
        {list.length} horses
      </p>

      {list.length ? (
        <div className="space-y-2">
          {list.map((h) => (
            <HorseCard key={h.id} horse={h} to={`/horse/${role}/${h.id}`} />
          ))}
        </div>
      ) : (
        <EmptyState title="No horses match" detail="Try a different filter or clear the search." />
      )}
    </AppShell>
  );
}

function TrainerHorses() {
  return <HorseListScreen role="trainer" title="Horses" />;
}
