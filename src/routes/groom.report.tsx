import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/raceos/shell";
import { ActionButton, Panel, SectionTitle } from "@/components/raceos/primitives";
import { horses } from "@/lib/raceos-data";

export const Route = createFileRoute("/groom/report")({
  head: () => ({
    meta: [
      { title: "Report an incident — RACEOS" },
      {
        name: "description",
        content:
          "Three-tap incident reporting from the stable floor: pick the horse, pick the sign, set severity, send to the vet.",
      },
      { property: "og:title", content: "Report an incident — RACEOS" },
      { property: "og:description", content: "Faster than a form — escalates straight to the veterinarian." },
    ],
  }),
  component: IncidentReport,
});

const incidents = [
  "Not eating",
  "Fever signs",
  "Colic signs",
  "Hoof issue",
  "Injury",
  "Unusual behaviour",
  "Other",
];
const severities = ["Low", "Medium", "High", "Urgent"];

function IncidentReport() {
  const [horse, setHorse] = useState("");
  const [kind, setKind] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(false);
  const [sent, setSent] = useState(false);

  const ready = horse && kind;

  if (sent) {
    return (
      <AppShell role="groom" title="Incident sent" back="/groom">
        <section className="rise rounded-xl border border-fit/40 bg-fit-soft p-5 text-center">
          <p className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-fit/20 text-fit">
            <Check className="h-6 w-6" />
          </p>
          <h2 className="mt-3 text-lg font-semibold">Sent to the veterinarian</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {horse} · {kind} · severity {severity}
          </p>
        </section>
        <Panel className="space-y-2 text-xs text-muted-foreground">
          <p>Vet notified immediately · escalation timer started</p>
          <p>Trainer informed if training is affected</p>
          <p>Event added to the horse timeline and audit log</p>
        </Panel>
        <ActionButton variant="secondary" to="/groom">
          Back to today
        </ActionButton>
      </AppShell>
    );
  }

  return (
    <AppShell role="groom" title="Report incident" subtitle="Three taps · under 20 seconds" back="/groom">
      <section>
        <SectionTitle>1 · Which horse</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {horses.slice(0, 6).map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHorse(h.name)}
              className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                horse === h.name ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <span className="block truncate">{h.name}</span>
              <span className="num block text-[11px] text-muted-foreground">{h.stall}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>2 · What did you see</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {incidents.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setKind(i)}
              className={`rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors ${
                kind === i ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>3 · Severity</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {severities.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`h-12 rounded-xl border text-sm font-semibold transition-colors ${
                severity === s
                  ? s === "Urgent"
                    ? "border-injured bg-injured-soft text-injured"
                    : "border-primary bg-primary/10"
                  : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setPhoto(true)}
          className={`flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs ${
            photo ? "border-fit/50 bg-fit-soft text-fit" : "border-border text-muted-foreground"
          }`}
        >
          <Camera className="h-5 w-5" />
          {photo ? "1 photo attached" : "Add photo"}
        </button>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Short description (optional)"
          className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </section>

      <section className="sticky bottom-24">
        <ActionButton
          variant={ready ? "danger" : "secondary"}
          onClick={() => {
            if (!ready) {
              toast.error("Select a horse and what you saw");
              return;
            }
            setSent(true);
          }}
        >
          Send to veterinarian
        </ActionButton>
      </section>
    </AppShell>
  );
}
