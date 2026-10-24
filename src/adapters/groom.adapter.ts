import type { Task } from "@/types/raceos";
import type { DailyChecklistDto, FeedingPlanDto } from "@/services/stable-care.service";
import { formatTime } from "@/utils/formatters";

export type GroomTodayDto = {
  date: string;
  horses: {
    horseId: string;
    horseName: string;
    barnName: string | null;
    stallCode: string | null;
    checklist: DailyChecklistDto | null;
    feedingPlan: FeedingPlanDto | null;
    trainingRuns: {
      participantId: string;
      sessionId: string;
      sessionName: string;
      scheduledStartAt: string;
      scheduledEndAt: string;
      status: string;
    }[];
    careSchedules: {
      id: string;
      type: string;
      dueAt: string;
      overdue: boolean;
      notes: string | null;
    }[];
  }[];
  horseVetAppointments?: {
    id: string;
    horseId: string;
    horseName: string;
    type: "ROUTINE_CHECKUP" | "FOLLOW_UP";
    scheduledAt: string;
  }[];
};

/** Tasks are only backend-assigned work. Feeding instructions are shown separately as a plan. */
export function mapGroomTodayToTasks(today: GroomTodayDto): Task[] {
  const tasks: Task[] = [];
  for (const horse of today.horses) {
    for (const item of horse.checklist?.items ?? []) {
      tasks.push({
        id: item.id,
        sourceId: item.id,
        sourceType: "checklist",
        time: "Today",
        horse: horse.horseName,
        horseId: horse.horseId,
        title: item.name,
        detail: [item.note, location(horse.barnName, horse.stallCode)].filter(Boolean).join(" · "),
        kind: classifyTask(item.name),
        done: item.done,
        actionable:
          horse.checklist?.status !== "INCOMPLETE" && horse.checklist?.status !== "CANCELLED",
      });
    }

    for (const run of horse.trainingRuns) {
      const action =
        run.status === "PLANNED" || run.status === "ABSENT"
          ? "check-in"
          : run.status === "PRESENT"
            ? "ready"
            : null;
      tasks.push({
        id: `training:${run.participantId}`,
        sourceId: run.participantId,
        sourceType: "training",
        sourceAction: action,
        actionLabel:
          action === "check-in"
            ? run.status === "ABSENT"
              ? "Check in again"
              : "Check in"
            : action === "ready"
              ? "Mark ready"
              : undefined,
        time: formatTime(run.scheduledStartAt),
        horse: horse.horseName,
        horseId: horse.horseId,
        title: run.sessionName,
        detail: `Training · ${run.status.toLowerCase().replaceAll("_", " ")}`,
        kind: "Training",
        done: [
          "COMPLETED",
          "ABSENT",
          "SKIPPED",
          "INELIGIBLE",
          "CANCELLED",
          "CANCELLED_BY_LOCK",
        ].includes(run.status),
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

function location(barnName: string | null, stallCode: string | null): string {
  return [barnName, stallCode].filter(Boolean).join(" · ") || "Stable care";
}
