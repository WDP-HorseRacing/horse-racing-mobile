import { apiRequest } from "@/services/api-client";
import {
  mapTrainingSessions,
  type HorseTrainingSessionDto,
  type TrainingSessionView,
} from "@/adapters/training.adapter";

type Page<T> = { items: T[]; meta: { totalPages: number } };
type HorseSummary = { id: string; name: string };

export type TrainingClassDto = {
  id: string; code: string; name: string; description: string | null; raceAptitude: string | null;
  maxHorses: number; headTrainerId: string | null; planId: string; startDate: string; endDate: string;
  status: string; completedAt: string | null; cancelledAt: string | null; cancelReason: string | null;
  createdAt: string; updatedAt: string;
};
export type TrainingSessionDto = {
  id: string; classId: string; subjectId: string | null; name: string; sessionType: string;
  intensity: string | null; plannedDistanceM: number; scheduledStartAt: string; scheduledEndAt: string;
  location: string | null; surface: string | null; notes: string | null; status: string;
  cancelledAt: string | null; cancelledBy: string | null; cancelReason: string | null;
};

export type SessionParticipantDto = {
  id: string;
  sessionId: string;
  horseId: string;
  horseEnrollmentId: string;
  assignedGroomId: string | null;
  assignedGroomName: string | null;
  status: string;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  absenceReason: string | null;
  cancelReason: string | null;
  ineligibilityReason: string | null;
  trainingLocked: boolean;
  horseName: string;
  horsePhotoUrl: string | null;
};

type SessionParticipantEvaluationInput = { score: number; comment?: string };

export const trainingService = {
  getClass(token: string, classId: string) {
    return apiRequest<TrainingClassDto>(`/classes/${encodeURIComponent(classId)}`, { token });
  },

  async listClassSessions(token: string, classId: string) {
    const response = await apiRequest<TrainingSessionDto[] | { items: TrainingSessionDto[] }>(
      `/classes/${encodeURIComponent(classId)}/sessions`, { token },
    );
    return Array.isArray(response) ? response : response.items ?? [];
  },

  getSession(token: string, sessionId: string) {
    return apiRequest<TrainingSessionDto>(`/training-sessions/${encodeURIComponent(sessionId)}`, { token });
  },

  listSessionParticipants(token: string, sessionId: string) {
    return apiRequest<SessionParticipantDto[]>(
      `/training-sessions/${encodeURIComponent(sessionId)}/participants`,
      { token },
    );
  },

  createEvaluation(token: string, participantId: string, input: SessionParticipantEvaluationInput) {
    return apiRequest<unknown>(`/session-participants/${encodeURIComponent(participantId)}/evaluation`, {
      method: "POST", token, body: input,
    });
  },

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
