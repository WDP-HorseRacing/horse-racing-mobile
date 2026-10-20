import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen } from "@/components/common";
import {
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { groomService } from "@/services/groom.service";
import { orderedMeals, stableCareService } from "@/services/stable-care.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime, formatTime } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

export default function GroomTasks() {
  const { token } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const loadToday = useCallback(() => groomService.getToday(token!), [token]);
  const resource = useApiResource(loadToday, Boolean(token));

  const [selectedHorseId, setSelectedHorseId] = useState<string>("ALL");
  const [expandedTaskDetails, setExpandedTaskDetails] = useState<Record<string, boolean>>({});
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const horses = useMemo(() => resource.data?.horses ?? [], [resource.data?.horses]);
  const tracked = useMemo(() => horses.flatMap((horse) => horse.checklist?.items ?? []), [horses]);
  const done = useMemo(() => tracked.filter((item) => item.done).length, [tracked]);
  const progress = tracked.length ? Math.round((done / tracked.length) * 100) : 0;

  const filteredHorses = useMemo(() => {
    if (selectedHorseId === "ALL") return horses;
    return horses.filter((h) => h.horseId === selectedHorseId);
  }, [horses, selectedHorseId]);

  const updateChecklist = async (itemId: string, nextDone: boolean, itemNote?: string | null) => {
    if (!token) return;
    setBusyId(itemId);
    try {
      await stableCareService.tickChecklistItem(token, itemId, {
        done: nextDone,
        ...(itemNote !== undefined ? { note: itemNote } : {}),
      });
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not update checklist"), extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const actOnRun = async (participantId: string, action: "check-in" | "ready") => {
    setBusyId(participantId);
    try {
      if (action === "check-in") await groomService.checkIn(token!, participantId);
      else await groomService.markReady(token!, participantId);
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not update training run"), extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const completeCare = async (scheduleId: string) => {
    setBusyId(scheduleId);
    try {
      await groomService.completeCareSchedule(token!, scheduleId);
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not complete care schedule"), extractErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const toggleTaskDetail = (id: string) => {
    setExpandedTaskDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Screen
      role="groom"
      title="Groom Today"
      subtitle={
        resource.data
          ? `${resource.data.date} · ${done} of ${tracked.length} checklist items complete`
          : "Assigned horses and today's work"
      }
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && horses.length === 0}
        emptyLabel="No horses are assigned to you today."
      />

      {resource.data && horses.length ? (
        <>
          {/* Overall Daily Progress Bar */}
          <Panel>
            <View style={ui.row}>
              <Text style={ui.value}>{t("Checklist progress")}</Text>
              <Text style={[ui.value, { color: colors.primary, fontWeight: "800" }]}>
                {done}/{tracked.length} ({progress}%)
              </Text>
            </View>
            <View style={{ height: 10 }} />
            <ProgressBar value={progress} />
          </Panel>

          {/* Multi-Horse Filter Pills (Scrollable) */}
          <View style={{ marginVertical: space.xs }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horseFilterScroll}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedHorseId === "ALL" }}
                onPress={() => setSelectedHorseId("ALL")}
                style={[
                  styles.horseFilterChip,
                  selectedHorseId === "ALL" && styles.horseFilterChipActive,
                ]}
              >
                <Ionicons
                  name="grid-outline"
                  size={14}
                  color={selectedHorseId === "ALL" ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.horseFilterChipText,
                    selectedHorseId === "ALL" && styles.horseFilterChipTextActive,
                  ]}
                >
                  {t("All horses")} ({horses.length})
                </Text>
              </Pressable>

              {horses.map((horse) => {
                const isSelected = selectedHorseId === horse.horseId;
                const items = horse.checklist?.items ?? [];
                const horseDone = items.filter((i) => i.done).length;
                return (
                  <Pressable
                    key={horse.horseId}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedHorseId(horse.horseId)}
                    style={[styles.horseFilterChip, isSelected && styles.horseFilterChipActive]}
                  >
                    <Text
                      style={[
                        styles.horseFilterChipText,
                        isSelected && styles.horseFilterChipTextActive,
                      ]}
                    >
                      {horse.horseName} ({horseDone}/{items.length})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Horse Tasks List */}
          {filteredHorses.map((horse) => {
            const items = horse.checklist?.items ?? [];
            const horseDone = items.filter((i) => i.done).length;

            return (
              <View key={horse.horseId} style={ui.section}>
                {/* Horse Header Card */}
                <View style={styles.horseCardHeader}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.horseCardTitle} numberOfLines={1}>
                      {horse.horseName}
                    </Text>
                    <Text style={ui.muted} numberOfLines={1}>
                      {[horse.barnName, horse.stallCode].filter(Boolean).join(" · ") ||
                        t("No barn or stall assigned")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.horseProgressPill,
                      items.length > 0 &&
                        horseDone === items.length &&
                        styles.horseProgressPillDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.horseProgressPillText,
                        items.length > 0 &&
                          horseDone === items.length &&
                          styles.horseProgressPillTextDone,
                      ]}
                    >
                      {horseDone}/{items.length} {t("done")}
                    </Text>
                  </View>
                </View>

                {/* To-Do List: All items stay visible and readable */}
                {horse.checklist ? (
                  <View style={{ gap: space.xs, marginBottom: space.sm }}>
                    <View style={styles.todoGroupHeader}>
                      <Text style={styles.todoGroupTitle}>
                        {t("Work checklist")} ({items.length})
                      </Text>
                    </View>

                    {items.length === 0 ? (
                      <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
                        <Ionicons name="checkmark-done-circle" size={32} color={colors.primary} />
                        <Text style={[ui.muted, { marginTop: 4, textAlign: "center" }]}>
                          {t("No tasks assigned")}
                        </Text>
                      </Panel>
                    ) : (
                      items.map((item) => {
                        const isBusy = busyId === item.id;
                        const isEditingNote = noteItemId === item.id;
                        const isExpanded = Boolean(expandedTaskDetails[item.id]);

                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.todoItemCard,
                              item.done ? styles.todoItemCardDone : null,
                            ]}
                          >
                            <View style={styles.todoItemMainRow}>
                              {/* 44x44 Touch Target Checkbox */}
                              <Pressable
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: item.done }}
                                disabled={isBusy || horse.checklist?.status === "INCOMPLETE"}
                                onPress={() => void updateChecklist(item.id, !item.done)}
                                style={styles.checkboxTouch}
                              >
                                {isBusy ? (
                                  <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                  <Ionicons
                                    name={item.done ? "checkbox" : "square-outline"}
                                    size={23}
                                    color={item.done ? colors.fit : colors.mutedForeground}
                                  />
                                )}
                              </Pressable>

                              {/* Task Card Body: Tap to expand details */}
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => toggleTaskDetail(item.id)}
                                style={styles.todoContentPressable}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <Text
                                    style={[styles.todoTitle, { flexShrink: 1 }]}
                                    numberOfLines={2}
                                  >
                                    {item.name}
                                  </Text>
                                  {item.done ? (
                                    <View style={styles.todoDoneBadge}>
                                      <Ionicons
                                        name="checkmark-circle"
                                        size={12}
                                        color={colors.fit}
                                      />
                                      <Text style={styles.todoDoneBadgeText}>{t("Completed")}</Text>
                                    </View>
                                  ) : null}
                                </View>
                                <Text style={styles.todoMeta} numberOfLines={1}>
                                  {item.done
                                    ? (item.doer?.fullName ?? t("Completed"))
                                    : (item.doer?.fullName ?? t("To do"))}
                                  {item.done && item.doneAt ? ` · ${formatTime(item.doneAt)}` : ""}
                                </Text>
                              </Pressable>

                              {/* Note icon or button */}
                              {!isEditingNote ? (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={t(item.note ? "Edit note" : "Add note")}
                                  onPress={() => {
                                    setNoteItemId(item.id);
                                    setNoteDraft(item.note ?? "");
                                  }}
                                  style={styles.noteIconBtn}
                                >
                                  <Ionicons
                                    name={item.note ? "document-text" : "chatbubble-outline"}
                                    size={18}
                                    color={item.note ? colors.primary : colors.mutedForeground}
                                  />
                                </Pressable>
                              ) : null}
                            </View>

                            {/* Expanded Details when item pressed */}
                            {isExpanded ? (
                              <View style={styles.todoExpandedDetails}>
                                <Text style={styles.todoExpandedText}>
                                  {t("Horse")}: {horse.horseName}
                                </Text>
                                {horse.stallCode ? (
                                  <Text style={styles.todoExpandedText}>
                                    {t("Stall")}: {horse.barnName ? `${horse.barnName} · ` : ""}
                                    {horse.stallCode}
                                  </Text>
                                ) : null}
                                {item.doer?.fullName ? (
                                  <Text style={styles.todoExpandedText}>
                                    {t("Assigned to")}: {item.doer.fullName}
                                  </Text>
                                ) : null}
                              </View>
                            ) : null}

                            {/* Note preview if exists */}
                            {item.note && !isEditingNote ? (
                              <View style={styles.noteBubble}>
                                <Ionicons name="create-outline" size={13} color={colors.primary} />
                                <Text style={styles.noteText}>{item.note}</Text>
                              </View>
                            ) : null}

                            {/* Note Editor */}
                            {isEditingNote ? (
                              <View style={styles.noteEditorBox}>
                                <Field label="Checklist note">
                                  <NativeInput
                                    value={noteDraft}
                                    onChangeText={setNoteDraft}
                                    placeholder={t("Enter task note")}
                                  />
                                </Field>
                                <View style={styles.noteActionsRow}>
                                  <SecondaryButton
                                    label="Cancel"
                                    style={{ flex: 1 }}
                                    onPress={() => setNoteItemId(null)}
                                  />
                                  <PrimaryButton
                                    label="Save note"
                                    style={{ flex: 1 }}
                                    onPress={() =>
                                      void updateChecklist(
                                        item.id,
                                        item.done,
                                        noteDraft.trim() || null,
                                      ).then(() => setNoteItemId(null))
                                    }
                                    disabled={busyId === item.id}
                                  />
                                </View>
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : (
                  <Text style={ui.muted}>No checklist has been generated for today.</Text>
                )}

                {/* Feeding Plan Section */}
                <Text style={[ui.value, { marginTop: space.sm }]}>{t("Feeding plan")}</Text>
                {horse.feedingPlan ? (
                  <Panel>
                    <Text style={ui.muted}>
                      {horse.feedingPlan.status}
                      {horse.feedingPlan.note ? ` · ${horse.feedingPlan.note}` : ""}
                    </Text>
                    {orderedMeals(horse.feedingPlan.meals).map((meal) => (
                      <View key={meal.meal} style={{ marginTop: 8 }}>
                        <Text style={ui.value}>{mealLabel(meal.meal)}</Text>
                        {meal.items.map((item, index) => (
                          <Text key={`${meal.meal}-${item.supplyItemId}-${index}`} style={ui.muted}>
                            • {item.name} · {item.quantity} {item.unit}
                            {item.note ? ` · ${item.note}` : ""}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </Panel>
                ) : (
                  <Text style={ui.muted}>No active feeding plan.</Text>
                )}

                {/* Training Runs Section */}
                <Text style={[ui.value, { marginTop: space.sm }]}>{t("Training runs")}</Text>
                {horse.trainingRuns.length ? (
                  horse.trainingRuns.map((run) => (
                    <Panel key={run.participantId}>
                      <Text style={ui.value}>{run.sessionName}</Text>
                      <Text style={ui.muted}>
                        {formatTime(run.scheduledStartAt)}–{formatTime(run.scheduledEndAt)} ·{" "}
                        {run.status}
                      </Text>
                      {run.status === "PLANNED" ? (
                        <PrimaryButton
                          label="Check in"
                          onPress={() => void actOnRun(run.participantId, "check-in")}
                          disabled={busyId === run.participantId}
                        />
                      ) : null}
                      {run.status === "PRESENT" ? (
                        <PrimaryButton
                          label="Mark ready"
                          onPress={() => void actOnRun(run.participantId, "ready")}
                          disabled={busyId === run.participantId}
                        />
                      ) : null}
                    </Panel>
                  ))
                ) : (
                  <Text style={ui.muted}>No training runs assigned today.</Text>
                )}

                {/* Care Schedules Section */}
                <Text style={[ui.value, { marginTop: space.sm }]}>{t("Care schedules")}</Text>
                {horse.careSchedules.length ? (
                  horse.careSchedules.map((schedule) => (
                    <Panel key={schedule.id}>
                      <Text style={ui.value}>
                        {schedule.type.replaceAll("_", " ")}
                        {schedule.overdue ? " · OVERDUE" : ""}
                      </Text>
                      <Text style={ui.muted}>
                        {formatDateTime(schedule.dueAt)}
                        {schedule.notes ? ` · ${schedule.notes}` : ""}
                      </Text>
                      <PrimaryButton
                        label={busyId === schedule.id ? "Saving…" : "Complete care"}
                        onPress={() => void completeCare(schedule.id)}
                        disabled={busyId === schedule.id}
                      />
                    </Panel>
                  ))
                ) : (
                  <Text style={ui.muted}>No care schedules are due.</Text>
                )}
              </View>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

function mealLabel(meal: string): string {
  switch (meal) {
    case "EARLY_MORNING":
      return "Early morning";
    case "NOON":
      return "Noon";
    case "AFTERNOON":
      return "Afternoon";
    default:
      return "Evening";
  }
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    horseFilterScroll: {
      gap: space.xs,
      paddingVertical: space.xs,
    },
    horseFilterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    horseFilterChipActive: {
      backgroundColor: colors.fitSoft,
      borderColor: colors.primary,
    },
    horseFilterChipText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.foreground,
    },
    horseFilterChipTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    horseCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.sm,
    },
    horseCardTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.foreground,
    },
    horseProgressPill: {
      paddingHorizontal: space.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
    horseProgressPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    todoGroupHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.xs,
      marginTop: space.xs,
    },
    todoGroupTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    todoItemCard: {
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.xs,
      overflow: "hidden",
    },
    todoItemCardDone: {
      backgroundColor: colors.fitSoft,
      borderColor: colors.fit,
    },
    todoDoneBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    todoDoneBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.fit,
    },
    horseProgressPillDone: {
      backgroundColor: colors.fit,
    },
    horseProgressPillTextDone: {
      color: colors.primaryForeground,
    },
    todoItemMainRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: space.sm,
      paddingVertical: space.xs,
      gap: space.xs,
    },
    checkboxTouch: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: -4,
    },
    todoContentPressable: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 4,
    },
    todoTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    todoMeta: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    noteIconBtn: {
      padding: space.xs,
      borderRadius: radius.sm,
    },
    noteBubble: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.xs,
      padding: space.xs,
      paddingHorizontal: space.sm,
      backgroundColor: colors.muted,
      borderRadius: radius.sm,
      marginHorizontal: space.sm,
      marginBottom: space.sm,
    },
    noteText: {
      flex: 1,
      fontSize: 12,
      color: colors.foreground,
      lineHeight: 16,
    },
    noteEditorBox: {
      padding: space.sm,
      paddingTop: 0,
      gap: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: space.xs,
    },
    noteActionsRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    todoExpandedDetails: {
      paddingHorizontal: space.sm,
      paddingBottom: space.xs,
      gap: 2,
    },
    todoExpandedText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
  });
