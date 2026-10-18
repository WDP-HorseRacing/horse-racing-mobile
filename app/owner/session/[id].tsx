import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, Linking, View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService } from "@/services/training.service";
import type { SessionParticipantDto } from "@/services/training.service";
import { horseService } from "@/services/horse.service";
import type { TrainingSessionView } from "@/adapters/training.adapter";
import { formatDistance, formatDurationMs } from "@/utils/formatters";
import { space } from "@/config/theme";

type OwnerSessionPayload = {
  session: TrainingSessionView;
  horseName: string;
  participant: SessionParticipantDto;
};

export default function OwnerSessionDetail() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { id, horseId } = useLocalSearchParams<{ id: string; horseId: string }>();
  const { token } = useAuth();
  const load = useCallback(async (): Promise<OwnerSessionPayload> => {
    const sessions = await trainingService.listHorseSessions(token!, horseId);
    const session = sessions.find((item) => item.participantId === id);
    if (!session) throw new Error("This session is no longer available for this horse.");
    const [horse, participants] = await Promise.all([
      horseService.get(token!, horseId),
      trainingService.listSessionParticipants(token!, session.sessionId),
    ]);
    const participant = participants.find((item) => item.id === id);
    if (!participant) throw new Error("This training participant is no longer available.");
    return { session, horseName: horse.name, participant };
  }, [token, horseId, id]);
  const resource = useApiResource(load, Boolean(token && horseId && id));
  const session = resource.data?.session;
  const completed = session?.status === "completed";

  return (
    <Screen
      role="owner"
      title={session?.title ?? "Training session"}
      subtitle={
        resource.data
          ? `${resource.data.horseName} · ${session?.scheduledStartLabel}`
          : "Session details"
      }
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && (!id || !horseId)}
        emptyLabel="This session link is missing its horse or participant ID."
      />
      {session ? (
        <>
          <View style={uiStyles.section}>
            <SectionTitle>Training Plan</SectionTitle>
            <Panel style={styles.grid}>
              <DetailCell label="Training class" value={session.className} />
              <DetailCell label="Plan" value={session.planName} />
              <DetailCell
                label="Distance"
                value={session.distanceM == null ? "—" : formatDistance(session.distanceM)}
              />
              <DetailCell label="Scheduled duration" value={`${session.durationMin} min`} />
              <DetailCell label="Surface" value={session.surface ?? "—"} />
              <DetailCell label="Intensity" value={session.intensity ?? "—"} />
              <DetailCell label="Location" value={session.location ?? "—"} />
              <DetailCell
                label="Assigned groom"
                value={resource.data!.participant.assignedGroomName ?? session.groomName ?? "—"}
              />
            </Panel>
          </View>

          <View style={uiStyles.section}>
            <SectionTitle>Status</SectionTitle>
            <Panel>
              <Text
                style={{ ...uiStyles.value, color: completed ? colors.primary : colors.foreground }}
              >
                {resource.data!.participant.status.replaceAll("_", " ")}
              </Text>
              {session.subjectName ? (
                <Text style={uiStyles.muted}>{session.subjectName}</Text>
              ) : null}
              {resource.data!.participant.trainingLocked ? (
                <Text style={{ ...uiStyles.muted, color: colors.destructive }}>
                  Training lock is active for this horse.
                </Text>
              ) : null}
              {resource.data!.participant.ineligibilityReason ? (
                <Text style={{ ...uiStyles.muted, color: colors.destructive }}>
                  {resource.data!.participant.ineligibilityReason}
                </Text>
              ) : null}
            </Panel>
          </View>

          {completed ? (
            <View style={uiStyles.section}>
              <SectionTitle>Trial results</SectionTitle>
              {session.trials.length ? (
                session.trials.map((trial) => (
                  <Panel key={`${session.participantId}:${trial.attemptNo}`}>
                    <View style={uiStyles.row}>
                      <Text style={uiStyles.value}>Attempt {trial.attemptNo}</Text>
                      <Text style={uiStyles.value}>{formatDurationMs(trial.elapsedMs)}</Text>
                    </View>
                    {trial.targetTimeMs == null ? null : (
                      <Text style={uiStyles.muted}>
                        Target {formatDurationMs(trial.targetTimeMs)}
                      </Text>
                    )}
                    {trial.notes ? <Text style={uiStyles.muted}>{trial.notes}</Text> : null}
                    {trial.videoUrl ? (
                      <Text style={{ ...uiStyles.label, color: colors.primary }}>
                        Video available
                      </Text>
                    ) : null}
                    {trial.videoUrl ? (
                      <SecondaryButton
                        label="Watch trial video"
                        icon="play-circle-outline"
                        onPress={() =>
                          void Linking.openURL(trial.videoUrl!).catch(() =>
                            Alert.alert(
                              "Could not open video",
                              "Refresh the session and try again.",
                            ),
                          )
                        }
                      />
                    ) : null}
                  </Panel>
                ))
              ) : (
                <Panel>
                  <Text style={uiStyles.muted}>No trial timing has been recorded.</Text>
                </Panel>
              )}
            </View>
          ) : null}

          {session.evaluation ? (
            <View style={uiStyles.section}>
              <SectionTitle>Trainer evaluation</SectionTitle>
              <Panel>
                <Text style={uiStyles.value}>Score {session.evaluation.score}</Text>
                <Text style={uiStyles.muted}>
                  {session.evaluation.evaluatorName ?? "Head Trainer"}
                </Text>
                {session.evaluation.comment ? (
                  <Text style={styles.quote}>{session.evaluation.comment}</Text>
                ) : null}
              </Panel>
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <View style={stylesForCell.cell}>
      <Text style={uiStyles.label}>{label}</Text>
      <Text style={uiStyles.value}>{value}</Text>
    </View>
  );
}

const stylesForCell = StyleSheet.create({ cell: { width: "45%", marginBottom: space.sm } });

const getStyles = (colors: any) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
    quote: {
      color: colors.foreground,
      fontSize: 15,
      fontStyle: "italic",
      marginTop: space.md,
    },
  });
