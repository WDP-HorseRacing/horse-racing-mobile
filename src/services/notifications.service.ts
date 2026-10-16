import type { HorseAlertPageDto, NotificationPageDto } from "@/adapters/notifications.adapter";
import { apiRequest } from "@/services/api-client";

export const notificationsService = {
  list(token: string, cursor?: string) {
    const query = new URLSearchParams({ limit: "50" });
    if (cursor) query.set("cursor", cursor);
    return apiRequest<NotificationPageDto>(`/notifications?${query.toString()}`, { token });
  },

  markRead(token: string, notificationId: string) {
    return apiRequest<unknown>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "PATCH", token,
    });
  },

  markAllRead(token: string) {
    return apiRequest<{ count: number }>("/notifications/read-all", { method: "PATCH", token });
  },

  async listHorseAlerts(token: string, horseId: string) {
    const items = [] as HorseAlertPageDto["items"];
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
      const page = await apiRequest<HorseAlertPageDto>(
        `/horses/${encodeURIComponent(horseId)}/alerts?${query.toString()}`, { token },
      );
      items.push(...(page.items ?? []));
      totalPages = page.meta?.totalPages ?? pageNumber;
      pageNumber += 1;
    } while (pageNumber <= totalPages);
    return items;
  },
};
