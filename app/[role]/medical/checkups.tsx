import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen } from "@/components/common";
import {
  DatePickerField,
  Field,
  NativeInput,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { showLocalizedAlert, useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { medicalService } from "@/services/medical.service";
import {
  clubDateTimeParts,
  isNotPastDateTime,
  isValidRequiredText,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime, formatEnum } from "@/utils/formatters";

type FilterTab = "ALL" | "OVERDUE" | "DUE_SOON";

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All due" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "DUE_SOON", label: "Due soon" },
];

export default function PeriodicCheckups() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { language } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [appointmentDefault] = useState(() =>
    clubDateTimeParts(new Date(Date.now() + 5 * 60 * 1000)),
  );
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(appointmentDefault.date);
  const [scheduledTime, setScheduledTime] = useState(appointmentDefault.time);
  const [reason, setReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      medicalService.listCheckups(token!, {
        ...(filter === "ALL" ? {} : { status: filter }),
      }),
    [filter, token],
  );

  const resource = useApiResource(
    load,
    Boolean(token && role && ["vet", "manager", "trainer"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);
  const checkups = useMemo(() => resource.data ?? [], [resource.data]);
  const overdueCount = useMemo(() => checkups.filter((c) => c.daysLeft < 0).length, [checkups]);
  const selected = checkups.find((item) => item.horseId === selectedHorseId) ?? null;

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer"].includes(role)) return <Redirect href={`/${role}` as Href} />;

  const saveAppointment = async () => {
    if (role !== "vet" || !selected || !token) return;
    const scheduledAt = toClubDateTime(scheduledDate, scheduledTime);
    if (!scheduledAt || !isNotPastDateTime(scheduledAt)) {
      showLocalizedAlert(
        language,
        "Invalid appointment time",
        "Choose a valid date and time that is not in the past.",
      );
      return;
    }
    if (selected.daysLeft >= 0 && scheduledDate > selected.dueDate) {
      showLocalizedAlert(
        language,
        "Appointment is after the due date",
        "A checkup that is not overdue must be scheduled on or before its due date.",
      );
      return;
    }
    if (selected.appointment && !isValidRequiredText(reason, 500)) {
      showLocalizedAlert(
        language,
        "Reschedule reason required",
        "Enter a reason to change an existing checkup appointment.",
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
      showLocalizedAlert(
        language,
        "Appointment saved",
        "The periodic checkup appointment was updated successfully.",
      );
    } catch (error) {
      showLocalizedAlert(language, "Could not save appointment", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const cancelAppointment = async () => {
    if (role !== "vet" || !selected?.appointment || !token) return;
    if (!isValidRequiredText(cancelReason, 500)) {
      showLocalizedAlert(
        language,
        "Cancellation reason required",
        "Enter a reason to cancel the appointment (up to 500 characters).",
      );
      return;
    }
    showLocalizedAlert(
      language,
      "Cancel checkup appointment?",
      "The appointment will be marked cancelled and will no longer appear in the Groom's schedule for today.",
      [
        { text: "Keep appointment", style: "cancel" },
        {
          text: "Cancel appointment",
          style: "destructive",
          onPress: () => {
            setSaving(true);
            void medicalService
              .cancelCheckupAppointment(token, selected.horseId, cancelReason.trim())
              .then(async () => {
                setSelectedHorseId("");
                setCancelReason("");
                await resource.refresh();
                showLocalizedAlert(
                  language,
                  "Appointment cancelled",
                  "The periodic checkup appointment was cancelled.",
                );
              })
              .catch((error) =>
                showLocalizedAlert(
                  language,
                  "Could not cancel appointment",
                  extractErrorMessage(error),
                ),
              )
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  return (
    <Screen
      role={role}
      title="Periodic checkups"
      subtitle="General health check cycle: 30 days"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        {filterTabs.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setFilter(tab.key);
                setSelectedHorseId("");
              }}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                {tab.label}
              </Text>
              {tab.key === "OVERDUE" && overdueCount > 0 ? (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {overdueCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {/* Cards List */}
      <View style={styles.cardsList}>
        {checkups.map((item) => {
          const isOverdue = item.daysLeft < 0;
          const isSelected = selectedHorseId === item.horseId;

          return (
            <View
              key={item.horseId}
              style={[
                styles.checkupCard,
                isOverdue && styles.checkupCardOverdue,
                isSelected && styles.checkupCardSelected,
              ]}
            >
              {/* Header row: Horse & Due Status Pill */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.horseRow}>
                  <View style={[styles.horseAvatar, isOverdue && styles.horseAvatarOverdue]}>
                    <Ionicons
                      name="paw"
                      size={18}
                      color={isOverdue ? colors.destructive : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.horseNameText}>{item.horseName}</Text>
                    <Text style={styles.horseStatusText}>
                      {formatEnum(item.healthStatus)}
                      {item.barnId ? " · Assigned to barn" : " · Not assigned to barn"}
                    </Text>
                  </View>
                </View>

                {/* Due status badge */}
                <View
                  style={[
                    styles.dueBadge,
                    isOverdue ? styles.dueBadgeOverdue : styles.dueBadgeNormal,
                  ]}
                >
                  <Ionicons
                    name={isOverdue ? "warning" : "time-outline"}
                    size={12}
                    color={isOverdue ? colors.destructive : colors.primary}
                  />
                  <Text
                    style={[
                      styles.dueBadgeText,
                      isOverdue ? styles.dueBadgeTextOverdue : styles.dueBadgeTextNormal,
                    ]}
                  >
                    {isOverdue
                      ? `${Math.abs(item.daysLeft)} days overdue`
                      : `${item.daysLeft} days remaining`}
                  </Text>
                </View>
              </View>

              {/* Due Date & Last Exam Info */}
              <View style={styles.datesBox}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Due date:</Text>
                  <Text style={[styles.dateVal, isOverdue && { color: colors.destructive }]}>
                    {formatDate(item.dueDate)}
                  </Text>
                </View>
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Last visit:</Text>
                  <Text style={styles.dateVal}>
                    {item.lastVisitDate ? formatDate(item.lastVisitDate) : "None yet"}
                  </Text>
                </View>
              </View>

              {/* Appointment Notice if any */}
              {item.appointment ? (
                <View style={styles.appointmentBox}>
                  <Ionicons name="calendar" size={15} color={colors.primary} />
                  <Text style={styles.appointmentText}>
                    Scheduled: {formatDateTime(item.appointment.scheduledAt)}
                  </Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              {role === "vet" ? (
                <View style={styles.cardActionsRow}>
                  <PrimaryButton
                    label="Check now"
                    icon="medkit-outline"
                    style={{ flex: 1 }}
                    onPress={() =>
                      router.push(
                        `/${role}/medical/visit?horseId=${item.horseId}&kind=ROUTINE` as Href,
                      )
                    }
                  />
                  <SecondaryButton
                    label={item.appointment ? "Reschedule" : "Set appointment"}
                    icon="calendar-outline"
                    onPress={() => {
                      const parts = item.appointment
                        ? clubDateTimeParts(new Date(item.appointment.scheduledAt))
                        : appointmentDefault;
                      setScheduledDate(parts.date);
                      setScheduledTime(parts.time);
                      setReason("");
                      setCancelReason("");
                      setSelectedHorseId((current) =>
                        current === item.horseId ? "" : item.horseId,
                      );
                    }}
                  />
                </View>
              ) : null}

              {/* Appointment Drawer */}
              {isSelected ? (
                <View style={styles.appointmentDrawer}>
                  <Text style={styles.drawerTitle}>
                    {item.appointment ? "Reschedule periodic checkup" : "Schedule periodic checkup"}
                  </Text>
                  <Field label="Appointment date (YYYY-MM-DD)">
                    <DatePickerField
                      value={scheduledDate}
                      onChangeText={setScheduledDate}
                      placeholder="YYYY-MM-DD"
                      outputFormat="YYYY-MM-DD"
                      title="Choose checkup date"
                    />
                  </Field>
                  <Field label="Appointment time (HH:mm)">
                    <NativeInput
                      value={scheduledTime}
                      onChangeText={setScheduledTime}
                      placeholder="09:30"
                    />
                  </Field>
                  {item.appointment ? (
                    <Field label="Reschedule reason *">
                      <NativeInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Enter the reason for changing this appointment"
                        multiline
                      />
                    </Field>
                  ) : null}
                  <PrimaryButton
                    label={saving ? "Saving…" : "Confirm appointment"}
                    disabled={saving}
                    onPress={() => void saveAppointment()}
                  />
                  {item.appointment ? (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <Field label="Cancellation reason *">
                        <NativeInput
                          value={cancelReason}
                          onChangeText={setCancelReason}
                          placeholder="Enter the reason for cancelling this appointment"
                          multiline
                          maxLength={500}
                        />
                      </Field>
                      <SecondaryButton
                        label={saving ? "Cancelling…" : "Cancel appointment"}
                        icon="close-circle-outline"
                        disabled={saving || !cancelReason.trim()}
                        onPress={() => void cancelAppointment()}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {resource.data && !checkups.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={44} color={colors.primary} />
            <Text style={styles.emptyTitle}>All horses are up to date</Text>
            <Text style={styles.emptySubtitle}>
              No horses are due for a periodic checkup in this cycle.
            </Text>
          </View>
        ) : null}
      </View>

      {/* System Note */}
      <View style={styles.infoNoteCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.infoNoteText}>
          Periodic checkups run every 30 days. When the veterinarian completes a routine visit, the
          related appointment is marked complete automatically.
        </Text>
      </View>
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    tabContainer: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 3,
      marginBottom: space.sm,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: radius.pill,
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    tabTextActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    tabBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
      minWidth: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBadgeActive: {
      backgroundColor: "rgba(255,255,255,0.25)",
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.foreground,
    },
    tabBadgeTextActive: {
      color: "#ffffff",
    },
    cardsList: {
      gap: space.sm,
    },
    checkupCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    checkupCardOverdue: {
      borderColor: colors.destructive,
      backgroundColor: colors.injuredSoft,
    },
    checkupCardSelected: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    horseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      flex: 1,
    },
    horseAvatar: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    horseAvatarOverdue: {
      backgroundColor: colors.injuredSoft,
    },
    horseNameText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    horseStatusText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    dueBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    dueBadgeOverdue: {
      backgroundColor: colors.injuredSoft,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    dueBadgeNormal: {
      backgroundColor: colors.fitSoft,
    },
    dueBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    dueBadgeTextOverdue: {
      color: colors.destructive,
    },
    dueBadgeTextNormal: {
      color: colors.primary,
    },
    datesBox: {
      flexDirection: "row",
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      justifyContent: "space-between",
    },
    dateCol: {
      gap: 2,
    },
    dateLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    dateVal: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    appointmentBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.fitSoft,
      padding: space.xs,
      borderRadius: radius.sm,
    },
    appointmentText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    cardActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginTop: 2,
    },
    appointmentDrawer: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: space.xs,
      marginTop: space.xs,
    },
    drawerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 4,
    },
    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      padding: space.xl,
      gap: space.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: space.sm,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: space.xs,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    infoNoteCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      marginTop: space.md,
    },
    infoNoteText: {
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 18,
      flex: 1,
    },
  });
}
