import { type Href, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { Panel, getUiStyles } from "@/components/ui";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { useApiResource } from "@/hooks/useApiResource";
import { trainingService } from "@/services/training.service";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { useTheme } from "@/hooks/useTheme";

export default function TrainingClassDetail() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const classId = Array.isArray(id) ? id[0] : id;
  const { token } = useAuth();
  const load = useCallback(async () => {
    const [trainingClass, sessions] = await Promise.all([
      trainingService.getClass(token!, classId), trainingService.listClassSessions(token!, classId),
    ]);
    return { trainingClass, sessions };
  }, [token, classId]);
  const resource = useApiResource(load, Boolean(token && classId));

  return (
    <Screen role="trainer" title={resource.data?.trainingClass.name ?? "Training class"} subtitle={resource.data?.trainingClass.code ?? "Class details"} back refreshing={resource.isRefreshing} onRefresh={() => void resource.refresh()}>
      <AsyncStateView isLoading={resource.isLoading} error={resource.error} onRetry={() => void resource.retry()} />
      {resource.data ? <>
        <Panel>
          <View style={uiStyles.row}><Text style={uiStyles.value}>{resource.data.trainingClass.status.replaceAll("_", " ")}</Text><Text style={uiStyles.label}>{resource.data.trainingClass.raceAptitude ?? "All aptitudes"}</Text></View>
          <Text style={uiStyles.muted}>{resource.data.trainingClass.description || "No class description."}</Text>
          <Text style={uiStyles.muted}>{formatDate(resource.data.trainingClass.startDate)} → {formatDate(resource.data.trainingClass.endDate)}</Text>
          <Text style={uiStyles.label}>Maximum horses: {resource.data.trainingClass.maxHorses}</Text>
        </Panel>
        <View style={uiStyles.section}>
          <SectionTitle>Sessions ({resource.data.sessions.length})</SectionTitle>
          <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty={resource.data.sessions.length === 0} emptyLabel="No sessions have been scheduled for this class." />
          {resource.data.sessions.map((session) => (
            <Pressable key={session.id} onPress={() => router.push(`/trainer/plan/${classId}/session/${session.id}` as Href)}>
              <Panel>
                <View style={uiStyles.row}><Text style={uiStyles.value}>{session.name}</Text><Text style={uiStyles.label}>{session.status.replaceAll("_", " ")}</Text></View>
                <Text style={uiStyles.muted}>{formatDateTime(session.scheduledStartAt)} · {session.sessionType.replaceAll("_", " ")}</Text>
                <Text style={uiStyles.label}>{session.plannedDistanceM.toLocaleString()} m · {session.intensity ?? "Intensity not set"}</Text>
                {session.location || session.surface ? <Text style={uiStyles.muted}>{[session.location, session.surface].filter(Boolean).join(" · ")}</Text> : null}
              </Panel>
            </Pressable>
          ))}
        </View>
      </> : null}
    </Screen>
  );
}
