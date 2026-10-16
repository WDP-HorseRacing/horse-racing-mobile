import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { medicalService, type TrainingLockDto } from "@/services/medical.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";

const reasons = [
  "Abnormal vital signs",
  "Injury or lameness",
  "Veterinary examination required",
  "Other",
];

export default function LockTraining() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const horseId = Array.isArray(id) ? id[0] : id;
  const { token } = useAuth();
  const [reason, setReason] = useState(reasons[0]);
  const [otherReason, setOtherReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [createdLock, setCreatedLock] = useState<TrainingLockDto | null>(null);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    try {
      setCreatedLock(
        await medicalService.createTrainingLock(token, horseId, { reason: lockReason }),
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
        "Training eligibility has been refreshed from the Backend.",
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
            </View>
            {showReleaseForm ? (
              <>
                <Field label="Reason for releasing this lock">
                  <NativeInput value={releaseReason} onChangeText={setReleaseReason} multiline />
                </Field>
                <PrimaryButton
                  label={saving ? "Releasing…" : "Confirm release"}
                  disabled={saving || !releaseReason.trim()}
                  onPress={() =>
                    Alert.alert(
                      "Release this training lock?",
                      "The Backend will update this horse’s training eligibility.",
                      [
                        { text: "Keep locked", style: "cancel" },
                        { text: "Release", onPress: () => void submitRelease() },
                      ],
                    )
                  }
                />
                <PrimaryButton
                  label="Back"
                  icon="arrow-back"
                  onPress={() => setShowReleaseForm(false)}
                />
              </>
            ) : (
              <PrimaryButton
                label="Release training lock"
                icon="lock-open-outline"
                onPress={() => setShowReleaseForm(true)}
              />
            )}
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
            <Panel>
              <Text style={uiStyles.muted}>
                The lock is recorded in the backend and changes this horse’s training eligibility.
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
