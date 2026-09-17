import { createFileRoute } from "@tanstack/react-router";
import { HorseListScreen } from "@/components/raceos/screens";

export const Route = createFileRoute("/owner/horses")({
  head: () => ({
    meta: [
      { title: "Owned horses — RACEOS" },
      { name: "description", content: "The horses you own, with fitness, status and training phase." },
      { property: "og:title", content: "Owned horses — RACEOS" },
      { property: "og:description", content: "Only your horses — no stable-wide operational detail." },
    ],
  }),
  component: () => (
    <HorseListScreen role="owner" title="My horses" subtitle="Marlow Bloodstock" onlyOwner="Marlow Bloodstock" />
  ),
});
