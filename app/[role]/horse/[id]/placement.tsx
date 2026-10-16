import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Field, NativeInput, Panel, PrimaryButton } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService, type HorseBarnPreviewDto } from "@/services/horse.service";
import { stableService } from "@/services/stable.service";
import { isRole } from "@/features/auth/roles";
import { extractErrorMessage } from "@/utils/errorHandler";

export default function HorsePlacement() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
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
  const availableBarns = useMemo(
    () =>
      (barnsResource.data ?? []).filter(
        (barn) =>
          barn.status === "ACTIVE" && barn.hasActiveHeadTrainer && barn.availableStallCount > 0,
      ),
    [barnsResource.data],
  );
  const availableStalls = useMemo(
    () => (stallsResource.data ?? []).filter((stall) => stall.status === "AVAILABLE"),
    [stallsResource.data],
  );

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
      setPreviewError(extractErrorMessage(error));
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
      "Confirm barn assignment",
      preview.summary ?? `Assign this horse to ${preview.toBarnName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => void saveBarn() },
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
        "Barn updated",
        "The horse is now assigned to the selected barn. The Backend places it in pending stall assignment.",
      );
      await horseResource.refresh();
      router.back();
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert("Could not assign barn", message);
    } finally {
      setSaving(false);
    }
  };

  const placeHorse = async () => {
    if (!token || !stallId || !groomId || saving) return;
    setSaving(true);
    setFormError("");
    Alert.alert(
      "Confirm stall and Groom assignment",
      "The Backend applies both changes in one transaction. If either change fails, neither is saved.",
      [
        { text: "Cancel", style: "cancel", onPress: () => setSaving(false) },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await horseService.placeHorse(token, id, { stallId, groomId });
              Alert.alert("Placement updated", "Stall and Groom assignments have been refreshed.");
              await horseResource.refresh();
              router.back();
            } catch (error) {
              const message = extractErrorMessage(error);
              setFormError(message);
              Alert.alert("Could not update placement", message);
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
              <Text>No active barn meets the Backend assignment requirements.</Text>
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
          <SectionTitle>Assign a stall and Groom</SectionTitle>
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
                  <Chips
                    options={availableStalls.map((stall) => `${stall.code} · ${stall.type}`)}
                    value={
                      availableStalls.find((stall) => stall.id === stallId)
                        ? `${availableStalls.find((stall) => stall.id === stallId)!.code} · ${availableStalls.find((stall) => stall.id === stallId)!.type}`
                        : ""
                    }
                    onChange={(value) =>
                      setStallId(
                        availableStalls.find((stall) => `${stall.code} · ${stall.type}` === value)
                          ?.id ?? "",
                      )
                    }
                  />
                ) : (
                  <Text>
                    No available stall in this barn. Backend decides stall capacity and conflicts.
                  </Text>
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
                  <Chips
                    options={groomsResource.data.map(
                      (groom) => `${groom.fullName} · ${groom.activeHorseCount}`,
                    )}
                    value={
                      groomsResource.data.find((groom) => groom.groomId === groomId)
                        ? `${groomsResource.data.find((groom) => groom.groomId === groomId)!.fullName} · ${groomsResource.data.find((groom) => groom.groomId === groomId)!.activeHorseCount}`
                        : ""
                    }
                    onChange={(value) =>
                      setGroomId(
                        groomsResource.data?.find(
                          (groom) => `${groom.fullName} · ${groom.activeHorseCount}` === value,
                        )?.groomId ?? "",
                      )
                    }
                  />
                ) : (
                  <Text>No active Grooms are available.</Text>
                )}
              </Field>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <PrimaryButton
                label={saving ? "Saving…" : "Confirm stall and Groom"}
                icon="checkmark"
                disabled={saving || !stallId || !groomId}
                onPress={() => void placeHorse()}
              />
            </View>
          ) : (
            <Text>Assign the horse to a barn before choosing its stall and Groom.</Text>
          )}
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
          ? (preview.summary ?? "Backend allows this assignment.")
          : (preview.blockedReason ?? "Backend blocked this assignment.")}
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
