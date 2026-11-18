import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, KeyValue, Screen, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
  DangerButton,
  DatePickerField,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import {
  trainingService,
  type EvaluationDto,
  type SessionParticipantDto,
  type TrainingSessionUpdate,
  type TrialResultDto,
} from "@/services/training.service";
import {
  performanceService,
  type ParticipantPerformanceSummaryDto,
} from "@/services/performance.service";
import { stableService } from "@/services/stable.service";
import {
  subscribeToPerformanceMetrics,
  type PerformanceMetricPoint,
} from "@/services/realtime.service";
import { Ionicons } from "@expo/vector-icons";
import { radius, space } from "@/config/theme";
import { formatDateTime, formatDurationMs } from "@/utils/formatters";
import {
  clubDateTimeParts,
  clubDateTimeToIso,
  formatTrainingStatus,
  isParticipantWindowOpen,
  MAX_TRIAL_TIME_MS,
  parseTrialDurationMs,
} from "@/features/training/training-utils";
import {
  startSimulation,
  stopSimulation,
  isSimulating,
  sendHeartRateSpike,
} from "@/features/training/sensor-simulator";
import { extractErrorMessage } from "@/utils/errorHandler";

type ParticipantRow = {
  participant: SessionParticipantDto;
  evaluation: EvaluationDto | null;
  results: TrialResultDto[];
  summary: ParticipantPerformanceSummaryDto | null;
};

export function TrainingSessionDetailScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const classId = Array.isArray(id) ? id[0] : id;
  const sessionKey = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const { token, role: userRole } = useAuth();
  const isTrainer = !userRole || userRole === "trainer";
  const [pending, setPending] = useState("");
  const [absentId, setAbsentId] = useState("");
  const [absentReason, setAbsentReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [groomPickerId, setGroomPickerId] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState("60");
  const [editLocation, setEditLocation] = useState("");
  const [editSurface, setEditSurface] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showTrialEdit, setShowTrialEdit] = useState(false);
  const [trialDistance, setTrialDistance] = useState("");
  const [trialTarget, setTrialTarget] = useState("");
  const [trialNotes, setTrialNotes] = useState("");
  const [liveMetrics, setLiveMetrics] = useState<Record<string, PerformanceMetricPoint>>({});
  const [simulatingIds, setSimulatingIds] = useState<Record<string, boolean>>({});
  const [stopParticipantId, setStopParticipantId] = useState("");
  const [stopReason, setStopReason] = useState("");
  const [showStopModal, setShowStopModal] = useState(false);
  const [trialCompletionParticipantId, setTrialCompletionParticipantId] = useState("");
  const [trialTimeInput, setTrialTimeInput] = useState("");
  const [trialTimeNotes, setTrialTimeNotes] = useState("");
  const [showTrialCompleteModal, setShowTrialCompleteModal] = useState(false);
  const hasFocusedRef = useRef(false);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setClockNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, []);

  const load = useCallback(async () => {
    const session = await trainingService.getSession(token!, sessionKey);
    const effectiveClassId = session.classId || classId;
    const [trainingClass, participants, grooms] = await Promise.all([
      trainingService.getClass(token!, effectiveClassId),
      trainingService.listSessionParticipants(token!, sessionKey),
      stableService.listGroomWorkload(token!).catch(() => []),
    ]);
    const rows = await Promise.all(
      participants.map(async (participant): Promise<ParticipantRow> => {
        const [evaluationResult, trialResult, summaryResult] = await Promise.allSettled([
          trainingService.getEvaluation(token!, participant.id),
          session.sessionType === "TIME_TRIAL"
            ? trainingService.listTrialResults(token!, participant.id)
            : Promise.resolve([]),
          performanceService.getParticipantSummary(token!, participant.id),
        ]);
        return {
          participant,
          evaluation: evaluationResult.status === "fulfilled" ? evaluationResult.value : null,
          results: trialResult.status === "fulfilled" ? trialResult.value : [],
          summary: summaryResult.status === "fulfilled" ? summaryResult.value : null,
        };
      }),
    );
    let timeTrial = null;
    if (session.sessionType === "TIME_TRIAL") {
      try {
        timeTrial = await trainingService.getTimeTrial(token!, sessionKey);
      } catch {
        /* The trial setup is also returned in the class plan and result responses. */
      }
    }
    return { session, trainingClass, rows, grooms, timeTrial };
  }, [token, sessionKey, classId]);
  const resource = useApiResource(load, Boolean(token && classId && sessionKey));
  const payload = resource.data;
  const session = payload?.session;
  const refreshResource = resource.revalidate;

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedRef.current) void refreshResource();
      else hasFocusedRef.current = true;
    }, [refreshResource]),
  );

  const initializeSessionEdit = () => {
    if (!payload) return;
    const parts = clubDateTimeParts(payload.session.scheduledStartAt);
    if (parts) {
      setEditDate(parts.date);
      setEditTime(parts.time);
    }
    setEditDuration(
      String(
        Math.max(
          1,
          Math.round(
            (new Date(payload.session.scheduledEndAt).getTime() -
              new Date(payload.session.scheduledStartAt).getTime()) /
              60_000,
          ),
        ),
      ),
    );
    setEditLocation(payload.session.location ?? "");
    setEditSurface(payload.session.surface ?? "");
    setEditNotes(payload.session.notes ?? "");
  };

  const initializeTrialEdit = () => {
    if (!payload?.timeTrial) return;
    setTrialDistance(String(payload.timeTrial.distanceM));
    setTrialTarget(
      payload.timeTrial.targetTimeMs == null ? "" : String(payload.timeTrial.targetTimeMs),
    );
    setTrialNotes(payload.timeTrial.notes ?? "");
  };

  useEffect(() => {
    if (session?.status !== "IN_PROGRESS") return;
    const interval = setInterval(() => void refreshResource(), 10_000);
    return () => clearInterval(interval);
  }, [refreshResource, session?.status]);

  useEffect(() => {
    if (!token || session?.status !== "IN_PROGRESS") return;
    return subscribeToPerformanceMetrics(token, (event) => {
      if (event.sessionId !== session.id) return;
      const latestPoint = event.points.at(-1);
      if (!latestPoint) return;
      setLiveMetrics((current) => ({
        ...current,
        [event.sessionParticipantId]: latestPoint,
      }));
    });
  }, [token, session?.id, session?.status]);

  useEffect(() => {
    if (!payload) return;
    for (const row of payload.rows) {
      if (row.participant.status !== "ONGOING") stopSimulation(row.participant.id);
    }
    if (
      session?.status !== "IN_PROGRESS" ||
      new Date(session.scheduledEndAt).getTime() <= clockNow
    ) {
      stopSimulation();
    }
  }, [payload, session?.status, session?.scheduledEndAt, clockNow]);

  const perform = async (key: string, action: () => Promise<unknown>) => {
    if (!token) return;
    setPending(key);
    try {
      await action();
      await resource.refresh();
      return true;
    } catch (error) {
      Alert.alert("Action failed", extractErrorMessage(error));
      return false;
    } finally {
      setPending("");
    }
  };

  const reportAbsent = async (participantId: string) => {
    if (!absentReason.trim())
      return Alert.alert("Reason required", "Enter a reason for the absence.");
    if (
      await perform(`absent:${participantId}`, () =>
        trainingService.markAbsent(token!, participantId, absentReason.trim()),
      )
    ) {
      setAbsentId("");
      setAbsentReason("");
    }
  };

  const stopParticipantSimulation = (participantId: string) => {
    stopSimulation(participantId);
    setSimulatingIds((current) =>
      current[participantId] ? { ...current, [participantId]: false } : current,
    );
  };

  const stopAllParticipantSimulations = () => {
    stopSimulation();
    setSimulatingIds({});
  };

  const toggleSimulation = (participantId: string) => {
    if (isSimulating(participantId)) {
      stopParticipantSimulation(participantId);
    } else {
      startSimulation(participantId, token, {
        onTick: (point) => {
          setLiveMetrics((current) => ({
            ...current,
            [participantId]: {
              recordedAt: point.recordedAt,
              heartRateBpm: point.heartRateBpm,
              speedMps: point.speedMps,
              alertLevel:
                point.heartRateBpm >= 240
                  ? "CRITICAL"
                  : point.heartRateBpm >= 220
                    ? "WARNING"
                    : "NORMAL",
            },
          }));
        },
        onError: (err) => {
          stopParticipantSimulation(participantId);
          Alert.alert("Lỗi phát giả lập", extractErrorMessage(err));
        },
      });
      setSimulatingIds((prev) => ({ ...prev, [participantId]: true }));
    }
  };

  const handleHeartRateSpike = async (participantId: string) => {
    try {
      await sendHeartRateSpike(participantId, token);
      setLiveMetrics((current) => ({
        ...current,
        [participantId]: {
          recordedAt: new Date().toISOString(),
          heartRateBpm: 248,
          speedMps: 16.8,
          alertLevel: "CRITICAL",
        },
      }));
      Alert.alert(
        "Đã tạo vọt nhịp tim!",
        "Đã gửi điểm đo 248 bpm lên hệ thống. Backend đã kích hoạt cảnh báo khẩn cấp tới Bác sĩ và Huấn luyện viên.",
      );
    } catch (err) {
      Alert.alert("Không thể gửi dữ liệu", extractErrorMessage(err));
    }
  };

  const submitStopParticipant = async () => {
    if (!stopReason.trim()) {
      Alert.alert("Lý do bắt buộc", "Vui lòng nhập lý do dừng sớm lượt tập (tối đa 500 ký tự).");
      return;
    }
    stopParticipantSimulation(stopParticipantId);
    if (
      await perform(`stop:${stopParticipantId}`, () =>
        trainingService.stopParticipant(token!, stopParticipantId, stopReason.trim()),
      )
    ) {
      setShowStopModal(false);
      setStopParticipantId("");
      setStopReason("");
    }
  };

  const submitTrialComplete = async (withTime: boolean) => {
    const pId = trialCompletionParticipantId;
    if (withTime) {
      const parsedMs = parseTrialDurationMs(trialTimeInput);
      if (!parsedMs) {
        Alert.alert("Thời gian không hợp lệ", "Vui lòng nhập định dạng mm:ss.s (ví dụ 01:14.5).");
        return;
      }
    }
    stopParticipantSimulation(pId);
    setShowTrialCompleteModal(false);
    await perform(`complete:${pId}`, async () => {
      await trainingService.completeParticipant(token!, pId);
      if (withTime) {
        const parsedMs = parseTrialDurationMs(trialTimeInput)!;
        const row = payload?.rows.find((r) => r.participant.id === pId);
        const attemptNo = (row?.results.length ?? 0) + 1;
        await trainingService.createTrialResult(token!, pId, {
          attemptNo,
          elapsedMs: parsedMs,
          notes: trialTimeNotes.trim() || undefined,
        });
      }
    });
    setTrialTimeInput("");
    setTrialTimeNotes("");
    setTrialCompletionParticipantId("");
  };

  const cancelSession = async () => {
    if (!cancelReason.trim())
      return Alert.alert("Reason required", "Enter a reason before cancelling the session.");
    stopAllParticipantSimulations();
    if (
      await perform("cancel", () =>
        trainingService.cancelSession(token!, sessionKey, cancelReason.trim()),
      )
    )
      setShowCancel(false);
  };

  const saveSessionEdit = async () => {
    const startAt = clubDateTimeToIso(editDate, editTime);
    const durationMinutes = Number(editDuration);
    if (!startAt || !Number.isFinite(durationMinutes) || durationMinutes <= 0)
      return Alert.alert(
        "Check session time",
        "Enter a valid club date, time and positive duration.",
      );
    const endAt = new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString();
    const input: TrainingSessionUpdate = {
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      location: editLocation.trim() || null,
      surface: editSurface.trim() || null,
      notes: editNotes.trim() || null,
    };
    if (
      await perform("edit-session", () => trainingService.updateSession(token!, sessionKey, input))
    )
      setShowEdit(false);
  };

  const saveTrialConfig = async () => {
    const distanceM = Number(trialDistance);
    const targetTimeMs = trialTarget.trim() ? Number(trialTarget) : null;
    if (
      !Number.isFinite(distanceM) ||
      distanceM <= 0 ||
      (targetTimeMs !== null &&
        (!Number.isInteger(targetTimeMs) || targetTimeMs < 1 || targetTimeMs > MAX_TRIAL_TIME_MS))
    )
      return Alert.alert(
        "Check time trial setup",
        "Distance must be greater than 0; target time must be from 1 to 3,600,000 ms.",
      );
    if (
      await perform("edit-trial", () =>
        trainingService.updateTimeTrial(token!, sessionKey, {
          distanceM,
          targetTimeMs,
          notes: trialNotes.trim() || null,
        }),
      )
    )
      setShowTrialEdit(false);
  };

  const assignGroom = (participantId: string, groomId: string | null) =>
    perform(`groom:${participantId}`, () =>
      trainingService.assignGroom(token!, participantId, groomId),
    );

  return (
    <Screen
      role={userRole ?? "trainer"}
      title={session?.name ?? "Training session"}
      subtitle={payload?.trainingClass.name ?? "Session details"}
      back
      fallbackHref={`/${userRole ?? "trainer"}` as any}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {payload ? (
        <>
          <Panel>
            <Text
              style={[
                ui.value,
                { color: session?.status === "IN_PROGRESS" ? colors.monitor : colors.foreground },
              ]}
            >
              {formatTrainingStatus(session?.status)}
            </Text>
            <KeyValue
              items={[
                ["Class", `${payload.trainingClass.code} · ${payload.trainingClass.name}`],
                ["Start", formatDateTime(session!.scheduledStartAt)],
                ["End", formatDateTime(session!.scheduledEndAt)],
                ["Type", session!.sessionType === "TIME_TRIAL" ? t("Chạy thử") : t("Thông thường")],
                [
                  "Intensity",
                  session!.intensity === "LIGHT"
                    ? t("Nhẹ")
                    : session!.intensity === "HEAVY"
                      ? t("Nặng")
                      : t("Vừa"),
                ],
                ["Planned distance", `${session!.plannedDistanceM.toLocaleString()} m`],
                ["Location", session!.location ?? "—"],
                ["Surface", session!.surface ?? "—"],
                ...(payload.timeTrial
                  ? [
                      [
                        "Trial target",
                        payload.timeTrial.targetTimeMs == null
                          ? "No target"
                          : formatDurationMs(payload.timeTrial.targetTimeMs),
                      ] as [string, string],
                    ]
                  : []),
              ]}
            />
            {session?.notes ? <Text style={ui.muted}>{session.notes}</Text> : null}
            {session?.cancelReason ? (
              <Text style={{ ...ui.muted, color: colors.destructive }}>
                Cancellation: {session.cancelReason}
              </Text>
            ) : null}
          </Panel>
          {session?.status === "SCHEDULED" && payload.trainingClass.status === "ACTIVE" ? (
            <>
              {payload.timeTrial ? (
                <>
                  <SecondaryButton
                    label="Edit time-trial setup"
                    icon="timer-outline"
                    style={{ minHeight: 46 }}
                    onPress={() => {
                      initializeTrialEdit();
                      setShowTrialEdit(true);
                    }}
                  />
                  <BottomSheetModal
                    visible={showTrialEdit}
                    title="Time-trial setup"
                    onClose={() => setShowTrialEdit(false)}
                    onSave={() => void saveTrialConfig()}
                    saveLoading={pending === "edit-trial"}
                    saveDisabled={pending !== ""}
                    saveLabel={t("Lưu")}
                    cancelLabel="Cancel"
                  >
                    <Field label="Trial distance (m)">
                      <NativeInput
                        value={trialDistance}
                        onChangeText={setTrialDistance}
                        keyboardType="decimal-pad"
                      />
                    </Field>
                    <Field label="Target time (milliseconds, optional)">
                      <NativeInput
                        value={trialTarget}
                        onChangeText={setTrialTarget}
                        keyboardType="number-pad"
                      />
                    </Field>
                    <Field label="Trial notes">
                      <NativeInput value={trialNotes} onChangeText={setTrialNotes} multiline />
                    </Field>
                  </BottomSheetModal>
                </>
              ) : null}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <SecondaryButton
                  label="Edit session time and details"
                  icon="create-outline"
                  style={{ flex: 1, minHeight: 46 }}
                  onPress={() => {
                    initializeSessionEdit();
                    setShowEdit(true);
                  }}
                />
                <DangerButton
                  label="Cancel session"
                  icon="close-circle-outline"
                  style={{ flex: 1, minHeight: 46 }}
                  onPress={() => setShowCancel(true)}
                />
              </View>

              <BottomSheetModal
                visible={showEdit}
                title="Edit session"
                onClose={() => setShowEdit(false)}
                onSave={() => void saveSessionEdit()}
                saveLoading={pending === "edit-session"}
                saveDisabled={pending !== ""}
                saveLabel={t("Lưu")}
                cancelLabel="Cancel"
              >
                <Text style={ui.value}>Move or update this scheduled session</Text>
                <Field label="New date (club calendar, YYYY-MM-DD)">
                  <DatePickerField
                    value={editDate}
                    onChangeText={setEditDate}
                    placeholder="YYYY-MM-DD"
                    outputFormat="YYYY-MM-DD"
                    title="Chọn ngày buổi tập"
                  />
                </Field>
                <Field label="New start time (HH:mm)">
                  <NativeInput value={editTime} onChangeText={setEditTime} />
                </Field>
                <Field label="Duration (minutes)">
                  <NativeInput
                    value={editDuration}
                    onChangeText={setEditDuration}
                    keyboardType="decimal-pad"
                  />
                </Field>
                <Field label="Location (blank clears) ">
                  <NativeInput value={editLocation} onChangeText={setEditLocation} />
                </Field>
                <Field label="Surface (blank clears)">
                  <NativeInput value={editSurface} onChangeText={setEditSurface} />
                </Field>
                <Field label="Notes (blank clears)">
                  <NativeInput value={editNotes} onChangeText={setEditNotes} multiline />
                </Field>
                <Text style={ui.label}>
                  The Backend permits changes only before start and before a horse checks in. It
                  rechecks class dates, plan phases, overlaps and daily load.
                </Text>
              </BottomSheetModal>
              <BottomSheetModal
                visible={showCancel}
                title="Cancel session"
                onClose={() => setShowCancel(false)}
                onSave={() => void cancelSession()}
                saveLoading={pending === "cancel"}
                saveDisabled={pending !== "" || !cancelReason.trim()}
                saveLabel="Confirm cancellation"
                cancelLabel="Cancel"
              >
                <Field label="Cancellation reason (required)">
                  <NativeInput
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    multiline
                    placeholder="Why is this session cancelled?"
                  />
                </Field>
              </BottomSheetModal>
            </>
          ) : null}

          <View style={ui.section}>
            <SectionTitle>Horse sessions ({payload.rows.length})</SectionTitle>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                padding: 10,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 2,
                marginBottom: 6,
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.primary}
                style={{ marginTop: 1, flexShrink: 0 }}
              />
              <Text style={[ui.muted, { flex: 1, fontSize: 12, lineHeight: 17 }]}>
                Check-in opens 30 minutes before the scheduled start. Ready and start open 15 minutes
                before; the Backend confirms each time window and eligibility.
              </Text>
            </View>
            {payload.rows.length ? (
              payload.rows.map(({ participant, evaluation, results, summary }) => {
                const liveMetric = liveMetrics[participant.id];
                const canStreamMetrics =
                  participant.status === "ONGOING" &&
                  session?.status === "IN_PROGRESS" &&
                  new Date(session.scheduledEndAt).getTime() > clockNow;
                const simulationActive =
                  canStreamMetrics && simulatingIds[participant.id] && isSimulating(participant.id);
                const canCheckIn =
                  (participant.status === "PLANNED" || participant.status === "ABSENT") &&
                  isParticipantWindowOpen(
                    session!.scheduledStartAt,
                    session!.scheduledEndAt,
                    "check-in",
                    clockNow,
                  );
                const canReady =
                  participant.status === "PRESENT" &&
                  isParticipantWindowOpen(
                    session!.scheduledStartAt,
                    session!.scheduledEndAt,
                    "ready",
                    clockNow,
                  );
                const canStart =
                  participant.status === "READY" &&
                  session!.status !== "CANCELLED" &&
                  payload.trainingClass.status === "ACTIVE" &&
                  isParticipantWindowOpen(
                    session!.scheduledStartAt,
                    session!.scheduledEndAt,
                    "ready",
                    clockNow,
                  );
                const canComplete = participant.status === "ONGOING";
                const isTerminalParticipant = [
                  "COMPLETED",
                  "STOPPED",
                  "ABSENT",
                  "SKIPPED",
                ].includes(participant.status);
                const isTerminalSession = ["COMPLETED", "CANCELLED"].includes(
                  session?.status ?? "",
                );
                const canAssignGroom =
                  payload.trainingClass.status === "ACTIVE" &&
                  !isTerminalSession &&
                  !isTerminalParticipant;
                return (
                  <Panel key={participant.id} style={{ gap: 9 }}>
                    <View style={ui.row}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={ui.value} numberOfLines={1} ellipsizeMode="tail">
                          {participant.horseName}
                        </Text>
                        <Text style={ui.muted} numberOfLines={1}>
                          {formatTrainingStatus(participant.status)}
                          {participant.assignedGroomName
                            ? ` · Groom: ${participant.assignedGroomName}`
                            : " · Chưa gán Groom"}
                        </Text>
                      </View>
                      {participant.trainingLocked ? (
                        <Text
                          style={{
                            color: colors.destructive,
                            fontSize: 11,
                            fontWeight: "700",
                            flexShrink: 0,
                          }}
                        >
                          LOCKED
                        </Text>
                      ) : null}
                    </View>
                    {participant.status === "STOPPED" ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radius.sm,
                          backgroundColor: colors.injuredSoft,
                          alignSelf: "flex-start",
                          marginTop: 2,
                        }}
                      >
                        <Text
                          style={{ fontSize: 11, fontWeight: "700", color: colors.destructive }}
                        >
                          DỪNG SỚM
                        </Text>
                      </View>
                    ) : null}
                    {participant.ineligibilityReason ||
                    participant.cancelReason ||
                    participant.absenceReason ||
                    participant.stoppedReason ? (
                      <Text style={{ ...ui.muted, color: colors.destructive }}>
                        {participant.ineligibilityReason ??
                          participant.cancelReason ??
                          participant.absenceReason ??
                          `Đã dừng sớm: ${participant.stoppedReason}`}
                      </Text>
                    ) : null}
                    {summary ? (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 6,
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                          borderRadius: radius.sm,
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="analytics-outline" size={13} color={colors.primary} />
                          <Text style={{ fontSize: 11, color: colors.foreground, fontWeight: "600" }}>
                            {summary.count} {t("điểm đo")}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.borderStrong }}>•</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="heart-outline" size={13} color={colors.destructive} />
                          <Text style={{ fontSize: 11, color: colors.foreground }}>
                            TB:{" "}
                            <Text style={{ fontWeight: "700" }}>
                              {summary.avgHeartRateBpm ?? "—"} bpm
                            </Text>
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.borderStrong }}>•</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={{ fontSize: 11, color: colors.foreground }}>
                            Đỉnh:{" "}
                            <Text
                              style={{
                                fontWeight: "700",
                                color:
                                  summary.maxHeartRateBpm && summary.maxHeartRateBpm >= 240
                                    ? colors.destructive
                                    : summary.maxHeartRateBpm && summary.maxHeartRateBpm >= 180
                                      ? colors.monitor
                                      : colors.foreground,
                              }}
                            >
                              {summary.maxHeartRateBpm ?? "—"} bpm
                            </Text>
                          </Text>
                        </View>
                        {(summary.warningCount > 0 || summary.criticalCount > 0) && (
                          <>
                            <Text style={{ fontSize: 11, color: colors.borderStrong }}>•</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Ionicons name="alert-circle" size={13} color={colors.monitor} />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "700",
                                  color:
                                    summary.criticalCount > 0
                                      ? colors.destructive
                                      : colors.monitor,
                                }}
                              >
                                {summary.warningCount + summary.criticalCount} {t("cảnh báo")}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    ) : null}
                    {liveMetric ? (
                      <Text
                        style={{
                          ...ui.label,
                          color:
                            liveMetric.alertLevel === "CRITICAL"
                              ? colors.destructive
                              : liveMetric.alertLevel === "WARNING"
                                ? colors.monitor
                                : colors.primary,
                        }}
                      >
                        Live · {liveMetric.heartRateBpm} bpm · {liveMetric.speedMps.toFixed(1)} m/s
                        · {liveMetric.alertLevel}
                      </Text>
                    ) : null}
                    {results.map((result) => (
                      <Panel key={result.id} style={{ gap: 6 }}>
                        <Text style={ui.label}>
                          Trial #{result.attemptNo}: {formatDurationMs(result.elapsedMs)}
                          {result.videoUrl ? " · video attached" : " · no video"}
                        </Text>
                        {result.videoUrl ? (
                          <SecondaryButton
                            label="View trial video"
                            icon="play-circle-outline"
                            onPress={() =>
                              void Linking.openURL(result.videoUrl!).catch(() =>
                                Alert.alert(
                                  "Could not open video",
                                  "Refresh the session and try again.",
                                ),
                              )
                            }
                          />
                        ) : null}
                        {payload.trainingClass.status !== "CANCELLED" ? (
                          <SecondaryButton
                            label={
                              result.videoUrl ? "Change or remove video" : "Attach trial video"
                            }
                            icon="videocam-outline"
                            onPress={() =>
                              router.push(
                                `/trainer/trial-result/${participant.id}?sessionId=${session!.id}&horse=${encodeURIComponent(participant.horseName)}&attemptNo=${result.attemptNo}&videoOnly=1` as Href,
                              )
                            }
                          />
                        ) : null}
                      </Panel>
                    ))}

                    {/* Participant Action Console */}
                    <View style={styles.actionGrid}>
                      {/* Row 1: Workflow actions (Attendance / Ready / Start / Complete vs Absent / Stop) */}
                      {canCheckIn ||
                      canReady ||
                      canStart ||
                      canComplete ||
                      (participant.status !== "ONGOING" &&
                        participant.status !== "COMPLETED" &&
                        participant.status !== "ABSENT" &&
                        participant.status !== "SKIPPED") ? (
                        <View style={styles.actionRow}>
                          {(participant.status === "PLANNED" || participant.status === "ABSENT") &&
                          canCheckIn ? (
                            <Pressable
                              accessibilityRole="button"
                              disabled={pending !== ""}
                              onPress={() =>
                                void perform(`checkin:${participant.id}`, () =>
                                  trainingService.checkIn(token!, participant.id),
                                )
                              }
                              style={({ pressed }) => [
                                styles.actionBtn,
                                styles.attendanceBtn,
                                { opacity: pending !== "" ? 0.5 : pressed ? 0.85 : 1 },
                              ]}
                            >
                              <Text style={styles.attendanceBtnText} numberOfLines={1}>
                                {t(participant.status === "ABSENT" ? "Check in again" : "Check in")}
                              </Text>
                              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                            </Pressable>
                          ) : null}

                          {canReady ? (
                            <Pressable
                              accessibilityRole="button"
                              disabled={pending !== ""}
                              onPress={() =>
                                void perform(`ready:${participant.id}`, () =>
                                  trainingService.markReady(token!, participant.id),
                                )
                              }
                              style={({ pressed }) => [
                                styles.actionBtn,
                                styles.attendanceBtn,
                                { opacity: pending !== "" ? 0.5 : pressed ? 0.85 : 1 },
                              ]}
                            >
                              <Text style={styles.attendanceBtnText} numberOfLines={1}>
                                {t("Mark ready")}
                              </Text>
                              <Ionicons name="walk-outline" size={16} color="#FFFFFF" />
                            </Pressable>
                          ) : null}

                          {canStart ? (
                            <Pressable
                              accessibilityRole="button"
                              disabled={pending !== ""}
                              onPress={() =>
                                void perform(`start:${participant.id}`, () =>
                                  trainingService.startParticipant(token!, participant.id),
                                )
                              }
                              style={({ pressed }) => [
                                styles.actionBtn,
                                styles.attendanceBtn,
                                { opacity: pending !== "" ? 0.5 : pressed ? 0.85 : 1 },
                              ]}
                            >
                              <Text style={styles.attendanceBtnText} numberOfLines={1}>
                                {t("Start training")}
                              </Text>
                              <Ionicons name="play" size={16} color="#FFFFFF" />
                            </Pressable>
                          ) : null}

                          {canComplete && isTrainer ? (
                            <>
                              <Pressable
                                accessibilityRole="button"
                                disabled={pending !== ""}
                                onPress={() => {
                                  if (session?.sessionType === "TIME_TRIAL") {
                                    setTrialCompletionParticipantId(participant.id);
                                    setTrialTimeInput("");
                                    setTrialTimeNotes("");
                                    setShowTrialCompleteModal(true);
                                  } else {
                                    stopParticipantSimulation(participant.id);
                                    void perform(`complete:${participant.id}`, () =>
                                      trainingService.completeParticipant(token!, participant.id),
                                    );
                                  }
                                }}
                                style={({ pressed }) => [
                                  styles.actionBtn,
                                  styles.attendanceBtn,
                                  { opacity: pending !== "" ? 0.5 : pressed ? 0.85 : 1 },
                                ]}
                              >
                                <Text style={styles.attendanceBtnText} numberOfLines={1}>
                                  {t("Complete training")}
                                </Text>
                                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                              </Pressable>

                              <Pressable
                                accessibilityRole="button"
                                disabled={pending !== ""}
                                onPress={() => {
                                  setStopParticipantId(participant.id);
                                  setStopReason("");
                                  setShowStopModal(true);
                                }}
                                style={({ pressed }) => [
                                  styles.actionBtn,
                                  styles.dangerActionBtn,
                                  { opacity: pending !== "" ? 0.5 : pressed ? 0.85 : 1 },
                                ]}
                              >
                                <Text style={styles.dangerActionBtnText} numberOfLines={1}>
                                  {t("Dừng sớm lượt tập")}
                                </Text>
                                <Ionicons
                                  name="stop-circle-outline"
                                  size={16}
                                  color={colors.destructive}
                                />
                              </Pressable>
                            </>
                          ) : null}

                          {participant.status !== "ONGOING" &&
                          participant.status !== "COMPLETED" &&
                          participant.status !== "ABSENT" &&
                          participant.status !== "SKIPPED" ? (
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setAbsentId(absentId === participant.id ? "" : participant.id);
                                setAbsentReason("");
                              }}
                              style={({ pressed }) => [
                                styles.actionBtn,
                                styles.absentBtn,
                                { opacity: pressed ? 0.85 : 1 },
                              ]}
                            >
                              <Text style={styles.absentBtnText} numberOfLines={1}>
                                {t("Report absent")}
                              </Text>
                              <Ionicons
                                name="person-remove-outline"
                                size={16}
                                color={isDark ? "#FBBF24" : "#B45309"}
                              />
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}

                      {/* Row 2: Management & Telemetry (Đổi Groom + Hiệu suất & Biểu đồ IoT) */}
                      <View style={styles.actionRow}>
                        {canAssignGroom ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                              setGroomPickerId(
                                groomPickerId === participant.id ? "" : participant.id,
                              )
                            }
                            style={({ pressed }) => [
                              styles.actionBtn,
                              styles.groomBtn,
                              { opacity: pressed ? 0.85 : 1 },
                            ]}
                          >
                            <Text style={styles.groomBtnText} numberOfLines={1}>
                              {t(
                                participant.assignedGroomId
                                  ? "Change assigned Groom"
                                  : "Assign Groom",
                              )}
                            </Text>
                            <Ionicons
                              name="people-outline"
                              size={16}
                              color={isDark ? "#C084FC" : "#7E22CE"}
                            />
                          </Pressable>
                        ) : null}

                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            const params = new URLSearchParams({
                              horse: participant.horseName,
                              session: session!.name,
                              classId: payload.trainingClass.id,
                              sessionId: session!.id,
                              sessionType: session!.sessionType,
                              sessionStatus: session!.status,
                              participantStatus: participant.status,
                              horseId: participant.horseId,
                            });
                            router.push(
                              `/trainer/participant/${participant.id}?${params.toString()}` as Href,
                            );
                          }}
                          style={({ pressed }) => [
                            styles.actionBtn,
                            styles.telemetryBtn,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                        >
                          <Text style={styles.telemetryBtnText} numberOfLines={1}>
                            {t("Hiệu suất & Biểu đồ IoT")}
                          </Text>
                          <Ionicons
                            name="pulse-outline"
                            size={16}
                            color={isDark ? "#38BDF8" : "#0284C7"}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {groomPickerId === participant.id ? (
                      <View style={{ gap: 6, marginTop: 4 }}>
                        <SecondaryButton
                          label="Unassign Groom"
                          icon="close"
                          disabled={!participant.assignedGroomId || pending !== ""}
                          onPress={() => void assignGroom(participant.id, null)}
                        />
                        {payload.grooms.map((groom) => (
                          <Pressable
                            key={groom.groomId}
                            onPress={() => void assignGroom(participant.id, groom.groomId)}
                          >
                            <Panel
                              style={{
                                padding: 11,
                                borderColor:
                                  participant.assignedGroomId === groom.groomId
                                    ? colors.primary
                                    : colors.border,
                              }}
                            >
                              <Text style={ui.value}>{groom.fullName}</Text>
                              <Text style={ui.label}>
                                {groom.activeHorseCount} active horses
                              </Text>
                            </Panel>
                          </Pressable>
                        ))}
                        {!payload.grooms.length ? (
                          <Text style={ui.muted}>No Groom assignments are available.</Text>
                        ) : null}
                      </View>
                    ) : null}

                    {absentId === participant.id ? (
                      <View style={{ gap: 8, marginTop: 4 }}>
                        <Field label="Absence reason">
                          <NativeInput
                            value={absentReason}
                            onChangeText={setAbsentReason}
                            multiline
                            placeholder="Required by the Backend"
                          />
                        </Field>
                        <PrimaryButton
                          label={
                            pending === `absent:${participant.id}` ? "Saving…" : "Confirm absence"
                          }
                          disabled={pending !== ""}
                          onPress={() => void reportAbsent(participant.id)}
                        />
                      </View>
                    ) : null}

                    {/* Sensor Simulator Panel for Ongoing Horses */}
                    {participant.status === "ONGOING" ? (
                      <View
                        style={{
                          backgroundColor: colors.surface,
                          borderRadius: radius.md,
                          padding: space.sm,
                          borderWidth: 1,
                          borderColor: colors.border,
                          gap: 10,
                          marginVertical: 4,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Ionicons
                              name="hardware-chip-outline"
                              size={16}
                              color={colors.primary}
                            />
                            <Text
                              style={{ fontWeight: "700", fontSize: 13, color: colors.foreground }}
                            >
                              Giả lập cảm biến IoT
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: 12,
                              color: simulationActive ? colors.primary : colors.mutedForeground,
                              fontWeight: "600",
                            }}
                          >
                            {simulationActive ? "🟢 Đang phát tín hiệu" : "⚪ Tắt"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <SecondaryButton
                            label={simulationActive ? "Dừng phát" : "Phát nhịp tim tự động"}
                            icon={simulationActive ? "pause-outline" : "pulse-outline"}
                            style={{ flex: 1, minHeight: 44 }}
                            disabled={!canStreamMetrics}
                            onPress={() => toggleSimulation(participant.id)}
                          />
                          <PrimaryButton
                            label="⚡ Vọt nhịp tim"
                            icon="flash"
                            style={{ flex: 1, minHeight: 44, backgroundColor: colors.destructive }}
                            disabled={!canStreamMetrics}
                            onPress={() => void handleHeartRateSpike(participant.id)}
                          />
                        </View>
                      </View>
                    ) : null}

                    {/* Trainer Evaluation Block when Completed / Stopped */}
                    {session &&
                    session.status !== "CANCELLED" &&
                    ["COMPLETED", "STOPPED"].includes(participant.status) ? (
                      evaluation ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: colors.surface,
                            borderRadius: radius.md,
                            paddingHorizontal: space.md,
                            paddingVertical: space.sm,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <View
                              style={{
                                backgroundColor: colors.fitSoft,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: radius.pill,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Ionicons name="star" size={13} color={colors.primary} />
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "800",
                                  color: colors.primary,
                                }}
                              >
                                {evaluation.score}/10
                              </Text>
                            </View>
                            <Text
                              style={[ui.muted, { flex: 1, fontSize: 13 }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {evaluation.comment || t("Đã hoàn tất đánh giá")}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                              router.push(
                                `/trainer/eval/${participant.id}?edit=1&horse=${encodeURIComponent(participant.horseName)}&session=${encodeURIComponent(session!.name)}` as Href,
                              )
                            }
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: radius.pill,
                              backgroundColor: colors.background,
                              borderWidth: 1,
                              borderColor: colors.border,
                              marginLeft: 8,
                            }}
                          >
                            <Ionicons name="create-outline" size={14} color={colors.foreground} />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: colors.foreground,
                              }}
                            >
                              {t("Sửa")}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <PrimaryButton
                          label="Đánh giá buổi tập"
                          icon="star-outline"
                          onPress={() =>
                            router.push(
                              `/trainer/eval/${participant.id}?horse=${encodeURIComponent(participant.horseName)}&session=${encodeURIComponent(session!.name)}` as Href,
                            )
                          }
                        />
                      )
                    ) : null}

                    {session &&
                    session.status !== "CANCELLED" &&
                    session?.sessionType === "TIME_TRIAL" &&
                    ["ONGOING", "COMPLETED", "STOPPED"].includes(participant.status) ? (
                      <View style={{ marginTop: 4 }}>
                        <SecondaryButton
                          label="Record trial result"
                          icon="timer-outline"
                          onPress={() =>
                            router.push(
                              `/trainer/trial-result/${participant.id}?sessionId=${session!.id}&horse=${encodeURIComponent(participant.horseName)}` as Href,
                            )
                          }
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
                emptyLabel="No participant rows are currently linked to this session."
              />
            )}
          </View>
        </>
      ) : null}

      {/* Early Stop Modal */}
      <BottomSheetModal
        visible={showStopModal}
        title="Dừng sớm lượt tập"
        onClose={() => setShowStopModal(false)}
        onSave={() => void submitStopParticipant()}
        saveLoading={pending === `stop:${stopParticipantId}`}
        saveDisabled={pending !== "" || !stopReason.trim()}
        saveLabel="Xác nhận dừng sớm"
        cancelLabel="Hủy"
      >
        <Field label="Lý do dừng sớm (bắt buộc, tối đa 500 ký tự)">
          <NativeInput
            value={stopReason}
            onChangeText={setStopReason}
            multiline
            placeholder="Nhập lý do dừng sớm lượt tập..."
          />
        </Field>
      </BottomSheetModal>

      {/* Complete Trial Run Modal */}
      <BottomSheetModal
        visible={showTrialCompleteModal}
        title="Hoàn thành lượt chạy thử"
        onClose={() => setShowTrialCompleteModal(false)}
        onSave={() => void submitTrialComplete(Boolean(trialTimeInput.trim()))}
        saveLoading={pending === `complete:${trialCompletionParticipantId}`}
        saveDisabled={pending !== ""}
        saveLabel={trialTimeInput.trim() ? "Hoàn thành & Lưu kết quả" : "Chỉ hoàn thành (Ghi sau)"}
        cancelLabel="Hủy"
      >
        <Text style={ui.muted}>
          Nhập thời gian chạy thử để hoàn thành và ghi nhận kết quả ngay, hoặc bấm tiếp tục để hoàn
          thành trước.
        </Text>
        <Field label="Thời gian chạy thử (mm:ss.s, ví dụ: 01:14.5)">
          <NativeInput
            value={trialTimeInput}
            onChangeText={setTrialTimeInput}
            placeholder="01:14.5"
          />
        </Field>
        <Field label="Ghi chú kết quả (tùy chọn)">
          <NativeInput
            value={trialTimeNotes}
            onChangeText={setTrialTimeNotes}
            multiline
            placeholder="Ghi chú về vòng chạy thử..."
          />
        </Field>
      </BottomSheetModal>
    </Screen>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    actionGrid: {
      gap: 8,
      marginTop: 4,
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
    },
    attendanceBtn: {
      backgroundColor: colors.fit,
      borderColor: colors.fit,
    },
    attendanceBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      flexShrink: 1,
    },
    absentBtn: {
      backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
      borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "#FCD34D",
    },
    absentBtnText: {
      color: isDark ? "#FBBF24" : "#B45309",
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      flexShrink: 1,
    },
    groomBtn: {
      backgroundColor: isDark ? "rgba(168, 85, 247, 0.12)" : "#F3E8FF",
      borderColor: isDark ? "rgba(168, 85, 247, 0.32)" : "#D8B4FE",
    },
    groomBtnText: {
      color: isDark ? "#C084FC" : "#7E22CE",
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      flexShrink: 1,
    },
    telemetryBtn: {
      backgroundColor: isDark ? "rgba(2, 132, 199, 0.12)" : "#E0F2FE",
      borderColor: isDark ? "rgba(2, 132, 199, 0.32)" : "#BAE6FD",
    },
    telemetryBtnText: {
      color: isDark ? "#38BDF8" : "#0284C7",
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      flexShrink: 1,
    },
    dangerActionBtn: {
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "#FEE2E2",
      borderColor: colors.destructive,
    },
    dangerActionBtnText: {
      color: colors.destructive,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      flexShrink: 1,
    },
  });

export default TrainingSessionDetailScreen;

