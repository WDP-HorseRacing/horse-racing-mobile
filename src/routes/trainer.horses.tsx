import { createFileRoute } from "@tanstack/react-router";
import { HorseListScreen } from "@/components/raceos/screens";

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

function TrainerHorses() {
  return <HorseListScreen role="trainer" title="Horses" />;
}
