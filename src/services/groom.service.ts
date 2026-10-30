import type { GroomTodayDto } from "@/adapters/groom.adapter";
import type { DailyChecklistDto, FeedingMeal, IncidentDto } from "@/services/stable-care.service";
import { apiRequest } from "@/services/api-client";

export const groomService = {
  async getToday(token: string): Promise<GroomTodayDto> {
    const today = await apiRequest<GroomTodayDto>("/grooms/me/today", { token });
    return {
      ...today,
      horses: arrayOrEmpty<GroomTodayDto["horses"][number]>(today?.horses).map((horse) => ({
        ...horse,
        checklist: horse.checklist
          ? {
              ...horse.checklist,
              items: arrayOrEmpty<DailyChecklistDto["items"][number]>(horse.checklist.items),
            }
          : null,
        feedingPlan: horse.feedingPlan
          ? {
              ...horse.feedingPlan,
              meals: arrayOrEmpty<FeedingMeal>(horse.feedingPlan.meals).map((meal) => ({
                ...meal,
                items: arrayOrEmpty<FeedingMeal["items"][number]>(meal.items),
              })),
            }
          : null,
        trainingRuns: arrayOrEmpty<GroomTodayDto["horses"][number]["trainingRuns"][number]>(
          horse.trainingRuns,
        ),
        careSchedules: arrayOrEmpty<GroomTodayDto["horses"][number]["careSchedules"][number]>(
          horse.careSchedules,
        ),
      })),
      horseVetAppointments: arrayOrEmpty<
        NonNullable<GroomTodayDto["horseVetAppointments"]>[number]
      >(today?.horseVetAppointments),
    };
  },

  tickChecklistItem(token: string, itemId: string, done: boolean, note?: string | null) {
    return apiRequest<DailyChecklistDto>(`/checklist-items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      token,
      body: { done, ...(note !== undefined ? { note } : {}) },
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

  reportIncident(
    token: string,
    input: { horseId: string; description: string; urgent?: boolean; photoMediaId?: string },
  ) {
    return apiRequest<IncidentDto>("/incidents", { method: "POST", token, body: input });
  },
};

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
