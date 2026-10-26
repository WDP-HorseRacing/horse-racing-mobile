import React, { useCallback } from "react";
import { type Href, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { performanceService } from "@/services/performance.service";
import { trainingService } from "@/services/training.service";
import { ParticipantPerformanceView } from "@/features/performance";

function first(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default function TrainerParticipantPerformance() {
  const params = useLocalSearchParams<{
    id: string;
    horse?: string;
    session?: string;
    classId?: string;
    horseId?: string;
    sessionId?: string;
    sessionType?: string;
    sessionStatus?: string;
    participantStatus?: string;
    horseLifecycle?: string;
  }>();

  const participantId = first(params.id) ?? "";
  const horseName = first(params.horse);
  const sessionName = first(params.session);
  const classId = first(params.classId);
  const horseId = first(params.horseId);
  const sessionId = first(params.sessionId);
  const sessionType = first(params.sessionType);
  const sessionStatus = first(params.sessionStatus);
  const participantStatus = first(params.participantStatus);
  const horseLifecycle = first(params.horseLifecycle);

  const { token, user } = useAuth();

  const load = useCallback(async () => {
    const [summary, metrics, evaluation, trialResults, classes, horseProfile] = await Promise.all([
      performanceService.getParticipantSummary(token!, participantId),
      performanceService.listParticipantMetrics(token!, participantId),
      trainingService.getEvaluation(token!, participantId).catch(() => null),
      trainingService.listTrialResults(token!, participantId),
      trainingService.listClasses(token!),
      horseId ? horseService.get(token!, horseId) : Promise.resolve(null),
    ]);
    return {
      summary,
      metrics,
      evaluation,
      trialResults,
      horseLifecycle: horseProfile?.lifecycleStatus ?? horseLifecycle,
      isClassTrainer: classes.some((item) => item.id === classId && item.headTrainerId === user?.userId),
    };
  }, [classId, horseId, horseLifecycle, participantId, token, user?.userId]);

  const resource = useApiResource(load, Boolean(token && participantId));
  const lifecycle = resource.data?.horseLifecycle;
  const readOnlyHorse = lifecycle === "TRANSFERRED" || lifecycle === "DECEASED";
  const completedRun = participantStatus === "COMPLETED" || participantStatus === "STOPPED";

  const canWriteEvaluation = Boolean(
    resource.data?.isClassTrainer &&
      sessionStatus !== "CANCELLED" &&
      completedRun &&
      !readOnlyHorse,
  );

  const canWriteTrialResults = Boolean(
    resource.data?.isClassTrainer &&
      sessionType === "TIME_TRIAL" &&
      (sessionStatus === "IN_PROGRESS" || sessionStatus === "COMPLETED") &&
      (completedRun || participantStatus === "ONGOING") &&
      !readOnlyHorse,
  );

  const evaluationHref = (edit: boolean) => {
    const query = new URLSearchParams({
      horse: horseName ?? "",
      session: sessionName ?? "",
      ...(edit ? { edit: "1" } : {}),
    });
    return `/trainer/eval/${participantId}?${query.toString()}` as Href;
  };

  const trialHref = (trialParams: Record<string, string>) => {
    const query = new URLSearchParams({
      sessionId: sessionId ?? "",
      horse: horseName ?? "",
      ...trialParams,
    });
    return `/trainer/trial-result/${participantId}?${query.toString()}` as Href;
  };

  const noticeText = !resource.data?.isClassTrainer
    ? "Mọi Head Trainer có thể xem dữ liệu lượt tập. Chỉ Head Trainer phụ trách lớp được ghi hoặc sửa đánh giá và kết quả."
    : null;

  const readOnlyNotice = readOnlyHorse
    ? "Ngựa đã chuyển nhượng hoặc ghi nhận mất; dữ liệu buổi tập chỉ xem được."
    : null;

  return (
    <ParticipantPerformanceView
      role="trainer"
      participantId={participantId}
      horseName={horseName}
      sessionName={sessionName}
      fallbackHref="/trainer/training"
      isLoading={resource.isLoading}
      error={resource.error}
      isRefreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
      initialSummary={resource.data?.summary}
      initialMetrics={resource.data?.metrics}
      canWriteEvaluation={canWriteEvaluation}
      evaluation={resource.data?.evaluation}
      evaluationHref={evaluationHref}
      trialResults={resource.data?.trialResults ?? []}
      canWriteTrialResults={canWriteTrialResults}
      trialHref={trialHref}
      sessionType={sessionType}
      noticeText={noticeText}
      readOnlyNotice={readOnlyNotice}
    />
  );
}
