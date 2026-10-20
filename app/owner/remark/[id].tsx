import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService } from "@/services/training.service";
import { mapOwnerTrainingRemarks } from "@/adapters/training.adapter";
import { formatDateTime } from "@/utils/formatters";
import { space } from "@/config/theme";

export default function OwnerRemarkDetail() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const loadTraining = useCallback(() => trainingService.listAllVisibleSessions(token!), [token]);
  const resource = useApiResource(loadTraining, Boolean(token));
  const remark = useMemo(
    () => mapOwnerTrainingRemarks(resource.data ?? []).find((item) => item.id === id),
    [id, resource.data],
  );

  return (
    <Screen
      role="owner"
      title="Trainer remark"
      subtitle={remark ? `${remark.horseName} · ${formatDateTime(remark.date)}` : undefined}
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data && !remark ? (
        <Panel>
          <Text style={uiStyles.muted}>This training evaluation could not be found.</Text>
        </Panel>
      ) : null}
      {remark ? (
        <>
          <View style={uiStyles.section}>
            <SectionTitle>Session context</SectionTitle>
            <Panel style={{ gap: space.md }}>
              <View>
                <Text style={uiStyles.label}>Horse</Text>
                <Text style={uiStyles.value}>{remark.horseName}</Text>
              </View>
              <View>
                <Text style={uiStyles.label}>Training session</Text>
                <Text style={uiStyles.value}>{remark.sessionTitle}</Text>
              </View>
              <View>
                <Text style={uiStyles.label}>Date</Text>
                <Text style={uiStyles.value}>{formatDateTime(remark.date)}</Text>
              </View>
              <View>
                <Text style={uiStyles.label}>Evaluator</Text>
                <Text style={uiStyles.value}>{remark.trainerName}</Text>
              </View>
              <View>
                <Text style={uiStyles.label}>Score</Text>
                <Text style={{ ...uiStyles.value, color: colors.primary }}>{remark.score}</Text>
              </View>
            </Panel>
          </View>
          <View style={uiStyles.section}>
            <SectionTitle>Professional observation</SectionTitle>
            <Panel>
              <Text style={{ ...uiStyles.value, lineHeight: 24 }}>{remark.observation}</Text>
            </Panel>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
