import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, KeyValue, Screen, SectionTitle } from "@/components/common";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/config/theme";
import { useApiResource } from "@/hooks/useApiResource";
import { useAuth } from "@/context/AuthContext";
import { horseService } from "@/services/horse.service";
import { usersService } from "@/services/users.service";
import { isRole } from "@/features/auth/roles";
import type { StaffDto } from "@/adapters/staff.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";

export default function HorseOwnership() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const { token } = useAuth();
  const [newOwnerId, setNewOwnerId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const transferPending = useRef(false);
  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token && id));
  const loadPermissions = useCallback(() => horseService.getPermissions(token!, id), [id, token]);
  const permissionsResource = useApiResource(loadPermissions, Boolean(token && id));
  const loadHistory = useCallback(() => horseService.listOwnerships(token!, id), [id, token]);
  const historyResource = useApiResource(loadHistory, Boolean(token && id));
  const loadOwners = useCallback(() => usersService.list(token!), [token]);
  const ownersResource = useApiResource(loadOwners, Boolean(token) && role === "manager");
  const owners = useMemo(
    () =>
      (ownersResource.data ?? []).filter(
        (user: StaffDto) =>
          user.role === "HORSE_OWNER" &&
          user.status === "ACTIVE" &&
          user.id !== horseResource.data?.ownerId,
      ),
    [horseResource.data?.ownerId, ownersResource.data],
  );

  if (!isRole(role)) return <Redirect href="/" />;

  const transfer = () => {
    const horse = horseResource.data;
    if (
      !token ||
      !horse ||
      !newOwnerId ||
      !reason.trim() ||
      role !== "manager" ||
      transferPending.current
    )
      return;
    if (reason.trim().length > 500) {
      setError("Transfer reason must be 500 characters or fewer.");
      return;
    }
    const newOwnerName =
      owners.find((owner) => owner.id === newOwnerId)?.fullName ?? "the selected owner";
    transferPending.current = true;
    Alert.alert(
      "Confirm ownership transfer",
      `Transfer ${horse.name} from ${horse.owner?.fullName ?? "the current owner"} to ${newOwnerName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            transferPending.current = false;
          },
        },
        { text: "Confirm transfer", onPress: () => void commitTransfer() },
      ],
    );
  };

  const commitTransfer = async () => {
    const horse = horseResource.data;
    if (!token || !horse || !newOwnerId || !reason.trim() || role !== "manager" || saving) {
      transferPending.current = false;
      return;
    }
    setSaving(true);
    setError("");
    try {
      await horseService.transferOwnership(token, id, {
        newOwnerId,
        reason: reason.trim(),
        version: horse.version,
      });
      Alert.alert(
        "Ownership transferred",
        "Horse profile and ownership history have been updated.",
      );
      setReason("");
      setNewOwnerId("");
      await Promise.all([horseResource.refresh(), historyResource.refresh()]);
    } catch (cause) {
      const message = extractErrorMessage(cause);
      setError(message);
      Alert.alert("Could not transfer ownership", message);
    } finally {
      transferPending.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen
      role={role}
      title="Ownership history"
      subtitle={horseResource.data?.name ?? "Horse profile"}
      back
      fallbackHref={`/${role}/horse/${id}` as any}
      refreshing={
        horseResource.isRefreshing ||
        historyResource.isRefreshing ||
        permissionsResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          horseResource.refresh(),
          historyResource.refresh(),
          permissionsResource.refresh(),
        ])
      }
    >
      <AsyncStateView
        isLoading={
          horseResource.isLoading || historyResource.isLoading || permissionsResource.isLoading
        }
        error={horseResource.error ?? historyResource.error ?? permissionsResource.error}
        onRetry={() =>
          void Promise.all([
            horseResource.retry(),
            historyResource.retry(),
            permissionsResource.retry(),
          ])
        }
      />
      {horseResource.data ? (
        <Panel>
          <SectionTitle>Current owner</SectionTitle>
          <KeyValue
            items={[
              ["Horse", horseResource.data.name],
              ["Owner", horseResource.data.owner?.fullName ?? "Unassigned"],
              [
                "Since",
                horseResource.data.ownerSince
                  ? new Date(horseResource.data.ownerSince).toLocaleDateString()
                  : "—",
              ],
            ]}
          />
        </Panel>
      ) : null}
      {historyResource.data ? (
        <View style={{ gap: 12 }}>
          <SectionTitle>Ownership periods</SectionTitle>
          {historyResource.data.length ? (
            historyResource.data.map((period) => (
              <Panel key={period.id} style={{ gap: space.xs }}>
                <Text style={{ fontWeight: "800" }}>{period.owner.fullName}</Text>
                <Text style={uiStyles.muted}>
                  {new Date(period.startedAt).toLocaleString()} —{" "}
                  {period.endedAt ? new Date(period.endedAt).toLocaleString() : "Current"}
                </Text>
                {period.reason ? <Text style={uiStyles.muted}>Reason: {period.reason}</Text> : null}
                {period.recordedBy ? (
                  <Text style={uiStyles.muted}>Recorded by {period.recordedBy.fullName}</Text>
                ) : null}
              </Panel>
            ))
          ) : (
            <Panel>
              <Text style={uiStyles.muted}>No ownership periods have been recorded.</Text>
            </Panel>
          )}
        </View>
      ) : null}
      {role === "manager" &&
      permissionsResource.data?.canEditProfile &&
      !horseResource.data?.isDeleted ? (
        <Panel style={{ gap: space.md }}>
          <SectionTitle>Internal ownership transfer</SectionTitle>
          <Text style={uiStyles.muted}>
            Transfer ownership uses the dedicated Backend workflow and records a history period. It
            does not change the horse lifecycle or stable placement.
          </Text>
          <View style={{ gap: 16, marginTop: 4 }}>
            <Field label="New owner">
              {ownersResource.error || ownersResource.isLoading ? (
                <AsyncStateView
                  isLoading={ownersResource.isLoading}
                  error={ownersResource.error}
                  onRetry={() => void ownersResource.retry()}
                />
              ) : owners.length ? (
                <Chips
                  options={owners.map((owner) => `${owner.fullName} · ${owner.id.slice(0, 6)}`)}
                  value={
                    owners.find((owner) => owner.id === newOwnerId)
                      ? `${owners.find((owner) => owner.id === newOwnerId)!.fullName} · ${newOwnerId.slice(0, 6)}`
                      : ""
                  }
                  onChange={(label) =>
                    setNewOwnerId(
                      owners.find(
                        (owner) => `${owner.fullName} · ${owner.id.slice(0, 6)}` === label,
                      )?.id ?? "",
                    )
                  }
                />
              ) : (
                <Text style={uiStyles.muted}>No active horse owners are available.</Text>
              )}
            </Field>
            <Field label="Transfer reason or contract number">
              <NativeInput
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder="Required · up to 500 characters"
              />
            </Field>
            {error ? (
              <View style={uiStyles.alert}>
                <Text style={{ color: colors.destructive, fontWeight: "600", fontSize: 13 }}>
                  {error}
                </Text>
              </View>
            ) : null}
            <PrimaryButton
              label={saving ? "Transferring…" : "Confirm ownership transfer"}
              icon="people"
              disabled={saving || !newOwnerId || !reason.trim() || !horseResource.data?.ownerId}
              onPress={() => void transfer()}
            />
          </View>
        </Panel>
      ) : null}
    </Screen>
  );
}
