import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/raceos/shell";
import { ActionButton, KeyValue, Panel, SectionTitle } from "@/components/raceos/primitives";
import { getHorse } from "@/lib/raceos-data";

export const Route = createFileRoute("/trainer/plan/$id")({
  head: () => ({
    meta: [
      { title: "Adjust training plan — RACEOS" },
      {
        name: "description",
        content:
          "Replace a suspended plan with a recovery plan — distance, workload, intensity, surface and start date — and publish it to the groom instantly.",
      },
      { property: "og:title", content: "Adjust training plan — RACEOS" },
      { property: "og:description", content: "One publish updates the groom's schedule and the horse timeline." },
    ],
  }),
  component: PlanEditor,
});

const phases = ["Recovery", "Base Conditioning", "Speed Work", "Peak / Taper"];
const surfaces = ["Soft", "Turf", "Dirt", "Synthetic"];
const intensities = ["Light", "Moderate", "High"];

function PlanEditor() {
  const { id } = Route.useParams();
  const horse = getHorse(id);

  const [phase, setPhase] = useState("Recovery");
  const [distance, setDistance] = useState(800);
  const [workload, setWorkload] = useState(50);
  const [surface, setSurface] = useState("Soft");
  const [intensity, setIntensity] = useState("Light");
  const [note, setNote] = useState("Reintroduce work gradually. Stop immediately if HR exceeds 160 bpm.");
  const [published, setPublished] = useState(false);

  return (
    <AppShell
      role="trainer"
      title="Training plan"
      subtitle={`${horse.name} · ${horse.status}`}
      back="/trainer/alerts"
    >
      {published ? (
        <section className="rise rounded-xl border border-fit/40 bg-fit-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-fit">
            <Check className="h-4 w-4" /> Recovery plan published
          </p>
          <p className="mt-1 text-xs text-foreground/85">
            Groom Mai Tran received the updated schedule for tomorrow 06:00. Veterinarian notified for
            recovery tracking.
          </p>
        </section>
      ) : null}

      <section>
        <SectionTitle>Previous plan · suspended</SectionTitle>
        <Panel className="opacity-70">
          <KeyValue
            items={[
              ["Phase", "Base Conditioning"],
              ["Distance", "1,600 m"],
              ["Workload", "80%"],
              ["Intensity", "Moderate"],
              ["Surface", "Dirt"],
              ["Status", "Stopped by vet lock"],
            ]}
          />
        </Panel>
      </section>

      <section>
        <SectionTitle>New plan</SectionTitle>
        <Panel className="space-y-4">
          <Field label="Phase">
            <Segmented options={phases} value={phase} onChange={setPhase} />
          </Field>

          <Field label={`Distance · ${distance.toLocaleString()} m`}>
            <input
              type="range"
              min={400}
              max={2400}
              step={200}
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>

          <Field label={`Workload · ${workload}%`}>
            <input
              type="range"
              min={30}
              max={100}
              step={5}
              value={workload}
              onChange={(e) => setWorkload(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>

          <Field label="Intensity">
            <Segmented options={intensities} value={intensity} onChange={setIntensity} />
          </Field>

          <Field label="Surface">
            <Segmented options={surfaces} value={surface} onChange={setSurface} />
          </Field>

          <Field label="Start date">
            <div className="rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm">
              Tomorrow · 06:00 · assigned to Mai Tran
            </div>
          </Field>

          <Field label="Trainer note">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
        </Panel>
      </section>

      <section>
        <SectionTitle>Impact</SectionTitle>
        <Panel className="space-y-2 text-xs text-muted-foreground">
          {[
            "Groom schedule regenerated from tomorrow",
            "Heavy work blocked while status is LOCKED",
            "Veterinarian gets recovery-tracking milestones",
            "Owner report updated with adjusted programme",
          ].map((t) => (
            <p key={t} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
              {t}
            </p>
          ))}
        </Panel>
      </section>

      <section className="sticky bottom-24 space-y-2">
        <ActionButton
          onClick={() => {
            setPublished(true);
            toast.success("Training plan updated", {
              description: `${horse.name} · ${distance} m · ${workload}% · ${intensity}`,
            });
          }}
        >
          Update training plan
        </ActionButton>
        <ActionButton variant="secondary" to="/trainer">
          Cancel
        </ActionButton>
      </section>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            value === o
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-elevated text-muted-foreground"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
