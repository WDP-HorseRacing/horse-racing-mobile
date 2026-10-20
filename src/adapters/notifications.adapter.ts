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
