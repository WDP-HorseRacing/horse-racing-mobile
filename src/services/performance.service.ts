import { apiRequest } from "@/services/api-client";

export type PerformanceMetricPointDto = {
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
  alertLevel: string;
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
};
