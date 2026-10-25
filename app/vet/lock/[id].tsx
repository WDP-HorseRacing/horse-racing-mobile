import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import {
  BottomSheetModal,
  Chips,
  DatePickerField,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  getUiStyles,
} from "@/components/ui";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { medicalService, type TrainingLockDto } from "@/services/medical.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";
import { toClubDateTime } from "@/features/medical/medical-validation";

const reasons = [
  "Abnormal vital signs",
  "Injury or lameness",
  "Veterinary examination required",
  "Other",
];

const lockDurationPresets = [
  "Không đặt trước",
  "Sau 3 ngày",
  "Sau 7 ngày",
  "Sau 14 ngày",
  "Tùy chọn",
];

const getOffsetDateStr = (days: number) => {
  const d = new Date(Date.now() + days * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
};

export default function LockTraining() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const horseId = Array.isArray(id) ? id[0] : id;
  const { token } = useAuth();
  const [reason, setReason] = useState(reasons[0]);
  const [otherReason, setOtherReason] = useState("");
  const [durationPreset, setDurationPreset] = useState("Không đặt trước");
  const [lockEndDate, setLockEndDate] = useState("");
  const [lockEndTime, setLockEndTime] = useState("09:00");
  const [releaseReason, setReleaseReason] = useState("");
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [createdLock, setCreatedLock] = useState<TrainingLockDto | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDurationChange = (preset: string) => {
    setDurationPreset(preset);
    if (preset === "Không đặt trước") {
      setLockEndDate("");
    } else if (preset === "Sau 3 ngày") {
      setLockEndDate(getOffsetDateStr(3));
    } else if (preset === "Sau 7 ngày") {
      setLockEndDate(getOffsetDateStr(7));
    } else if (preset === "Sau 14 ngày") {
      setLockEndDate(getOffsetDateStr(14));
    } else if (preset === "Tùy chọn" && !lockEndDate) {
      setLockEndDate(getOffsetDateStr(3));
    }
  };

  const load = useCallback(async () => {
    const [horse, locks] = await Promise.all([
      horseService.get(token!, horseId),
      medicalService.listTrainingLocks(token!, horseId),
    ]);
    return { horse, locks };
  }, [token, horseId]);
  const resource = useApiResource(load, Boolean(token && horseId));
  const activeLock =
    createdLock ?? resource.data?.locks.find((lock) => lock.status === "ACTIVE") ?? null;

  const createLock = () =>
    Alert.alert(
      "Lock training?",
      "A veterinary lock will stop training eligibility for this horse.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Lock", style: "destructive", onPress: () => void submitLock() },
      ],
    );
  const submitLock = async () => {
    if (!token) return;
    const lockReason = reason === "Other" ? otherReason.trim() : reason;
    if (!lockReason) {
      Alert.alert("Reason required", "Enter a reason for the training lock.");
      return;
    }
    let lockEndIso: string | undefined = undefined;
    if (lockEndDate.trim()) {
      const iso = toClubDateTime(lockEndDate.trim(), lockEndTime.trim() || "09:00");
      if (!iso) {
        Alert.alert("Ngày giờ không hợp lệ", "Vui lòng nhập đúng định dạng YYYY-MM-DD và HH:mm.");
        return;
      }
      lockEndIso = iso;
    }
    setSaving(true);
    try {
      setCreatedLock(
        await medicalService.createTrainingLock(token, horseId, {
          reason: lockReason,
          ...(lockEndIso ? { lockEnd: lockEndIso } : {}),
        }),
      );
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not lock training", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitRelease = async () => {
    if (!token || !activeLock || !releaseReason.trim() || saving) return;
    setSaving(true);
    try {
      await medicalService.releaseTrainingLock(token, activeLock.id, releaseReason.trim());
      setReleaseReason("");
      setShowReleaseForm(false);
      setCreatedLock(null);
      await resource.refresh();
      Alert.alert(
        "Training lock released",
        "Điều kiện huấn luyện của ngựa đã được làm mới thành công.",
      );
    } catch (error) {
      Alert.alert("Could not release training lock", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role="vet"
      title={activeLock ? "Training locked" : "Lock training"}
      subtitle={resource.data?.horse.name ?? ""}
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        activeLock ? (
          <>
            <View style={uiStyles.alert}>
              <Text style={{ ...uiStyles.value, fontSize: 22 }}>
                {resource.data.horse.name} is LOCKED
              </Text>
              <Text style={uiStyles.muted}>{activeLock.reason}</Text>
              <Text style={uiStyles.muted}>
                Started{" "}
                {new Date(activeLock.lockStart).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </Text>
              {activeLock.lockEnd ? (
                <Text style={uiStyles.muted}>
                  Dự kiến gỡ:{" "}
                  {new Date(activeLock.lockEnd).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </Text>
              ) : null}
            </View>
            <PrimaryButton
              label="Release training lock"
              icon="lock-open-outline"
              onPress={() => setShowReleaseForm(true)}
            />
            <BottomSheetModal
              visible={showReleaseForm}
              title="Release training lock"
              saveLabel={saving ? "Releasing…" : "Confirm release"}
              cancelLabel="Cancel"
              saveDisabled={saving || !releaseReason.trim()}
              onSave={() =>
                Alert.alert(
                  "Release this training lock?",
                  "Hệ thống sẽ cập nhật điều kiện huấn luyện của ngựa tương ứng.",
                  [
                    { text: "Keep locked", style: "cancel" },
                    { text: "Release", onPress: () => void submitRelease() },
                  ],
                )
              }
              onClose={() => setShowReleaseForm(false)}
            >
              <Field label="Reason for releasing this lock">
                <NativeInput value={releaseReason} onChangeText={setReleaseReason} multiline />
              </Field>
            </BottomSheetModal>
            <PrimaryButton
              label="Open horse profile"
              onPress={() => router.push(`/vet/horse/${horseId}`)}
            />
          </>
        ) : (
          <>
            <View style={uiStyles.alert}>
              <Text style={uiStyles.label}>Emergency training lock</Text>
              <Text style={{ ...uiStyles.value, fontSize: 22 }}>{resource.data.horse.name}</Text>
              <Text style={uiStyles.muted}>
                {resource.data.horse.location.barn?.name ?? "No barn assigned"} ·{" "}
                {resource.data.horse.location.stall?.code ?? "No stall assigned"}
              </Text>
            </View>
            <View style={uiStyles.section}>
              <SectionTitle>Reason</SectionTitle>
              <Chips options={reasons} value={reason} onChange={setReason} />
            </View>
            {reason === "Other" ? (
              <Field label="Reason">
                <NativeInput
                  value={otherReason}
                  onChangeText={setOtherReason}
                  multiline
                  placeholder="Enter the reason"
                />
              </Field>
            ) : null}
            <View style={uiStyles.section}>
              <SectionTitle>Thời hạn khóa dự kiến</SectionTitle>
              <Chips
                options={lockDurationPresets}
                value={durationPreset}
                onChange={handleDurationChange}
              />
              {durationPreset !== "Không đặt trước" ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <Field label="Ngày dự kiến gỡ khóa (YYYY-MM-DD)">
                    <DatePickerField
                      value={lockEndDate}
                      onChangeText={setLockEndDate}
                      placeholder="YYYY-MM-DD"
                      outputFormat="YYYY-MM-DD"
                      title="Chọn ngày dự kiến gỡ khóa"
                    />
                  </Field>
                  <Field label="Giờ dự kiến gỡ khóa (HH:mm)">
                    <NativeInput
                      value={lockEndTime}
                      onChangeText={setLockEndTime}
                      placeholder="09:00"
                    />
                  </Field>
                </View>
              ) : null}
            </View>
            <Panel>
              <Text style={uiStyles.muted}>
                Lệnh khóa huấn luyện được lưu trữ và cập nhật điều kiện tham gia lớp của ngựa.
              </Text>
            </Panel>
            <PrimaryButton
              label={saving ? "Locking…" : "Lock training"}
              icon="lock-closed"
              onPress={createLock}
              disabled={saving}
            />
          </>
        )
      ) : null}
    </Screen>
  );
}
