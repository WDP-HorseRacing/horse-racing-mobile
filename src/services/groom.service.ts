import type { GroomTodayDto } from "@/adapters/groom.adapter";
import { apiRequest } from "@/services/api-client";

export const groomService = {
  getToday(token: string) {
    return apiRequest<GroomTodayDto>("/grooms/me/today", { token });
  },

  tickChecklistItem(token: string, itemId: string, done: boolean) {
    return apiRequest<void>(`/checklist-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      token,
      body: { done },
    });
  },

  checkIn(token: string, participantId: string) {
    return apiRequest<void>(`/session-participants/${encodeURIComponent(participantId)}/check-in`, {
      method: "POST",
      token,
    });
  },

  markReady(token: string, participantId: string) {
    return apiRequest<void>(`/session-participants/${encodeURIComponent(participantId)}/ready`, {
      method: "POST",
      token,
    });
  },

  completeCareSchedule(token: string, scheduleId: string) {
    return apiRequest<void>(`/care-schedules/${encodeURIComponent(scheduleId)}/complete`, {
      method: "POST",
      token,
      body: {},
    });
  },

  reportIncident(token: string, input: { horseId: string; description: string; urgent?: boolean; photoMediaId?: string }) {
    return apiRequest<IncidentDto>("/incidents", { method: "POST", token, body: input });
  },
};

export type IncidentDto = {
  id: string;
  horseId: string;
  horseName: string;
  description: string;
  urgent: boolean;
  status: string;
  photoUrl: string | null;
  createdAt: string;
};
