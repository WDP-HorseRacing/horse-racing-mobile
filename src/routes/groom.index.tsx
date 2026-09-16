import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  component: GroomHome;
}
