import { apiRequest } from "@/services/api-client";
import {
  mapTrainingSessions,
  type HorseTrainingSessionDto,
  type TrainingSessionView,
} from "@/adapters/training.adapter";

type Page<T> = { items: T[]; meta: { totalPages: number } };
type HorseSummary = { id: string; name: string };

export const trainingService = {
  async listHorseSessions(
    token: string,
    horseId: string,
    when?: "upcoming" | "history",
  ): Promise<TrainingSessionView[]> {
    const sessions: HorseTrainingSessionDto[] = [];
    let pageNumber = 1;
    let totalPages = 1;
    do {
      const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
      if (when) query.set("when", when);
      const page = await apiRequest<Page<HorseTrainingSessionDto>>(
        `/horses/${encodeURIComponent(horseId)}/training/sessions?${query.toString()}`,
        { token },
      );
      sessions.push(...(page.items ?? []));
      totalPages = page.meta?.totalPages ?? pageNumber;
      pageNumber += 1;
    } while (pageNumber <= totalPages);
    return mapTrainingSessions(horseId, "", sessions);
  },

  async listAllVisibleSessions(token: string): Promise<TrainingSessionView[]> {
    const horses = await listVisibleHorses(token);
    const grouped = await Promise.all(
      horses.map(async (horse) => {
        const sessions = await this.listHorseSessions(token, horse.id);
        return sessions.map((session) => ({ ...session, horseName: horse.name }));
      }),
    );
    return grouped.flat().sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
  },
};

async function listVisibleHorses(token: string): Promise<HorseSummary[]> {
  const horses: HorseSummary[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
    const page = await apiRequest<Page<HorseSummary>>(`/horses?${query.toString()}`, { token });
    horses.push(...(page.items ?? []));
    totalPages = page.meta?.totalPages ?? pageNumber;
    pageNumber += 1;
  } while (pageNumber <= totalPages);
  return horses;
}
