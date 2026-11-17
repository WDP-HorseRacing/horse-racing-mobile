import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle } from "@/components/common";
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
import { radius, space } from "@/config/theme";
import {
  stableCareService,
  orderedMeals,
  type FeedingMealName,
  type FeedingPlanDto,
  type FeedingPlanLineInput,
} from "@/services/stable-care.service";
import { suppliesService } from "@/services/supplies.service";
import { horseService } from "@/services/horse.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { hasFeedingMealDuplicate } from "@/features/stable-care/stable-care-validation";
import { formatDate } from "@/utils/formatters";
import {
  MEALS,
  MEAL_METADATA,
  QUICK_QUANTITIES,
  getCareStyles,
} from "./stableCareHelpers";

export function FeedingPlansTab({ role, horseId }: { role: string; horseId: string }) {
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

