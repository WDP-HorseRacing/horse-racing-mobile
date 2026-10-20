import { router, type Href } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
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

export default function OwnerRemarks() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const loadTraining = useCallback(() => trainingService.listAllVisibleSessions(token!), [token]);
  const resource = useApiResource(loadTraining, Boolean(token));
  const remarks = useMemo(() => mapOwnerTrainingRemarks(resource.data ?? []), [resource.data]);

  return (
    <Screen
      role="owner"
      title="Trainer remarks"
      subtitle="Evaluations attached to your horses’ training sessions"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <View style={uiStyles.section}>
        <SectionTitle>Recent observations</SectionTitle>
        <AsyncStateView
          isLoading={resource.isLoading}
          error={resource.error}
          onRetry={() => void resource.retry()}
          empty={Boolean(resource.data && remarks.length === 0)}
          emptyLabel="There are no trainer evaluations for your horses yet."
        />
        {remarks.map((remark) => (
          <Pressable
            key={remark.id}
            onPress={() => router.push(`/owner/remark/${remark.id}` as Href)}
          >
            <Panel style={{ gap: space.md }}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={uiStyles.value} numberOfLines={1}>
                    {remark.horseName}
                  </Text>
                  <Text style={uiStyles.muted} numberOfLines={1}>
                    {remark.sessionTitle} · {formatDateTime(remark.date)}
                  </Text>
                </View>
                <Text style={{ ...uiStyles.value, color: colors.primary, flexShrink: 0 }}>
                  Score {remark.score}
                </Text>
              </View>
              <Text style={uiStyles.muted}>From {remark.trainerName}</Text>
              <Text style={uiStyles.value} numberOfLines={3}>
                {remark.observation}
              </Text>
              <Text style={{ ...uiStyles.label, color: colors.primary, textAlign: "right" }}>
                View details →
              </Text>
            </Panel>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
