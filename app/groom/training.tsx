import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import {
  trainingService,
  type SessionParticipantDto,
  type TrainingSessionDto,
} from "@/services/training.service";
import { formatDateTime } from "@/utils/formatters";
import { isParticipantWindowOpen } from "@/features/training/training-utils";
import { extractErrorMessage } from "@/utils/errorHandler";

type AssignedSession = {
  session: TrainingSessionDto;
  classCode: string;
  className: string;
  participant: SessionParticipantDto;
};

export default function GroomTraining() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token, user } = useAuth();
  const [pending, setPending] = useState("");
  const [absentId, setAbsentId] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const load = useCallback(async (): Promise<AssignedSession[]> => {
    const classes = await trainingService.listClasses(token!);
    const groups = await Promise.all(
      classes.map(async (trainingClass) => {
        const sessions = await trainingService.listClassSessions(token!, trainingClass.id);
        return Promise.all(
          sessions.map(async (session) => ({
            session,
            classCode: trainingClass.code,
            className: trainingClass.name,
            participants: await trainingService.listSessionParticipants(token!, session.id),
          })),
        );
      }),
    );
    return groups
      .flat()
      .flatMap(({ session, classCode, className, participants }) =>
        participants
          .filter((participant) => participant.assignedGroomId === user?.userId)
          .map((participant) => ({ session, classCode, className, participant })),
      )
      .filter(
        ({ session, participant }) =>
          session.status !== "CANCELLED" &&
          ![
            "COMPLETED",
            "ABSENT",
            "SKIPPED",
            "CANCELLED",
            "CANCELLED_BY_LOCK",
            "INELIGIBLE",
          ].includes(participant.status),
      )
      .sort((a, b) => a.session.scheduledStartAt.localeCompare(b.session.scheduledStartAt));
  }, [token, user?.userId]);
  const resource = useApiResource(load, Boolean(token && user?.userId));

  const perform = async (key: string, action: () => Promise<unknown>) => {
    setPending(key);
    try {
      await action();
      await resource.refresh();
    } catch (error) {
      Alert.alert("Training action failed", extractErrorMessage(error));
    } finally {
      setPending("");
    }
  };

  const submitAbsence = (participantId: string) => {
    if (!absenceReason.trim())
      return Alert.alert("Reason required", "Enter why the horse cannot attend.");
    void perform(`absent:${participantId}`, () =>
      trainingService.markAbsent(token!, participantId, absenceReason.trim()),
    );
    setAbsentId("");
    setAbsenceReason("");
  };

  return (
    <Screen
      role="groom"
      title="Training duties"
      subtitle="Sessions assigned to you"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      <Text style={ui.muted}>
        Only horses assigned to your Groom account are shown. The Backend controls the allowed
        check-in and ready windows.
      </Text>
      {resource.data ? (
        <View style={ui.section}>
          <SectionTitle>Assigned training sessions</SectionTitle>
          {resource.data.length ? (
            resource.data.map(({ session, classCode, className, participant }) => {
              const checkInOpen = isParticipantWindowOpen(
                session.scheduledStartAt,
                session.scheduledEndAt,
                "check-in",
              );
              const readyOpen = isParticipantWindowOpen(
                session.scheduledStartAt,
                session.scheduledEndAt,
                "ready",
              );
              return (
                <Panel key={participant.id} style={{ gap: 8 }}>
                  <View style={ui.row}>
                    <Text style={[ui.value, { flex: 1 }]}>{participant.horseName}</Text>
                    <Text style={ui.label}>{participant.status.replaceAll("_", " ")}</Text>
                  </View>
                  <Text style={ui.muted}>
                    {session.name} · {classCode} {className}
                  </Text>
                  <Text style={ui.label}>
                    {formatDateTime(session.scheduledStartAt)} →{" "}
                    {formatDateTime(session.scheduledEndAt)}
                  </Text>
                  {participant.ineligibilityReason || participant.cancelReason ? (
                    <Text style={{ ...ui.muted, color: colors.destructive }}>
                      {participant.ineligibilityReason ?? participant.cancelReason}
                    </Text>
                  ) : null}
                  {participant.trainingLocked ? (
                    <Text style={{ ...ui.label, color: colors.destructive }}>
                      A training lock is active.
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {participant.status === "PLANNED" ? (
                      <PrimaryButton
                        label="Check in"
                        icon="checkmark-circle-outline"
                        style={{ flex: 1 }}
                        disabled={!checkInOpen || pending !== ""}
                        onPress={() =>
                          void perform(`checkin:${participant.id}`, () =>
                            trainingService.checkIn(token!, participant.id),
                          )
                        }
                      />
                    ) : null}
                    {participant.status === "PRESENT" ? (
                      <PrimaryButton
                        label="Mark ready"
                        icon="walk-outline"
                        style={{ flex: 1 }}
                        disabled={!readyOpen || pending !== ""}
                        onPress={() =>
                          void perform(`ready:${participant.id}`, () =>
                            trainingService.markReady(token!, participant.id),
                          )
                        }
                      />
                    ) : null}
                    {["PLANNED", "PRESENT", "READY"].includes(participant.status) ? (
                      <SecondaryButton
                        label="Report absent"
                        icon="person-remove-outline"
                        style={{ flex: 1 }}
                        onPress={() => {
                          setAbsentId(absentId === participant.id ? "" : participant.id);
                          setAbsenceReason("");
                        }}
                      />
                    ) : null}
                  </View>
                  {participant.status === "PLANNED" && !checkInOpen ? (
                    <Text style={ui.label}>Check-in opens 30 minutes before the session.</Text>
                  ) : null}
                  {participant.status === "PRESENT" && !readyOpen ? (
                    <Text style={ui.label}>Ready opens 15 minutes before the session.</Text>
                  ) : null}
                  {absentId === participant.id ? (
                    <View style={{ gap: 8 }}>
                      <Field label="Absence reason">
                        <NativeInput
                          value={absenceReason}
                          onChangeText={setAbsenceReason}
                          multiline
                          placeholder="Required by the Backend"
                        />
                      </Field>
                      <PrimaryButton
                        label={
                          pending === `absent:${participant.id}` ? "Saving…" : "Confirm absence"
                        }
                        disabled={pending !== ""}
                        onPress={() => submitAbsence(participant.id)}
                      />
                    </View>
                  ) : null}
                </Panel>
              );
            })
          ) : (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void resource.refresh()}
              empty
              emptyLabel="No training sessions are assigned to you right now."
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
