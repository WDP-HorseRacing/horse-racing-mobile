import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
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
import { horseService } from "@/services/horse.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import {
  hasFeedingMealDuplicate,
  isDateOnly,
  isValidCareTaskRange,
  isValidChecklistRange,
} from "@/features/stable-care/stable-care-validation";
import { clubDate, normalizeVietnamese } from "@/utils/horse-validation";
import { formatDate, formatTime } from "@/utils/formatters";

const MEALS: FeedingMealName[] = ["EARLY_MORNING", "NOON", "AFTERNOON", "EVENING"];

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
  const {
    role: roleParam,
    id: horseIdParam,
    tab: tabParam,
  } = useLocalSearchParams<{
    role: string;
    id: string;
    tab?: string;
  }>();
  const role = isRole(roleParam) ? roleParam : "trainer";
  const horseId = Array.isArray(horseIdParam) ? horseIdParam[0] : horseIdParam;
  const initialTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const options = useMemo(() => {
    const tabs: string[] = [];
    if (["trainer", "manager", "vet", "groom"].includes(role)) tabs.push("Feeding plan");
    if (["trainer", "manager", "vet", "groom"].includes(role)) tabs.push("Care tasks");
    if (["manager", "trainer", "groom"].includes(role)) tabs.push("Daily checklist");
    if (["manager", "trainer", "owner"].includes(role)) tabs.push("Surcharges");
    return tabs;
  }, [role]);
  const [tab, setTab] = useState(() =>
    initialTab && options.includes(initialTab) ? initialTab : (options[0] ?? "Feeding plan"),
  );

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
        horseService.get(token!, horseId).catch(() => null),
      ]),
    [horseId, status, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));

  const [modalVisible, setModalVisible] = useState(false);
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

  const plans = resource.data?.[0] ?? [];
  const feedItems = (resource.data?.[1] ?? []).filter((item) =>
    ["FEED", "SUPPLEMENT"].includes(item.category),
  );
  const horseDetail = resource.data?.[2];
  const currentHorseName = horseDetail?.name ?? plans[0]?.horseName ?? t("Horse");

  const openCreateModal = () => {
    setSelectedPlan(null);
    setLines([]);
    setNote("");
    setLineNote("");
    setQuantity("");
    setItemId(feedItems[0]?.id ?? "");
    setCopyFromPlanId("");
    setTargetIds(horseId);
    setMeal("EARLY_MORNING");
    setModalVisible(true);
  };

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
    setLineNote("");
    setQuantity("");
    setItemId(feedItems[0]?.id ?? "");
    setCopyFromPlanId("");
    setTargetIds(plan.horseId || horseId);
    setMeal("EARLY_MORNING");
    setModalVisible(true);
  };

  const clearEditor = () => {
    setSelectedPlan(null);
    setLines([]);
    setNote("");
    setLineNote("");
    setCopyFromPlanId("");
    setTargetIds(horseId);
  };

  const addOrUpdateLine = () => {
    const parsed = Number(quantity);
    if (!itemId || !Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert(
        t("Check feeding item"),
        t("Choose a feed or supplement and enter a quantity greater than zero."),
      );
      return;
    }

    setLines((current) => {
      const existingIndex = current.findIndex((l) => l.meal === meal && l.supplyItemId === itemId);
      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = {
          meal,
          supplyItemId: itemId,
          quantity: parsed,
          ...(lineNote.trim() ? { note: lineNote.trim() } : {}),
        };
        return updated;
      }
      return [
        ...current,
        {
          meal,
          supplyItemId: itemId,
          quantity: parsed,
          ...(lineNote.trim() ? { note: lineNote.trim() } : {}),
        },
      ];
    });

    setQuantity("");
    setLineNote("");
  };

  const adjustLineQty = (index: number, step: number) => {
    setLines((current) => {
      const line = current[index];
      if (!line) return current;
      const nextQty = Math.round((line.quantity + step) * 10) / 10;
      if (nextQty <= 0) return current;
      const updated = [...current];
      updated[index] = { ...line, quantity: nextQty };
      return updated;
    });
  };

  const editLine = (line: FeedingPlanLineInput) => {
    setMeal(line.meal);
    setItemId(line.supplyItemId);
    setQuantity(String(line.quantity));
    setLineNote(line.note ?? "");
  };

  const handleQuickAddQty = (step: number) => {
    const current = Number(quantity);
    const nextVal =
      Number.isFinite(current) && current > 0 ? Math.round((current + step) * 10) / 10 : step;
    setQuantity(String(nextVal));
  };

  const save = async (approveImmediately = false) => {
    if (!token || (!lines.length && !copyFromPlanId) || saving) return;
    setSaving(true);
    try {
      let savedPlanId = selectedPlan?.id;
      if (selectedPlan) {
        const res = await stableCareService.replaceFeedingPlan(token, selectedPlan.id, {
          items: lines,
          note: note.trim() || null,
        });
        savedPlanId = res.id;
      } else {
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
        const created = await stableCareService.createFeedingPlans(token, {
          horseIds,
          ...(copyFromPlanId ? { copyFromPlanId } : { items: lines }),
          note: note.trim() || undefined,
        });
        savedPlanId = created?.[0]?.id;
      }

      if (approveImmediately && savedPlanId) {
        await stableCareService.approveFeedingPlan(token, savedPlanId);
      }

      setModalVisible(false);
      clearEditor();
      await resource.refresh();
      Alert.alert(
        t("Success"),
        approveImmediately
          ? t("Feeding plan created and approved")
          : t("Feeding plan saved as draft"),
      );
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
      <SectionTitle
        action={
          canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Add feeding plan")}
              onPress={openCreateModal}
              style={careStyles.createPlanBtn}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={careStyles.createPlanBtnText}>{t("Thêm")}</Text>
            </Pressable>
          ) : null
        }
      >
        Feeding plans
      </SectionTitle>

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
        const statusColor = isActive
          ? colors.primary
          : isDraft
            ? colors.monitor
            : colors.mutedForeground;
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
                          <View key={lineIdx} style={careStyles.mealItemCard}>
                            <View style={careStyles.mealItemHeaderRow}>
                              <Text style={careStyles.mealItemName} numberOfLines={1}>
                                {line.name}
                              </Text>
                              <View style={careStyles.mealItemQtyBadge}>
                                <Text style={careStyles.mealItemQtyText}>
                                  {line.quantity} {line.unit}
                                </Text>
                              </View>
                            </View>
                            {line.note ? (
                              <View style={careStyles.mealItemNoteRow}>
                                <Ionicons
                                  name="document-text-outline"
                                  size={12}
                                  color={colors.mutedForeground}
                                />
                                <Text style={careStyles.mealItemNote} numberOfLines={2}>
                                  {line.note}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={careStyles.mealEmptyText}>{t("No items in this meal")}</Text>
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
              <View style={careStyles.cardActionRow}>
                <SecondaryButton
                  label={t("Edit draft plan")}
                  icon="create-outline"
                  style={{ flexGrow: 1 }}
                  onPress={() => beginEdit(plan)}
                />
                <SecondaryButton
                  label={t("Delete")}
                  icon="trash-outline"
                  style={{ flexGrow: 1 }}
                  onPress={() => remove(plan)}
                />
                <PrimaryButton
                  label={t("Approve")}
                  icon="checkmark-outline"
                  style={{ flexGrow: 1 }}
                  onPress={() => approve(plan)}
                />
              </View>
            ) : null}

            {/* Actions for active plans */}
            {canEdit && plan.status === "ACTIVE" ? (
              <View style={careStyles.cardActionRow}>
                <SecondaryButton
                  label={t("Chỉnh sửa / Tạo bản mới")}
                  icon="create-outline"
                  style={{ flexGrow: 1 }}
                  onPress={() => beginEdit(plan)}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      {/* Modern Bottom Sheet Modal for Creating / Editing Feeding Plan */}
      {canEdit ? (
        <BottomSheetModal
          visible={modalVisible}
          title={selectedPlan ? t("Edit draft plan") : t("Create feeding plan")}
          cancelLabel={t("Cancel")}
          onClose={() => {
            setModalVisible(false);
            clearEditor();
          }}
          maxHeight="92%"
        >
          {/* Horse Banner - Showing Name Directly, Not UUID */}
          <View style={careStyles.modalHorseBanner}>
            <View style={careStyles.modalHorseIconContainer}>
              <Ionicons name="nutrition" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={careStyles.modalHorseBannerLabel}>{t("Applicable horse")}</Text>
              <Text style={careStyles.modalHorseBannerName}>{currentHorseName}</Text>
            </View>
          </View>

          <Field label="Plan note">
            <NativeInput value={note} onChangeText={setNote} placeholder="Optional instructions" />
          </Field>

          {!selectedPlan && plans.length ? (
            <View style={{ gap: space.xs }}>
              <Text style={ui.muted}>
                {t("Start with a previous plan, or enter feed items below.")}
              </Text>
              <Chips
                options={[
                  "Build from items",
                  ...plans.map((p) => `Copy ${p.horseName} · ${p.status}`),
                ]}
                value={
                  copyFromPlanId
                    ? `Copy ${plans.find((p) => p.id === copyFromPlanId)?.horseName ?? ""} · ${plans.find((p) => p.id === copyFromPlanId)?.status ?? ""}`
                    : "Build from items"
                }
                onChange={(value) =>
                  setCopyFromPlanId(
                    plans.find((p) => value === `Copy ${p.horseName} · ${p.status}`)?.id ?? "",
                  )
                }
              />
            </View>
          ) : null}

          {!copyFromPlanId || selectedPlan ? (
            <View style={{ gap: space.md, marginTop: space.xs }}>
              {/* 2x2 Meal Selector Grid */}
              <View style={{ gap: 6 }}>
                <Text style={[ui.value, { fontSize: 13, fontWeight: "700" }]}>
                  {t("Select meal to add")}
                </Text>
                <View style={careStyles.mealGrid}>
                  {MEALS.map((entry) => {
                    const meta = MEAL_METADATA[entry];
                    const isSelected = meal === entry;
                    const count = lines.filter((l) => l.meal === entry).length;
                    return (
                      <Pressable
                        key={entry}
                        accessibilityRole="button"
                        onPress={() => setMeal(entry)}
                        style={[
                          careStyles.mealGridCard,
                          isSelected && {
                            borderColor: meta.color,
                            backgroundColor: meta.bg,
                          },
                        ]}
                      >
                        <View style={careStyles.mealGridHeader}>
                          <View
                            style={[
                              careStyles.mealIconCircle,
                              { backgroundColor: isSelected ? meta.color : colors.elevated },
                            ]}
                          >
                            <Ionicons
                              name={meta.icon}
                              size={18}
                              color={isSelected ? "#FFFFFF" : meta.color}
                            />
                          </View>
                          <View
                            style={[
                              careStyles.mealItemCountBadge,
                              count > 0 && {
                                backgroundColor: isSelected ? meta.color : colors.fitSoft,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                careStyles.mealItemCountText,
                                count > 0 && {
                                  color: isSelected ? "#FFFFFF" : colors.primary,
                                  fontWeight: "700",
                                },
                              ]}
                            >
                              {count > 0 ? `${count} ${t("item")}` : t("Empty")}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            careStyles.mealGridLabel,
                            isSelected && { color: meta.color, fontWeight: "800" },
                          ]}
                        >
                          {t(meta.label)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Feed items chips */}
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

              {/* Quantity field + quick stepper */}
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
                label={
                  lines.some((l) => l.meal === meal && l.supplyItemId === itemId)
                    ? t("Update meal item")
                    : t("Add item to meal")
                }
                icon={
                  lines.some((l) => l.meal === meal && l.supplyItemId === itemId)
                    ? "checkmark-circle-outline"
                    : "add-circle-outline"
                }
                onPress={addOrUpdateLine}
                disabled={!itemId}
              />
            </View>
          ) : null}

          {/* Configured Lines with Inline Quantity Adjustment and Quick Edit */}
          {lines.length > 0 ? (
            <View style={{ gap: space.xs, marginTop: space.sm }}>
              <Text style={[ui.value, { fontSize: 13, fontWeight: "700" }]}>
                {t("Configured items in this plan")} ({lines.length})
              </Text>
              {lines.map((line, index) => {
                const itemMeta = feedItems.find((item) => item.id === line.supplyItemId);
                const mealMeta = MEAL_METADATA[line.meal];
                return (
                  <View
                    key={`${line.supplyItemId}-${line.meal}-${index}`}
                    style={careStyles.configuredLineCard}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View
                          style={[
                            careStyles.statusBadge,
                            {
                              backgroundColor: mealMeta.bg,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            },
                          ]}
                        >
                          <Ionicons name={mealMeta.icon} size={12} color={mealMeta.color} />
                          <Text
                            style={[
                              careStyles.statusBadgeText,
                              { color: mealMeta.color, fontSize: 11 },
                            ]}
                          >
                            {t(mealMeta.label)}
                          </Text>
                        </View>
                        <Text style={[ui.value, { flex: 1, fontSize: 14 }]} numberOfLines={1}>
                          {itemMeta?.name ?? "Feed item"}
                        </Text>
                      </View>
                      {line.note ? (
                        <Text
                          style={[ui.muted, { fontSize: 12, fontStyle: "italic" }]}
                          numberOfLines={1}
                        >
                          {line.note}
                        </Text>
                      ) : null}
                    </View>

                    <View style={careStyles.lineStepperRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Decrease quantity")}
                        onPress={() => adjustLineQty(index, -0.5)}
                        style={careStyles.stepperBtn}
                      >
                        <Ionicons name="remove" size={16} color={colors.foreground} />
                      </Pressable>

                      <View style={careStyles.stepperQtyDisplay}>
                        <Text style={careStyles.stepperQtyText}>{line.quantity}</Text>
                        <Text style={careStyles.stepperQtyUnit}>{itemMeta?.unit ?? "unit"}</Text>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Increase quantity")}
                        onPress={() => adjustLineQty(index, 0.5)}
                        style={careStyles.stepperBtn}
                      >
                        <Ionicons name="add" size={16} color={colors.foreground} />
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Edit line details")}
                        onPress={() => editLine(line)}
                        style={careStyles.lineActionBtn}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Remove item")}
                        onPress={() => setLines((curr) => curr.filter((_, idx) => idx !== index))}
                        style={careStyles.lineActionBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Modal Bottom Actions */}
          <View style={careStyles.modalBottomActions}>
            <PrimaryButton
              label={saving ? t("Saving…") : t("Save and approve")}
              icon="checkmark-circle-outline"
              onPress={() => void save(true)}
              disabled={saving || (!lines.length && !copyFromPlanId)}
            />
            <SecondaryButton
              label={saving ? t("Saving…") : t("Save draft")}
              icon="save-outline"
              onPress={() => void save(false)}
              disabled={saving || (!lines.length && !copyFromPlanId)}
            />
          </View>
        </BottomSheetModal>
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
  const canAssign = role === "trainer" || role === "vet";
  const load = useCallback(
    async () =>
      Promise.all([
        stableCareService.listHorseCareTasks(token!, horseId),
        stableCareService.listTaskTypes(token!),
      ]),
    [horseId, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [taskMode, setTaskMode] = useState<"EXTRA" | "EXEMPT">("EXTRA");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState(todayDate());
  const [toDate, setToDate] = useState(todayDate());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const types = (resource.data?.[1] ?? []).filter(
    (item) => item.active && (taskMode === "EXTRA" ? !item.appliesToAll : item.appliesToAll),
  );
  const tasks = resource.data?.[0] ?? [];

  const handleApplyPresetDays = (days: number) => {
    setSelectedDuration(days);
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
    if (taskMode === "EXEMPT" && !note.trim()) {
      Alert.alert(t("Lý do bắt buộc"), t("Vui lòng nhập lý do miễn loại việc chung này."));
      return;
    }
    setSaving(true);
    try {
      await stableCareService.createHorseCareTask(token, horseId, {
        taskTypeId,
        mode: taskMode,
        fromDate,
        toDate,
        note: note.trim() || undefined,
      });
      setNote("");
      setTaskTypeId("");
      setSelectedDuration(null);
      setShowAssignModal(false);
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not assign care task"), extractErrorMessage(error));
    } finally {
      setSaving(false);
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
      <SectionTitle
        action={
          canAssign ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Gán việc")}
              onPress={() => {
                setTaskMode("EXTRA");
                setTaskTypeId("");
                setNote("");
                setSelectedDuration(null);
                setFromDate(todayDate());
                setToDate(todayDate());
                setShowAssignModal(true);
              }}
              style={careStyles.createPlanBtn}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={careStyles.createPlanBtnText}>{t("Thêm")}</Text>
            </Pressable>
          ) : null
        }
      >
        Horse care tasks
      </SectionTitle>

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
              <Text
                style={[careStyles.planHorseName, { fontSize: 16, flexShrink: 1 }]}
                numberOfLines={2}
              >
                {task.taskType.name}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: task.mode === "EXEMPT" ? colors.monitorSoft : colors.fitSoft,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radius.pill,
                marginRight: space.xs,
              }}
            >
              <Text
                style={{
                  color: task.mode === "EXEMPT" ? colors.monitor : colors.primary,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {task.mode === "EXEMPT" ? t("Miễn việc chung") : t("Việc riêng")}
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
              <Text style={careStyles.planNoteText}>
                {task.mode === "EXEMPT" ? `Lý do: ${task.note}` : task.note}
              </Text>
            </View>
          ) : null}
          <Text style={ui.muted}>
            {t("Assigned by")} {task.creator.fullName}
          </Text>
        </View>
      ))}

      {canAssign ? (
        <BottomSheetModal
          visible={showAssignModal}
          title={taskMode === "EXTRA" ? t("Gắn việc riêng") : t("Miễn việc chung")}
          saveLabel={
            saving ? t("Saving…") : taskMode === "EXTRA" ? t("Gán việc") : t("Xác nhận miễn")
          }
          cancelLabel={t("Cancel")}
          saveDisabled={!taskTypeId || (taskMode === "EXEMPT" && !note.trim()) || saving}
          saveLoading={saving}
          onSave={() => void add()}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedDuration(null);
          }}
        >
          <Chips
            options={[t("Gắn việc riêng"), t("Miễn việc chung")]}
            value={taskMode === "EXTRA" ? t("Gắn việc riêng") : t("Miễn việc chung")}
            onChange={(val) => {
              const newMode = val === t("Miễn việc chung") ? "EXEMPT" : "EXTRA";
              setTaskMode(newMode);
              setTaskTypeId("");
              setSelectedDuration(null);
            }}
          />

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
              {taskMode === "EXTRA"
                ? t(
                    "No active individual task types are available. Club Manager can add them under Care task types.",
                  )
                : t("Không có loại việc chung nào để miễn.")}
            </Text>
          )}

          {/* Quick Duration Presets */}
          <View style={careStyles.quickChipsRow}>
            <Text style={ui.muted}>{t("Duration")}:</Text>
            {TASK_DURATION_PRESETS.map((d) => {
              const isSelected = selectedDuration === d;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  onPress={() => handleApplyPresetDays(d)}
                  style={[careStyles.quickQtyChip, isSelected && careStyles.quickQtyChipActive]}
                >
                  <Text
                    style={[
                      careStyles.quickQtyChipText,
                      isSelected && careStyles.quickQtyChipTextActive,
                    ]}
                  >
                    {d === 1 ? t("Today only") : `${d} ${t("days")}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Field label="Start date · YYYY-MM-DD">
            <NativeInput
              value={fromDate}
              onChangeText={(val) => {
                setFromDate(val);
                setSelectedDuration(null);
              }}
              placeholder="YYYY-MM-DD"
            />
          </Field>
          <Field label="End date · YYYY-MM-DD">
            <NativeInput
              value={toDate}
              onChangeText={(val) => {
                setToDate(val);
                setSelectedDuration(null);
              }}
              placeholder="YYYY-MM-DD"
            />
          </Field>
          <Field
            label={
              taskMode === "EXEMPT" ? t("Reason for common task exemption (required) *") : t("Note")
            }
          >
            <NativeInput
              value={note}
              onChangeText={setNote}
              placeholder={
                taskMode === "EXEMPT"
                  ? t("Nhập lý do miễn (vd: Ngựa sốt, kiêng tắm...)")
                  : t("Optional instruction")
              }
            />
          </Field>
        </BottomSheetModal>
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
  const [regenerating, setRegenerating] = useState(false);
  const load = useCallback(
    () => stableCareService.listChecklists(token!, horseId, range.from, range.to),
    [horseId, range.from, range.to, token],
  );
  const resource = useApiResource(load, Boolean(token && horseId));

  const handleRegenerateChecklists = async () => {
    if (!token) return;
    setRegenerating(true);
    try {
      const res = await stableCareService.regenerateChecklistsToday(token);
      await resource.refresh();
      if (res.failures.length === 0) {
        Alert.alert(
          t("Sinh checklist thành công"),
          `${t("Đã sinh")} ${res.generated} ${t("checklist cho các ngựa có Groom còn thiếu.")}`,
        );
      } else {
        Alert.alert(
          t("Sinh checklist hôm nay"),
          `${t("Đã sinh")} ${res.generated} ${t("checklist.")}\n${t("Còn")} ${res.failures.length} ${t("ngựa lỗi:")} ${res.failures.map((f) => f.horseName).join(", ")}`,
        );
      }
    } catch (error) {
      Alert.alert(t("Could not regenerate checklists"), extractErrorMessage(error));
    } finally {
      setRegenerating(false);
    }
  };

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

      {role === "manager" ? (
        <View style={{ marginBottom: space.sm }}>
          <PrimaryButton
            label={regenerating ? t("Đang sinh checklist…") : t("Sinh lại checklist hôm nay")}
            icon="refresh"
            disabled={regenerating}
            onPress={() => void handleRegenerateChecklists()}
          />
        </View>
      ) : null}

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
            <Text style={careStyles.quickQtyChipText}>
              {d} {t("days")}
            </Text>
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
        const isCancelled = checklist.status === "CANCELLED";

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
                  {checklist.completedAt
                    ? ` · ${t("Completed")} ${formatTime(checklist.completedAt)}`
                    : ""}
                </Text>
              </View>
              <View
                style={[
                  careStyles.statusBadge,
                  {
                    backgroundColor: isCancelled
                      ? colors.injuredSoft
                      : isCompleted
                        ? colors.fitSoft
                        : colors.monitorSoft,
                  },
                ]}
              >
                <Ionicons
                  name={
                    isCancelled ? "close-circle" : isCompleted ? "checkmark-circle" : "time-outline"
                  }
                  size={13}
                  color={
                    isCancelled ? colors.destructive : isCompleted ? colors.primary : colors.monitor
                  }
                />
                <Text
                  style={[
                    careStyles.statusBadgeText,
                    {
                      color: isCancelled
                        ? colors.destructive
                        : isCompleted
                          ? colors.primary
                          : colors.monitor,
                    },
                  ]}
                >
                  {isCancelled
                    ? t("Cancelled")
                    : totalItems === 0
                      ? t(isCompleted ? "Completed" : "No tasks assigned")
                      : `${doneItems}/${totalItems} (${progressPct}%)`}
                </Text>
              </View>
            </View>

            {/* Checklist Items */}
            <View style={{ gap: space.xs, marginTop: space.xs }}>
              {totalItems === 0 ? <Text style={ui.muted}>{t("No tasks assigned")}</Text> : null}
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
                  checklist.status !== "INCOMPLETE" &&
                  checklist.status !== "CANCELLED" ? (
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
          {t(
            "Only today’s checklist can be changed. Older or incomplete checklists are read-only.",
          )}
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
  const [showCreateModal, setShowCreateModal] = useState(false);

  const amountError = useMemo(() => {
    if (!amount.trim()) return "";
    const num = Number(amount);
    if (!Number.isInteger(num) || num < 1 || num > 1_000_000_000) {
      return t("Số tiền phải là số nguyên dương từ 1 đến 1.000.000.000 đ/ngày.");
    }
    return "";
  }, [amount, t]);

  const descError = useMemo(() => {
    if (!description.trim()) return "";
    if (description.trim().length > 500) {
      return t("Mô tả không được vượt quá 500 ký tự.");
    }
    return "";
  }, [description, t]);

  const dateError = useMemo(() => {
    if (startDate && !isDateOnly(startDate))
      return t("Ngày bắt đầu không đúng định dạng YYYY-MM-DD.");
    if (startDate && startDate < todayDate()) return t("Ngày bắt đầu không được ở quá khứ.");
    if (endDate && !isDateOnly(endDate)) return t("Ngày kết thúc không đúng định dạng YYYY-MM-DD.");
    if (startDate && endDate && endDate < startDate)
      return t("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
    return "";
  }, [startDate, endDate, t]);
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
        t(
          "Enter a description, a positive whole VND amount up to 1 billion, and valid dates starting today or later.",
        ),
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
      setShowCreateModal(false);
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
              .catch((error) =>
                Alert.alert(t("Could not end surcharge"), extractErrorMessage(error)),
              ),
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
  const surcharges = resource.data ?? [];
  const activeDailyTotal = surcharges
    .filter((s) => s.appliedBy && s.startDate <= today && s.endDate >= today)
    .reduce((sum, s) => sum + (s.dailyAmount || 0), 0);
  const pendingCount = surcharges.filter((s) => !s.appliedBy && s.endDate >= today).length;

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
      {surcharges.length > 0 ? (
        <View style={careStyles.surchargeSummaryCard}>
          <View style={careStyles.surchargeSummaryRow}>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Số khoản phụ phí")}</Text>
              <Text style={careStyles.surchargeSummaryValue}>
                {surcharges.length} {t("khoản")}
              </Text>
            </View>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Tổng phát sinh / ngày")}</Text>
              <Text style={[careStyles.surchargeSummaryValue, { color: colors.primary }]}>
                {formatVnd(activeDailyTotal)}
              </Text>
            </View>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Chờ duyệt")}</Text>
              <Text
                style={[
                  careStyles.surchargeSummaryValue,
                  { color: pendingCount > 0 ? colors.monitor : colors.mutedForeground },
                ]}
              >
                {pendingCount}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
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
            <View
              style={[
                careStyles.statusBadge,
                { backgroundColor: colors.monitorSoft, alignSelf: "flex-start" },
              ]}
            >
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
            <SecondaryButton
              label="Delete"
              icon="trash-outline"
              onPress={() => remove(surcharge)}
            />
          ) : null}
          {canCreate && surcharge.startDate <= today && surcharge.endDate >= today ? (
            <SecondaryButton label="End today" onPress={() => end(surcharge)} />
          ) : null}
        </View>
      ))}
      {canCreate ? (
        <>
          <PrimaryButton
            label="Create surcharge"
            icon="add"
            onPress={() => setShowCreateModal(true)}
          />
          <BottomSheetModal
            visible={showCreateModal}
            title="Create surcharge"
            saveLabel="Save"
            cancelLabel="Cancel"
            onSave={() => void create()}
            onClose={() => setShowCreateModal(false)}
          >
            <Field label="Description">
              <NativeInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder={t("Reason for additional care cost")}
              />
              {descError ? (
                <Text
                  style={{
                    color: colors.destructive,
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {descError}
                </Text>
              ) : null}
            </Field>
            <Field label="Daily amount · VND">
              <NativeInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="e.g. 250000"
              />
              {amountError ? (
                <Text
                  style={{
                    color: colors.destructive,
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {amountError}
                </Text>
              ) : amount.trim() && Number(amount) > 0 ? (
                <Text
                  style={{ color: colors.primary, fontSize: 13, marginTop: 4, fontWeight: "600" }}
                >
                  {formatVnd(Number(amount))} / {t("day")}
                </Text>
              ) : null}
            </Field>
            <Field label="Start date · YYYY-MM-DD">
              <NativeInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="End date · YYYY-MM-DD">
              <NativeInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
              {dateError ? (
                <Text
                  style={{
                    color: colors.destructive,
                    fontSize: 12,
                    marginTop: 4,
                    fontWeight: "600",
                  }}
                >
                  {dateError}
                </Text>
              ) : null}
            </Field>
          </BottomSheetModal>
        </>
      ) : null}
    </View>
  );
}

export function CareTaskTypesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const load = useCallback(() => stableCareService.listTaskTypes(token!), [token]);
  const resource = useApiResource(load, Boolean(token));
  const [name, setName] = useState("");
  const [appliesToAll, setAppliesToAll] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "APPLIES_ALL" | "INDIVIDUAL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  const rawItems = resource.data ?? [];
  const filteredItems = useMemo(() => {
    let list = rawItems;
    if (search.trim()) {
      const q = normalizeVietnamese(search.trim().toLowerCase());
      list = list.filter((item) => normalizeVietnamese(item.name.toLowerCase()).includes(q));
    }
    if (filter === "APPLIES_ALL") {
      list = list.filter((item) => item.appliesToAll);
    } else if (filter === "INDIVIDUAL") {
      list = list.filter((item) => !item.appliesToAll);
    } else if (filter === "ACTIVE") {
      list = list.filter((item) => item.active);
    } else if (filter === "INACTIVE") {
      list = list.filter((item) => !item.active);
    }
    return list;
  }, [rawItems, search, filter]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await stableCareService.createTaskType(token!, { name: name.trim(), appliesToAll });
      setName("");
      setShowAddModal(false);
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
      fallbackHref="/manager"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {/* Search & Actions Header */}
      <View style={{ gap: space.sm, marginBottom: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: space.sm,
              height: 42,
            }}
          >
            <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("Tìm loại việc chăm sóc...")}
              placeholderTextColor={colors.mutedForeground}
              style={{
                flex: 1,
                color: colors.foreground,
                fontSize: 14,
                padding: 0,
              }}
              autoCapitalize="none"
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Thêm loại việc")}
            onPress={() => {
              setName("");
              setAppliesToAll(false);
              setShowAddModal(true);
            }}
            style={careStyles.createPlanBtn}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={careStyles.createPlanBtnText}>{t("Thêm")}</Text>
          </Pressable>
        </View>

        <Chips
          options={[t("Tất cả"), t("Việc chung"), t("Việc riêng"), t("Đang dùng"), t("Tạm dừng")]}
          value={
            filter === "APPLIES_ALL"
              ? t("Việc chung")
              : filter === "INDIVIDUAL"
                ? t("Việc riêng")
                : filter === "ACTIVE"
                  ? t("Đang dùng")
                  : filter === "INACTIVE"
                    ? t("Tạm dừng")
                    : t("Tất cả")
          }
          onChange={(val) => {
            if (val === t("Việc chung")) setFilter("APPLIES_ALL");
            else if (val === t("Việc riêng")) setFilter("INDIVIDUAL");
            else if (val === t("Đang dùng")) setFilter("ACTIVE");
            else if (val === t("Tạm dừng")) setFilter("INACTIVE");
            else setFilter("ALL");
          }}
        />
      </View>

      {/* Cards List matching horse list aesthetic */}
      <View style={{ gap: space.sm }}>
        {filteredItems.map((item) => {
          const isActive = item.active;
          const appliesAll = item.appliesToAll;

          return (
            <View key={item.id} style={careStyles.taskTypeCard}>
              {/* Left Icon mark */}
              <View
                style={[
                  careStyles.taskTypeIconBox,
                  { backgroundColor: isActive ? colors.fitSoft : colors.elevated },
                ]}
              >
                <Ionicons
                  name={appliesAll ? "globe-outline" : "hand-left-outline"}
                  size={22}
                  color={isActive ? colors.primary : colors.mutedForeground}
                />
              </View>

              {/* Middle copy */}
              <View style={careStyles.taskTypeContent}>
                <View style={careStyles.taskTypeHeader}>
                  <Text
                    style={[
                      careStyles.taskTypeName,
                      !isActive && { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <View
                    style={[
                      careStyles.taskTypeStatusBadge,
                      { backgroundColor: isActive ? colors.fitSoft : colors.elevated },
                    ]}
                  >
                    <Text
                      style={[
                        careStyles.taskTypeStatusText,
                        { color: isActive ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {isActive ? t("Đang dùng") : t("Tạm dừng")}
                    </Text>
                  </View>
                </View>

                {/* Scope pill */}
                <View style={careStyles.taskTypeMetaRow}>
                  <View
                    style={[
                      careStyles.taskTypeScopePill,
                      { backgroundColor: appliesAll ? colors.fitSoft : colors.monitorSoft },
                    ]}
                  >
                    <Ionicons
                      name={appliesAll ? "globe-outline" : "person-outline"}
                      size={12}
                      color={appliesAll ? colors.primary : colors.monitor}
                    />
                    <Text
                      style={[
                        careStyles.taskTypeScopeText,
                        { color: appliesAll ? colors.primary : colors.monitor },
                      ]}
                    >
                      {appliesAll ? t("Áp dụng tất cả ngựa") : t("Việc riêng từng con")}
                    </Text>
                  </View>
                </View>

                {/* Actions row */}
                <View style={careStyles.taskTypeActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Đổi tên")}
                    style={careStyles.taskTypeActionBtn}
                    onPress={() => {
                      setEditingTypeId(item.id);
                      setEditingName(item.name);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={13} color={colors.foreground} />
                    <Text style={careStyles.taskTypeActionBtnText}>{t("Đổi tên")}</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={appliesAll ? t("Thành việc riêng") : t("Áp dụng tất cả")}
                    style={careStyles.taskTypeActionBtn}
                    onPress={() => void patch(item, { appliesToAll: !item.appliesToAll })}
                  >
                    <Ionicons name="swap-horizontal" size={13} color={colors.foreground} />
                    <Text style={careStyles.taskTypeActionBtnText}>
                      {appliesAll ? t("Thành việc riêng") : t("Áp dụng tất cả")}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isActive ? t("Tạm dừng") : t("Kích hoạt")}
                    style={[
                      careStyles.taskTypeActionBtn,
                      isActive
                        ? careStyles.taskTypeActionBtnDanger
                        : careStyles.taskTypeActionBtnSuccess,
                    ]}
                    onPress={() => void patch(item, { active: !item.active })}
                  >
                    <Ionicons
                      name={isActive ? "pause-outline" : "play-outline"}
                      size={13}
                      color={isActive ? colors.destructive : colors.primary}
                    />
                    <Text
                      style={[
                        careStyles.taskTypeActionBtnText,
                        { color: isActive ? colors.destructive : colors.primary },
                      ]}
                    >
                      {isActive ? t("Tạm dừng") : t("Kích hoạt")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {!filteredItems.length && !resource.isLoading ? (
          <Text style={[ui.muted, { textAlign: "center", paddingVertical: space.xl }]}>
            {search.trim() || filter !== "ALL"
              ? t("Không tìm thấy loại việc phù hợp.")
              : t("Chưa có loại việc chăm sóc nào.")}
          </Text>
        ) : null}
      </View>

      <BottomSheetModal
        visible={Boolean(editingTypeId)}
        title={t("Đổi tên loại việc")}
        saveLabel={t("Lưu")}
        cancelLabel={t("Cancel")}
        saveDisabled={!editingName.trim()}
        onSave={() => {
          const item = rawItems.find((t) => t.id === editingTypeId);
          if (item) void rename(item);
        }}
        onClose={() => {
          setEditingTypeId(null);
          setEditingName("");
        }}
      >
        <Field label={t("Tên loại việc")}>
          <NativeInput
            value={editingName}
            onChangeText={setEditingName}
            placeholder={t("Nhập tên mới")}
          />
        </Field>
      </BottomSheetModal>

      <BottomSheetModal
        visible={showAddModal}
        title={t("Thêm loại việc chăm sóc")}
        saveLabel={saving ? t("Saving…") : t("Lưu")}
        cancelLabel={t("Cancel")}
        saveDisabled={!name.trim() || saving}
        saveLoading={saving}
        onSave={() => void create()}
        onClose={() => setShowAddModal(false)}
      >
        <Field label={t("Tên loại việc chăm sóc")}>
          <NativeInput
            value={name}
            onChangeText={setName}
            placeholder={t("VD: Chăm sóc đặc biệt, Băng bó...")}
          />
        </Field>
        <Field label={t("Phạm vi áp dụng")}>
          <Chips
            options={[t("Việc riêng từng con"), t("Áp dụng tất cả ngựa")]}
            value={appliesToAll ? t("Áp dụng tất cả ngựa") : t("Việc riêng từng con")}
            onChange={(value) => setAppliesToAll(value === t("Áp dụng tất cả ngựa"))}
          />
        </Field>
      </BottomSheetModal>
    </Screen>
  );
}

export function UnappliedSurchargesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const load = useCallback(() => stableCareService.listUnappliedSurcharges(token!), [token]);
  const resource = useApiResource(load, Boolean(token));
  const surcharges = resource.data ?? [];
  const totalDaily = surcharges.reduce((sum, s) => sum + (s.dailyAmount || 0), 0);

  return (
    <Screen
      role="manager"
      title={t("Phụ phí chăm sóc")}
      subtitle={t("Phụ phí chưa áp dụng trên toàn CLB")}
      back
      fallbackHref="/manager"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && surcharges.length === 0}
        emptyLabel={t("Không có phụ phí nào đang chờ áp dụng.")}
      />
      {surcharges.length > 0 ? (
        <View style={careStyles.surchargeSummaryCard}>
          <View style={careStyles.surchargeSummaryRow}>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Số lượng phụ phí")}</Text>
              <Text style={careStyles.surchargeSummaryValue}>
                {surcharges.length} {t("khoản")}
              </Text>
            </View>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Tổng cộng / ngày")}</Text>
              <Text style={[careStyles.surchargeSummaryValue, { color: colors.primary }]}>
                {formatVnd(totalDaily)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      {surcharges.map((surcharge) => (
        <View key={surcharge.id} style={careStyles.surchargeCard}>
          <View style={careStyles.surchargeCardHeader}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={careStyles.surchargeHorseName}>{surcharge.horseName}</Text>
                {surcharge.barnName ? (
                  <View style={careStyles.surchargeBarnBadge}>
                    <Ionicons name="home-outline" size={11} color={colors.primary} />
                    <Text style={careStyles.surchargeBarnText}>{surcharge.barnName}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={careStyles.surchargeDescription}>{surcharge.description}</Text>
            </View>
            <View style={careStyles.surchargeAmountBadge}>
              <Text style={careStyles.surchargeAmountText}>
                +{formatVnd(surcharge.dailyAmount)} / {t("ngày")}
              </Text>
            </View>
          </View>
          <View style={careStyles.surchargeMetaRow}>
            <View style={careStyles.surchargeMetaItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
              <Text style={careStyles.surchargeMetaText}>
                {surcharge.startDate} → {surcharge.endDate}
              </Text>
            </View>
            {surcharge.headTrainerName ? (
              <View style={careStyles.surchargeMetaItem}>
                <Ionicons name="person-outline" size={13} color={colors.mutedForeground} />
                <Text style={careStyles.surchargeMetaText}>
                  {t("HLV")}: {surcharge.headTrainerName}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ marginTop: space.xs }}>
            <SecondaryButton
              label={t("Mở chăm sóc ngựa")}
              icon="open-outline"
              onPress={() =>
                router.push(
                  ("/manager/horse/" + surcharge.horseId + "/stable-care?tab=Surcharges") as Href,
                )
              }
            />
          </View>
        </View>
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
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: space.xs,
    },
    createPlanBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    createPlanBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    cardActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      marginTop: space.xs,
    },
    mealItemsWrap: {
      gap: 8,
      marginTop: space.xs,
    },
    mealItemCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.sm,
      paddingVertical: 7,
      gap: 4,
    },
    mealItemHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    mealItemName: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      flex: 1,
    },
    mealItemQtyBadge: {
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    mealItemQtyText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
    },
    mealItemNoteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
    },
    mealItemNote: {
      fontSize: 11,
      fontStyle: "italic",
      color: colors.mutedForeground,
      flexShrink: 1,
    },
    mealEmptyText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontStyle: "italic",
      paddingVertical: 2,
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

    // Modal & Builder Styles
    modalHorseBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.fitSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: space.sm,
    },
    modalHorseIconContainer: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    modalHorseBannerLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      textTransform: "uppercase",
    },
    modalHorseBannerName: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    mealGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    mealGridCard: {
      width: "48%",
      backgroundColor: colors.elevated,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: space.sm,
      gap: 6,
    },
    mealGridHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    mealIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    mealItemCountBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
    },
    mealItemCountText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    mealGridLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
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
    quickQtyChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    quickQtyChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    quickQtyChipTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    taskTypeCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
    },
    taskTypeIconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    taskTypeContent: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    taskTypeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    taskTypeName: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    taskTypeStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    taskTypeStatusText: {
      fontSize: 11,
      fontWeight: "700",
    },
    taskTypeMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    taskTypeScopePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    taskTypeScopeText: {
      fontSize: 11,
      fontWeight: "600",
    },
    taskTypeActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      flexWrap: "wrap",
    },
    taskTypeActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
    },
    taskTypeActionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    taskTypeActionBtnDanger: {
      borderColor: colors.injuredSoft,
      backgroundColor: colors.injuredSoft,
    },
    taskTypeActionBtnSuccess: {
      borderColor: colors.fitSoft,
      backgroundColor: colors.fitSoft,
    },
    taskTypeSearchInput: {
      flex: 1,
      height: 40,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.sm,
      color: colors.foreground,
      fontSize: 14,
    },
    configuredLineCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.sm,
      gap: 8,
    },
    lineStepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    stepperBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperQtyDisplay: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
      paddingHorizontal: 4,
    },
    stepperQtyText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.foreground,
    },
    stepperQtyUnit: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    lineActionBtn: {
      padding: 5,
      marginLeft: 2,
    },
    modalBottomActions: {
      gap: space.sm,
      marginTop: space.sm,
      paddingTop: space.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    taskCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    surchargeSummaryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      marginBottom: space.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    surchargeSummaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: space.sm,
    },
    surchargeSummaryCol: {
      flex: 1,
      gap: 3,
    },
    surchargeSummaryLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.mutedForeground,
    },
    surchargeSummaryValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
      fontVariant: ["tabular-nums"],
    },
    surchargeCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
      marginBottom: space.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    surchargeCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: space.sm,
    },
    surchargeHorseName: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
    },
    surchargeDescription: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      marginTop: 2,
    },
    surchargeBarnBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: `${colors.primary}12`,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    surchargeBarnText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primary,
    },
    surchargeAmountBadge: {
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    surchargeAmountText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    surchargeMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.md,
      alignItems: "center",
    },
    surchargeMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    surchargeMetaText: {
      fontSize: 11,
      color: colors.mutedForeground,
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
