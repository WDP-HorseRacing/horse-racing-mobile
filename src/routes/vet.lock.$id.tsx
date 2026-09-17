import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/raceos/shell";
import { ActionButton, Panel, SectionTitle, TimelineItem } from "@/components/raceos/primitives";
import { getHorse } from "@/lib/raceos-data";

export const Route = createFileRoute("/vet/lock/$id")({
  head: () => ({
    meta: [
      { title: "Lock training — RACEOS" },
      {
        name: "description",
        content:
          "Emergency training lock: stop the current session, block heavy work, and notify trainer and groom in one confirmed action.",
      },
      { property: "og:title", content: "Lock training — RACEOS" },
      { property: "og:description", content: "A safety-critical action with its consequences stated up front." },
    ],
  }),
  component: LockTraining,
});

const reasons = [
  "Abnormal heart-rate response",
  "Suspected lameness",
  "Fever / infection risk",
  "Post-injury rehabilitation",
];

function LockTraining() {
  const { id } = Route.useParams();
  const horse = getHorse(id);
  const [reason, setReason] = useState(reasons[0]);
  const [locked, setLocked] = useState(false);

  if (locked) {
    return (
      <AppShell role="vet" title="Training locked" subtitle={horse.name} back="/vet">
        <section className="rise rounded-xl border border-border-strong bg-locked-soft p-5 text-center">
          <p className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-elevated text-locked">
            <Lock className="h-5 w-5" />
          </p>
          <h2 className="mt-3 text-xl font-semibold">{horse.name} is LOCKED</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Training status: STOPPED · locked by Dr. S. Rao at 10:24
          </p>
        </section>

        <section>
          <SectionTitle>System events created</SectionTitle>
          <Panel>
            <TimelineItem
              time="10:24"
              title="Horse status set to LOCKED"
              detail={`Reason: ${reason}`}
              tone="critical"
            />
            <TimelineItem
              time="10:24"
              title="Current training session stopped"
              detail="Groom Mai Tran instructed to walk in hand only"
              tone="system"
            />
            <TimelineItem
              time="10:24"
              title="Head trainer alerted"
              detail="Elena Marsh · adjust training plan required"
              tone="system"
            />
            <TimelineItem
              time="10:24"
              title="Owner notified"
              detail="Marlow Bloodstock · health update issued"
              tone="system"
              last
            />
          </Panel>
        </section>

        <section className="space-y-2">
          <ActionButton to={`/horse/vet/${horse.id}`}>Open horse profile</ActionButton>
          <ActionButton variant="secondary" to="/flow">
            See what happens next
          </ActionButton>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell role="vet" title="Lock training" subtitle="Safety-critical action" back={`/horse/vet/${horse.id}`}>
      <section className="rounded-xl border border-injured/50 bg-injured-soft p-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-injured uppercase">
          Emergency training lock
        </p>
        <h2 className="mt-2 text-xl font-semibold">{horse.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Stall {horse.stall} · {horse.phase} · fitness {horse.fitness}%
        </p>
      </section>

      <section>
        <SectionTitle>Reason</SectionTitle>
        <div className="space-y-2">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors ${
                reason === r ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                  reason === r ? "border-primary bg-primary" : "border-border-strong"
                }`}
              />
              {r}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Impact</SectionTitle>
        <Panel className="space-y-2.5 text-xs text-foreground/85">
          {[
            "Current training will be stopped immediately",
            "New heavy training cannot be assigned",
            "Head trainer will receive a critical alert",
            "Groom will receive updated care instructions",
            "Horse status becomes LOCKED across every role",
          ].map((t) => (
            <p key={t} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-injured" />
              {t}
            </p>
          ))}
        </Panel>
      </section>

      <section className="sticky bottom-24 space-y-2">
        <ActionButton
          variant="danger"
          onClick={() => {
            setLocked(true);
            toast.error("Training locked", { description: `${horse.name} · ${reason}` });
          }}
        >
          Lock training
        </ActionButton>
        <ActionButton variant="secondary" to={`/horse/vet/${horse.id}`}>
          Cancel
        </ActionButton>
      </section>
    </AppShell>
  );
}
