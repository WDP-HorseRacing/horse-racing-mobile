import { apiRequest } from "@/services/api-client";
import {
  mapTrainingSessions,
  type HorseTrainingSessionDto,
  type TrainingSessionView,
} from "@/adapters/training.adapter";

export type Page<T> = { items: T[]; meta: { totalPages: number } };

export type TrainingIntensity = "LIGHT" | "HEAVY";
export type TrainingSessionType = "REGULAR" | "TIME_TRIAL";
export type TrainingClassStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export type TrainingSessionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ParticipantStatus =
  | "PLANNED"
  | "PRESENT"
  | "READY"
  | "ONGOING"
  | "COMPLETED"
  | "STOPPED"
  | "ABSENT"
  | "SKIPPED"
  | "INELIGIBLE"
  | "CANCELLED_BY_LOCK"
  | "CANCELLED";

export type TrainingSubjectDto = {
  id: string;
  name: string;
  description: string | null;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  durationMinutes: number;
  surface: string | null;
  targetTimeMs: number | null;
  updatedAt: string;
};

export type TrainingSubjectInput = {
  name: string;
  description?: string;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  durationMinutes: number;
  surface?: string;
  targetTimeMs?: number | null;
};
export type TrainingSubjectCreateInput = Omit<TrainingSubjectInput, "targetTimeMs"> & {
  targetTimeMs?: number;
};
export type TrainingSubjectUpdateInput = Partial<TrainingSubjectCreateInput>;

export type TrainingPlanSubjectDto = { subject: TrainingSubjectDto; minSessionsPerWeek: number };
export type TrainingPlanPhaseDto = {
  position: number;
  startWeek: number;
  weeks: number;
  minTotalMinutes: number;
  subjects: TrainingPlanSubjectDto[];
};
export type TrainingPlanDto = {
  id: string;
  name: string;
  description: string | null;
  headTrainerId: string;
  totalWeeks: number;
  minTotalMinutes: number;
  phases: TrainingPlanPhaseDto[];
  updatedAt: string;
};
export type TrainingPlanInput = {
  name: string;
  description?: string;
  phases: { weeks: number; subjects: { subjectId: string; minSessionsPerWeek: number }[] }[];
};

export type TrainingClassDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  raceAptitude: "SPRINTER" | "MILER" | "STAYER" | null;
  maxHorses: number;
  headTrainerId: string | null;
  planId: string;
  startDate: string;
  endDate: string;
  status: TrainingClassStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateTrainingClassInput = {
  code: string;
  name: string;
  description?: string;
  raceAptitude?: "SPRINTER" | "MILER" | "STAYER";
  maxHorses?: number;
  planId: string;
  startDate: string;
};
export type UpdateTrainingClassInput = Partial<Omit<CreateTrainingClassInput, "planId">>;

export type ClassPlanDto = {
  classId: string;
  planId: string;
  minTotalMinutes: number;
  phases: (Omit<TrainingPlanPhaseDto, "startWeek"> & { startDate: string; endDate: string })[];
};
export type ClassProgressDto = {
  classId: string;
  minTotalMinutes: number;
  scheduledMinutes: number;
  weeks: {
    week: number;
    phasePosition: number;
    startDate: string;
    endDate: string;
    subjects: {
      subjectId: string;
      subjectName: string;
      minSessions: number;
      scheduledSessions: number;
    }[];
  }[];
};

export type TrainingSessionDto = {
  id: string;
  classId: string;
  subjectId: string | null;
  name: string;
  sessionType: TrainingSessionType;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  location: string | null;
  surface: string | null;
  notes: string | null;
  status: TrainingSessionStatus;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
};
export type TrainingSessionInput = {
  name: string;
  subjectId: string;
  intensity: TrainingIntensity;
  plannedDistanceM: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  sessionType?: TrainingSessionType;
  location?: string;
  surface?: string;
  notes?: string;
  targetTimeMs?: number | null;
};
export type TrainingSessionUpdate = Partial<
  Omit<TrainingSessionInput, "sessionType" | "targetTimeMs" | "location" | "surface" | "notes">
> & {
  location?: string | null;
  surface?: string | null;
  notes?: string | null;
};

export type HorseEnrollmentResponseDto = {
  id: string;
  classId: string;
  horseId: string;
  enrolledAt: string;
  leftAt: string | null;
  status: "ACTIVE" | "LEFT" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
};
export type HorseEnrollmentDto = HorseEnrollmentResponseDto & {
  horseName: string;
  horsePhotoUrl: string | null;
};
export type EnrollableHorseDto = {
  horseId: string;
  horseName: string;
  horsePhotoUrl: string | null;
};
export type SessionParticipantDto = {
  id: string;
  sessionId: string;
  horseId: string;
  horseEnrollmentId: string;
  assignedGroomId: string | null;
  assignedGroomName: string | null;
  status: ParticipantStatus;
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
export type SessionParticipantResponseDto = Omit<
  SessionParticipantDto,
  "assignedGroomName" | "trainingLocked" | "horseName" | "horsePhotoUrl"
>;
export type EvaluationDto = {
  id: string;
  sessionParticipantId: string;
  evaluatorId: string;
  score: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};
export type TrialResultDto = {
  id: string;
  sessionParticipantId: string;
  attemptNo: number;
  elapsedMs: number;
  notes: string | null;
  videoMediaId: string | null;
  videoUrl: string | null;
  recordedBy: string;
  recordedAt: string;
};
export type TimeTrialDto = {
  id: string;
  sessionId: string;
  distanceM: number;
  targetTimeMs: number | null;
  notes: string | null;
  createdAt: string;
};

export const trainingService = {
  listSubjects(token: string) {
    return apiRequest<TrainingSubjectDto[]>("/training-subjects", { token });
  },
  createSubject(token: string, input: TrainingSubjectCreateInput) {
    return apiRequest<TrainingSubjectDto>("/training-subjects", {
      method: "POST",
      token,
      body: input,
    });
  },
  updateSubject(token: string, subjectId: string, input: TrainingSubjectUpdateInput) {
    return apiRequest<TrainingSubjectDto>(`/training-subjects/${encodeURIComponent(subjectId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  deleteSubject(token: string, subjectId: string) {
    return apiRequest<void>(`/training-subjects/${encodeURIComponent(subjectId)}`, {
      method: "DELETE",
      token,
    });
  },

  listPlans(token: string) {
    return apiRequest<TrainingPlanDto[]>("/training-plans", { token });
  },
  getPlan(token: string, planId: string) {
    return apiRequest<TrainingPlanDto>(`/training-plans/${encodeURIComponent(planId)}`, { token });
  },
  createPlan(token: string, input: TrainingPlanInput) {
    return apiRequest<TrainingPlanDto>("/training-plans", { method: "POST", token, body: input });
  },
  replacePlan(token: string, planId: string, input: TrainingPlanInput) {
    return apiRequest<TrainingPlanDto>(`/training-plans/${encodeURIComponent(planId)}`, {
      method: "PUT",
      token,
      body: input,
    });
  },
  deletePlan(token: string, planId: string) {
    return apiRequest<void>(`/training-plans/${encodeURIComponent(planId)}`, {
      method: "DELETE",
      token,
    });
  },

  listClasses(token: string) {
    return apiRequest<TrainingClassDto[]>("/classes", { token });
  },
  getClass(token: string, classId: string) {
    return apiRequest<TrainingClassDto>(`/classes/${encodeURIComponent(classId)}`, { token });
  },
  getClassPlan(token: string, classId: string) {
    return apiRequest<ClassPlanDto>(`/classes/${encodeURIComponent(classId)}/plan`, { token });
  },
  getClassProgress(token: string, classId: string) {
    return apiRequest<ClassProgressDto>(`/classes/${encodeURIComponent(classId)}/progress`, {
      token,
    });
  },
  createClass(token: string, input: CreateTrainingClassInput) {
    return apiRequest<TrainingClassDto>("/classes", { method: "POST", token, body: input });
  },
  updateClass(token: string, classId: string, input: UpdateTrainingClassInput) {
    return apiRequest<TrainingClassDto>(`/classes/${encodeURIComponent(classId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  setClassStatus(
    token: string,
    classId: string,
    input: { status: "COMPLETED" | "CANCELLED"; cancelReason?: string },
  ) {
    return apiRequest<TrainingClassDto>(`/classes/${encodeURIComponent(classId)}/status`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  listEnrollments(token: string, classId: string) {
    return apiRequest<HorseEnrollmentDto[]>(`/classes/${encodeURIComponent(classId)}/enrollments`, {
      token,
    });
  },
  listEnrollableHorses(token: string, classId: string) {
    return apiRequest<EnrollableHorseDto[]>(
      `/classes/${encodeURIComponent(classId)}/enrollable-horses`,
      { token },
    );
  },
  enrollHorse(token: string, classId: string, horseId: string) {
    return apiRequest<HorseEnrollmentResponseDto>(
      `/classes/${encodeURIComponent(classId)}/enrollments`,
      { method: "POST", token, body: { horseId } },
    );
  },
  leaveEnrollment(
    token: string,
    enrollmentId: string,
    input: { reason?: string } = {},
  ) {
    return apiRequest<HorseEnrollmentResponseDto>(
      `/enrollments/${encodeURIComponent(enrollmentId)}/leave`,
      { method: "PATCH", token, body: input },
    );
  },

  listClassSessions(token: string, classId: string) {
    return apiRequest<TrainingSessionDto[] | { items: TrainingSessionDto[] }>(
      `/classes/${encodeURIComponent(classId)}/sessions`,
      { token },
    ).then((response) => (Array.isArray(response) ? response : (response.items ?? [])));
  },
  getSession(token: string, sessionId: string) {
    return apiRequest<TrainingSessionDto>(`/training-sessions/${encodeURIComponent(sessionId)}`, {
      token,
    });
  },
  createSession(token: string, classId: string, input: TrainingSessionInput) {
    return apiRequest<TrainingSessionDto>(`/classes/${encodeURIComponent(classId)}/sessions`, {
      method: "POST",
      token,
      body: input,
    });
  },
  createSessions(token: string, classId: string, sessions: TrainingSessionInput[]) {
    return apiRequest<TrainingSessionDto[]>(
      `/classes/${encodeURIComponent(classId)}/sessions/bulk`,
      { method: "POST", token, body: { sessions } },
    );
  },
  updateSession(token: string, sessionId: string, input: TrainingSessionUpdate) {
    return apiRequest<TrainingSessionDto>(`/training-sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      token,
      body: input,
    });
  },
  cancelSession(token: string, sessionId: string, reason: string) {
    return apiRequest<TrainingSessionDto>(
      `/training-sessions/${encodeURIComponent(sessionId)}/cancel`,
      { method: "POST", token, body: { reason } },
    );
  },
  listSessionParticipants(token: string, sessionId: string) {
    return apiRequest<SessionParticipantDto[]>(
      `/training-sessions/${encodeURIComponent(sessionId)}/participants`,
      { token },
    );
  },
  assignGroom(token: string, participantId: string, groomId: string | null) {
    return apiRequest<SessionParticipantResponseDto>(
      `/session-participants/${encodeURIComponent(participantId)}/groom`,
      { method: "PATCH", token, body: { groomId } },
    );
  },
  checkIn(token: string, participantId: string) {
    return apiRequest<SessionParticipantResponseDto>(
      `/session-participants/${encodeURIComponent(participantId)}/check-in`,
      { method: "POST", token },
    );
  },
  markAbsent(token: string, participantId: string, reason: string) {
    return apiRequest<SessionParticipantResponseDto>(
      `/session-participants/${encodeURIComponent(participantId)}/absent`,
      { method: "POST", token, body: { reason } },
    );
  },
  markReady(token: string, participantId: string) {
    return apiRequest<SessionParticipantResponseDto>(
      `/session-participants/${encodeURIComponent(participantId)}/ready`,
      { method: "POST", token },
    );
  },
  startParticipant(token: string, participantId: string) {
    return apiRequest<SessionParticipantResponseDto>(
      `/session-participants/${encodeURIComponent(participantId)}/start`,
      { method: "POST", token },
    );
  },
  completeParticipant(token: string, participantId: string) {
    return apiRequest<SessionParticipantResponseDto>(
      `/session-participants/${encodeURIComponent(participantId)}/complete`,
      { method: "POST", token },
    );
  },
  createEvaluation(
    token: string,
    participantId: string,
    input: { score: number; comment?: string },
  ) {
    return apiRequest<EvaluationDto>(
      `/session-participants/${encodeURIComponent(participantId)}/evaluation`,
      { method: "POST", token, body: input },
    );
  },
  updateEvaluation(
    token: string,
    participantId: string,
    input: { score?: number; comment?: string | null; reason: string },
  ) {
    return apiRequest<EvaluationDto>(
      `/session-participants/${encodeURIComponent(participantId)}/evaluation`,
      { method: "PATCH", token, body: input },
    );
  },
  getEvaluation(token: string, participantId: string) {
    return apiRequest<EvaluationDto>(
      `/session-participants/${encodeURIComponent(participantId)}/evaluation`,
      { token },
    );
  },
  createTrialResult(
    token: string,
    participantId: string,
    input: { attemptNo: number; elapsedMs: number; notes?: string; videoMediaId?: string },
  ) {
    return apiRequest<TrialResultDto>(
      `/session-participants/${encodeURIComponent(participantId)}/trial-results`,
      { method: "POST", token, body: input },
    );
  },
  listTrialResults(token: string, participantId: string) {
    return apiRequest<TrialResultDto[]>(
      `/session-participants/${encodeURIComponent(participantId)}/trial-results`,
      { token },
    );
  },
  updateTrialResult(
    token: string,
    participantId: string,
    attemptNo: number,
    input: {
      videoMediaId?: string | null;
      elapsedMs?: number;
      notes?: string | null;
      reason?: string;
    },
  ) {
    return apiRequest<TrialResultDto>(
      `/session-participants/${encodeURIComponent(participantId)}/trial-results/${attemptNo}`,
      { method: "PATCH", token, body: input },
    );
  },
  updateTrialVideo(
    token: string,
    participantId: string,
    attemptNo: number,
    videoMediaId: string | null,
  ) {
    return this.updateTrialResult(token, participantId, attemptNo, { videoMediaId });
  },
  getTimeTrial(token: string, sessionId: string) {
    return apiRequest<TimeTrialDto>(
      `/training-sessions/${encodeURIComponent(sessionId)}/time-trial`,
      { token },
    );
  },
  updateTimeTrial(
    token: string,
    sessionId: string,
    input: { distanceM?: number; targetTimeMs?: number | null; notes?: string | null },
  ) {
    return apiRequest<TimeTrialDto>(
      `/training-sessions/${encodeURIComponent(sessionId)}/time-trial`,
      { method: "PATCH", token, body: input },
    );
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

async function listVisibleHorses(token: string): Promise<{ id: string; name: string }[]> {
  const horses: { id: string; name: string }[] = [];
  let pageNumber = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ page: String(pageNumber), limit: "100" });
    const page = await apiRequest<Page<{ id: string; name: string }>>(
      `/horses?${query.toString()}`,
      { token },
    );
    horses.push(...(page.items ?? []));
    totalPages = page.meta?.totalPages ?? pageNumber;
    pageNumber += 1;
  } while (pageNumber <= totalPages);
  return horses;
}
