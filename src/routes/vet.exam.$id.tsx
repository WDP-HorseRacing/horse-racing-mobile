import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/raceos/shell";
import { ActionButton, Panel, SectionTitle } from "@/components/raceos/primitives";
import { getHorse } from "@/lib/raceos-data";

export const Route = createFileRoute("/vet/exam/$id")({
  head: () => ({
    meta: [
      { title: "Medical examination — RACEOS" },
      {
        name: "description",
        content:
          "Record vitals, symptoms, diagnosis, treatment, medication and follow-up in a single structured examination.",
      },
      { property: "og:title", content: "Medical examination — RACEOS" },
      { property: "og:description", content: "Clinical detail captured in the same flow as the decision." },
    ],
  }),
  component: Exam,
});

const symptomOptions = [
  "Elevated HR",
  "Slow HR recovery",
  "Lameness",
  "Heat / swelling",
  "Reduced appetite",
  "Cough",
  "Dehydration",
];

function Exam() {
  const { id } = Route.useParams();
  const horse = getHorse(id);
  const [symptoms, setSymptoms] = useState<string[]>(["Elevated HR", "Slow HR recovery"]);
  const [diagnosis, setDiagnosis] = useState("Exercise intolerance — suspected cardiac arrhythmia");
  const [treatment, setTreatment] = useState("Rest 10 days, cardiac monitoring, no heavy work");
  const [medication, setMedication] = useState("None pending ECG");
  const [notes, setNotes] = useState("Recheck ECG in 72 h. Recommend training lock until cleared.");
  const [saved, setSaved] = useState(false);

  const toggle = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <AppShell
      role="vet"
      title="Examination"
      subtitle={`${horse.name} · stall ${horse.stall}`}
      back={`/horse/vet/${horse.id}`}
    >
      {saved ? (
        <section className="rise rounded-xl border border-fit/40 bg-fit-soft p-4">
          <p className="text-sm font-semibold text-fit">Examination saved</p>
          <p className="mt-1 text-xs text-foreground/85">
            Added to the medical record and the horse timeline. Trainer notified.
          </p>
        </section>
      ) : null}

      <section>
        <SectionTitle>Vitals</SectionTitle>
        <Panel className="grid grid-cols-2 gap-3">
          {[
            ["Heart rate", "48 bpm resting"],
            ["Temperature", "38.4 °C"],
            ["Respiration", "18 /min"],
            ["Weight", `${horse.weight} kg`],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{k}</p>
              <p className="num mt-1 text-sm font-medium">{v}</p>
            </div>
          ))}
        </Panel>
      </section>

      <section>
        <SectionTitle>Symptoms</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {symptomOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                symptoms.includes(s)
                  ? "border-monitor/50 bg-monitor-soft text-monitor"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {[
          ["Diagnosis", diagnosis, setDiagnosis],
          ["Treatment", treatment, setTreatment],
          ["Medication", medication, setMedication],
          ["Notes", notes, setNotes],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="block">
            <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              {label as string}
            </span>
            <textarea
              rows={2}
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
        ))}
        <div className="rounded-xl border border-border bg-surface px-3 py-3 text-sm">
          Follow-up: <span className="font-medium">in 3 days · 09:00</span>
        </div>
      </section>

      <section className="sticky bottom-24 space-y-2">
        <ActionButton
          onClick={() => {
            setSaved(true);
            toast.success("Examination recorded", { description: horse.name });
          }}
        >
          Save examination
        </ActionButton>
        <ActionButton variant="danger" to={`/vet/lock/${horse.id}`}>
          Continue to training lock
        </ActionButton>
      </section>
    </AppShell>
  );
}
