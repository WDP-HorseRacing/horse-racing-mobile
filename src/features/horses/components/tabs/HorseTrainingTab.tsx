import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle } from "@/components/common";
import { Panel, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { formatDistance, formatDurationMs } from "@/utils/formatters";
import type { trainingService } from "@/services/training.service";
import type { RoleId } from "@/types/raceos";

export type HorseTrainingTabProps = {
  trainingResource: {
    isLoading: boolean;
    error: unknown;
    data: Awaited<ReturnType<typeof trainingService.listHorseSessions>> | null;
    retry: () => void | Promise<unknown>;
  };
  roleId: RoleId;
  horseLifecycleStatus: string;
};

export function HorseTrainingTab({
  trainingResource,
  roleId,
  horseLifecycleStatus,
}: HorseTrainingTabProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);

  return (
    <>
      <AsyncStateView
        isLoading={trainingResource.isLoading}
        error={trainingResource.error}
        onRetry={() => void trainingResource.retry()}
      />
      {trainingResource.data?.length ? (
        <View style={uiStyles.section}>
          <SectionTitle>Class sessions</SectionTitle>
          {trainingResource.data.map((session) => (
            <Pressable
              key={session.id}
              disabled={roleId !== "trainer"}
              onPress={() => {
                const params = new URLSearchParams({
                  horse: session.horseName,
                  session: session.title,
                  classId: session.classId,
                  sessionId: session.sessionId,
                  sessionType: session.type === "time_trial" ? "TIME_TRIAL" : "REGULAR",
                  sessionStatus: session.sessionStatus,
                  participantStatus: session.participantStatus,
                  horseLifecycle: horseLifecycleStatus,
                });
                router.push(
                  `/trainer/participant/${session.participantId}?${params.toString()}` as Href,
                );
              }}
            >
              <Panel>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={uiStyles.value} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text style={uiStyles.muted} numberOfLines={1}>
                      {session.className} · {session.planName}
                    </Text>
                  </View>
                  <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                    {session.status === "cancelled_by_lock"
                      ? t("Cancelled by training lock")
                      : session.status === "ineligible"
                        ? t("Not eligible")
                        : session.status.replaceAll("_", " ")}
                  </Text>
                </View>
                <Text style={uiStyles.muted}>
                  {session.scheduledStartLabel}
                  {session.distanceM == null ? "" : ` · ${formatDistance(session.distanceM)}`}
                  {session.surface ? ` · ${session.surface}` : ""}
                </Text>
                {session.cancelReason ? (
                  <Text style={uiStyles.muted}>{session.cancelReason}</Text>
                ) : null}
                {session.trials.length ? (
                  <Text style={uiStyles.label}>
                    Trial: {session.trials.map((trial) => trial.elapsedLabel).join(" · ")}
                  </Text>
                ) : null}
                {session.targetTimeMs != null ? (
                  <Text style={uiStyles.label}>
                    Target {formatDurationMs(session.targetTimeMs)}
                  </Text>
                ) : null}
                {session.evaluation?.comment ? (
                  <Text style={uiStyles.muted}>{session.evaluation.comment}</Text>
                ) : null}
              </Panel>
            </Pressable>
          ))}
        </View>
      ) : trainingResource.data ? (
        <AsyncStateView
          isLoading={false}
          error={null}
          onRetry={() => undefined}
          empty
          emptyLabel="This horse has no class sessions."
        />
      ) : null}
    </>
  );
}

export default HorseTrainingTab;
