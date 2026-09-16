import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/raceos/shell";
import { FilterChips, Meter, Panel, SectionTitle, TaskCard } from "@/components/raceos/primitives";
import { groomTasks } from "@/lib/raceos-data";

export const Route = createFileRoute("/groom/tasks")({
  head: () => ({
    meta: [
      { title: "Daily task queue — RACEOS" },
      {
        name: "description",
        content: "Feeding, grooming, bathing, ice baths and training preparation with one-tap completion.",
      },
      { property: "og:title", content: "Daily task queue — RACEOS" },
      { property: "og:description", content: "Built for one-handed use while working around the stable." },
    ],
  }),
  component: GroomTasks,
});

function GroomTasks() {
  const [tasks, setTasks] = useState(groomTasks);
  const [filter, setFilter] = useState("All");

  const complete = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
    toast.success("Task completed");
  };

  const list = tasks.filter((t) =>
    filter === "All" ? true : filter === "Open" ? !t.done : filter === "Done" ? t.done : t.kind === filter,
  );
  const done = tasks.filter((t) => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <AppShell role="groom" title="Tasks" subtitle={`${done} of ${tasks.length} complete`}>
      <Panel>
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium">Today's progress</p>
          <p className="num text-primary">{pct}%</p>
        </div>
        <div className="mt-2">
          <Meter value={pct} />
        </div>
      </Panel>

      <FilterChips
        options={["All", "Open", "Done", "Feeding", "Training", "Recovery", "Grooming"]}
        value={filter}
        onChange={setFilter}
      />

      <section>
        <SectionTitle>{filter === "All" ? "Full day" : filter}</SectionTitle>
        <div className="space-y-2.5">
          {list.map((t) => (
            <TaskCard key={t.id} task={t} onComplete={complete} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
