import { formatDateTime } from "@/utils/formatters";

export type NotificationDto = {
  id: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  resource: { type: string; id: string; horseId?: string | null } | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPageDto = { items: NotificationDto[]; nextCursor: string | null };

export type HorseAlertDto = {
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
  alertLevel: "WARNING" | "CRITICAL";
  sessionParticipantId: string;
  sessionId: string;
  sessionName: string | null;
};

export type HorseAlertPageDto = {
  items: HorseAlertDto[];
  meta: { totalPages?: number; page?: number; totalItems?: number };
};

export type NotificationView = NotificationDto & { createdAtLabel: string };
export type HorseAlertView = HorseAlertDto & {
  horseId: string;
  horseName: string;
  recordedAtLabel: string;
};

const notificationCategoryLabels: Record<string, string> = {
  MEASUREMENT_ALERT: "Measurement alert",
  BARN_ASSIGNED: "Stable placement",
  GROOM_ASSIGNMENT: "Groom assignment",
  MEDICAL_CASE: "Medical case",
  TRAINING_LOCK: "Training lock",
  HEALTH_STATUS: "Health status",
  EXAM_REQUEST: "Exam request",
  CARE_REMINDER: "Care reminder",
  HORSE_LIFECYCLE: "Horse lifecycle",
  OWNERSHIP: "Horse ownership",
  PERFORMANCE_ALERT: "Performance alert",
  DAILY_CHECKLIST: "Daily checklist",
  INCIDENT: "Stable incident",
  SUPPLY: "Supply",
  SURCHARGE: "Horse surcharge",
  TRAINING_SESSION: "Training session",
  TRAINING_CLASS: "Training class",
};

export function notificationCategoryLabel(category: string): string {
  return notificationCategoryLabels[category] ?? category.replaceAll("_", " ");
}

export function mapNotification(item: NotificationDto): NotificationView {
  return { ...item, createdAtLabel: formatDateTime(item.createdAt) };
}

export function mapHorseAlert(
  horseId: string,
  horseName: string,
  item: HorseAlertDto,
): HorseAlertView {
  return { ...item, horseId, horseName, recordedAtLabel: formatDateTime(item.recordedAt) };
}
