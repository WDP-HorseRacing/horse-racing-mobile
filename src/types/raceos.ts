export type HorseStatus = "FIT" | "MONITOR" | "INJURED" | "LOCKED" | "TRAINING";
export type RoleId = "trainer" | "groom" | "vet" | "owner" | "manager";

export type TaskSourceType = "checklist" | "training" | "care";

export type Task = {
  id: string;
  time: string;
  horse: string;
  horseId: string;
  title: string;
  detail: string;
  kind: "Feeding" | "Training" | "Grooming" | "Recovery" | "Cleaning" | "Bathing";
  done: boolean;
  priority?: boolean;
  actionable?: boolean;
  sourceType?: TaskSourceType;
  sourceId?: string | null;
  sourceAction?: "check-in" | "ready" | "complete" | null;
  actionLabel?: string;
};
