import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
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
import { useI18n } from "@/context/I18nContext";
import {
  trainingService,
  type TrainingPlanDto,
  type TrainingSubjectDto,
} from "@/services/training.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { radius, space } from "@/config/theme";

export function formatSessionType(type: string, t: (key: string) => string): string {
  if (type === "TIME_TRIAL" || type === "TIME TRIAL") return t("Chạy thử");
  if (type === "REGULAR") return t("Thông thường");
  return type.replaceAll("_", " ");
}

export function formatIntensity(intensity: string, t: (key: string) => string): string {
  if (intensity === "LIGHT") return t("Nhẹ");
  if (intensity === "HEAVY") return t("Nặng");
  if (intensity === "MODERATE") return t("Vừa");
  return intensity;
}

type EditorPhase = {
  id: string;
  weeks: string;
  subjects: { subjectId: string; minSessionsPerWeek: string }[];
};
const emptyPhase = (): EditorPhase => ({
  id: Math.random().toString(36).slice(2),
  weeks: "1",
  subjects: [],
});
const EMPTY_PLANS: TrainingPlanDto[] = [];
const EMPTY_SUBJECTS: TrainingSubjectDto[] = [];

export default function TrainerPlans() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const styles = useMemo(() => getPlanStyles(colors), [colors]);
  const { token } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phases, setPhases] = useState<EditorPhase[]>([emptyPhase()]);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const [plans, subjects] = await Promise.all([
      trainingService.listPlans(token!),
      trainingService.listSubjects(token!),
    ]);
    return { plans, subjects };
  }, [token]);
  const resource = useApiResource(load, Boolean(token));
  const plans = resource.data?.plans ?? EMPTY_PLANS;
  const subjects = resource.data?.subjects ?? EMPTY_SUBJECTS;
  const editingPlan = useMemo(
    () => plans.find((plan) => plan.id === editingId) ?? null,
    [editingId, plans],
  );

  const closeEditor = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPhases([emptyPhase()]);
  };

  const editPlan = (plan: TrainingPlanDto) => {
    setName(plan.name);
    setDescription(plan.description ?? "");
    setPhases(
      plan.phases.map((phase) => ({
        id: Math.random().toString(36).slice(2),
        weeks: String(phase.weeks),
        subjects: phase.subjects.map((item) => ({
          subjectId: item.subject.id,
          minSessionsPerWeek: String(item.minSessionsPerWeek),
        })),
      })),
    );
    setEditingId(plan.id);
  };

  const setPhase = (index: number, update: (phase: EditorPhase) => EditorPhase) => {
    setPhases((current) =>
      current.map((phase, phaseIndex) => (phaseIndex === index ? update(phase) : phase)),
    );
  };
  const toggleSubject = (phaseIndex: number, subject: TrainingSubjectDto) => {
    setPhase(phaseIndex, (phase) => ({
      ...phase,
      subjects: phase.subjects.some((row) => row.subjectId === subject.id)
        ? phase.subjects.filter((row) => row.subjectId !== subject.id)
        : [...phase.subjects, { subjectId: subject.id, minSessionsPerWeek: "1" }],
    }));
  };

  const duplicatePhase = (index: number) => {
    setPhases((current) => {
      const source = current[index];
      const cloned: EditorPhase = {
        id: Math.random().toString(36).slice(2),
        weeks: source.weeks,
        subjects: source.subjects.map((s) => ({ ...s })),
      };
      const next = [...current];
      next.splice(index + 1, 0, cloned);
      return next;
    });
  };

  const movePhaseUp = (index: number) => {
    if (index <= 0) return;
    setPhases((current) => {
      const next = [...current];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const movePhaseDown = (index: number) => {
    setPhases((current) => {
      if (index >= current.length - 1) return current;
      const next = [...current];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const save = async () => {
    if (!token) return;
    if (!name.trim() || name.trim().length > 160)
      return Alert.alert("Check the plan name", "Enter a name of 1–160 characters.");
    if (
      !phases.length ||
      phases.length > 52 ||
      phases.some(
        (phase) =>
          !Number.isInteger(Number(phase.weeks)) ||
          Number(phase.weeks) < 1 ||
          Number(phase.weeks) > 52 ||
          !phase.subjects.length,
      )
    ) {
      return Alert.alert(
        "Check the phases",
        "Each phase needs 1–52 weeks and at least one subject.",
      );
    }
    if (phases.reduce((sum, phase) => sum + Number(phase.weeks), 0) > 104)
      return Alert.alert("Plan is too long", "The total plan cannot exceed 104 weeks.");
    if (
      phases.some((phase) =>
        phase.subjects.some(
          (item) =>
            !Number.isInteger(Number(item.minSessionsPerWeek)) ||
            Number(item.minSessionsPerWeek) < 1 ||
            Number(item.minSessionsPerWeek) > 14,
        ),
      )
    ) {
      return Alert.alert(
        "Check weekly minimums",
        "Each subject needs 1–14 minimum sessions per week.",
      );
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        phases: phases.map((phase) => ({
          weeks: Number(phase.weeks),
          subjects: phase.subjects.map((item) => ({
            subjectId: item.subjectId,
            minSessionsPerWeek: Number(item.minSessionsPerWeek),
          })),
        })),
      };
      if (editingId && editingId !== "new")
        await trainingService.replacePlan(token, editingId, input);
      else await trainingService.createPlan(token, input);
      await resource.refresh();
      closeEditor();
      Alert.alert(
        "Saved",
        editingId && editingId !== "new" ? "Training plan updated." : "Training plan created.",
      );
    } catch (error) {
      Alert.alert("Could not save plan", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = (plan: TrainingPlanDto) =>
    Alert.alert(
      "Delete training plan?",
      "The Backend only allows plans with no class to be deleted.",
      [
        { text: "Keep plan", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void (async () => {
              try {
                await trainingService.deletePlan(token!, plan.id);
                await resource.refresh();
              } catch (error) {
                Alert.alert("Could not delete plan", extractErrorMessage(error));
              }
            })(),
        },
      ],
    );

  return (
    <Screen
      role="trainer"
      title={editingId ? (editingPlan ? "Edit training plan" : "Training plan") : "Training plans"}
      subtitle="Head Trainer plans and weekly minimums"
      back
      onBack={editingId ? () => setEditingId(null) : undefined}
      fallbackHref="/trainer/training"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {!editingId ? (
        <>
          <PrimaryButton
            label="Create training plan"
            icon="add-circle-outline"
            onPress={() => {
              setName("");
              setDescription("");
              setPhases([emptyPhase()]);
              setEditingId("new");
            }}
          />
          {resource.data ? (
            <View style={ui.section}>
              <SectionTitle>Plans you own</SectionTitle>
              {plans.length ? (
                plans.map((plan) => (
                  <Panel
                    key={plan.id}
                    style={{
                      gap: space.sm,
                      padding: space.md,
                      borderRadius: radius.md,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: space.sm,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[ui.value, { fontSize: 17, fontWeight: "700" }]}
                          numberOfLines={1}
                        >
                          {plan.name}
                        </Text>
                        {plan.description ? (
                          <Text
                            style={[ui.muted, { fontSize: 13, marginTop: 2 }]}
                            numberOfLines={2}
                          >
                            {plan.description}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: radius.pill,
                          backgroundColor: colors.fitSoft,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                          {plan.totalWeeks} tuần
                        </Text>
                      </View>
                    </View>

                    {/* Summary row */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: space.sm,
                        marginTop: 2,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: colors.elevated,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: radius.sm,
                        }}
                      >
                        <Ionicons name="layers-outline" size={14} color={colors.primary} />
                        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
                          {plan.phases.length} giai đoạn
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          backgroundColor: colors.elevated,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: radius.sm,
                        }}
                      >
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
                          Tối thiểu {plan.minTotalMinutes} phút
                        </Text>
                      </View>
                    </View>

                    {/* Phases breakdown */}
                    <View
                      style={{
                        gap: 6,
                        marginTop: 4,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}
                    >
                      {plan.phases.map((phase, pIdx) => (
                        <View
                          key={pIdx}
                          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                        >
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: colors.elevated,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: colors.mutedForeground,
                              }}
                            >
                              {pIdx + 1}
                            </Text>
                          </View>
                          <Text
                            style={{ fontSize: 12, color: colors.foreground, fontWeight: "600" }}
                          >
                            {phase.weeks} tuần:
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.mutedForeground,
                              flex: 1,
                              minWidth: 0,
                            }}
                            numberOfLines={1}
                          >
                            {phase.subjects
                              .map(
                                (item) =>
                                  `${item.subject.name} (${item.minSessionsPerWeek} buổi/tuần)`,
                              )
                              .join(", ")}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Action buttons */}
                    <View style={{ flexDirection: "row", gap: space.sm, marginTop: 4 }}>
                      <SecondaryButton
                        label="Chỉnh sửa"
                        icon="create-outline"
                        style={{ flex: 1 }}
                        onPress={() => editPlan(plan)}
                      />
                      <SecondaryButton
                        label="Xóa"
                        icon="trash-outline"
                        style={{ flex: 1 }}
                        onPress={() => remove(plan)}
                      />
                    </View>
                  </Panel>
                ))
              ) : (
                <AsyncStateView
                  isLoading={false}
                  error={null}
                  onRetry={() => void resource.refresh()}
                  empty
                  emptyLabel="No training plans yet."
                />
              )}
            </View>
          ) : null}
        </>
      ) : resource.data ? (
        <>
          <Field label="Plan name">
            <NativeInput value={name} onChangeText={setName} placeholder="Name this plan" />
          </Field>
          <Field label="Description">
            <NativeInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Optional training goal"
            />
          </Field>
          {phases.map((phase, phaseIndex) => (
            <Panel key={phase.id} style={{ gap: 12 }}>
              <View style={styles.phaseHeaderRow}>
                <View style={styles.phaseTitleRow}>
                  <Text style={styles.phaseTitleText}>
                    {t("Giai đoạn")} {phaseIndex + 1}
                  </Text>
                  {phases.length > 1 ? (
                    <View style={styles.phaseOrderGroup}>
                      {phaseIndex > 0 ? (
                        <Pressable
                          hitSlop={8}
                          onPress={() => movePhaseUp(phaseIndex)}
                          style={({ pressed }) => [
                            styles.phaseOrderBtn,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            pressed && { opacity: 0.6 },
                          ]}
                          accessibilityLabel={t("Chuyển lên")}
                        >
                          <Ionicons name="chevron-up" size={14} color={colors.foreground} />
                        </Pressable>
                      ) : null}
                      {phaseIndex < phases.length - 1 ? (
                        <Pressable
                          hitSlop={8}
                          onPress={() => movePhaseDown(phaseIndex)}
                          style={({ pressed }) => [
                            styles.phaseOrderBtn,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                            pressed && { opacity: 0.6 },
                          ]}
                          accessibilityLabel={t("Chuyển xuống")}
                        >
                          <Ionicons name="chevron-down" size={14} color={colors.foreground} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {/* Mobile UX Action Chips: Duplicate & Remove */}
                <View style={styles.phaseActionsRow}>
                  <Pressable
                    hitSlop={6}
                    onPress={() => duplicatePhase(phaseIndex)}
                    style={({ pressed }) => [
                      styles.phaseActionChip,
                      {
                        backgroundColor: colors.fitSoft,
                        borderColor: "rgba(5, 150, 105, 0.25)",
                      },
                      pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <Ionicons name="copy-outline" size={13} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                      {t("Nhân bản")}
                    </Text>
                  </Pressable>

                  {phases.length > 1 ? (
                    <Pressable
                      hitSlop={6}
                      onPress={() => setPhases((items) => items.filter((p) => p.id !== phase.id))}
                      style={({ pressed }) => [
                        styles.phaseActionChip,
                        {
                          backgroundColor: colors.injuredSoft,
                          borderColor: "rgba(239, 68, 68, 0.25)",
                        },
                        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={13} color={colors.destructive} />
                      <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: "700" }}>
                        {t("Xóa")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <Field label={t("Thời lượng giai đoạn (tuần)")}>
                <NativeInput
                  value={phase.weeks}
                  onChangeText={(value) =>
                    setPhase(phaseIndex, (item) => ({ ...item, weeks: value }))
                  }
                  keyboardType="number-pad"
                />
              </Field>
              <Text style={ui.label}>
                {t("Chọn các môn trong giai đoạn này. Không cần thiết lập lịch theo thứ trong tuần.")}
              </Text>
              <View style={{ gap: 8 }}>
                {subjects.map((subject) => {
                  const selected = phase.subjects.find((item) => item.subjectId === subject.id);
                  return (
                    <Pressable
                      key={subject.id}
                      onPress={() => toggleSubject(phaseIndex, subject)}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.fitSoft : colors.surface,
                        padding: 12,
                        borderRadius: radius.md,
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <Ionicons
                          name={selected ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={selected ? colors.primary : colors.mutedForeground}
                        />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={[ui.value, { fontSize: 15 }]} numberOfLines={1}>
                            {subject.name}
                          </Text>
                          <Text style={ui.muted} numberOfLines={1}>
                            {formatSessionType(subject.sessionType, t)} · {formatIntensity(subject.intensity, t)} ·{" "}
                            {subject.durationMinutes} {t("phút")} · {subject.plannedDistanceM} m
                          </Text>
                        </View>
                      </View>
                      {selected ? (
                        <View style={{ marginTop: 4 }}>
                          <Field label={t("Số buổi tối thiểu mỗi tuần")}>
                            <NativeInput
                              value={selected.minSessionsPerWeek}
                              onChangeText={(value) =>
                                setPhase(phaseIndex, (item) => ({
                                  ...item,
                                  subjects: item.subjects.map((row) =>
                                    row.subjectId === subject.id
                                      ? { ...row, minSessionsPerWeek: value }
                                      : row,
                                  ),
                                }))
                              }
                              keyboardType="number-pad"
                            />
                          </Field>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </Panel>
          ))}
          <SecondaryButton
            label={t("Thêm giai đoạn")}
            icon="add"
            disabled={phases.length >= 52}
            onPress={() => setPhases((items) => [...items, emptyPhase()])}
          />
          <Text style={ui.muted}>
            Each phase can be 1–52 weeks; total plan length is at most 104 weeks. A subject can
            appear once per phase.
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              gap: 10,
              width: "100%",
              marginTop: 8,
            }}
          >
            <SecondaryButton
              label="Cancel"
              icon="close"
              style={{ flex: 1, minHeight: 48 }}
              onPress={closeEditor}
            />
            <PrimaryButton
              label={saving ? "Saving…" : editingId === "new" ? "Save plan" : "Replace plan"}
              icon="checkmark"
              style={{ flex: 1, minHeight: 48 }}
              disabled={saving}
              onPress={() => void save()}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const getPlanStyles = (colors: any) =>
  StyleSheet.create({
    phaseHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 2,
    },
    phaseTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    phaseTitleText: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.foreground,
    },
    phaseOrderGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    phaseOrderBtn: {
      paddingVertical: 3,
      paddingHorizontal: 6,
      borderRadius: radius.sm,
      borderWidth: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    phaseActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    phaseActionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
  });
