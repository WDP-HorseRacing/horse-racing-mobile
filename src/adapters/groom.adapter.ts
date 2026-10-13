import type { Task } from "@/types/raceos";
import { formatTime } from "@/utils/formatters";

export type GroomTodayDto = {
  date: string;
  horses: Array<{
    horseId: string;
    horseName: string;
    barnName: string | null;
    stallCode: string | null;
    checklist: {
      items: Array<{ id: string; name: string; done: boolean; note: string | null }>;
    } | null;
    feedingPlan: {
      meals: Array<{
        meal: string;
        items: Array<{ name: string; quantity: number; unit: string }>;
      }>;
    } | null;
    trainingRuns: Array<{
      participantId: string;
      sessionId: string;
      sessionName: string;
      scheduledStartAt: string;
      scheduledEndAt: string;
      status: string;
    }>;
    careSchedules: Array<{
      id: string;
      type: string;
      dueAt: string;
      overdue: boolean;
      notes: string | null;
    }>;
  }>;
};

export function mapGroomTodayToTasks(today: GroomTodayDto): Task[] {
  const tasks: Task[] = [];
  for (const horse of today.horses) {
    const rationForHorse = horse.feedingPlan?.meals ?? [];
    const feedingChecklistItemId = horse.checklist?.items.find(
      (item) => classifyTask(item.name) === "Feeding",
    )?.id;
    for (const item of horse.checklist?.items ?? []) {
      const kind = classifyTask(item.name);
      const ration = item.id === feedingChecklistItemId ? rationForHorse[0] : undefined;
      tasks.push({
        id: item.id,
        sourceId: item.id,
        sourceType: "checklist",
        time: ration ? mealTime(ration.meal) : "Today",
        horse: horse.horseName,
        horseId: horse.horseId,
        title: item.name,
        detail: item.note ?? location(horse.barnName, horse.stallCode),
        kind,
        done: item.done,
        actionable: true,
        dietaryRation: ration
          ? {
              feedingTime: ration.meal.replaceAll("_", " "),
              items: ration.items,
            }
          : undefined,
      });
    }

    for (const meal of rationForHorse.slice(feedingChecklistItemId ? 1 : 0)) {
      tasks.push({
        id: `feeding:${horse.horseId}:${meal.meal}`,
      sourceId: null,
        sourceType: "feeding",
        time: mealTime(meal.meal),
        horse: horse.horseName,
        horseId: horse.horseId,
        title: "Feeding plan",
        detail: location(horse.barnName, horse.stallCode),
        kind: "Feeding",
        done: false,
        actionable: false,
        dietaryRation: { feedingTime: meal.meal.replaceAll("_", " "), items: meal.items },
      });
    }

    for (const run of horse.trainingRuns) {
      const action = run.status === "PLANNED" ? "check-in" : run.status === "PRESENT" ? "ready" : null;
      tasks.push({
        id: `training:${run.participantId}`,
        sourceId: run.participantId,
        sourceType: "training",
        sourceAction: action,
        actionLabel: action === "check-in" ? "Check in" : action === "ready" ? "Mark ready" : undefined,
        time: formatTime(run.scheduledStartAt),
        horse: horse.horseName,
        horseId: horse.horseId,
        title: run.sessionName,
        detail: `Training · ${run.status.toLowerCase().replaceAll("_", " ")}`,
        kind: "Training",
        done: ["COMPLETED", "ABSENT", "SKIPPED", "INELIGIBLE", "CANCELLED", "CANCELLED_BY_LOCK"].includes(run.status),
        actionable: action !== null,
      });
    }

    for (const schedule of horse.careSchedules) {
      tasks.push({
        id: `care:${schedule.id}`,
        sourceId: schedule.id,
        sourceType: "care",
        sourceAction: "complete",
        actionLabel: "Complete care",
        time: formatTime(schedule.dueAt),
        horse: horse.horseName,
        horseId: horse.horseId,
        title: schedule.type.replaceAll("_", " "),
        detail: [schedule.overdue ? "Overdue" : "Care schedule", schedule.notes]
          .filter(Boolean)
          .join(" · "),
        kind: "Grooming",
        done: false,
        actionable: true,
      });
    }
  }

  return tasks.sort((a, b) => a.time.localeCompare(b.time));
}

function classifyTask(name: string): Task["kind"] {
  const normalized = name.toLowerCase();
  if (/feed|ration|meal|ăn|thức ăn/.test(normalized)) return "Feeding";
  if (/train|walk|run|exercise|tập|dắt/.test(normalized)) return "Training";
  if (/recover|rest|therapy|hồi phục|nghỉ/.test(normalized)) return "Recovery";
  if (/clean|stall|chuồng|dọn/.test(normalized)) return "Cleaning";
  if (/bath|wash|tắm/.test(normalized)) return "Bathing";
  return "Grooming";
}

function mealTime(meal: string): string {
  switch (meal) {
    case "EARLY_MORNING":
      return "05:30";
    case "NOON":
      return "12:00";
    case "AFTERNOON":
      return "16:00";
    case "EVENING":
      return "19:00";
    default:
      return "Today";
  }
}

function location(barnName: string | null, stallCode: string | null): string {
  return [barnName, stallCode].filter(Boolean).join(" · ") || "Stable care";
}

