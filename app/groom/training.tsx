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
import { formatTrainingStatus, isParticipantWindowOpen } from "@/features/training/training-utils";
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
    const now = Date.now();
    const groups = await Promise.all(
      classes.map(async (trainingClass) => {
        const sessions = await trainingService.listClassSessions(token!, trainingClass.id);
        return Promise.all(
          sessions
            .filter((session) => {
              const endAt = new Date(session.scheduledEndAt).getTime();
              return session.status !== "CANCELLED" && Number.isFinite(endAt) && endAt >= now;
            })
            .map(async (session) => ({
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
          !["COMPLETED", "SKIPPED", "CANCELLED", "CANCELLED_BY_LOCK", "INELIGIBLE"].includes(
            participant.status,
          ),
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
      Alert.alert("Thao tác thất bại", extractErrorMessage(error));
    } finally {
      setPending("");
    }
  };

  const submitAbsence = (participantId: string) => {
    if (!absenceReason.trim())
      return Alert.alert("Cần có lý do", "Vui lòng nhập lý do ngựa không thể tham gia.");
    void perform(`absent:${participantId}`, () =>
      trainingService.markAbsent(token!, participantId, absenceReason.trim()),
    );
    setAbsentId("");
    setAbsenceReason("");
  };

  return (
    <Screen
      role="groom"
      title="Nhiệm vụ huấn luyện"
      subtitle="Các buổi tập được phân công"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        <View style={ui.section}>
          <SectionTitle>Lịch tập được giao</SectionTitle>
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
                    <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {participant.horseName}
                    </Text>
                    <Text
                      style={[
                        ui.label,
                        {
                          flexShrink: 0,
                          color:
                            participant.status === "PRESENT" || participant.status === "READY"
                              ? colors.primary
                              : colors.foreground,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {formatTrainingStatus(participant.status)}
                    </Text>
                  </View>
                  <Text style={ui.muted} numberOfLines={1}>
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
                      Đang có khóa huấn luyện cho ngựa này.
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {participant.status === "PLANNED" || participant.status === "ABSENT" ? (
                      <PrimaryButton
                        label={participant.status === "ABSENT" ? "Điểm danh lại" : "Điểm danh"}
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
                        label="Báo sẵn sàng"
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
                        label="Báo vắng"
                        icon="person-remove-outline"
                        style={{ flex: 1 }}
                        onPress={() => {
                          setAbsentId(absentId === participant.id ? "" : participant.id);
                          setAbsenceReason("");
                        }}
                      />
                    ) : null}
                  </View>
                  {(participant.status === "PLANNED" || participant.status === "ABSENT") &&
                  !checkInOpen ? (
                    <Text style={ui.label}>Mở điểm danh 30 phút trước buổi tập.</Text>
                  ) : null}
                  {participant.status === "PRESENT" && !readyOpen ? (
                    <Text style={ui.label}>Mở báo sẵn sàng 15 phút trước buổi tập.</Text>
                  ) : null}
                  {absentId === participant.id ? (
                    <View style={{ gap: 8 }}>
                      <Field label="Lý do vắng mặt">
                        <NativeInput
                          value={absenceReason}
                          onChangeText={setAbsenceReason}
                          multiline
                          placeholder="Nhập lý do ngựa không thể tham gia"
                        />
                      </Field>
                      <PrimaryButton
                        label={
                          pending === `absent:${participant.id}` ? "Đang lưu…" : "Xác nhận vắng mặt"
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
              emptyLabel="Hiện tại bạn chưa được phân công buổi tập nào."
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}
