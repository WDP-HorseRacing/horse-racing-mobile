import { createFileRoute } from "@tanstack/react-router";
import { HorseListScreen } from "@/components/raceos/screens";

export const Route = createFileRoute("/vet/horses")({
  head: () => ({
    meta: [
      { title: "Horses under care — RACEOS" },
      { name: "description", content: "Every horse in the club filtered by health status and recovery state." },
      { property: "og:title", content: "Horses under care — RACEOS" },
      { property: "og:description", content: "Triage the stable by health status in one list." },
    ],
  }),
  component: () => <HorseListScreen role="vet" title="Horses" subtitle="Health status across the club" />,
});
