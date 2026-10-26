import { router, useLocalSearchParams, type Href } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { formatEnum } from "@/utils/formatters";
import { space } from "@/config/theme";
import { useApiResource } from "@/hooks/useApiResource";
import {
  horseService,
  type HorseDeletePreviewDto,
  type HorseLifecyclePreviewDto,
  type HorseLifecycleStatusDto,
  type HorseRestorePreviewDto,
} from "@/services/horse.service";
import { usersService } from "@/services/users.service";
import type { StaffDto } from "@/adapters/staff.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";

type Action = HorseLifecycleStatusDto | "DELETE" | "RESTORE";
type Preview =
  | { kind: "lifecycle"; data: HorseLifecyclePreviewDto }
  | { kind: "delete"; data: HorseDeletePreviewDto }
  | { kind: "restore"; data: HorseRestorePreviewDto };
const LIFECYCLE: HorseLifecycleStatusDto[] = ["ACTIVE", "RETIRED", "TRANSFERRED", "DECEASED"];

export default function LifecycleManagement() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [action, setAction] = useState<Action | "">("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token && id));
  const loadPermissions = useCallback(() => horseService.getPermissions(token!, id), [id, token]);
  const permissionsResource = useApiResource(loadPermissions, Boolean(token && id));
  const loadOwners = useCallback(() => usersService.list(token!), [token]);
  const ownersResource = useApiResource(loadOwners, Boolean(token));

  const activeOwners = useMemo(
    () =>
      (ownersResource.data ?? []).filter(
        (user: StaffDto) => user.role === "HORSE_OWNER" && user.status === "ACTIVE",
      ),
    [ownersResource.data],
  );

  const isReactivatingTransferred =
    horseResource.data?.lifecycleStatus === "TRANSFERRED" && action === "ACTIVE";

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    return q
      ? activeOwners.filter(
          (o: StaffDto) =>
            o.fullName.toLowerCase().includes(q) ||
            o.email.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q),
        )
      : activeOwners;
  }, [activeOwners, ownerSearch]);

  const chooseAction = (value: string) => {
    setAction(value as Action);
    setPreview(null);
    setReason("");
    setOwnerId("");
    setOwnerSearch("");
    setError("");
  };

  const getPreview = async () => {
    if (!token || !action || !horseResource.data || loadingPreview) return;
    setLoadingPreview(true);
    setError("");
    setPreview(null);
    try {
      if (action === "DELETE")
        setPreview({ kind: "delete", data: await horseService.previewDeletion(token, id) });
      else if (action === "RESTORE")
        setPreview({ kind: "restore", data: await horseService.previewRestore(token, id) });
      else
        setPreview({
          kind: "lifecycle",
          data: await horseService.previewLifecycle(token, id, action),
        });
    } catch (cause) {
      const message = extractErrorMessage(cause);
      setError(message);
      Alert.alert("Could not load preview", message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const previewAllowed =
    preview?.kind === "lifecycle"
      ? preview.data.allowed
      : preview?.kind === "delete"
        ? preview.data.allowed
        : preview?.kind === "restore";
  const save = async () => {
    if (!token || !action || !previewAllowed || !reason.trim() || saving) return;
    if (isReactivatingTransferred && !ownerId) {
      setError("Vui lòng chọn chủ sở hữu mới khi kích hoạt lại ngựa đã chuyển nhượng.");
      return;
    }
    if (reason.trim().length > 500) {
      setError("Reason must be 500 characters or fewer.");
      return;
    }
    const description =
      action === "DELETE"
        ? "Soft delete this horse profile?"
        : action === "RESTORE"
          ? "Restore this profile into the pending barn list?"
          : `Change lifecycle to ${action}?`;
    Alert.alert("Confirm lifecycle change", description, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: action === "DELETE" || action === "DECEASED" ? "destructive" : "default",
        onPress: () => void commit(),
      },
    ]);
  };

  const commit = async () => {
    if (!token || !action) return;
    setSaving(true);
    setError("");
    try {
      if (action === "DELETE") {
        await horseService.deleteHorse(token, id, reason.trim());
        Alert.alert(
          "Profile deleted",
          "The profile was soft-deleted. You can find and restore it with the deleted-profile filter.",
        );
        router.replace("/manager/horses");
      } else if (action === "RESTORE") {
        await horseService.restoreHorse(token, id, reason.trim());
        Alert.alert(
          "Profile restored",
          "The horse has returned to the active list and is pending barn assignment.",
        );
        safeBack(`/manager/horse/${id}` as Href);
      } else {
        await horseService.changeLifecycle(token, id, {
          lifecycleStatus: action,
          reason: reason.trim(),
          ...(isReactivatingTransferred ? { ownerId } : {}),
        });
        Alert.alert("Lifecycle updated", "Horse profile was refreshed.");
        safeBack(`/manager/horse/${id}` as Href);
      }
    } catch (cause) {
      const message = extractErrorMessage(cause);
      setError(message);
      Alert.alert("Could not update lifecycle", message);
    } finally {
      setSaving(false);
    }
  };

  const horse = horseResource.data;
  const permissions = permissionsResource.data;
  const actions: Action[] = horse?.isDeleted
    ? permissions?.canRestore
      ? ["RESTORE"]
      : []
    : [
        ...(permissions?.canChangeLifecycle
          ? LIFECYCLE.filter((status) => status !== horse?.lifecycleStatus)
          : []),
        ...(permissions?.canDelete ? ["DELETE" as const] : []),
      ];

  return (
    <Screen
      role="manager"
      title="Lifecycle and profile"
      subtitle={horse?.name ?? "Horse profile"}
      back
      fallbackHref={`/manager/horse/${id}` as Href}
      refreshing={horseResource.isRefreshing || permissionsResource.isRefreshing}
      onRefresh={() => void Promise.all([horseResource.refresh(), permissionsResource.refresh()])}
    >
      <AsyncStateView
        isLoading={horseResource.isLoading || permissionsResource.isLoading}
        error={horseResource.error ?? permissionsResource.error}
        onRetry={() => void Promise.all([horseResource.retry(), permissionsResource.retry()])}
      />
      {horse ? (
        <Panel style={{ gap: space.xs }}>
          <SectionTitle>Current profile state</SectionTitle>
          <Text>
            {horse.name} · {horse.lifecycleStatus} ·{" "}
            {horse.isDeleted ? "Soft deleted" : "Active profile"}
          </Text>
          {horse.lifecycleReason ? <Text>Latest reason: {horse.lifecycleReason}</Text> : null}
          {horse.dateOfDeath ? <Text>Date of death: {horse.dateOfDeath}</Text> : null}
        </Panel>
      ) : null}
      {actions.length ? (
        <Panel style={{ gap: space.sm }}>
          <SectionTitle>Chọn thao tác hệ thống</SectionTitle>
          <View style={{ gap: 14, marginTop: 12 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
              {actions.map((option) => {
                const selected = action === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => chooseAction(option)}
                    style={{
                      flexBasis: actions.length === 1 ? "100%" : "48%",
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      numberOfLines={2}
                      style={{
                        color: selected ? "#FFFFFF" : colors.mutedForeground,
                        fontSize: 12,
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      {formatEnum(t(option))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {action === "DECEASED" ? (
              <Text style={[uiStyles.muted, { color: colors.mutedForeground, fontSize: 13 }]}>
                Ngày mất sẽ được hệ thống tự động ghi nhận là ngày hôm nay theo lịch câu lạc bộ.
              </Text>
            ) : null}
            {isReactivatingTransferred ? (
              <Field label="Chủ sở hữu mới *">
                <Text style={[uiStyles.muted, { fontSize: 13, marginBottom: 4 }]}>
                  Bắt buộc chọn tài khoản chủ sở hữu đang hoạt động khi kích hoạt lại ngựa đã chuyển nhượng.
                </Text>
                {ownersResource.isLoading ? (
                  <Text style={uiStyles.muted}>Đang tải danh sách chủ sở hữu…</Text>
                ) : ownersResource.error ? (
                  <Text style={{ color: colors.destructive }}>
                    {extractErrorMessage(ownersResource.error)}
                  </Text>
                ) : (
                  <View style={{ gap: space.sm }}>
                    <NativeInput
                      value={ownerSearch}
                      onChangeText={setOwnerSearch}
                      placeholder="Tìm theo tên hoặc email chủ sở hữu…"
                    />
                    <View style={{ gap: space.xs }}>
                      {filteredOwners.slice(0, 6).map((owner: StaffDto) => {
                        const selected = ownerId === owner.id;
                        return (
                          <Chips
                            key={owner.id}
                            options={[`${owner.fullName} (${owner.email})`]}
                            value={selected ? `${owner.fullName} (${owner.email})` : ""}
                            onChange={() => {
                              setOwnerId(owner.id);
                              setOwnerSearch(owner.fullName);
                            }}
                          />
                        );
                      })}
                      {filteredOwners.length === 0 ? (
                        <Text style={uiStyles.muted}>Không tìm thấy chủ sở hữu phù hợp.</Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </Field>
            ) : null}
            <Field
              label={action === "DECEASED" ? "Cause of death · required" : "Reason · required"}
            >
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
              label={loadingPreview ? "Checking…" : "Preview consequences"}
              icon="eye"
              disabled={!action || loadingPreview || saving}
              onPress={() => void getPreview()}
            />
          </View>
        </Panel>
      ) : permissions ? (
        <Panel>
          <Text style={uiStyles.muted}>
            No lifecycle, delete or restore action is available for this profile and role.
          </Text>
        </Panel>
      ) : null}
      {preview ? <PreviewCard preview={preview} /> : null}
      {previewAllowed ? (
        <PrimaryButton
          label={
            saving
              ? "Saving…"
              : action === "DELETE"
                ? "Confirm soft delete"
                : action === "RESTORE"
                  ? "Confirm restore"
                  : "Confirm lifecycle change"
          }
          icon={action === "DELETE" ? "trash" : "checkmark"}
          disabled={saving || !reason.trim()}
          onPress={() => void save()}
        />
      ) : null}
    </Screen>
  );
}

function PreviewCard({ preview }: { preview: Preview }) {
  if (preview.kind === "delete") {
    const data = preview.data;
    const blockers = [
      data.transferred ? "Horse was transferred to another club." : "",
      data.deceased ? "A deceased horse profile must be retained." : "",
      data.businessData.length ? `Business data exists: ${data.businessData.join(", ")}.` : "",
      data.isParent ? "This horse is a parent in another horse profile." : "",
    ].filter(Boolean);
    return (
      <Panel>
        <SectionTitle>Deletion preview</SectionTitle>
        <Text>
          {data.allowed ? "Hệ thống cho phép xóa mềm hồ sơ." : "Hệ thống chặn thao tác xóa."}
        </Text>
        {blockers.map((item) => (
          <Text key={item}>• {item}</Text>
        ))}
        {data.allowed ? (
          <Text>
            The record will be hidden from roles other than Club Manager. Its microchip will not
            become available for reuse.
          </Text>
        ) : null}
      </Panel>
    );
  }
  if (preview.kind === "restore") {
    const data = preview.data;
    return (
      <Panel>
        <SectionTitle>Restore preview</SectionTitle>
        <Text>{data.summary}</Text>
        <Text>The horse returns to pending barn assignment.</Text>
        {data.barnCleared ? <Text>Barn cleared: {data.barnCleared}</Text> : null}
        {data.ownerCleared ? <Text>Owner cleared: {data.ownerCleared}</Text> : null}
      </Panel>
    );
  }
  const data = preview.data;
  return (
    <Panel>
      <SectionTitle>Lifecycle preview</SectionTitle>
      <Text>
        {data.allowed
          ? (data.summary ?? `Hệ thống cho phép chuyển từ ${data.from} → ${data.to}.`)
          : (data.blockedReason ?? "Hệ thống đã chặn chuyển đổi trạng thái này.")}
      </Text>
      {data.allowed ? (
        <View style={{ gap: 6, marginTop: 8 }}>
          {data.classesWithdrawn ? (
            <Text>Training classes withdrawn: {data.classesWithdrawn}</Text>
          ) : null}
          {data.raceRegistrationsWithdrawn ? (
            <Text>Future race registrations withdrawn: {data.raceRegistrationsWithdrawn}</Text>
          ) : null}
          {data.stallReleased ? <Text>Stall released: {data.stallReleased}</Text> : null}
          {data.groomEnded ? <Text>Groom assignment ended: {data.groomEnded}</Text> : null}
          {data.barnCleared ? <Text>Barn cleared: {data.barnCleared}</Text> : null}
          {data.trainingLockReleased ? <Text>Active training lock released.</Text> : null}
          {data.examRequestsDismissed ? (
            <Text>Pending exam requests dismissed: {data.examRequestsDismissed}</Text>
          ) : null}
          {data.careSchedulesCancelled ? (
            <Text>Care schedules cancelled: {data.careSchedulesCancelled}</Text>
          ) : null}
          {data.incidentsClosed ? (
            <Text>Stable incidents closed: {data.incidentsClosed}</Text>
          ) : null}
          {data.healthResetTo ? <Text>Health reset to: {data.healthResetTo}</Text> : null}
          {data.pendingBarnAfter ? <Text>Horse returns to pending barn assignment.</Text> : null}
          {data.ownerCleared ? <Text>Owner cleared: {data.ownerCleared}</Text> : null}
        </View>
      ) : null}
    </Panel>
  );
}
