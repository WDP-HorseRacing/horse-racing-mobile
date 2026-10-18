import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { isRole } from "@/features/auth/roles";
import { medicalService } from "@/services/medical.service";
import {
  clubDateTimeParts,
  isNotPastDateTime,
  isValidRequiredText,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime } from "@/utils/formatters";

export default function PeriodicCheckups() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const [appointmentDefault] = useState(() =>
    clubDateTimeParts(new Date(Date.now() + 5 * 60 * 1000)),
  );
  const [status, setStatus] = useState("All due");
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(appointmentDefault.date);
  const [scheduledTime, setScheduledTime] = useState(appointmentDefault.time);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(
    () =>
      medicalService.listCheckups(token!, {
        ...(status === "All due" ? {} : { status: status as "DUE_SOON" | "OVERDUE" }),
      }),
    [status, token],
  );
  const resource = useApiResource(
    load,
    Boolean(token && role && ["vet", "manager", "trainer"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);
  const selected = resource.data?.find((item) => item.horseId === selectedHorseId) ?? null;

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer"].includes(role)) return <Redirect href={`/${role}` as Href} />;

  const saveAppointment = async () => {
    if (role !== "vet" || !selected || !token) return;
    const scheduledAt = toClubDateTime(scheduledDate, scheduledTime);
    if (!scheduledAt || !isNotPastDateTime(scheduledAt)) {
      Alert.alert("Invalid appointment", "Choose a valid date and time that is not in the past.");
      return;
    }
    if (selected.daysLeft >= 0 && scheduledDate > selected.dueDate) {
      Alert.alert(
        "Appointment is after the due date",
        "A checkup that is not overdue must be scheduled by its due date.",
      );
      return;
    }
    if (selected.appointment && !isValidRequiredText(reason, 500)) {
      Alert.alert(
        "Reason required",
        "Enter a reason up to 500 characters when moving an existing appointment.",
      );
      return;
    }
    setSaving(true);
    try {
      await medicalService.setCheckupAppointment(token, selected.horseId, {
        scheduledAt,
        ...(selected.appointment ? { reason: reason.trim() } : {}),
      });
      setSelectedHorseId("");
      setReason("");
      await resource.refresh();
      Alert.alert("Appointment saved", "The checkup appointment has been updated.");
    } catch (error) {
      Alert.alert("Could not save appointment", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role={role}
      title="Periodic checkups"
      subtitle="Fixed 30-day routine cycle"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      <Chips options={["All due", "OVERDUE", "DUE_SOON"]} value={status} onChange={setStatus} />
      <View style={uiStyles.section}>
        <SectionTitle>Checkups due</SectionTitle>
        {(resource.data ?? []).map((item) => (
          <Panel key={item.horseId}>
            <Text style={uiStyles.value}>
              {item.horseName} · {item.healthStatus.replaceAll("_", " ")}
            </Text>
            <Text style={uiStyles.muted}>
              Last visit {item.lastVisitDate ? formatDate(item.lastVisitDate) : "not recorded"} ·
              due {formatDate(item.dueDate)}
            </Text>
            <Text
              style={{
                ...uiStyles.label,
                color: item.daysLeft < 0 ? colors.destructive : colors.monitor,
              }}
            >
              {item.daysLeft < 0
                ? `${Math.abs(item.daysLeft)} days overdue`
                : `${item.daysLeft} days remaining`}{" "}
              · {item.barnId ? "Barn assigned" : "No barn"}
            </Text>
            <Text style={uiStyles.muted}>
              {item.appointment
                ? `Appointment ${formatDateTime(item.appointment.scheduledAt)}`
                : "No appointment set"}
            </Text>
            {role === "vet" ? (
              <SecondaryButton
                label={item.appointment ? "Reschedule" : "Set appointment"}
                onPress={() => {
                  const parts = item.appointment
                    ? clubDateTimeParts(new Date(item.appointment.scheduledAt))
                    : appointmentDefault;
                  setScheduledDate(parts.date);
                  setScheduledTime(parts.time);
                  setReason("");
                  setSelectedHorseId((current) => (current === item.horseId ? "" : item.horseId));
                }}
              />
            ) : null}
            {role === "vet" ? (
              <SecondaryButton
                label="Perform routine checkup"
                icon="medkit-outline"
                onPress={() =>
                  router.push(`/${role}/medical/visit?horseId=${item.horseId}&kind=ROUTINE` as Href)
                }
              />
            ) : null}
            {selectedHorseId === item.horseId ? (
              <View style={{ gap: 10, marginTop: 12 }}>
                <Field label="Appointment date (YYYY-MM-DD)">
                  <NativeInput
                    value={scheduledDate}
                    onChangeText={setScheduledDate}
                    placeholder="2026-10-20"
                  />
                </Field>
                <Field label="Appointment time (24-hour)">
                  <NativeInput
                    value={scheduledTime}
                    onChangeText={setScheduledTime}
                    placeholder="09:30"
                  />
                </Field>
                {item.appointment ? (
                  <Field label="Reason for rescheduling">
                    <NativeInput value={reason} onChangeText={setReason} multiline />
                  </Field>
                ) : null}
                <PrimaryButton
                  label={saving ? "Saving…" : "Save appointment"}
                  disabled={saving}
                  onPress={() => void saveAppointment()}
                />
              </View>
            ) : null}
          </Panel>
        ))}
        {resource.data && !resource.data.length ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel="No periodic checkups are due."
          />
        ) : null}
      </View>
      <Panel>
        <Text style={uiStyles.muted}>
          The Backend contract supports setting and rescheduling appointments. It does not expose a
          manual appointment-cancel endpoint; visits complete the active appointment automatically.
        </Text>
      </Panel>
    </Screen>
  );
}
