import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { radius, space, type ThemeColors } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import {
  stableCareService,
  orderedMeals,
  type CareTaskTypeDto,
  type FeedingMealName,
  type FeedingPlanDto,
  type FeedingPlanLineInput,
  type HorseCareTaskDto,
  type HorseSurchargeDto,
} from "@/services/stable-care.service";
import { suppliesService } from "@/services/supplies.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import {
  hasFeedingMealDuplicate,
  isDateOnly,
  isValidCareTaskRange,
  isValidChecklistRange,
} from "@/features/stable-care/stable-care-validation";
import { clubDate } from "@/utils/horse-validation";
import { formatDate, formatTime } from "@/utils/formatters";

const MEALS: FeedingMealName[] = ["EARLY_MORNING", "NOON", "AFTERNOON", "EVENING"];
const MEAL_LABELS: Record<FeedingMealName, string> = {
  EARLY_MORNING: "Early morning",
  NOON: "Noon",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

const MEAL_METADATA: Record<
  FeedingMealName,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  EARLY_MORNING: {
    label: "Early morning",
    icon: "sunny-outline",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
  },
  NOON: {
    label: "Noon",
    icon: "sunny",
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.12)",
  },
  AFTERNOON: {
    label: "Afternoon",
    icon: "partly-sunny-outline",
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.12)",
  },
  EVENING: {
    label: "Evening",
    icon: "moon-outline",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
  },
};

const QUICK_QUANTITIES = [0.5, 1, 2, 5];
const TASK_DURATION_PRESETS = [1, 3, 7, 14, 30];
const CHECKLIST_RANGE_PRESETS = [7, 14, 30];

export default function HorseStableCareScreen() {
  const { role: roleParam, id: horseIdParam } = useLocalSearchParams<{
    role: string;
    id: string;
  }>();
  const role = isRole(roleParam) ? roleParam : "trainer";
  const horseId = Array.isArray(horseIdParam) ? horseIdParam[0] : horseIdParam;
  const options = useMemo(() => {
    const tabs: string[] = [];
    if (["trainer", "manager", "vet", "groom"].includes(role)) tabs.push("Feeding plan");
    if (["trainer", "manager", "groom"].includes(role)) tabs.push("Care tasks");
    if (["manager", "trainer", "groom"].includes(role)) tabs.push("Daily checklist");
    if (["manager", "trainer", "owner"].includes(role)) tabs.push("Surcharges");
    return tabs;
  }, [role]);
  const [tab, setTab] = useState(options[0] ?? "Feeding plan");
  const visibleTab = options.includes(tab) ? tab : (options[0] ?? "Feeding plan");
  const title = "Stable care";

  return (
    <Screen
      role={role}
      title={title}
      subtitle="Feeding, scheduled care, daily checklists and surcharges"
      back
      fallbackHref={(horseId ? `/${role}/horse/${horseId}` : `/${role}/horses`) as any}
    >
      <Chips options={options} value={visibleTab} onChange={setTab} />
      {visibleTab === "Feeding plan" ? (
        <FeedingPlansTab role={role} horseId={horseId ?? ""} />
      ) : null}
      {visibleTab === "Care tasks" ? (
        <HorseCareTasksTab role={role} horseId={horseId ?? ""} />
      ) : null}
      {visibleTab === "Daily checklist" ? (
        <DailyChecklistTab role={role} horseId={horseId ?? ""} />
      ) : null}
      {visibleTab === "Surcharges" ? (
        <HorseSurchargesTab role={role} horseId={horseId ?? ""} />
      ) : null}
    </Screen>
  );
}

function FeedingPlansTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const canEdit = role === "trainer";
  const status = role === "groom" ? ("ACTIVE" as const) : undefined;
  const load = useCallback(
    async () =>
      Promise.all([
        stableCareService.listFeedingPlans(token!, horseId, status),
        suppliesService.listItems(token!, {}),
      ]),
    [horseId, status, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));
  const [selectedPlan, setSelectedPlan] = useState<FeedingPlanDto | null>(null);
  const [targetIds, setTargetIds] = useState(horseId);
  const [note, setNote] = useState("");
  const [meal, setMeal] = useState<FeedingMealName>("EARLY_MORNING");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lineNote, setLineNote] = useState("");
  const [copyFromPlanId, setCopyFromPlanId] = useState("");
  const [lines, setLines] = useState<FeedingPlanLineInput[]>([]);
  const [saving, setSaving] = useState(false);
  const feedItems = (resource.data?.[1] ?? []).filter((item) =>
    ["FEED", "SUPPLEMENT"].includes(item.category),
  );
  const plans = resource.data?.[0] ?? [];

  const beginEdit = (plan: FeedingPlanDto) => {
    setSelectedPlan(plan);
    setLines(
      plan.meals.flatMap((entry) =>
        entry.items.map((line) => ({
          meal: entry.meal,
          supplyItemId: line.supplyItemId,
          quantity: line.quantity,
          ...(line.note ? { note: line.note } : {}),
        })),
      ),
    );
    setNote(plan.note ?? "");
  };

  const clearEditor = () => {
    setSelectedPlan(null);
    setLines([]);
    setNote("");
    setLineNote("");
    setCopyFromPlanId("");
    setTargetIds(horseId);
  };

  const addLine = () => {
    const parsed = Number(quantity);
    if (!itemId || !Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert(
        t("Check feeding item"),
        t("Choose a feed or supplement and enter a quantity greater than zero."),
      );
      return;
    }
    if (hasFeedingMealDuplicate(lines, meal, itemId)) {
      Alert.alert(t("Duplicate meal item"), t("Each feed or supplement can appear only once in a meal."));
      return;
    }
    setLines((current) => [
      ...current,
      {
        meal,
        supplyItemId: itemId,
        quantity: parsed,
        ...(lineNote.trim() ? { note: lineNote.trim() } : {}),
      },
    ]);
    setQuantity("");
    setLineNote("");
  };

  const handleQuickAddQty = (step: number) => {
    const current = Number(quantity);
    const nextVal = Number.isFinite(current) && current > 0 ? Math.round((current + step) * 10) / 10 : step;
    setQuantity(String(nextVal));
  };

  const save = async () => {
    if (!token || (!lines.length && !copyFromPlanId) || saving) return;
    setSaving(true);
    try {
      if (selectedPlan)
        await stableCareService.replaceFeedingPlan(token, selectedPlan.id, {
          items: lines,
          note: note.trim() || null,
        });
      else {
        const horseIds = [
          ...new Set(
            targetIds
              .split(/[\s,;]+/)
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ];
        if (!horseIds.length || horseIds.length > 50)
          throw new Error("Choose between 1 and 50 horse IDs.");
        await stableCareService.createFeedingPlans(token, {
          horseIds,
          ...(copyFromPlanId ? { copyFromPlanId } : { items: lines }),
          note: note.trim() || undefined,
        });
      }
      clearEditor();
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not save feeding plan"), extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const approve = (plan: FeedingPlanDto) =>
    Alert.alert(
      t("Approve feeding plan?"),
      t("This makes the draft active and archives the horse's previous active plan."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Approve"),
          onPress: () =>
            void stableCareService
              .approveFeedingPlan(token!, plan.id)
              .then(() => resource.refresh())
              .catch((error) => Alert.alert(t("Could not approve"), extractErrorMessage(error))),
        },
      ],
    );

  const remove = (plan: FeedingPlanDto) =>
    Alert.alert(t("Delete draft?"), t("This removes the draft feeding plan."), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: () =>
          void stableCareService
            .deleteFeedingPlan(token!, plan.id)
            .then(() => resource.refresh())
            .catch((error) => Alert.alert(t("Could not delete"), extractErrorMessage(error))),
      },
    ]);

  return (
    <View style={ui.section}>
      <SectionTitle>Feeding plans</SectionTitle>
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && plans.length === 0}
        emptyLabel="No feeding plans are recorded."
      />

      {plans.map((plan) => {
        const isActive = plan.status === "ACTIVE";
        const isDraft = plan.status === "DRAFT";
        const statusBg = isActive ? colors.fitSoft : isDraft ? colors.monitorSoft : colors.elevated;
        const statusColor = isActive ? colors.primary : isDraft ? colors.monitor : colors.mutedForeground;
        const statusIcon: keyof typeof Ionicons.glyphMap = isActive
          ? "checkmark-circle"
          : isDraft
            ? "document-text-outline"
            : "archive-outline";

        return (
          <View key={plan.id} style={careStyles.planCard}>
            {/* Header */}
            <View style={careStyles.planCardHeader}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="nutrition" size={18} color={colors.primary} />
                  <Text style={careStyles.planHorseName} numberOfLines={1}>
                    {plan.horseName}
                  </Text>
                </View>
                <Text style={careStyles.planCreatorText}>
                  {t("Created by")} {plan.creator.fullName}
                  {plan.approver ? ` · ${t("approved by")} ${plan.approver.fullName}` : ""}
                </Text>
              </View>
              <View style={[careStyles.statusBadge, { backgroundColor: statusBg }]}>
                <Ionicons name={statusIcon} size={14} color={statusColor} />
                <Text style={[careStyles.statusBadgeText, { color: statusColor }]}>
                  {t(plan.status)}
                </Text>
              </View>
            </View>

            {/* Meals Breakdown Cards */}
            <View style={careStyles.mealsContainer}>
              {orderedMeals(plan.meals).map((entry) => {
                const meta = MEAL_METADATA[entry.meal];
                return (
                  <View key={entry.meal} style={careStyles.mealBox}>
                    <View style={careStyles.mealBoxHeader}>
                      <Ionicons name={meta.icon} size={15} color={meta.color} />
                      <Text style={[careStyles.mealBoxTitle, { color: meta.color }]}>
                        {t(meta.label)}
                      </Text>
                    </View>
                    {entry.items.length > 0 ? (
                      <View style={careStyles.mealItemsWrap}>
                        {entry.items.map((line, lineIdx) => (
                          <View key={lineIdx} style={careStyles.mealItemChip}>
                            <Text style={careStyles.mealItemName}>{line.name}</Text>
                            <View style={careStyles.mealItemQtyBadge}>
                              <Text style={careStyles.mealItemQtyText}>
                                {line.quantity} {line.unit}
                              </Text>
                            </View>
                            {line.note ? (
                              <Text style={careStyles.mealItemNote}>({line.note})</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={ui.muted}>{t("No items in this meal")}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Note */}
            {plan.note ? (
              <View style={careStyles.planNoteBox}>
                <Text style={careStyles.planNoteText}>{plan.note}</Text>
              </View>
            ) : null}

            {/* Actions for draft plans */}
            {canEdit && plan.status === "DRAFT" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs }}>
                <SecondaryButton
                  label="Edit draft"
                  icon="create-outline"
                  style={{ flexGrow: 1 }}
                  onPress={() => beginEdit(plan)}
                />
                <SecondaryButton
                  label="Delete"
                  icon="trash-outline"
                  style={{ flexGrow: 1 }}
                  onPress={() => remove(plan)}
                />
                <PrimaryButton
                  label="Approve"
                  icon="checkmark-outline"
                  style={{ flexGrow: 1 }}
                  onPress={() => approve(plan)}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      {canEdit ? (
        <View style={careStyles.builderCard}>
          <View style={careStyles.builderHeader}>
            <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
            <Text style={careStyles.builderTitle}>
              {selectedPlan ? t("Edit draft plan") : t("Create feeding plan")}
            </Text>
          </View>

          {!selectedPlan ? (
            <Field label="Horse IDs · one or more, up to 50">
              <NativeInput value={targetIds} onChangeText={setTargetIds} placeholder={horseId} />
            </Field>
          ) : null}

          <Field label="Plan note">
            <NativeInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional instructions"
            />
          </Field>

          {!selectedPlan && plans.length ? (
            <>
              <Text style={ui.muted}>{t("Start with a previous plan, or enter feed items below.")}</Text>
              <Chips
                options={[
                  "Build from items",
                  ...plans.map((p) => `Copy ${p.horseName} · ${p.status}`),
                ]}
                value={
                  copyFromPlanId
                    ? `Copy ${(plans.find((p) => p.id === copyFromPlanId)?.horseName ?? "")} · ${(plans.find((p) => p.id === copyFromPlanId)?.status ?? "")}`
                    : "Build from items"
                }
                onChange={(value) =>
                  setCopyFromPlanId(
                    plans.find((p) => value === `Copy ${p.horseName} · ${p.status}`)?.id ?? "",
                  )
                }
              />
            </>
          ) : null}

          {!copyFromPlanId || selectedPlan ? (
            <View style={{ gap: space.md, marginTop: space.xs }}>
              {/* Meal Selector Pills */}
              <View style={careStyles.mealSelectorRow}>
                {MEALS.map((entry) => {
                  const meta = MEAL_METADATA[entry];
                  const isSelected = meal === entry;
                  return (
                    <Pressable
                      key={entry}
                      accessibilityRole="button"
                      onPress={() => setMeal(entry)}
                      style={[
                        careStyles.mealTabBtn,
                        isSelected && [careStyles.mealTabBtnActive, { borderColor: meta.color }],
                      ]}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={14}
                        color={isSelected ? meta.color : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          careStyles.mealTabBtnText,
                          isSelected && { color: meta.color, fontWeight: "700" },
                        ]}
                        numberOfLines={1}
                      >
                        {t(meta.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Feed Items Selector Chips */}
              <View style={{ gap: space.xs }}>
                <Text style={[ui.value, { fontSize: 13 }]}>{t("Select feed or supplement")}</Text>
                <Chips
                  options={feedItems.map((item) => item.name)}
                  value={feedItems.find((item) => item.id === itemId)?.name ?? ""}
                  onChange={(value) =>
                    setItemId(feedItems.find((item) => item.name === value)?.id ?? "")
                  }
                />
              </View>

              {/* Quantity Field + Stepper */}
              <Field
                label={`Quantity (${feedItems.find((item) => item.id === itemId)?.unit ?? "unit"})`}
              >
                <NativeInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 2.5"
                />
              </Field>

              <View style={careStyles.quickChipsRow}>
                <Text style={ui.muted}>{t("Quick add")}:</Text>
                {QUICK_QUANTITIES.map((step) => (
                  <Pressable
                    key={step}
                    accessibilityRole="button"
                    onPress={() => handleQuickAddQty(step)}
                    style={careStyles.quickQtyChip}
                  >
                    <Text style={careStyles.quickQtyChipText}>+{step}</Text>
                  </Pressable>
                ))}
              </View>

              <Field label="Meal item note">
                <NativeInput
                  value={lineNote}
                  onChangeText={setLineNote}
                  placeholder="Optional note for this item"
                />
              </Field>

              <SecondaryButton
                label="Add item to meal"
                icon="add-circle-outline"
                onPress={addLine}
                disabled={!itemId}
              />
            </View>
          ) : null}

          {/* Configured Lines */}
          {lines.length > 0 ? (
            <View style={{ gap: space.xs, marginTop: space.xs }}>
              <Text style={[ui.value, { fontSize: 13, fontWeight: "700" }]}>
                {t("Configured items in this plan")} ({lines.length})
              </Text>
              {lines.map((line, index) => {
                const itemMeta = feedItems.find((item) => item.id === line.supplyItemId);
                const mealMeta = MEAL_METADATA[line.meal];
                return (
                  <View key={`${line.supplyItemId}-${line.meal}-${index}`} style={careStyles.configuredLineRow}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={[careStyles.statusBadge, { backgroundColor: mealMeta.bg, paddingHorizontal: 6, paddingVertical: 2 }]}>
                          <Ionicons name={mealMeta.icon} size={11} color={mealMeta.color} />
                          <Text style={[careStyles.statusBadgeText, { color: mealMeta.color, fontSize: 11 }]}>
                            {t(mealMeta.label)}
                          </Text>
                        </View>
                        <Text style={[ui.value, { flex: 1 }]} numberOfLines={1}>
                          {itemMeta?.name ?? "Feed item"}
                        </Text>
                      </View>
                      <Text style={ui.muted}>
                        {line.quantity} {itemMeta?.unit ?? "unit"}
                        {line.note ? ` · ${line.note}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove item"
                      onPress={() => setLines((curr) => curr.filter((_, idx) => idx !== index))}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <PrimaryButton
              label={saving ? "Saving…" : selectedPlan ? "Save draft" : "Create draft plan"}
              icon="save-outline"
              onPress={() => void save()}
              disabled={saving || (!lines.length && !copyFromPlanId)}
            />
            {selectedPlan ? <SecondaryButton label="Cancel edit" onPress={clearEditor} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function HorseCareTasksTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const canAssign = role === "trainer";
  const load = useCallback(
    async () =>
      Promise.all([
        stableCareService.listHorseCareTasks(token!, horseId),
        stableCareService.listTaskTypes(token!),
      ]),
    [horseId, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));
  const [taskTypeId, setTaskTypeId] = useState("");
  const [fromDate, setFromDate] = useState(todayDate());
  const [toDate, setToDate] = useState(todayDate());
  const [note, setNote] = useState("");
  const types = (resource.data?.[1] ?? []).filter((item) => item.active && !item.appliesToAll);
  const tasks = resource.data?.[0] ?? [];

  const handleApplyPresetDays = (days: number) => {
    const start = todayDate();
    setFromDate(start);
    if (days === 1) {
      setToDate(start);
    } else {
      const d = new Date(start + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + days - 1);
      setToDate(d.toISOString().slice(0, 10));
    }
  };

  const add = async () => {
    if (!token || !taskTypeId || !isValidCareTaskRange(fromDate, toDate, todayDate())) {
      Alert.alert(
        t("Check care task dates"),
        t("Choose an active task type, start today or later, and an end date within 366 days."),
      );
      return;
    }
    try {
      await stableCareService.createHorseCareTask(token, horseId, {
        taskTypeId,
        fromDate,
        toDate,
        note: note.trim() || undefined,
      });
      setNote("");
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not assign care task"), extractErrorMessage(error));
    }
  };

  const remove = (task: HorseCareTaskDto) =>
    Alert.alert(
      t("Remove care task?"),
      t("An active task will end today; a future task will be removed."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Remove"),
          style: "destructive",
          onPress: () =>
            void stableCareService
              .removeHorseCareTask(token!, task.id)
              .then(() => resource.refresh())
              .catch((error) => Alert.alert(t("Could not remove"), extractErrorMessage(error))),
        },
      ],
    );

  return (
    <View style={ui.section}>
      <SectionTitle>Horse care tasks</SectionTitle>
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && tasks.length === 0}
        emptyLabel="No individual care tasks are scheduled."
      />
      {tasks.map((task) => (
        <View key={task.id} style={careStyles.taskCard}>
          <View style={ui.row}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, flex: 1 }}>
              <Ionicons name="calendar-outline" size={17} color={colors.primary} />
              <Text style={[careStyles.planHorseName, { fontSize: 16 }]} numberOfLines={1}>
                {task.taskType.name}
              </Text>
            </View>
            {canAssign ? (
              <SecondaryButton
                label="Remove"
                icon="trash-outline"
                style={{ flexShrink: 0 }}
                onPress={() => remove(task)}
              />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <View style={careStyles.dateRangeBadge}>
              <Ionicons name="time-outline" size={13} color={colors.primary} />
              <Text style={careStyles.dateRangeText}>
                {task.fromDate} → {task.toDate}
              </Text>
            </View>
          </View>
          {task.note ? (
            <View style={careStyles.planNoteBox}>
              <Text style={careStyles.planNoteText}>{task.note}</Text>
            </View>
          ) : null}
          <Text style={ui.muted}>{t("Assigned by")} {task.creator.fullName}</Text>
        </View>
      ))}

      {canAssign ? (
        <View style={careStyles.builderCard}>
          <View style={careStyles.builderHeader}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={careStyles.builderTitle}>{t("Assign individual task")}</Text>
          </View>
          {types.length ? (
            <Chips
              options={types.map((item) => item.name)}
              value={types.find((item) => item.id === taskTypeId)?.name ?? ""}
              onChange={(value) =>
                setTaskTypeId(types.find((item) => item.name === value)?.id ?? "")
              }
            />
          ) : (
            <Text style={ui.muted}>
              {t("No active individual task types are available. Club Manager can add them under Care task types.")}
            </Text>
          )}

          {/* Quick Duration Presets */}
          <View style={careStyles.quickChipsRow}>
            <Text style={ui.muted}>{t("Duration")}:</Text>
            {TASK_DURATION_PRESETS.map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                onPress={() => handleApplyPresetDays(d)}
                style={careStyles.quickQtyChip}
              >
                <Text style={careStyles.quickQtyChipText}>
                  {d === 1 ? t("Today only") : `${d} ${t("days")}`}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field label="Start date · YYYY-MM-DD">
            <NativeInput value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="End date · YYYY-MM-DD">
            <NativeInput value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="Note">
            <NativeInput value={note} onChangeText={setNote} placeholder="Optional instruction" />
          </Field>
          <PrimaryButton
            label="Assign care task"
            icon="calendar"
            onPress={() => void add()}
            disabled={!taskTypeId}
          />
        </View>
      ) : null}
    </View>
  );
}

function DailyChecklistTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const [from, setFrom] = useState(daysAgoDate(6));
  const [to, setTo] = useState(todayDate());
  const [range, setRange] = useState({ from: daysAgoDate(6), to: todayDate() });
  const load = useCallback(
    () => stableCareService.listChecklists(token!, horseId, range.from, range.to),
    [horseId, range.from, range.to, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));
  const toggle = async (itemId: string, done: boolean) => {
    try {
      await stableCareService.tickChecklistItem(token!, itemId, { done });
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not update checklist"), extractErrorMessage(error));
    }
  };
  const handlePresetRange = (days: number) => {
    const start = daysAgoDate(days - 1);
    const end = todayDate();
    setFrom(start);
    setTo(end);
    setRange({ from: start, to: end });
  };
  const refreshRange = () => {
    if (!isValidChecklistRange(from, to)) {
      Alert.alert(
        t("Check date range"),
        t("Choose valid dates with an inclusive range of no more than 31 days."),
      );
      return;
    }
    setRange({ from, to });
  };
  const today = todayDate();

  return (
    <View style={ui.section}>
      <SectionTitle>Daily checklist history</SectionTitle>

      {/* Preset range chips */}
      <View style={careStyles.quickChipsRow}>
        <Text style={ui.muted}>{t("Range")}:</Text>
        {CHECKLIST_RANGE_PRESETS.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            onPress={() => handlePresetRange(d)}
            style={careStyles.quickQtyChip}
          >
            <Text style={careStyles.quickQtyChipText}>{d} {t("days")}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="From · YYYY-MM-DD">
        <NativeInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="To · YYYY-MM-DD">
        <NativeInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
      </Field>
      <SecondaryButton label="Load up to 31 days" icon="refresh-outline" onPress={refreshRange} />

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && (resource.data?.length ?? 0) === 0}
        emptyLabel="No checklists exist in this date range."
      />

      {(resource.data ?? []).map((checklist) => {
        const totalItems = checklist.items.length;
        const doneItems = checklist.items.filter((item) => item.done).length;
        const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
        const isCompleted = checklist.status === "COMPLETED";

        return (
          <View key={checklist.id} style={careStyles.checklistCard}>
            <View style={ui.row}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="checkbox-outline" size={17} color={colors.primary} />
                  <Text style={[careStyles.planHorseName, { fontSize: 16 }]}>
                    {checklist.checklistDate}
                  </Text>
                </View>
                <Text style={ui.muted}>
                  {t("Groom")}: {checklist.groom.fullName}
                  {checklist.completedAt ? ` · ${t("Completed")} ${formatTime(checklist.completedAt)}` : ""}
                </Text>
              </View>
              <View
                style={[
                  careStyles.statusBadge,
                  { backgroundColor: isCompleted ? colors.fitSoft : colors.monitorSoft },
                ]}
              >
                <Ionicons
                  name={isCompleted ? "checkmark-circle" : "time-outline"}
                  size={13}
                  color={isCompleted ? colors.primary : colors.monitor}
                />
                <Text
                  style={[
                    careStyles.statusBadgeText,
                    { color: isCompleted ? colors.primary : colors.monitor },
                  ]}
                >
                  {doneItems}/{totalItems} ({progressPct}%)
                </Text>
              </View>
            </View>

            {/* Checklist Items */}
            <View style={{ gap: space.xs, marginTop: space.xs }}>
              {checklist.items.map((item) => (
                <View key={item.id} style={careStyles.checklistItemRow}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons
                        name={item.done ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={item.done ? colors.primary : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          ui.value,
                          item.done && { color: colors.foreground },
                          { fontSize: 14 },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <Text style={ui.muted} numberOfLines={1}>
                      {item.doer
                        ? `${item.doer.fullName}${item.doneAt ? ` · ${formatTime(item.doneAt)}` : ""}`
                        : t("Not completed")}
                      {item.note ? ` · ${item.note}` : ""}
                    </Text>
                  </View>
                  {role === "groom" &&
                  checklist.checklistDate === today &&
                  checklist.status !== "INCOMPLETE" ? (
                    <SecondaryButton
                      label={item.done ? "Undo" : "Done"}
                      style={{ flexShrink: 0 }}
                      onPress={() => void toggle(item.id, !item.done)}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {role === "groom" ? (
        <Text style={ui.muted}>
          {t("Only today’s checklist can be changed. Older or incomplete checklists are read-only.")}
        </Text>
      ) : null}
    </View>
  );
}

function HorseSurchargesTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const canCreate = role === "manager";
  const canApply = role === "trainer";
  const load = useCallback(
    () => stableCareService.listSurcharges(token!, horseId),
    [horseId, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayDate());
  const [endDate, setEndDate] = useState(todayDate());
  const create = async () => {
    const dailyAmount = Number(amount);
    if (
      !token ||
      !description.trim() ||
      description.trim().length > 500 ||
      !Number.isInteger(dailyAmount) ||
      dailyAmount < 1 ||
      dailyAmount > 1_000_000_000 ||
      !isDateOnly(startDate) ||
      !isDateOnly(endDate) ||
      startDate < todayDate() ||
      endDate < startDate
    ) {
      Alert.alert(
        t("Check surcharge details"),
        t("Enter a description, a positive whole VND amount up to 1 billion, and valid dates starting today or later."),
      );
      return;
    }
    try {
      await stableCareService.createSurcharge(token, horseId, {
        description: description.trim(),
        dailyAmount,
        startDate,
        endDate,
      });
      setDescription("");
      setAmount("");
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not create surcharge"), extractErrorMessage(error));
    }
  };
  const end = (surcharge: HorseSurchargeDto) =>
    Alert.alert(
      t("End surcharge today?"),
      t("This applies only to a surcharge that has started and is still active."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("End today"),
          onPress: () =>
            void stableCareService
              .endSurcharge(token!, surcharge.id)
              .then(() => resource.refresh())
              .catch((error) => Alert.alert(t("Could not end surcharge"), extractErrorMessage(error))),
        },
      ],
    );
  const remove = (surcharge: HorseSurchargeDto) =>
    Alert.alert(
      t("Delete upcoming surcharge?"),
      t("Only a surcharge that has not started can be deleted."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: () =>
            void stableCareService
              .deleteSurcharge(token!, surcharge.id)
              .then(() => resource.refresh())
              .catch((error) =>
                Alert.alert(t("Could not delete surcharge"), extractErrorMessage(error)),
              ),
        },
      ],
    );
  const today = todayDate();
  return (
    <View style={ui.section}>
      <SectionTitle>Care surcharges</SectionTitle>
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && (resource.data?.length ?? 0) === 0}
        emptyLabel="No surcharges are recorded for this horse."
      />
      {(resource.data ?? []).map((surcharge) => (
        <View key={surcharge.id} style={careStyles.taskCard}>
          <View style={ui.row}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={careStyles.planHorseName}>{surcharge.description}</Text>
              <Text style={[ui.value, { color: colors.primary, fontSize: 16 }]}>
                {formatVnd(surcharge.dailyAmount)} / {t("day")}
              </Text>
            </View>
            <View style={careStyles.dateRangeBadge}>
              <Ionicons name="calendar-outline" size={13} color={colors.primary} />
              <Text style={careStyles.dateRangeText}>
                {surcharge.startDate} → {surcharge.endDate}
              </Text>
            </View>
          </View>
          {surcharge.appliedByName ? (
            <Text style={ui.muted}>
              {t("Applied by")} {surcharge.appliedByName}
              {surcharge.appliedAt ? ` · ${formatDate(surcharge.appliedAt)}` : ""}
            </Text>
          ) : (
            <View style={[careStyles.statusBadge, { backgroundColor: colors.monitorSoft, alignSelf: "flex-start" }]}>
              <Ionicons name="time-outline" size={12} color={colors.monitor} />
              <Text style={[careStyles.statusBadgeText, { color: colors.monitor }]}>
                {t("Awaiting Head Trainer")}
              </Text>
            </View>
          )}
          {canApply && !surcharge.appliedBy && surcharge.endDate >= today ? (
            <PrimaryButton
              label="Apply surcharge"
              icon="checkmark-outline"
              onPress={() =>
                void stableCareService
                  .applySurcharge(token!, surcharge.id)
                  .then(() => resource.refresh())
                  .catch((error) =>
                    Alert.alert(t("Could not apply surcharge"), extractErrorMessage(error)),
                  )
              }
            />
          ) : null}
          {canCreate && !surcharge.appliedBy && surcharge.startDate > today ? (
            <SecondaryButton label="Delete" icon="trash-outline" onPress={() => remove(surcharge)} />
          ) : null}
          {canCreate && surcharge.startDate <= today && surcharge.endDate >= today ? (
            <SecondaryButton label="End today" onPress={() => end(surcharge)} />
          ) : null}
        </View>
      ))}
      {canCreate ? (
        <View style={careStyles.builderCard}>
          <View style={careStyles.builderHeader}>
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
            <Text style={careStyles.builderTitle}>{t("Create surcharge")}</Text>
          </View>
          <Field label="Description">
            <NativeInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Reason for additional care cost"
            />
          </Field>
          <Field label="Daily amount · VND">
            <NativeInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="e.g. 250000"
            />
          </Field>
          <Field label="Start date · YYYY-MM-DD">
            <NativeInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="End date · YYYY-MM-DD">
            <NativeInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
          </Field>
          <PrimaryButton label="Create surcharge" icon="add" onPress={() => void create()} />
        </View>
      ) : null}
    </View>
  );
}

export function CareTaskTypesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const load = useCallback(() => stableCareService.listTaskTypes(token!), [token]);
  const resource = useApiResource(load, Boolean(token));
  const [name, setName] = useState("");
  const [appliesToAll, setAppliesToAll] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await stableCareService.createTaskType(token!, { name: name.trim(), appliesToAll });
      setName("");
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not create task type"), extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const patch = async (
    item: CareTaskTypeDto,
    input: { name?: string; active?: boolean; appliesToAll?: boolean },
  ) => {
    try {
      await stableCareService.updateTaskType(token!, item.id, input);
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not update task type"), extractErrorMessage(error));
    }
  };
  const rename = async (item: CareTaskTypeDto) => {
    if (!editingName.trim()) {
      Alert.alert(t("Enter a task name"), t("Task type name cannot be blank."));
      return;
    }
    try {
      await stableCareService.updateTaskType(token!, item.id, { name: editingName.trim() });
      setEditingTypeId(null);
      setEditingName("");
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not rename task type"), extractErrorMessage(error));
    }
  };
  return (
    <Screen
      role="manager"
      title="Care task types"
      subtitle="Manage reusable stable care tasks"
      back
      fallbackHref="/manager/operations"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {(resource.data ?? []).map((item) => (
        <Panel key={item.id}>
          <Text style={ui.value}>{item.name}</Text>
          <Text style={ui.muted}>
            {item.active ? t("Active") : t("Inactive")} ·{" "}
            {item.appliesToAll
              ? t("Automatically applies to all horses")
              : t("Can be assigned to one horse")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            <SecondaryButton
              label={item.active ? "Deactivate" : "Reactivate"}
              style={{ flexGrow: 1 }}
              onPress={() => void patch(item, { active: !item.active })}
            />
            <SecondaryButton
              label={item.appliesToAll ? "Make individual" : "Apply to all horses"}
              style={{ flexGrow: 1 }}
              onPress={() => void patch(item, { appliesToAll: !item.appliesToAll })}
            />
            <SecondaryButton
              label={editingTypeId === item.id ? "Cancel rename" : "Rename"}
              style={{ flexGrow: 1 }}
              onPress={() => {
                setEditingTypeId(editingTypeId === item.id ? null : item.id);
                setEditingName(editingTypeId === item.id ? "" : item.name);
              }}
            />
          </View>
          {editingTypeId === item.id ? (
            <>
              <Field label="Task type name">
                <NativeInput value={editingName} onChangeText={setEditingName} />
              </Field>
              <PrimaryButton
                label="Save name"
                onPress={() => void rename(item)}
                disabled={!editingName.trim()}
              />
            </>
          ) : null}
        </Panel>
      ))}
      <SectionTitle>Add care task type</SectionTitle>
      <Field label="Name">
        <NativeInput value={name} onChangeText={setName} placeholder="e.g. Special grooming" />
      </Field>
      <Chips
        options={["Individual task", "Applies to all horses"]}
        value={appliesToAll ? "Applies to all horses" : "Individual task"}
        onChange={(value) => setAppliesToAll(value === "Applies to all horses")}
      />
      <PrimaryButton
        label={saving ? "Saving…" : "Create task type"}
        onPress={() => void create()}
        disabled={saving || !name.trim()}
      />
    </Screen>
  );
}

export function UnappliedSurchargesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const load = useCallback(() => stableCareService.listUnappliedSurcharges(token!), [token]);
  const resource = useApiResource(load, Boolean(token));
  return (
    <Screen
      role="manager"
      title="Surcharges"
      subtitle="Unapplied care charges across the club"
      back
      fallbackHref="/manager/operations"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && (resource.data?.length ?? 0) === 0}
        emptyLabel="No surcharges are awaiting application."
      />
      {(resource.data ?? []).map((surcharge) => (
        <Panel key={surcharge.id}>
          <Text style={ui.value}>
            {surcharge.horseName} · {surcharge.description}
          </Text>
          <Text style={ui.muted}>
            {formatVnd(surcharge.dailyAmount)} / {t("day")} · {surcharge.startDate} → {surcharge.endDate}
          </Text>
          <Text style={ui.muted}>
            {t("Barn")}: {surcharge.barnName ?? t("Unassigned")} · {t("Head Trainer")}:{" "}
            {surcharge.headTrainerName ?? t("Unassigned")}
          </Text>
          <SecondaryButton
            label="Open horse care"
            icon="open-outline"
            onPress={() =>
              router.push(("/manager/horse/" + surcharge.horseId + "/stable-care") as Href)
            }
          />
        </Panel>
      ))}
    </Screen>
  );
}

function todayDate(): string {
  return clubDate();
}
function daysAgoDate(days: number): string {
  const date = new Date(clubDate() + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

function getCareStyles(colors: ThemeColors) {
  return StyleSheet.create({
    planCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    planCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: space.sm,
    },
    planHorseName: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    planCreatorText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    mealsContainer: {
      gap: space.sm,
    },
    mealBox: {
      backgroundColor: colors.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.xs,
    },
    mealBoxHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
    },
    mealBoxTitle: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.1,
    },
    mealItemsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.xs,
      marginTop: space.xs,
    },
    mealItemChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.sm,
      paddingVertical: 5,
    },
    mealItemName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    mealItemQtyBadge: {
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    mealItemQtyText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    mealItemNote: {
      fontSize: 11,
      fontStyle: "italic",
      color: colors.mutedForeground,
    },
    planNoteBox: {
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
      padding: space.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    planNoteText: {
      fontSize: 13,
      color: colors.foreground,
    },
    builderCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.md,
      marginTop: space.sm,
    },
    builderHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      paddingBottom: space.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    builderTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    mealSelectorRow: {
      flexDirection: "row",
      gap: space.xs,
    },
    mealTabBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mealTabBtnActive: {
      backgroundColor: colors.surface,
      borderWidth: 2,
    },
    mealTabBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    quickChipsRow: {
      flexDirection: "row",
      gap: space.xs,
      alignItems: "center",
      flexWrap: "wrap",
    },
    quickQtyChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickQtyChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    configuredLineRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.sm,
      gap: space.sm,
    },
    taskCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    dateRangeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateRangeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    checklistCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    checklistItemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: space.sm,
    },
  });
}
