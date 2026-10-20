import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService } from "@/services/training.service";
import { formatDateTime, formatDistance } from "@/utils/formatters";
import { space } from "@/config/theme";

export default function OwnerTrialDetail() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);
  const { id, attemptNo } = useLocalSearchParams<{ id: string; attemptNo?: string | string[] }>();
  const { token } = useAuth();
  const loadTraining = useCallback(() => trainingService.listAllVisibleSessions(token!), [token]);
  const resource = useApiResource(loadTraining, Boolean(token));
  const session = useMemo(
    () => resource.data?.find((item) => item.participantId === id),
    [id, resource.data],
  );
  const attemptValue = Array.isArray(attemptNo) ? attemptNo[0] : attemptNo;
  const trial =
    session?.trials.find((item) => item.attemptNo === Number(attemptValue)) ??
    session?.trials.find((item) => Boolean(item.videoUrl));
  const player = useVideoPlayer(trial?.videoUrl || "", (videoPlayer) => {
    videoPlayer.loop = false;
  });

  return (
    <Screen
      role="owner"
      title="Trial video"
      subtitle={
        session
          ? `${session.horseName} · ${formatDateTime(trial?.recordedAt ?? session.scheduledStartAt)}`
          : undefined
      }
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data && (!session || !trial) ? (
        <Panel>
          <Text style={uiStyles.muted}>This trial or its video could not be found.</Text>
        </Panel>
      ) : null}
      {session && trial ? (
        <>
          {trial.videoUrl ? (
            <View style={styles.videoContainer}>
              <VideoView style={styles.video} player={player} nativeControls />
            </View>
          ) : (
            <Panel>
              <Text style={uiStyles.muted}>No video is attached to this trial attempt.</Text>
            </Panel>
          )}
          <View style={uiStyles.section}>
            <SectionTitle>Trial summary</SectionTitle>
            <Panel style={{ gap: space.md }}>
              <View style={uiStyles.row}>
                <Text style={[uiStyles.muted, { flexShrink: 0 }]}>Horse</Text>
                <Text
                  style={[uiStyles.value, { flex: 1, minWidth: 0, textAlign: "right" }]}
                  numberOfLines={1}
                >
                  {session.horseName}
                </Text>
              </View>
              <View style={uiStyles.row}>
                <Text style={[uiStyles.muted, { flexShrink: 0 }]}>Session</Text>
                <Text
                  style={[uiStyles.value, { flex: 1, minWidth: 0, textAlign: "right" }]}
                  numberOfLines={1}
                >
                  {session.title}
                </Text>
              </View>
              <View style={uiStyles.row}>
                <Text style={[uiStyles.muted, { flexShrink: 0 }]}>Attempt</Text>
                <Text style={[uiStyles.value, { flexShrink: 0 }]}>{trial.attemptNo}</Text>
              </View>
              <View style={uiStyles.row}>
                <Text style={[uiStyles.muted, { flexShrink: 0 }]}>Recorded</Text>
                <Text
                  style={[uiStyles.value, { flex: 1, minWidth: 0, textAlign: "right" }]}
                  numberOfLines={1}
                >
                  {formatDateTime(trial.recordedAt)}
                </Text>
              </View>
              {session.distanceM !== null ? (
                <View style={uiStyles.row}>
                  <Text style={[uiStyles.muted, { flexShrink: 0 }]}>Distance</Text>
                  <Text style={[uiStyles.value, { flexShrink: 0 }]}>
                    {formatDistance(session.distanceM)}
                  </Text>
                </View>
              ) : null}
              {session.surface ? (
                <View style={uiStyles.row}>
                  <Text style={[uiStyles.muted, { flexShrink: 0 }]}>Surface</Text>
                  <Text
                    style={[uiStyles.value, { flex: 1, minWidth: 0, textAlign: "right" }]}
                    numberOfLines={1}
                  >
                    {session.surface}
                  </Text>
                </View>
              ) : null}
              <View style={uiStyles.row}>
                <Text style={[uiStyles.muted, { flexShrink: 0 }]}>Elapsed time</Text>
                <Text
                  style={[
                    uiStyles.value,
                    { color: colors.primary, flex: 1, minWidth: 0, textAlign: "right" },
                  ]}
                  numberOfLines={1}
                >
                  {trial.elapsedLabel}
                </Text>
              </View>
              {trial.notes ? <Text style={uiStyles.muted}>{trial.notes}</Text> : null}
            </Panel>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    videoContainer: {
      width: "100%",
      height: (Dimensions.get("window").width - space.xl * 2) * 0.56,
      maxHeight: 360,
      backgroundColor: colors.elevated,
      borderRadius: 14,
      overflow: "hidden",
    },
    video: { width: "100%", height: "100%" },
  });
