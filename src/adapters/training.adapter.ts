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
  status:
    | "planned"
    | "scheduled"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "cancelled_by_lock"
    | "ineligible";
  sessionStatus: string;
  participantStatus: string;
  cancelReason: string | null;
  groomName: string | null;
  trials: (TrainingTrialResultDto & { elapsedLabel: string; targetTimeLabel: string | null })[];
  evaluation: HorseTrainingSessionDto["evaluation"];
};

export type OwnerTrainingRemarkView = {
  id: string;
  sessionId: string;
  horseId: string;
  horseName: string;
  date: string;
  sessionTitle: string;
  trainerName: string;
  score: number;
  observation: string;
};

export type OwnerTrialVideoView = {
  id: string;
  participantId: string;
  attemptNo: number;
  horseId: string;
  horseName: string;
  sessionTitle: string;
  date: string;
  elapsedMs: number;
  elapsedLabel: string;
  videoUrl: string;
  notes: string | null;
};

export function mapOwnerTrainingRemarks(
  sessions: readonly TrainingSessionView[],
): OwnerTrainingRemarkView[] {
  return sessions
    .filter((session) => Boolean(session.evaluation))
    .map((session) => ({
      id: session.participantId,
      sessionId: session.sessionId,
      horseId: session.horseId,
      horseName: session.horseName,
      date: session.scheduledStartAt,
      sessionTitle: session.title,
      trainerName: session.evaluation?.evaluatorName ?? "Head Trainer",
      score: session.evaluation?.score ?? 0,
      observation:
        session.evaluation?.comment?.trim() ||
        (session.evaluation?.score != null
          ? `Điểm đánh giá: ${session.evaluation.score}/10`
          : "Đã hoàn thành đánh giá"),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function mapOwnerTrialVideos(
  sessions: readonly TrainingSessionView[],
): OwnerTrialVideoView[] {
  return sessions
    .flatMap((session) =>
      session.trials
        .filter((trial) => Boolean(trial.videoUrl))
        .map((trial) => ({
          id: `${session.participantId}:${trial.attemptNo}`,
          participantId: session.participantId,
          attemptNo: trial.attemptNo,
          horseId: session.horseId,
          horseName: session.horseName,
          sessionTitle: session.title,
          date: trial.recordedAt,
          elapsedMs: trial.elapsedMs,
          elapsedLabel: trial.elapsedLabel,
          videoUrl: trial.videoUrl!,
          notes: trial.notes,
        })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

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
      sessionStatus: session.sessionStatus,
      participantStatus: session.participantStatus,
      cancelReason: session.cancelReason,
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
  if (participantStatus === "CANCELLED_BY_LOCK") return "cancelled_by_lock";
  if (participantStatus === "INELIGIBLE" && sessionStatus !== "CANCELLED") return "ineligible";
  if (
    sessionStatus === "CANCELLED" ||
    ["ABSENT", "SKIPPED", "CANCELLED"].includes(participantStatus)
  ) {
    return "cancelled";
  }
  if (
    sessionStatus === "COMPLETED" ||
    participantStatus === "COMPLETED" ||
    participantStatus === "STOPPED"
  )
    return "completed";
  if (participantStatus === "ONGOING") return "in_progress";
  return "scheduled";
}
