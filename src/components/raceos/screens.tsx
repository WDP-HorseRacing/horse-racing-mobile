import { useMemo, useState } from "react";
import { AppShell } from "./shell";
import { EmptyState, FilterChips, HorseCard, SearchField } from "./primitives";
import { horses } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";

const filters = ["All", "Fit", "Monitor", "Injured", "Training", "Race ready", "Locked"];

export function HorseListScreen({
  role,
  title,
  subtitle,
  onlyOwner,
}: {
  role: RoleId;
  title: string;
  subtitle?: string;
  onlyOwner?: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");

  const source = useMemo(
    () => (onlyOwner ? horses.filter((h) => h.owner === onlyOwner) : horses),
    [onlyOwner],
  );

  const list = useMemo(
    () =>
      source.filter((h) => {
        const matchQ = h.name.toLowerCase().includes(q.toLowerCase());
        const matchF = filter === "All" || h.status.toLowerCase() === filter.toLowerCase();
        return matchQ && matchF;
      }),
    [q, filter, source],
  );

  return (
    <AppShell role={role} title={title} subtitle={subtitle}>
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
