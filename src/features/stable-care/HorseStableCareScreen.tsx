import { useCallback, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
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
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/config/theme";
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
  const ui = getUiStyles(colors);
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
        "Check feeding item",
        "Choose a feed or supplement and enter a quantity greater than zero.",
      );
      return;
    }
    if (hasFeedingMealDuplicate(lines, meal, itemId)) {
      Alert.alert("Duplicate meal item", "Each feed or supplement can appear only once in a meal.");
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
      Alert.alert("Could not save feeding plan", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const approve = (plan: FeedingPlanDto) =>
    Alert.alert(
      "Approve feeding plan?",
      "This makes the draft active and archives the horse's previous active plan.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () =>
            void stableCareService
              .approveFeedingPlan(token!, plan.id)
              .then(() => resource.refresh())
              .catch((error) => Alert.alert("Could not approve", extractErrorMessage(error))),
        },
      ],
    );
  const remove = (plan: FeedingPlanDto) =>
    Alert.alert("Delete draft?", "This removes the draft feeding plan.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void stableCareService
            .deleteFeedingPlan(token!, plan.id)
            .then(() => resource.refresh())
            .catch((error) => Alert.alert("Could not delete", extractErrorMessage(error))),
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
      {plans.map((plan) => (
        <Panel key={plan.id}>
          <Text style={ui.value}>
            {plan.status} · {plan.horseName}
          </Text>
          {orderedMeals(plan.meals).map((entry) => (
            <Text key={entry.meal} style={ui.muted}>
              {MEAL_LABELS[entry.meal]}:{" "}
              {entry.items
                .map(
                  (line) =>
                    `${line.name} ${line.quantity} ${line.unit}${line.note ? ` (${line.note})` : ""}`,
                )
                .join(", ")}
            </Text>
          ))}
          {plan.note ? <Text style={ui.muted}>{plan.note}</Text> : null}
          <Text style={ui.muted}>
            Created by {plan.creator.fullName}
            {plan.approver ? ` · approved by ${plan.approver.fullName}` : ""}
          </Text>
          {canEdit && plan.status === "DRAFT" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              <SecondaryButton
                label="Edit draft"
                style={{ flexGrow: 1 }}
                onPress={() => beginEdit(plan)}
              />
              <SecondaryButton
                label="Delete"
                style={{ flexGrow: 1 }}
                onPress={() => remove(plan)}
              />
              <PrimaryButton
                label="Approve"
                style={{ flexGrow: 1 }}
                onPress={() => approve(plan)}
              />
            </View>
          ) : null}
        </Panel>
      ))}
      {canEdit ? (
        <>
          <SectionTitle>{selectedPlan ? "Edit draft plan" : "Create feeding plan"}</SectionTitle>
          {!selectedPlan ? (
            <Field label="Horse IDs · one or more, up to 50">
              <NativeInput value={targetIds} onChangeText={setTargetIds} placeholder={horseId} />
            </Field>
          ) : null}
          <Field label="Plan note">
            <NativeInput value={note} onChangeText={setNote} placeholder="Optional instructions" />
          </Field>
          {!selectedPlan && plans.length ? (
            <>
              <Text style={ui.muted}>Start with a previous plan, or enter feed items below.</Text>
              <Chips
                options={[
                  "Build from items",
                  ...plans.map((plan) => "Copy " + plan.horseName + " · " + plan.status),
                ]}
                value={
                  copyFromPlanId
                    ? "Copy " +
                      (plans.find((plan) => plan.id === copyFromPlanId)?.horseName ?? "") +
                      " · " +
                      (plans.find((plan) => plan.id === copyFromPlanId)?.status ?? "")
                    : "Build from items"
                }
                onChange={(value) =>
                  setCopyFromPlanId(
                    plans.find((plan) => value === "Copy " + plan.horseName + " · " + plan.status)
                      ?.id ?? "",
                  )
                }
              />
            </>
          ) : null}
          {!copyFromPlanId || selectedPlan ? (
            <>
              <Chips
                options={MEALS.map((value) => MEAL_LABELS[value])}
                value={MEAL_LABELS[meal]}
                onChange={(value) =>
                  setMeal(MEALS.find((entry) => MEAL_LABELS[entry] === value) ?? MEALS[0])
                }
              />
              <Chips
                options={feedItems.map((item) => item.name)}
                value={feedItems.find((item) => item.id === itemId)?.name ?? ""}
                onChange={(value) =>
                  setItemId(feedItems.find((item) => item.name === value)?.id ?? "")
                }
              />
              <Field label="Quantity">
                <NativeInput
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 2"
                />
              </Field>
              <Field label="Meal item note">
                <NativeInput
                  value={lineNote}
                  onChangeText={setLineNote}
                  placeholder="Optional note for this item"
                />
              </Field>
              <SecondaryButton label="Add item to meal" onPress={addLine} disabled={!itemId} />
            </>
          ) : null}
          {lines.map((line, index) => (
            <Panel key={`${line.supplyItemId}-${line.meal}-${index}`}>
              <View style={ui.row}>
                <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                  {MEAL_LABELS[line.meal]} ·{" "}
                  {feedItems.find((item) => item.id === line.supplyItemId)?.name ?? "Feed item"}
                </Text>
                <SecondaryButton
                  label="Remove"
                  style={{ flexShrink: 0 }}
                  onPress={() =>
                    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
                  }
                />
              </View>
              <Text style={ui.muted}>
                {line.quantity} {feedItems.find((item) => item.id === line.supplyItemId)?.unit}
              </Text>
            </Panel>
          ))}
          <PrimaryButton
            label={saving ? "Saving…" : selectedPlan ? "Save draft" : "Create draft plan"}
            onPress={() => void save()}
            disabled={saving || (!lines.length && !copyFromPlanId)}
          />
          {selectedPlan ? <SecondaryButton label="Cancel edit" onPress={clearEditor} /> : null}
        </>
      ) : null}
    </View>
  );
}

function HorseCareTasksTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
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
  const add = async () => {
    if (!token || !taskTypeId || !isValidCareTaskRange(fromDate, toDate, todayDate())) {
      Alert.alert(
        "Check care task dates",
        "Choose an active task type, start today or later, and an end date within 366 days.",
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
      Alert.alert("Could not assign care task", extractErrorMessage(error));
    }
  };
  const remove = (task: HorseCareTaskDto) =>
    Alert.alert(
      "Remove care task?",
      "An active task will end today; a future task will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            void stableCareService
              .removeHorseCareTask(token!, task.id)
              .then(() => resource.refresh())
              .catch((error) => Alert.alert("Could not remove", extractErrorMessage(error))),
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
        <Panel key={task.id}>
          <View style={ui.row}>
            <Text style={[ui.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
              {task.taskType.name}
            </Text>
            {canAssign ? (
              <SecondaryButton
                label="Remove"
                style={{ flexShrink: 0 }}
                onPress={() => remove(task)}
              />
            ) : null}
          </View>
          <Text style={ui.muted}>
            {task.fromDate} → {task.toDate}
            {task.note ? ` · ${task.note}` : ""}
          </Text>
          <Text style={ui.muted}>Assigned by {task.creator.fullName}</Text>
        </Panel>
      ))}
      {canAssign ? (
        <>
          <SectionTitle>Assign individual task</SectionTitle>
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
              No active individual task types are available. Club Manager can add them under Care
              task types.
            </Text>
          )}
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
            onPress={() => void add()}
            disabled={!taskTypeId}
          />
        </>
      ) : null}
    </View>
  );
}

function DailyChecklistTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
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
      Alert.alert("Could not update checklist", extractErrorMessage(error));
    }
  };
  const refreshRange = () => {
    if (!isValidChecklistRange(from, to)) {
      Alert.alert(
        "Check date range",
        "Choose valid dates with an inclusive range of no more than 31 days.",
      );
      return;
    }
    setRange({ from, to });
  };
  const today = todayDate();
  return (
    <View style={ui.section}>
      <SectionTitle>Daily checklist history</SectionTitle>
      <Field label="From · YYYY-MM-DD">
        <NativeInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
      </Field>
      <Field label="To · YYYY-MM-DD">
        <NativeInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
      </Field>
      <SecondaryButton label="Load up to 31 days" onPress={refreshRange} />
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && (resource.data?.length ?? 0) === 0}
        emptyLabel="No checklists exist in this date range."
      />
      {(resource.data ?? []).map((checklist) => (
        <Panel key={checklist.id}>
          <Text style={ui.value}>
            {checklist.checklistDate} · {checklist.status}
          </Text>
          <Text style={ui.muted}>
            Groom: {checklist.groom.fullName}
            {checklist.completedAt ? ` · Completed ${formatTime(checklist.completedAt)}` : ""}
          </Text>
          {checklist.items.map((item) => (
            <View key={item.id} style={ui.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ui.value} numberOfLines={1}>
                  {item.name} · {item.done ? "Done" : "Incomplete"}
                </Text>
                <Text style={ui.muted} numberOfLines={2}>
                  {item.doer
                    ? `${item.doer.fullName}${item.doneAt ? ` · ${formatTime(item.doneAt)}` : ""}`
                    : "Not completed"}
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
        </Panel>
      ))}
      {role === "groom" ? (
        <Text style={ui.muted}>
          Only today’s checklist can be changed. Older or incomplete checklists are read-only.
        </Text>
      ) : null}
    </View>
  );
}

function HorseSurchargesTab({ role, horseId }: { role: string; horseId: string }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
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
        "Check surcharge details",
        "Enter a description, a positive whole VND amount up to 1 billion, and valid dates starting today or later.",
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
      Alert.alert("Could not create surcharge", extractErrorMessage(error));
    }
  };
  const end = (surcharge: HorseSurchargeDto) =>
    Alert.alert(
      "End surcharge today?",
      "This applies only to a surcharge that has started and is still active.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End today",
          onPress: () =>
            void stableCareService
              .endSurcharge(token!, surcharge.id)
              .then(() => resource.refresh())
              .catch((error) => Alert.alert("Could not end surcharge", extractErrorMessage(error))),
        },
      ],
    );
  const remove = (surcharge: HorseSurchargeDto) =>
    Alert.alert(
      "Delete upcoming surcharge?",
      "Only a surcharge that has not started can be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void stableCareService
              .deleteSurcharge(token!, surcharge.id)
              .then(() => resource.refresh())
              .catch((error) =>
                Alert.alert("Could not delete surcharge", extractErrorMessage(error)),
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
        <Panel key={surcharge.id}>
          <Text style={ui.value}>{surcharge.description}</Text>
          <Text style={ui.value}>{formatVnd(surcharge.dailyAmount)} / day</Text>
          <Text style={ui.muted}>
            {surcharge.startDate} → {surcharge.endDate}
          </Text>
          {surcharge.appliedByName ? (
            <Text style={ui.muted}>
              Applied by {surcharge.appliedByName}
              {surcharge.appliedAt ? ` · ${formatDate(surcharge.appliedAt)}` : ""}
            </Text>
          ) : (
            <Text style={ui.muted}>Awaiting Head Trainer</Text>
          )}
          {canApply && !surcharge.appliedBy && surcharge.endDate >= today ? (
            <PrimaryButton
              label="Apply surcharge"
              onPress={() =>
                void stableCareService
                  .applySurcharge(token!, surcharge.id)
                  .then(() => resource.refresh())
                  .catch((error) =>
                    Alert.alert("Could not apply surcharge", extractErrorMessage(error)),
                  )
              }
            />
          ) : null}
          {canCreate && !surcharge.appliedBy && surcharge.startDate > today ? (
            <SecondaryButton label="Delete" onPress={() => remove(surcharge)} />
          ) : null}
          {canCreate && surcharge.startDate <= today && surcharge.endDate >= today ? (
            <SecondaryButton label="End today" onPress={() => end(surcharge)} />
          ) : null}
        </Panel>
      ))}
      {canCreate ? (
        <>
          <SectionTitle>Create surcharge</SectionTitle>
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
          <PrimaryButton label="Create surcharge" onPress={() => void create()} />
        </>
      ) : null}
    </View>
  );
}

export function CareTaskTypesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
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
      Alert.alert("Could not create task type", extractErrorMessage(error));
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
      Alert.alert("Could not update task type", extractErrorMessage(error));
    }
  };
  const rename = async (item: CareTaskTypeDto) => {
    if (!editingName.trim()) {
      Alert.alert("Enter a task name", "Task type name cannot be blank.");
      return;
    }
    try {
      await stableCareService.updateTaskType(token!, item.id, { name: editingName.trim() });
      setEditingTypeId(null);
      setEditingName("");
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not rename task type", extractErrorMessage(error));
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
            {item.active ? "Active" : "Inactive"} ·{" "}
            {item.appliesToAll
              ? "Automatically applies to all horses"
              : "Can be assigned to one horse"}
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
            {formatVnd(surcharge.dailyAmount)} / day · {surcharge.startDate} → {surcharge.endDate}
          </Text>
          <Text style={ui.muted}>
            Barn: {surcharge.barnName ?? "Unassigned"} · Head Trainer:{" "}
            {surcharge.headTrainerName ?? "Unassigned"}
          </Text>
          <SecondaryButton
            label="Open horse care"
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
