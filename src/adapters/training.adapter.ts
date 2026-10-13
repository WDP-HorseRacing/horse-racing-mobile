import { formatDate, formatDateTime, formatDurationMs, formatTime } from "@/utils/formatters";

export type TrainingTrialResultDto = {
  attemptNo: number;
  elapsedMs: number;
  targetTimeMs?: number | null;
  notes: string | null;
  videoUrl: string | null;
  recordedAt: string;
};

export type HorseTrainingSessionDto = {
  participantId: string;
  sessionId: string;
  classId: string;
  className: string;
  planName: string;
  subjectName: string | null;
  name: string;
  sessionType: "REGULAR" | "TIME_TRIAL" | string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  location: string | null;
  surface: string | null;
  sessionStatus: string;
  participantStatus: string;
  groomName: string | null;
  absenceReason: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  trialResults: TrainingTrialResultDto[];
  evaluation: {
    score: number;
    comment: string | null;
    evaluatorName: string | null;
    createdAt: string;
  } | null;
  plannedDistanceM?: number | null;
  distanceM?: number | null;
  intensity?: string | null;
  targetTimeMs?: number | null;
};

export type TrainingSessionView = {
  id: string;
  participantId: string;
  sessionId: string;
  classId: string;
  className: string;
  planName: string;
  horseId: string;
  horseName: string;
  title: string;
  subjectName: string | null;
  type: "regular" | "time_trial";
  date: string;
  time: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  scheduledStartLabel: string;
  location: string | null;
  surface: string | null;
  distanceM: number | null;
  targetTimeMs: number | null;
  durationMin: number;
  intensity: string | null;
  status: "planned" | "scheduled" | "in_progress" | "completed" | "cancelled";
  groomName: string | null;
  trials: Array<TrainingTrialResultDto & { elapsedLabel: string; targetTimeLabel: string | null }>;
  evaluation: HorseTrainingSessionDto["evaluation"];
};

export function mapTrainingSessions(
  horseId: string,
  horseName: string,
  sessions: readonly HorseTrainingSessionDto[],
): TrainingSessionView[] {
  return sessions.map((session) => {
    const start = new Date(session.scheduledStartAt);
    const end = new Date(session.scheduledEndAt);
    const durationMs = Math.max(0, end.getTime() - start.getTime());
    return {
      id: session.participantId,
      participantId: session.participantId,
      sessionId: session.sessionId,
      classId: session.classId,
      className: session.className,
      planName: session.planName,
      horseId,
      horseName,
      title: session.name,
      subjectName: session.subjectName,
      type: session.sessionType === "TIME_TRIAL" ? "time_trial" : "regular",
      date: formatDate(session.scheduledStartAt),
      time: formatTime(session.scheduledStartAt),
      scheduledStartAt: session.scheduledStartAt,
      scheduledEndAt: session.scheduledEndAt,
      scheduledStartLabel: formatDateTime(session.scheduledStartAt),
      location: session.location,
      surface: session.surface,
      distanceM: session.plannedDistanceM ?? session.distanceM ?? null,
      targetTimeMs:
        session.targetTimeMs ??
        session.trialResults?.find((trial) => trial.targetTimeMs != null)?.targetTimeMs ??
        null,
      durationMin: Math.round(durationMs / 60_000),
      intensity: session.intensity ?? null,
      status: mapParticipantStatus(session.participantStatus, session.sessionStatus),
      groomName: session.groomName,
      trials: (session.trialResults ?? []).map((trial) => ({
        ...trial,
        elapsedLabel: formatDurationMs(trial.elapsedMs),
        targetTimeLabel:
          trial.targetTimeMs != null
            ? formatDurationMs(trial.targetTimeMs)
            : session.targetTimeMs != null
              ? formatDurationMs(session.targetTimeMs)
              : null,
      })),
      evaluation: session.evaluation,
    };
  });
}

function mapParticipantStatus(
  participantStatus: string,
  sessionStatus: string,
): TrainingSessionView["status"] {
  if (sessionStatus === "CANCELLED" || ["ABSENT", "SKIPPED", "INELIGIBLE", "CANCELLED", "CANCELLED_BY_LOCK"].includes(participantStatus)) {
    return "cancelled";
  }
  if (sessionStatus === "COMPLETED" || participantStatus === "COMPLETED") return "completed";
  if (participantStatus === "ONGOING") return "in_progress";
  if (sessionStatus === "DRAFT") return "planned";
  return "scheduled";
}
