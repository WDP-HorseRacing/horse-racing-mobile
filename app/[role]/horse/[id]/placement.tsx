import { Redirect, useLocalSearchParams, type Href } from "expo-router";
import { safeBack } from "@/utils/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Field, NativeInput, Panel, PrimaryButton, SecondaryButton } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService, type HorseBarnPreviewDto } from "@/services/horse.service";
import { stableService } from "@/services/stable.service";
import { isRole } from "@/features/auth/roles";
import { extractErrorMessage } from "@/utils/errorHandler";

const PLACEMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_BARN: "Awaiting barn",
  PENDING_STALL: "Awaiting stall",
  PENDING_GROOM: "Awaiting Groom",
  PLACED: "Placed",
  NOT_APPLICABLE: "Not applicable",
};

export default function HorsePlacement() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const { t } = useI18n();
  const { token } = useAuth();
  const [barnId, setBarnId] = useState("");
  const [reason, setReason] = useState("");
  const [stallId, setStallId] = useState("");
  const [groomId, setGroomId] = useState("");
  const [previewRequested, setPreviewRequested] = useState(false);
  const [barnPreview, setBarnPreview] = useState<HorseBarnPreviewDto | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token && id));
  const loadPermissions = useCallback(() => horseService.getPermissions(token!, id), [id, token]);
  const permissionsResource = useApiResource(loadPermissions, Boolean(token && id));
  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(loadBarns, Boolean(token) && role === "manager");
  const barnIdForQuery = horseResource.data?.location.barn?.id;
  const loadStalls = useCallback(
    () => stableService.listBarnStalls(token!, barnIdForQuery!),
    [barnIdForQuery, token],
  );
  const stallsResource = useApiResource(
    loadStalls,
    Boolean(token && barnIdForQuery) && role === "trainer",
  );
  const loadGrooms = useCallback(() => stableService.listGroomWorkload(token!), [token]);
  const groomsResource = useApiResource(loadGrooms, Boolean(token) && role === "trainer");

  const currentStall = horseResource.data?.location.stall;
  const currentGroom = horseResource.data?.groom;
  const isPlaced = horseResource.data?.location.placementStatus === "PLACED";
  const stallChanged = Boolean(stallId) && stallId !== currentStall?.id;
  const groomChanged = Boolean(groomId) && groomId !== currentGroom?.id;

  useEffect(() => {
    if (horseResource.data) {
      if (horseResource.data.location.stall?.id && !stallId) {
        setStallId(horseResource.data.location.stall.id);
      }
      if (horseResource.data.groom?.id && !groomId) {
        setGroomId(horseResource.data.groom.id);
      }
    }
  }, [horseResource.data]);

  const availableBarns = useMemo(
    () =>
      (barnsResource.data ?? []).filter(
        (barn) =>
          barn.status === "ACTIVE" && barn.hasActiveHeadTrainer && barn.availableStallCount > 0,
      ),
    [barnsResource.data],
  );

  const availableStalls = useMemo(() => {
    const rawStalls = stallsResource.data ?? [];
    return rawStalls.filter(
      (stall) => stall.status === "AVAILABLE" || (currentStall && stall.id === currentStall.id),
    );
  }, [stallsResource.data, currentStall]);

  const stallOptions = useMemo(
    () =>
      availableStalls.map((stall) =>
        stall.id === currentStall?.id
          ? `${stall.code} · ${stall.type} (${t("Current")})`
          : `${stall.code} · ${stall.type}`,
      ),
    [availableStalls, currentStall, t],
  );

  const selectedStallOption = useMemo(() => {
    const found = availableStalls.find((stall) => stall.id === stallId);
    if (!found) return "";
    return found.id === currentStall?.id
      ? `${found.code} · ${found.type} (${t("Current")})`
      : `${found.code} · ${found.type}`;
  }, [availableStalls, stallId, currentStall, t]);

  const groomOptions = useMemo(
    () =>
      (groomsResource.data ?? []).map((groom) =>
        groom.groomId === currentGroom?.id
          ? `${groom.fullName} · ${groom.activeHorseCount} (${t("Current")})`
          : `${groom.fullName} · ${groom.activeHorseCount}`,
      ),
    [groomsResource.data, currentGroom, t],
  );

  const selectedGroomOption = useMemo(() => {
    const found = (groomsResource.data ?? []).find((groom) => groom.groomId === groomId);
    if (!found) return "";
    return found.groomId === currentGroom?.id
      ? `${found.fullName} · ${found.activeHorseCount} (${t("Current")})`
      : `${found.fullName} · ${found.activeHorseCount}`;
  }, [groomsResource.data, groomId, currentGroom, t]);

  if (!isRole(role)) return <Redirect href="/" />;

  const requestPreview = async () => {
    if (!barnId) return;
    setPreviewError("");
    setPreviewRequested(true);
    try {
      const preview = await horseService.previewBarn(token!, id, barnId);
      setBarnPreview(preview);
      await confirmBarnChange(preview);
    } catch (error) {
      setPreviewError(t(extractErrorMessage(error)));
    } finally {
      setPreviewRequested(false);
    }
  };

  const confirmBarnChange = async (preview: HorseBarnPreviewDto) => {
    if (!preview.allowed) return;
    const isChange = Boolean(horseResource.data?.location.barn);
    if (isChange && !reason.trim()) {
      setFormError("A reason is required when changing a horse’s barn.");
      return;
    }
    Alert.alert(
      t("Confirm barn assignment"),
      preview.summary ?? `Assign this horse to ${preview.toBarnName}?`,
      [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Confirm"), onPress: () => void saveBarn() },
      ],
    );
  };

  const saveBarn = async () => {
    if (!token || !barnId || saving) return;
    setSaving(true);
    setFormError("");
    try {
      await horseService.assignBarn(token, id, barnId, reason.trim() || undefined);
      Alert.alert(
        t("Barn updated"),
        t("Ngựa đã được phân vào khu chuồng đã chọn và chuyển sang trạng thái chờ xếp ô."),
      );
      await horseResource.refresh();
      safeBack(`/${role}/horse/${id}` as Href);
    } catch (error) {
      const message = t(extractErrorMessage(error));
      setFormError(message);
      Alert.alert(t("Could not assign barn"), message);
    } finally {
      setSaving(false);
    }
  };

  const saveStallOnly = async () => {
    if (!token || !stallChanged || saving) return;
    setSaving(true);
    setFormError("");
    try {
      await horseService.assignStall(token, id, stallId);
      Alert.alert(t("Stall updated"), t("Ô chuồng của ngựa đã được cập nhật thành công."));
      await horseResource.refresh();
      safeBack(`/${role}/horse/${id}` as Href);
    } catch (error) {
      const message = t(extractErrorMessage(error));
      setFormError(message);
      Alert.alert(t("Could not update stall"), message);
    } finally {
      setSaving(false);
    }
  };

  const saveGroomOnly = async () => {
    if (!token || !groomChanged || saving) return;
    setSaving(true);
    setFormError("");
    try {
      await horseService.assignGroom(token, id, groomId);
      Alert.alert(t("Groom updated"), t("Groom phụ trách ngựa đã được cập nhật thành công."));
      await horseResource.refresh();
      safeBack(`/${role}/horse/${id}` as Href);
    } catch (error) {
      const message = t(extractErrorMessage(error));
      setFormError(message);
      Alert.alert(t("Could not update groom"), message);
    } finally {
      setSaving(false);
    }
  };

  const placeHorse = async () => {
    if (!token || (!stallChanged && !groomChanged) || saving) return;
    if (stallChanged && !groomChanged) {
      await saveStallOnly();
      return;
    }
    if (!stallChanged && groomChanged) {
      await saveGroomOnly();
      return;
    }
    setSaving(true);
    setFormError("");
    Alert.alert(
      t("Confirm stall and Groom assignment"),
      t("Hệ thống áp dụng phân ô chuồng và giao Groom đồng thời."),
      [
        { text: t("Cancel"), style: "cancel", onPress: () => setSaving(false) },
        {
          text: t("Confirm"),
          onPress: async () => {
            try {
              await horseService.placeHorse(token, id, { stallId, groomId });
              Alert.alert(t("Placement updated"), t("Stall and Groom assignments have been refreshed."));
              await horseResource.refresh();
              safeBack(`/${role}/horse/${id}` as Href);
            } catch (error) {
              const message = t(extractErrorMessage(error));
              setFormError(message);
              Alert.alert(t("Could not update placement"), message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const canAssignBarn = role === "manager" && permissionsResource.data?.canAssignBarn === true;
  const canPlace = role === "trainer" && permissionsResource.data?.canAssignStallAndGroom === true;

  return (
    <Screen
      role={role}
      title={role === "manager" ? "Assign barn" : "Stall and Groom"}
      subtitle={horseResource.data?.name ?? "Horse profile"}
      back
      fallbackHref={`/${role}/horse/${id}` as Href}
      refreshing={
        horseResource.isRefreshing ||
        permissionsResource.isRefreshing ||
        barnsResource.isRefreshing ||
        stallsResource.isRefreshing ||
        groomsResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          horseResource.refresh(),
          permissionsResource.refresh(),
          barnsResource.refresh(),
          stallsResource.refresh(),
          groomsResource.refresh(),
        ])
      }
    >
      <AsyncStateView
        isLoading={horseResource.isLoading || permissionsResource.isLoading}
        error={horseResource.error ?? permissionsResource.error}
        onRetry={() => void Promise.all([horseResource.retry(), permissionsResource.retry()])}
      />
      {horseResource.data ? (
        <Panel>
          <SectionTitle>Current placement</SectionTitle>
          <Text>
            {horseResource.data.location.barn?.name ?? "No barn assigned"} ·{" "}
            {horseResource.data.location.stall?.code ?? "Pending stall assignment"}
          </Text>
          <Text>Groom: {horseResource.data.groom?.fullName ?? "Not assigned"}</Text>
        </Panel>
      ) : null}

      {canAssignBarn ? (
        <Panel>
          <SectionTitle>Assign or transfer barn</SectionTitle>
          <Text>
            Target barns must be active, have an active Head Trainer and report available stall
            capacity. A barn transfer returns the current stall and places the horse in pending
            stall assignment; the current Groom is kept.
          </Text>
          <View style={{ gap: 14, marginTop: 14 }}>
            {barnsResource.isLoading || barnsResource.error ? (
              <AsyncStateView
                isLoading={barnsResource.isLoading}
                error={barnsResource.error}
                onRetry={() => void barnsResource.retry()}
              />
            ) : availableBarns.length ? (
              availableBarns.map((barn) => (
                <Pressable
                  key={barn.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setBarnId(barn.id);
                    setBarnPreview(null);
                    setPreviewRequested(false);
                    setPreviewError("");
                    setFormError("");
                  }}
                  style={[styles.option, barnId === barn.id && styles.optionSelected]}
                >
                  <Text style={barnId === barn.id ? styles.selectedTitle : styles.optionTitle}>
                    {barn.name}
                  </Text>
                  <Text style={styles.optionCopy}>
                    {barn.availableStallCount} available stalls · Head Trainer{" "}
                    {barn.headTrainerFullName ?? "not assigned"}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text>Không có khu chuồng nào phù hợp với yêu cầu phân công.</Text>
            )}
            {horseResource.data?.location.barn ? (
              <Field label="Reason for changing barn">
                <NativeInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder="Required for a barn transfer"
                />
              </Field>
            ) : null}
            {previewError ? <Text style={styles.error}>{previewError}</Text> : null}
            {barnPreview ? <BarnPreview preview={barnPreview} /> : null}
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <PrimaryButton
              label={previewRequested ? "Checking…" : saving ? "Saving…" : "Preview and assign"}
              icon="business"
              disabled={!barnId || saving || previewRequested}
              onPress={() => void requestPreview()}
            />
          </View>
        </Panel>
      ) : null}

      {canPlace ? (
        <Panel>
          <SectionTitle>{isPlaced ? "Change stall or Groom" : "Assign a stall and Groom"}</SectionTitle>
          {barnIdForQuery ? (
            <View style={{ gap: 14, marginTop: 12 }}>
              <Field label="Available stall">
                {stallsResource.isLoading || stallsResource.error ? (
                  <AsyncStateView
                    isLoading={stallsResource.isLoading}
                    error={stallsResource.error}
                    onRetry={() => void stallsResource.retry()}
                  />
                ) : availableStalls.length ? (
                  <View style={{ gap: 8 }}>
                    <Chips
                      options={stallOptions}
                      value={selectedStallOption}
                      onChange={(value) => {
                        const matched = availableStalls.find(
                          (stall) =>
                            `${stall.code} · ${stall.type}` === value ||
                            `${stall.code} · ${stall.type} (${t("Current")})` === value,
                        );
                        setStallId(matched?.id ?? "");
                      }}
                    />
                    {stallChanged ? (
                      <SecondaryButton
                        label={saving ? t("Saving…") : t("Save stall only")}
                        icon="checkmark-outline"
                        disabled={saving}
                        onPress={() => void saveStallOnly()}
                      />
                    ) : null}
                  </View>
                ) : (
                  <Text>Khu chuồng này hiện không còn ô chuồng trống phù hợp.</Text>
                )}
              </Field>
              <Field label="Groom · horse count across club">
                {groomsResource.isLoading || groomsResource.error ? (
                  <AsyncStateView
                    isLoading={groomsResource.isLoading}
                    error={groomsResource.error}
                    onRetry={() => void groomsResource.retry()}
                  />
                ) : groomsResource.data?.length ? (
                  <View style={{ gap: 8 }}>
                    <Chips
                      options={groomOptions}
                      value={selectedGroomOption}
                      onChange={(value) => {
                        const matched = (groomsResource.data ?? []).find(
                          (groom) =>
                            `${groom.fullName} · ${groom.activeHorseCount}` === value ||
                            `${groom.fullName} · ${groom.activeHorseCount} (${t("Current")})` === value,
                        );
                        setGroomId(matched?.groomId ?? "");
                      }}
                    />
                    {groomChanged ? (
                      <SecondaryButton
                        label={saving ? t("Saving…") : t("Save Groom only")}
                        icon="checkmark-outline"
                        disabled={saving}
                        onPress={() => void saveGroomOnly()}
                      />
                    ) : null}
                  </View>
                ) : (
                  <Text>No active Grooms are available.</Text>
                )}
              </Field>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <PrimaryButton
                label={
                  saving
                    ? t("Saving…")
                    : !stallChanged && !groomChanged
                      ? t("No changes")
                      : stallChanged && groomChanged
                        ? t("Confirm stall and Groom")
                        : stallChanged
                          ? t("Save stall only")
                          : t("Save Groom only")
                }
                icon="checkmark"
                disabled={saving || (!stallChanged && !groomChanged)}
                onPress={() => void placeHorse()}
              />
            </View>
          ) : (
            <Text>Assign the horse to a barn before choosing its stall and Groom.</Text>
          )}
        </Panel>
      ) : null}
      {role === "manager" && horseResource.data?.location.barn ? (
        <Panel>
          <SectionTitle>{t("Stall and Groom management")}</SectionTitle>
          <Text style={{ fontWeight: "700", color: colors.primary, marginBottom: 4 }}>
            {t("Status")}: {t(
              PLACEMENT_STATUS_LABELS[horseResource.data.location.placementStatus] ??
                horseResource.data.location.placementStatus,
            )}
          </Text>
          <Text>
            {t(
              "Ngựa đã được phân vào khu {barnName}. Việc xếp ô chuồng và giao Groom do Huấn luyện viên trưởng phụ trách khu này thực hiện.",
            ).replace("{barnName}", horseResource.data.location.barn.name)}
          </Text>
        </Panel>
      ) : null}
      {!canAssignBarn && !canPlace && permissionsResource.data ? (
        <Panel>
          <Text>This role does not have placement permission for this horse.</Text>
        </Panel>
      ) : null}
    </Screen>
  );
}

function BarnPreview({ preview }: { preview: HorseBarnPreviewDto }) {
  return (
    <Panel>
      <Text style={{ fontWeight: "800" }}>
        {preview.allowed ? "Preview" : "Assignment blocked"}
      </Text>
      <Text>
        {preview.allowed
          ? (preview.summary ?? "Hệ thống xác nhận cho phép phân công này.")
          : (preview.blockedReason ?? "Hệ thống chặn phân công này.")}
      </Text>
      {preview.stallReleased ? <Text>Stall released: {preview.stallReleased}</Text> : null}
      {preview.classesWithdrawn ? (
        <Text>Training classes withdrawn: {preview.classesWithdrawn}</Text>
      ) : null}
      {preview.groomKept ? <Text>Groom retained: {preview.groomKept}</Text> : null}
      {preview.newHeadTrainerName ? <Text>Head Trainer: {preview.newHeadTrainerName}</Text> : null}
    </Panel>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    option: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 5,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.fitSoft },
    optionTitle: { color: colors.foreground, fontWeight: "700" },
    selectedTitle: { color: colors.primary, fontWeight: "800" },
    optionCopy: { color: colors.mutedForeground, fontSize: 12 },
    error: { color: colors.destructive, fontSize: 13 },
  });
