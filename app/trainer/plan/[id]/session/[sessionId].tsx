import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { KeyValue, AsyncStateView, Screen } from "@/components/common";
import { Panel } from "@/components/ui";
import { useApiResource } from "@/hooks/useApiResource";
import { trainingService } from "@/services/training.service";
import { formatDateTime } from "@/utils/formatters";

export default function TrainingSessionDetail() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const classId = Array.isArray(id) ? id[0] : id;
  const sessionKey = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const { token } = useAuth();
  const load = useCallback(async () => {
    const [session, trainingClass] = await Promise.all([
      trainingService.getSession(token!, sessionKey), trainingService.getClass(token!, classId),
    ]);
    return { session, trainingClass };
  }, [token, sessionKey, classId]);
  const resource = useApiResource(load, Boolean(token && classId && sessionKey));
  const session = resource.data?.session;

  return (
    <Screen role="trainer" title={session?.name ?? "Training session"} subtitle={resource.data?.trainingClass.name ?? "Session details"} back refreshing={resource.isRefreshing} onRefresh={() => void resource.refresh()}>
      <AsyncStateView isLoading={resource.isLoading} error={resource.error} onRetry={() => void resource.retry()} />
      {session ? <>
        <Panel>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>{session.status.replaceAll("_", " ")}</Text>
          <KeyValue items={[
            ["Class", `${resource.data!.trainingClass.code} · ${resource.data!.trainingClass.name}`],
            ["Start", formatDateTime(session.scheduledStartAt)],
            ["End", formatDateTime(session.scheduledEndAt)],
            ["Type", session.sessionType.replaceAll("_", " ")],
            ["Intensity", session.intensity ?? "—"],
            ["Planned distance", `${session.plannedDistanceM.toLocaleString()} m`],
            ["Location", session.location ?? "—"],
            ["Surface", session.surface ?? "—"],
          ]} />
        </Panel>
        {session.notes ? <Panel><Text style={{ fontWeight: "700" }}>Session notes</Text><Text>{session.notes}</Text></Panel> : null}
        {session.cancelReason ? <Panel><Text style={{ fontWeight: "700" }}>Cancellation reason</Text><Text>{session.cancelReason}</Text></Panel> : null}
      </> : null}
    </Screen>
  );
}
