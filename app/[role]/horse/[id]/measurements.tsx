import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  MiniChart,
  NativeInput,
  Panel,
  PrimaryButton,
  getUiStyles,
} from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService, type HorseMeasurementDto } from "@/services/horse.service";
import { isRole } from "@/features/auth/roles";
import { extractErrorMessage } from "@/utils/errorHandler";

const TYPES = ["WEIGHT", "HEIGHT", "BODY_CONDITION", "TEMPERATURE"] as const;
type MeasurementType = (typeof TYPES)[number];
const UNITS: Record<MeasurementType, string> = {
  WEIGHT: "kg",
  HEIGHT: "cm",
  BODY_CONDITION: "score",
  TEMPERATURE: "°C",
};
const TODAY = new Date().toISOString().slice(0, 10);

export default function BodyMeasurements() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const { token } = useAuth();
  const [values, setValues] = useState<Record<MeasurementType, string>>({
    WEIGHT: "",
    HEIGHT: "",
    BODY_CONDITION: "",
    TEMPERATURE: "",
  });
  const [measurementDate, setMeasurementDate] = useState(TODAY);
  const [confirmAbnormal, setConfirmAbnormal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [chartType, setChartType] = useState<MeasurementType>("WEIGHT");
  const [deleteId, setDeleteId] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token && id));
  const loadPermissions = useCallback(() => horseService.getPermissions(token!, id), [id, token]);
  const permissionsResource = useApiResource(loadPermissions, Boolean(token && id));
  const loadMeasurements = useCallback(
    () => horseService.listMeasurements(token!, id),
    [id, token],
  );
  const resource = useApiResource(loadMeasurements, Boolean(token && id));
  const chartData = useMemo(
    () =>
      (resource.data ?? [])
        .filter((item) => item.type === chartType)
        .slice()
        .reverse()
        .map((item) => ({ value: item.value })),
    [chartType, resource.data],
  );
  const latestByType = useMemo(() => {
    const latest = new Map<MeasurementType, HorseMeasurementDto>();
    for (const row of resource.data ?? []) if (!latest.has(row.type)) latest.set(row.type, row);
    return latest;
  }, [resource.data]);

  if (!isRole(role)) return <Redirect href="/" />;

  const updateValue = (type: MeasurementType, value: string) =>
    setValues((current) => ({ ...current, [type]: value }));
  const addMeasurement = async () => {
    const selected = TYPES.filter((type) => values[type].trim() !== "");
    if (!token || !selected.length || saving) {
      setFormError("Enter at least one measurement.");
      return;
    }
    const parsedDate = new Date(`${measurementDate}T12:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(measurementDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== measurementDate
    ) {
      setFormError("Measurement date must be valid and use YYYY-MM-DD format.");
      return;
    }
    const now = new Date();
    const daysOld = (now.getTime() - parsedDate.getTime()) / 86_400_000;
    if (daysOld < -0.5 || daysOld > 7.5) {
      setFormError("Backend accepts measurements from now back through the previous seven days.");
      return;
    }
    const parsedValues = selected.map((type) => ({ type, value: Number(values[type]) }));
    if (parsedValues.some((entry) => !Number.isFinite(entry.value))) {
      setFormError("Each measurement must be a number.");
      return;
    }
    const allowed: Record<MeasurementType, [number, number]> = {
      WEIGHT: [30, 1500],
      HEIGHT: [50, 250],
      BODY_CONDITION: [1, 9],
      TEMPERATURE: [30, 45],
    };
    if (
      parsedValues.some(
        (entry) => entry.value < allowed[entry.type][0] || entry.value > allowed[entry.type][1],
      )
    ) {
      setFormError("One or more values are outside the valid range defined by Backend.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const result = await horseService.addMeasurements(token, id, {
        values: parsedValues,
        measuredAt: parsedDate.toISOString(),
        ...(confirmAbnormal ? { confirmAbnormal: true } : {}),
      });
      const alerts = result.flatMap((measurement) =>
        measurement.alerts.map((alert) => alert.alert),
      );
      Alert.alert(
        "Measurements saved",
        alerts.length
          ? `Saved. Backend generated: ${alerts.join(", ")}.`
          : "Measurement history is up to date.",
      );
      setValues({ WEIGHT: "", HEIGHT: "", BODY_CONDITION: "", TEMPERATURE: "" });
      setConfirmAbnormal(false);
      await Promise.all([resource.refresh(), horseResource.refresh()]);
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert("Could not save measurements", message);
    } finally {
      setSaving(false);
    }
  };

  const removeMeasurement = async () => {
    if (!token || !deleteId || !deleteReason.trim() || deleting) return;
    setDeleting(true);
    setFormError("");
    try {
      await horseService.deleteMeasurement(token, id, deleteId, deleteReason.trim());
      Alert.alert("Measurement removed", "The history has been refreshed.");
      setDeleteId("");
      setDeleteReason("");
      await Promise.all([resource.refresh(), horseResource.refresh()]);
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert("Could not remove measurement", message);
    } finally {
      setDeleting(false);
    }
  };

  const canRecord = permissionsResource.data?.canRecordMeasurement === true;
  const canDelete = permissionsResource.data?.canDeleteMeasurement === true;

  return (
    <Screen
      role={role}
      title="Body measurements"
      subtitle={horseResource.data?.name ?? "Horse profile"}
      back
      fallbackHref={`/${role}/horse/${id}` as any}
      refreshing={
        resource.isRefreshing || horseResource.isRefreshing || permissionsResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          resource.refresh(),
          horseResource.refresh(),
          permissionsResource.refresh(),
        ])
      }
    >
      <AsyncStateView
        isLoading={resource.isLoading || horseResource.isLoading}
        error={resource.error ?? horseResource.error ?? permissionsResource.error}
        onRetry={() =>
          void Promise.all([resource.retry(), horseResource.retry(), permissionsResource.retry()])
        }
      />
      {resource.data ? (
        <>
          <View style={uiStyles.metricGrid}>
            {TYPES.map((type) => {
              const latest = latestByType.get(type);
              return (
                <Panel key={type}>
                  <Text style={uiStyles.label}>{type.replaceAll("_", " ")}</Text>
                  <Text style={styles.metricValue}>
                    {latest ? `${latest.value} ${latest.unit}` : "—"}
                  </Text>
                  <Text style={uiStyles.muted}>
                    {latest ? new Date(latest.measuredAt).toLocaleDateString() : "No value yet"}
                  </Text>
                </Panel>
              );
            })}
          </View>
          <Panel>
            <SectionTitle>Trend</SectionTitle>
            <Chips
              options={[...TYPES]}
              value={chartType}
              onChange={(value) => setChartType(value as MeasurementType)}
            />
            {chartData.length > 1 ? (
              <MiniChart data={chartData} valueKey="value" color={colors.primary} />
            ) : (
              <Text style={uiStyles.muted}>
                A trend appears after at least two measurements of the selected type.
              </Text>
            )}
          </Panel>
          <View style={{ gap: 12 }}>
            <SectionTitle>History</SectionTitle>
            {resource.data.length ? (
              resource.data.map((row) => (
                <Panel key={row.id}>
                  <View style={styles.recordHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordTitle}>
                        {row.type.replaceAll("_", " ")} · {row.value} {row.unit}
                      </Text>
                      <Text style={uiStyles.muted}>
                        {new Date(row.measuredAt).toLocaleString()} · {row.measuredByName} ·{" "}
                        {row.source.replaceAll("_", " ")}
                      </Text>
                    </View>
                    {row.isAbnormal ? <Text style={styles.alertLabel}>Abnormal</Text> : null}
                  </View>
                  {canDelete && row.source === "MANUAL" ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDeleteId(deleteId === row.id ? "" : row.id)}
                    >
                      <Text style={styles.deleteLink}>
                        {deleteId === row.id ? "Cancel remove" : "Remove incorrect record"}
                      </Text>
                    </Pressable>
                  ) : null}
                  {deleteId === row.id ? (
                    <View style={{ gap: 10, marginTop: 12 }}>
                      <Field label="Reason required">
                        <NativeInput
                          value={deleteReason}
                          onChangeText={setDeleteReason}
                          multiline
                          placeholder="Explain why this measurement is incorrect"
                        />
                      </Field>
                      <PrimaryButton
                        label={deleting ? "Removing…" : "Confirm removal"}
                        icon="trash"
                        disabled={deleting || !deleteReason.trim()}
                        onPress={() =>
                          Alert.alert(
                            "Remove measurement?",
                            "This record will be hidden from history and its charts.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => void removeMeasurement(),
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  ) : null}
                </Panel>
              ))
            ) : (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => undefined}
                empty
                emptyLabel="No body measurements are recorded."
              />
            )}
          </View>
        </>
      ) : null}
      {canRecord ? (
        <Panel>
          <SectionTitle>Add a measurement session</SectionTitle>
          <View style={{ gap: 14, marginTop: 12 }}>
            {TYPES.map((type) => (
              <Field key={type} label={`${type.replaceAll("_", " ")} (${UNITS[type]})`}>
                <NativeInput
                  value={values[type]}
                  onChangeText={(value) => updateValue(type, value)}
                  keyboardType="decimal-pad"
                  placeholder="Optional · enter a value"
                />
              </Field>
            ))}
            <Field label="Measurement date (YYYY-MM-DD)">
              <NativeInput
                value={measurementDate}
                onChangeText={setMeasurementDate}
                placeholder="YYYY-MM-DD"
              />
            </Field>
            <Chips
              options={["Do not confirm abnormal", "Confirm abnormal if Backend requires"]}
              value={
                confirmAbnormal ? "Confirm abnormal if Backend requires" : "Do not confirm abnormal"
              }
              onChange={(value) => setConfirmAbnormal(value.startsWith("Confirm"))}
            />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <PrimaryButton
              label={saving ? "Saving…" : "Save measurements"}
              icon="checkmark"
              disabled={saving}
              onPress={() => void addMeasurement()}
            />
          </View>
        </Panel>
      ) : permissionsResource.data ? (
        <Panel>
          <Text>Measurement entry is not available for this role on this horse.</Text>
        </Panel>
      ) : null}
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    metricValue: { color: colors.foreground, fontSize: 19, fontWeight: "800", marginVertical: 5 },
    recordHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    recordTitle: { color: colors.foreground, fontSize: 15, fontWeight: "700" },
    alertLabel: { color: colors.destructive, fontSize: 11, fontWeight: "800" },
    deleteLink: { color: colors.destructive, fontSize: 13, fontWeight: "700", marginTop: 10 },
    error: { color: colors.destructive, fontSize: 13 },
  });
