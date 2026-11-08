import { type Href, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, getUiStyles, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { mapOwnerTrialVideos, type TrainingSessionView } from "@/adapters/training.adapter";
import { trainingService } from "@/services/training.service";
import { formatDistance } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

export default function OwnerTraining() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const [tab, setTab] = useState("Schedule");
  const loadSessions = useCallback(() => trainingService.listAllVisibleSessions(token!), [token]);
  const resource = useApiResource(loadSessions, Boolean(token));
  const sessions = resource.data ?? [];
  const upcomingSessions = sessions.filter(
    (session) => session.status !== "completed" && session.status !== "cancelled",
  );
  const completedSessions = sessions
    .filter((session) => session.status === "completed")
    .slice()
    .reverse();
  const trials = useMemo(() => mapOwnerTrialVideos(sessions), [sessions]);
  const visibleSessions = tab === "Schedule" ? upcomingSessions : completedSessions;

  return (
    <Screen
      role="owner"
      title="Training"
      subtitle="Training schedule for your horses"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <Chips options={["Schedule", "History", "Trial videos"]} value={tab} onChange={setTab} />
      {tab === "Trial videos" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Trial videos</SectionTitle>
          <AsyncStateView
            isLoading={resource.isLoading}
            error={resource.error}
            onRetry={() => void resource.retry()}
            empty={Boolean(resource.data && trials.length === 0)}
            emptyLabel="No trial videos are available for your horses."
          />
          {trials.map((trial) => (
            <Pressable
              key={trial.id}
              onPress={() =>
                router.push(
                  `/owner/trial/${trial.participantId}?attemptNo=${trial.attemptNo}` as Href,
                )
              }
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: space.md,
                flexDirection: "row",
                gap: space.md,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: radius.sm,
                  backgroundColor: colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="play-circle" size={32} color={colors.primary} />
              </View>
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={uiStyles.value}>{trial.horseName}</Text>
                <Text style={uiStyles.muted}>
                  {trial.sessionTitle} · {trial.date}
                </Text>
                <Text style={uiStyles.label}>
                  Attempt {trial.attemptNo} · {trial.elapsedLabel}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={uiStyles.section}>
          <SectionTitle>
            {tab === "Schedule" ? "Upcoming / Today" : "Completed sessions"}
          </SectionTitle>
          <AsyncStateView
            isLoading={resource.isLoading}
            error={resource.error}
            onRetry={() => void resource.retry()}
            empty={Boolean(resource.data && visibleSessions.length === 0)}
            emptyLabel={
              tab === "Schedule" ? "No upcoming training sessions." : "No completed sessions."
            }
          />
          {visibleSessions.map((session) => (
            <OwnerSessionRow key={session.participantId} session={session} />
          ))}
          {tab === "History" ? (
            <View style={{ marginTop: space.lg }}>
              <PrimaryButton
                label="View Head Trainer Remarks"
                icon="document-text-outline"
                onPress={() => router.push("/owner/remarks")}
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function OwnerSessionRow({ session }: { session: TrainingSessionView }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { t } = useI18n();
  const date = new Date(session.scheduledStartAt);
  const day = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
  }).format(date);
  const monthYear = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    month: "2-digit",
    year: "2-digit",
  }).format(date);

  return (
    <Pressable
      onPress={() =>
        router.push(
          `/owner/session/${session.participantId}?horseId=${encodeURIComponent(session.horseId)}` as Href,
        )
      }
      style={styles.session}
    >
      <View style={styles.date}>
        <Text style={styles.day}>{day}</Text>
        <Text style={uiStyles.label}>{monthYear}</Text>
      </View>
      <View style={styles.flex}>
        <View style={uiStyles.row}>
          <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
            {session.horseName} · {session.title}
          </Text>
          <Text
            style={[
              styles.status,
              session.status === "completed" && styles.complete,
              { flexShrink: 0 },
            ]}
          >
            {t(
              session.status === "cancelled_by_lock"
                ? "Cancelled by training lock"
                : session.status === "ineligible"
                  ? "Not eligible"
                  : session.status,
            )}
          </Text>
        </View>
        <Text style={uiStyles.muted}>
          {session.scheduledStartLabel} · {session.className}
          {session.distanceM == null ? "" : ` · ${formatDistance(session.distanceM)}`}
          {session.surface ? ` · ${session.surface}` : ""}
        </Text>
        {session.cancelReason ? <Text style={uiStyles.muted}>{session.cancelReason}</Text> : null}
        {session.evaluation ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
            <Ionicons name="star" size={13} color={colors.monitor} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.monitor }}>
              {t("Đánh giá:")} {session.evaluation.score}/10
              {session.evaluation.comment ? ` · "${session.evaluation.comment}"` : ""}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0, gap: 4 },
    session: {
      flexDirection: "row",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    date: {
      width: 48,
      height: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    day: { color: colors.primary, fontSize: 18, fontWeight: "800" },
    status: {
      color: colors.monitor,
      backgroundColor: colors.monitorSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "capitalize",
      overflow: "hidden",
    },
    complete: {
      color: colors.primary,
      backgroundColor: colors.fitSoft,
    },
  });
