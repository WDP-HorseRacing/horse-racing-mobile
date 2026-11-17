import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
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
  type CareTaskTypeDto,
  type HorseCareTaskDto,
} from "@/services/stable-care.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import {
  isDateOnly,
  isValidCareTaskRange,
} from "@/features/stable-care/stable-care-validation";
import { formatDate } from "@/utils/formatters";
import {
  TASK_DURATION_PRESETS,
  todayDate,
  getCareStyles,
} from "./stableCareHelpers";

export function HorseCareTasksTab({ role, horseId }: { role: string; horseId: string }) {
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

