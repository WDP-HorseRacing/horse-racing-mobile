import React, { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { performanceService } from "@/services/performance.service";
import { ParticipantPerformanceView } from "@/features/performance";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function VetParticipantPerformance() {
  const params = useLocalSearchParams<{
    id: string;
    horse?: string;
    session?: string;
  }>();

  const participantId = first(params.id) ?? "";
  const horseName = first(params.horse);
  const sessionName = first(params.session);
  const { token } = useAuth();

  const load = useCallback(async () => {
    const [summary, metrics] = await Promise.all([
      performanceService.getParticipantSummary(token!, participantId),
      performanceService.listParticipantMetrics(token!, participantId),
    ]);
    return { summary, metrics };
  }, [participantId, token]);

  const resource = useApiResource(load, Boolean(token && participantId));

  return (
    <ParticipantPerformanceView
      role="vet"
      participantId={participantId}
      horseName={horseName}
      sessionName={sessionName}
      fallbackHref="/vet/alerts"
      isLoading={resource.isLoading}
      error={resource.error}
      isRefreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
      initialSummary={resource.data?.summary}
      initialMetrics={resource.data?.metrics}
    />
  );
}
