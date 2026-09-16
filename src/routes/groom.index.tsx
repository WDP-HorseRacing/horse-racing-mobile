import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/raceos/shell";
import {
  ActionButton,
  MetricCard,
  Panel,
  SectionTitle,
  StatusBadge,
  TaskCard,
} from "@/components/raceos/primitives";
import { groomTasks, horses } from "@/lib/raceos-data";

export const Route = createFileRoute("/groom/")({
  head: () => ({
    meta: [
      { title: "Today's stable work — RACEOS" },
      {
        name: "description",
        content:
          "One-handed daily task queue for grooms: feeding, training preparation, recovery care and incident reporting.",
      },
      { property: "og:title", content: "Today's stable work — RACEOS" },
      { property: "og:description", content: "Large touch targets, one task at a time, instant reporting." },
    ],
  }),
  component: GroomHome,
});

function GroomHome() {
  const [tasks, setTasks] = useState(groomTasks);
  const done = tasks.filter((t) => t.done).length;
  const next = tasks.find((t) => !t.done);

  const complete = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
    toast.success("Task completed", { description: "Logged to the horse timeline." });
  };

  return (
    <AppShell role="groom" title="Good morning, Mai" subtitle="A wing · Monday · 8 horses">
      <section className="grid grid-cols-3 gap-2.5">
        <MetricCard label="Tasks" value={`${done}/${tasks.length}`} hint="Today" />
        <MetricCard label="Next" value={next?.time ?? "—"} hint={next?.horse ?? "All done"} tone="training" />
        <MetricCard label="Flags" value={2} hint="Vet instructions" tone="monitor" />
      </section>

      {next ? (
        <section>
          <SectionTitle>Do this next</SectionTitle>
          <TaskCard task={next} onComplete={complete} />
        </section>
      ) : null}

      <section>
        <SectionTitle>Vet instructions for today</SectionTitle>
        <Panel className="space-y-3">
          {[
            ["Thunder King", "Training locked — walk in hand only, 20 min."],
            ["Red Storm", "Ice bath left fore, 15 min after 08:00."],
          ].map(([h, i]) => (
            <div key={h} className="rounded-lg border border-monitor/35 bg-monitor-soft px-3 py-2.5">
              <p className="text-sm font-semibold">{h}</p>
              <p className="mt-0.5 text-xs text-foreground/85">{i}</p>
            </div>
          ))}
        </Panel>
      </section>

      <section>
        <SectionTitle>Horses in your care</SectionTitle>
        <Panel className="divide-y divide-border p-0">
          {horses.slice(0, 4).map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{h.name}</p>
                <p className="text-[11px] text-muted-foreground">Stall {h.stall}</p>
              </div>
              <StatusBadge status={h.status} />
            </div>
          ))}
        </Panel>
      </section>

      <section>
        <ActionButton variant="secondary" to="/groom/report">
          Report an incident
        </ActionButton>
      </section>
    </AppShell>
  );
}
