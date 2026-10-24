import { apiRequest } from "@/services/api-client";
import type { Page } from "@/services/training.service";

export type PerformanceMetricPointDto = {
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
  alertLevel: "NORMAL" | "WARNING" | "CRITICAL";
};

export type HorsePerformanceDto = {
  horseId: string;
  sessionsTracked: number;
  latestMetric: PerformanceMetricPointDto | null;
  recentMetrics: PerformanceMetricPointDto[];
  latestEvaluation: { createdAt: string; score: number; comment: string | null } | null;
};

export type SessionPerformanceSummaryDto = {
  sessionId: string;
  scheduledAt: string;
  avgHeartRateBpm: number;
  maxHeartRateBpm: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  alertCount: number;
};

export type ParticipantPerformanceSummaryDto = {
  sessionParticipantId: string;
  count: number;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  warningCount: number;
  criticalCount: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
};

export type ThresholdLimitsDto = {
  heartRateWarningBpm: number;
  heartRateCriticalBpm: number;
  maxSpeedMps: number;
};

export type HorseThresholdsDto = {
  horseId: string;
  limits: ThresholdLimitsDto;
};

export type HorseAlertDto = {
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
  alertLevel: "WARNING" | "CRITICAL";
  sessionParticipantId: string;
  sessionId: string;
  sessionName: string | null;
};
export type HorseAlertPageDto = Page<HorseAlertDto>;

export type HorseWorkloadDto = {
  horseId: string;
  from: string;
  to: string;
  sessionsCompleted: number;
  byIntensity: { LIGHT: number; HEAVY: number };
  plannedDistanceM: number;
  actualDurationSeconds: number;
  actualDistanceM: number;
};

export const performanceService = {
  getHorseSummary(token: string, horseId: string) {
    return apiRequest<HorsePerformanceDto>(`/horses/${encodeURIComponent(horseId)}/performance`, {
      token,
    });
  },
  listHorseSessions(token: string, horseId: string) {
    return apiRequest<SessionPerformanceSummaryDto[]>(
      `/horses/${encodeURIComponent(horseId)}/performance/sessions`,
      { token },
    );
  },
  getParticipantSummary(token: string, participantId: string) {
    return apiRequest<ParticipantPerformanceSummaryDto>(
      `/session-participants/${encodeURIComponent(participantId)}/performance-summary`,
      { token },
    );
  },
  listParticipantMetrics(token: string, participantId: string) {
    return apiRequest<PerformanceMetricPointDto[]>(
      `/session-participants/${encodeURIComponent(participantId)}/metrics`,
      { token },
    );
  },
  getThresholds(token: string, horseId: string) {
    return apiRequest<HorseThresholdsDto>(`/horses/${encodeURIComponent(horseId)}/thresholds`, {
      token,
    });
  },
  setThresholds(
    token: string,
    horseId: string,
    input: {
      profileName: string;
      effectiveFrom: string;
      effectiveTo?: string;
      limits: { heartRateWarningBpm: number; heartRateCriticalBpm: number; maxSpeedMps: number };
    },
  ) {
    return apiRequest<{
      profileName: string;
      effectiveFrom: string;
      effectiveTo?: string;
      limits: ThresholdLimitsDto;
    }>(`/horses/${encodeURIComponent(horseId)}/thresholds`, { method: "PUT", token, body: input });
  },
  listHorseAlerts(
    token: string,
    horseId: string,
    query: {
      level?: "WARNING" | "CRITICAL";
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    return apiRequest<HorseAlertPageDto>(
      `/horses/${encodeURIComponent(horseId)}/alerts${params.size ? `?${params.toString()}` : ""}`,
      { token },
    );
  },
  getHorseWorkload(token: string, horseId: string, query: { from?: string; to?: string } = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, value);
    return apiRequest<HorseWorkloadDto>(
      `/horses/${encodeURIComponent(horseId)}/workload${params.size ? `?${params.toString()}` : ""}`,
      { token },
    );
  },
};
