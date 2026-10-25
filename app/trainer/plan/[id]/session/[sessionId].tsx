import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { router, type Href, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, KeyValue, Screen, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
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

export default function TrainingSessionDetail() {
  const { colors } = useTheme();
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

  const toggleSimulation = (participantId: string) => {
    if (isSimulating(participantId)) {
      stopSimulation(participantId);
      setSimulatingIds((prev) => ({ ...prev, [participantId]: false }));
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
          Alert.alert("Lỗi phát giả lập", extractErrorMessage(err));
          setSimulatingIds((prev) => ({ ...prev, [participantId]: false }));
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
    if (
      await perform(`stop:${stopParticipantId}`, () =>
        trainingService.stopParticipant(token!, stopParticipantId, stopReason.trim()),
      )
    ) {
      stopSimulation(stopParticipantId);
      setSimulatingIds((prev) => ({ ...prev, [stopParticipantId]: false }));
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
    stopSimulation(pId);
    setSimulatingIds((prev) => ({ ...prev, [pId]: false }));
    setTrialTimeInput("");
    setTrialTimeNotes("");
    setTrialCompletionParticipantId("");
  };

  const cancelSession = async () => {
    if (!cancelReason.trim())
      return Alert.alert("Reason required", "Enter a reason before cancelling the session.");
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
                [
                  "Type",
                  session!.sessionType === "TIME_TRIAL" ? t("Chạy thử") : t("Thông thường"),
                ],
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
              <SecondaryButton
                label="Edit session time and details"
                icon="create-outline"
                onPress={() => {
                  initializeSessionEdit();
                  setShowEdit(true);
                }}
              />
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
                  <NativeInput value={editDate} onChangeText={setEditDate} />
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

              {payload.timeTrial ? (
                <>
                  <SecondaryButton
                    label="Edit time-trial setup"
                    icon="timer-outline"
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

              <SecondaryButton
                label="Cancel session"
                icon="close-circle-outline"
                onPress={() => setShowCancel(true)}
              />
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
            <Text style={ui.muted}>
              Check-in opens 30 minutes before the scheduled start. Ready and start open 15 minutes
              before; the Backend confirms each time window and eligibility.
            </Text>
            {payload.rows.length ? (
              payload.rows.map(({ participant, evaluation, results, summary }) => {
                const liveMetric = liveMetrics[participant.id];
                const canCheckIn =
                  (participant.status === "PLANNED" || participant.status === "ABSENT") &&
                  isParticipantWindowOpen(
                    session!.scheduledStartAt,
                    session!.scheduledEndAt,
                    "check-in",
                  );
                const canReady =
                  participant.status === "PRESENT" &&
                  isParticipantWindowOpen(
                    session!.scheduledStartAt,
                    session!.scheduledEndAt,
                    "ready",
                  );
                const canStart =
                  participant.status === "READY" &&
                  session!.status !== "CANCELLED" &&
                  payload.trainingClass.status === "ACTIVE";
                const canComplete = participant.status === "ONGOING";
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
                            ? ` · ${participant.assignedGroomName}`
                            : " · Chưa phân công Groom"}
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
                          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.destructive }}>
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
                      <Text style={ui.label}>
                        Metrics: {summary.count} points · avg HR {summary.avgHeartRateBpm ?? "—"}{" "}
                        bpm · peak {summary.maxHeartRateBpm ?? "—"} · {summary.warningCount}{" "}
                        warnings · {summary.criticalCount} critical
                      </Text>
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

                    {payload.trainingClass.status === "ACTIVE" ? (
                      <View style={{ gap: 8 }}>
                        <SecondaryButton
                          label={
                            participant.assignedGroomId ? "Change assigned Groom" : "Assign Groom"
                          }
                          icon="people-outline"
                          onPress={() =>
                            setGroomPickerId(groomPickerId === participant.id ? "" : participant.id)
                          }
                        />
                        {groomPickerId === participant.id ? (
                          <View style={{ gap: 6 }}>
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
                      </View>
                    ) : null}

                    {canCheckIn || canReady || canStart || canComplete ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {(participant.status === "PLANNED" || participant.status === "ABSENT") &&
                        canCheckIn ? (
                          <SecondaryButton
                            label={participant.status === "ABSENT" ? "Check in again" : "Check in"}
                            icon="checkmark-circle-outline"
                            disabled={pending !== ""}
                            style={{ flexGrow: 1 }}
                            onPress={() =>
                              void perform(`checkin:${participant.id}`, () =>
                                trainingService.checkIn(token!, participant.id),
                              )
                            }
                          />
                        ) : null}
                        {canReady ? (
                          <SecondaryButton
                            label="Mark ready"
                            icon="walk-outline"
                            disabled={pending !== ""}
                            style={{ flexGrow: 1 }}
                            onPress={() =>
                              void perform(`ready:${participant.id}`, () =>
                                trainingService.markReady(token!, participant.id),
                              )
                            }
                          />
                        ) : null}
                        {canStart ? (
                          <PrimaryButton
                            label="Start training"
                            icon="play"
                            disabled={pending !== ""}
                            style={{ flexGrow: 1 }}
                            onPress={() =>
                              void perform(`start:${participant.id}`, () =>
                                trainingService.startParticipant(token!, participant.id),
                              )
                            }
                          />
                        ) : null}
                        {canComplete && isTrainer ? (
                          <>
                            <PrimaryButton
                              label="Complete training"
                              icon="checkmark-done"
                              disabled={pending !== ""}
                              style={{ flexGrow: 1 }}
                              onPress={() => {
                                if (session?.sessionType === "TIME_TRIAL") {
                                  setTrialCompletionParticipantId(participant.id);
                                  setTrialTimeInput("");
                                  setTrialTimeNotes("");
                                  setShowTrialCompleteModal(true);
                                } else {
                                  void perform(`complete:${participant.id}`, () =>
                                    trainingService.completeParticipant(token!, participant.id),
                                  );
                                }
                              }}
                            />
                            <SecondaryButton
                              label="Dừng sớm lượt tập"
                              icon="stop-circle-outline"
                              disabled={pending !== ""}
                              style={{ flexGrow: 1, borderColor: colors.destructive }}
                              onPress={() => {
                                setStopParticipantId(participant.id);
                                setStopReason("");
                                setShowStopModal(true);
                              }}
                            />
                          </>
                        ) : null}
                        {participant.status !== "ONGOING" &&
                        participant.status !== "COMPLETED" &&
                        participant.status !== "ABSENT" &&
                        participant.status !== "SKIPPED" ? (
                          <SecondaryButton
                            label="Report absent"
                            icon="person-remove-outline"
                            style={{ flexGrow: 1 }}
                            onPress={() => {
                              setAbsentId(absentId === participant.id ? "" : participant.id);
                              setAbsentReason("");
                            }}
                          />
                        ) : null}
                      </View>
                    ) : null}
                    {absentId === participant.id ? (
                      <View style={{ gap: 8 }}>
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
                          gap: 8,
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
                            <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} />
                            <Text style={{ fontWeight: "700", fontSize: 13, color: colors.foreground }}>
                              Giả lập cảm biến IoT
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: 12,
                              color: simulatingIds[participant.id]
                                ? colors.primary
                                : colors.mutedForeground,
                              fontWeight: "600",
                            }}
                          >
                            {simulatingIds[participant.id] ? "🟢 Đang phát tín hiệu" : "⚪ Tắt"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <SecondaryButton
                            label={simulatingIds[participant.id] ? "Dừng phát" : "Phát nhịp tim tự động"}
                            icon={simulatingIds[participant.id] ? "pause-outline" : "pulse-outline"}
                            style={{ flexGrow: 1 }}
                            onPress={() => toggleSimulation(participant.id)}
                          />
                          <PrimaryButton
                            label="⚡ Vọt nhịp tim"
                            icon="flash"
                            style={{ flexGrow: 1, backgroundColor: colors.destructive }}
                            onPress={() => void handleHeartRateSpike(participant.id)}
                          />
                        </View>
                      </View>
                    ) : null}

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <SecondaryButton
                        label="Performance"
                        icon="pulse-outline"
                        style={{ flexGrow: 1 }}
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
                          router.push(`/trainer/participant/${participant.id}?${params.toString()}` as Href);
                        }}
                      />
                      {session && session.status !== "CANCELLED" &&
                      ["COMPLETED", "STOPPED"].includes(participant.status) &&
                      !evaluation ? (
                        <SecondaryButton
                          label="Add evaluation"
                          icon="star-outline"
                          style={{ flexGrow: 1 }}
                          onPress={() =>
                            router.push(
                              `/trainer/eval/${participant.id}?horse=${encodeURIComponent(participant.horseName)}&session=${encodeURIComponent(session!.name)}` as Href,
                            )
                          }
                        />
                      ) : null}
                      {evaluation && session && session.status !== "CANCELLED" ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[ui.label, { alignSelf: "center", color: colors.primary }]}>
                            Evaluated · {evaluation.score}/10
                          </Text>
                          <SecondaryButton
                            label="Edit evaluation"
                            onPress={() =>
                              router.push(
                                `/trainer/eval/${participant.id}?edit=1&horse=${encodeURIComponent(participant.horseName)}&session=${encodeURIComponent(session!.name)}` as Href,
                              )
                            }
                          />
                        </View>
                      ) : null}
                      {session && session.status !== "CANCELLED" &&
                      session?.sessionType === "TIME_TRIAL" &&
                      ["ONGOING", "COMPLETED", "STOPPED"].includes(participant.status) ? (
                        <SecondaryButton
                          label="Record trial result"
                          icon="timer-outline"
                          style={{ flexGrow: 1 }}
                          onPress={() =>
                            router.push(
                              `/trainer/trial-result/${participant.id}?sessionId=${session!.id}&horse=${encodeURIComponent(participant.horseName)}` as Href,
                            )
                          }
                        />
                      ) : null}
                    </View>
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
          Nhập thời gian chạy thử để hoàn thành và ghi nhận kết quả ngay, hoặc bấm tiếp tục để hoàn thành trước.
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
