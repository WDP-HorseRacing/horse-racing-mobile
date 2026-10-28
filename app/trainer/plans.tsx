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
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [expandedPlanCards, setExpandedPlanCards] = useState<Record<string, boolean>>({});

  const totalWeeks = useMemo(
    () => phases.reduce((sum, phase) => sum + (Number(phase.weeks) || 0), 0),
    [phases],
  );
  const totalMinSessions = useMemo(
    () =>
      phases.reduce(
        (sum, phase) =>
          sum +
          phase.subjects.reduce(
            (subSum, s) => subSum + (Number(s.minSessionsPerWeek) || 0),
            0,
          ),
        0,
      ),
    [phases],
  );

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
    setExpandedPhases({});
  };

  const editPlan = (plan: TrainingPlanDto) => {
    setName(plan.name);
    setDescription(plan.description ?? "");
    const loadedPhases = plan.phases.map((phase) => ({
      id: Math.random().toString(36).slice(2),
      weeks: String(phase.weeks),
      subjects: phase.subjects.map((item) => ({
        subjectId: item.subject.id,
        minSessionsPerWeek: String(item.minSessionsPerWeek),
      })),
    }));
    setPhases(loadedPhases);
    setExpandedPhases({ [loadedPhases[0]?.id ?? "0"]: true });
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
      setExpandedPhases((prev) => ({ ...prev, [cloned.id]: true }));
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
      title={
        editingId
          ? editingId === "new"
            ? t("Tạo giáo án")
            : t("Sửa giáo án")
          : t("Giáo án huấn luyện")
      }
      subtitle={
        editingId
          ? t("Thiết lập giai đoạn và số buổi tối thiểu")
          : t("Giáo án HLV và quy định tuần")
      }
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
            label={t("Tạo giáo án mới")}
            icon="add-circle-outline"
            onPress={() => {
              setName("");
              setDescription("");
              const p = emptyPhase();
              setPhases([p]);
              setExpandedPhases({ [p.id]: true });
              setEditingId("new");
            }}
          />
          {resource.data ? (
            <View style={ui.section}>
              <SectionTitle>{t("Plans you own")}</SectionTitle>
              {plans.length ? (
                plans.map((plan) => {
                  const isExpanded = Boolean(expandedPlanCards[plan.id]);
                  return (
                    <Panel
                      key={plan.id}
                      style={{
                        gap: space.xs,
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
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text
                            style={[ui.value, { fontSize: 16, fontWeight: "700" }]}
                            numberOfLines={1}
                          >
                            {plan.name}
                          </Text>
                          {plan.description ? (
                            <Text
                              style={[ui.muted, { fontSize: 12 }]}
                              numberOfLines={2}
                            >
                              {plan.description}
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: radius.pill,
                            backgroundColor: colors.fitSoft,
                            alignSelf: "flex-start",
                          }}
                        >
                          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                            {plan.totalWeeks} {t("tuần")}
                          </Text>
                        </View>
                      </View>

                      {/* Summary Metrics Pills Row */}
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        <View style={styles.metricPill}>
                          <Ionicons name="layers-outline" size={13} color={colors.primary} />
                          <Text style={styles.metricPillText}>
                            {plan.phases.length} {t("giai đoạn")}
                          </Text>
                        </View>
                        <View style={styles.metricPill}>
                          <Ionicons name="time-outline" size={13} color={colors.primary} />
                          <Text style={styles.metricPillText}>
                            {t("Tối thiểu")} {plan.minTotalMinutes} {t("phút")}
                          </Text>
                        </View>
                      </View>

                      {/* Collapsible Phase Breakdown Toggle */}
                      <Pressable
                        onPress={() =>
                          setExpandedPlanCards((prev) => ({
                            ...prev,
                            [plan.id]: !isExpanded,
                          }))
                        }
                        style={styles.phaseToggleBtn}
                      >
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.phaseToggleText}>
                          {isExpanded
                            ? t("Thu gọn chi tiết")
                            : `${t("Chi tiết")} ${plan.phases.length} ${t("giai đoạn")}`}
                        </Text>
                      </Pressable>

                      {/* Expanded Phases Breakdown */}
                      {isExpanded ? (
                        <View style={styles.expandedPhasesList}>
                          {plan.phases.map((phase, pIdx) => (
                            <View
                              key={pIdx}
                              style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
                            >
                              <View style={styles.miniPhaseBadge}>
                                <Text style={styles.miniPhaseBadgeText}>{pIdx + 1}</Text>
                              </View>
                              <View style={{ flex: 1, gap: 1 }}>
                                <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600" }}>
                                  {phase.weeks} {t("tuần")}:
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                                  {phase.subjects
                                    .map(
                                      (item) =>
                                        `${item.subject.name} (${item.minSessionsPerWeek} ${t("buổi/tuần")})`,
                                    )
                                    .join(", ")}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {/* Compact Action Chips */}
                      <View style={styles.planCardActions}>
                        <Pressable
                          style={styles.planActionChip}
                          onPress={() => editPlan(plan)}
                          accessibilityRole="button"
                          accessibilityLabel={t("Edit")}
                        >
                          <Ionicons name="create-outline" size={13} color={colors.primary} />
                          <Text style={[styles.planActionChipText, { color: colors.primary }]}>
                            {t("Edit")}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.planActionChip, { backgroundColor: colors.injuredSoft }]}
                          onPress={() => remove(plan)}
                          accessibilityRole="button"
                          accessibilityLabel={t("Delete")}
                        >
                          <Ionicons name="trash-outline" size={13} color={colors.destructive} />
                          <Text style={[styles.planActionChipText, { color: colors.destructive }]}>
                            {t("Delete")}
                          </Text>
                        </Pressable>
                      </View>
                    </Panel>
                  );
                })
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
          {/* Form Completion Progress Card */}
          <View style={styles.planProgressCard}>
            <View style={styles.planProgressRow}>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.planProgressTitle}>
                  {t("Thời lượng:")} {totalWeeks} / 104 {t("tuần")}
                </Text>
                <Text style={styles.planProgressSubtitle}>
                  {phases.length} {t("giai đoạn")} · {totalMinSessions} {t("buổi tối thiểu/tuần")}
                </Text>
              </View>
              <View
                style={[
                  styles.progressPill,
                  totalWeeks > 104 ? styles.progressPillDanger : styles.progressPillSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.progressPillText,
                    totalWeeks > 104 ? { color: colors.destructive } : { color: colors.primary },
                  ]}
                >
                  {totalWeeks <= 104 ? `${Math.round((totalWeeks / 104) * 100)}%` : t("Vượt quá")}
                </Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(100, (totalWeeks / 104) * 100)}%`,
                    backgroundColor: totalWeeks > 104 ? colors.destructive : colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          <Field label={t("Plan name")}>
            <NativeInput value={name} onChangeText={setName} placeholder={t("Name this plan")} />
          </Field>
          <Field label={t("Description")}>
            <NativeInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder={t("Optional training goal")}
            />
          </Field>

          {/* Accordion / Collapsible Phase Cards */}
          {phases.map((phase, phaseIndex) => {
            const isExpanded = expandedPhases[phase.id] ?? (phaseIndex === 0);
            return (
              <Panel key={phase.id} style={{ gap: isExpanded ? 10 : 0 }}>
                <Pressable
                  style={styles.phaseAccordionHeader}
                  onPress={() =>
                    setExpandedPhases((prev) => ({
                      ...prev,
                      [phase.id]: !isExpanded,
                    }))
                  }
                >
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={styles.phaseNumberBadge}>
                      <Text style={styles.phaseNumberText}>{phaseIndex + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.phaseTitleText}>
                        {t("Giai đoạn")} {phaseIndex + 1}
                      </Text>
                      <Text style={ui.muted} numberOfLines={1}>
                        {phase.weeks} {t("tuần")} · {phase.subjects.length} {t("môn")}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {phases.length > 1 ? (
                      <View style={styles.phaseOrderGroup}>
                        {phaseIndex > 0 ? (
                          <Pressable
                            hitSlop={8}
                            onPress={() => movePhaseUp(phaseIndex)}
                            style={styles.phaseOrderBtn}
                            accessibilityLabel={t("Chuyển lên")}
                          >
                            <Ionicons name="chevron-up" size={13} color={colors.foreground} />
                          </Pressable>
                        ) : null}
                        {phaseIndex < phases.length - 1 ? (
                          <Pressable
                            hitSlop={8}
                            onPress={() => movePhaseDown(phaseIndex)}
                            style={styles.phaseOrderBtn}
                            accessibilityLabel={t("Chuyển xuống")}
                          >
                            <Ionicons name="chevron-down" size={13} color={colors.foreground} />
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    <Pressable
                      hitSlop={6}
                      onPress={() => duplicatePhase(phaseIndex)}
                      style={styles.phaseSmallChip}
                      accessibilityLabel={t("Nhân bản")}
                    >
                      <Ionicons name="copy-outline" size={13} color={colors.primary} />
                    </Pressable>

                    {phases.length > 1 ? (
                      <Pressable
                        hitSlop={6}
                        onPress={() =>
                          setPhases((items) => items.filter((p) => p.id !== phase.id))
                        }
                        style={[styles.phaseSmallChip, { backgroundColor: colors.injuredSoft }]}
                        accessibilityLabel={t("Xóa")}
                      >
                        <Ionicons name="trash-outline" size={13} color={colors.destructive} />
                      </Pressable>
                    ) : null}

                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View style={{ gap: 10, marginTop: 4 }}>
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
                      {t("Chọn các môn trong giai đoạn này:")}
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
                              padding: 10,
                              borderRadius: radius.md,
                              gap: 6,
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
                                size={20}
                                color={selected ? colors.primary : colors.mutedForeground}
                              />
                              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                                <Text style={[ui.value, { fontSize: 14 }]} numberOfLines={1}>
                                  {subject.name}
                                </Text>
                                <Text style={ui.muted} numberOfLines={1}>
                                  {formatSessionType(subject.sessionType, t)} · {formatIntensity(subject.intensity, t)} ·{" "}
                                  {subject.durationMinutes} {t("phút")} · {subject.plannedDistanceM} m
                                </Text>
                              </View>
                            </View>
                            {selected ? (
                              <View style={{ marginTop: 2 }}>
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
                  </View>
                ) : null}
              </Panel>
            );
          })}

          <SecondaryButton
            label={t("Thêm giai đoạn")}
            icon="add"
            disabled={phases.length >= 52}
            onPress={() => {
              const p = emptyPhase();
              setPhases((items) => [...items, p]);
              setExpandedPhases((prev) => ({ ...prev, [p.id]: true }));
            }}
          />

          <Text style={ui.muted}>
            {t("Mỗi giai đoạn từ 1–52 tuần; tổng thời lượng tối đa 104 tuần.")}
          </Text>

          {/* Fixed Bottom CTA Container */}
          <View style={styles.fixedCtaContainer}>
            <SecondaryButton
              label={t("Cancel")}
              icon="close"
              style={{ flex: 1, minHeight: 46 }}
              onPress={closeEditor}
            />
            <PrimaryButton
              label={saving ? t("Saving…") : editingId === "new" ? t("Save plan") : t("Replace plan")}
              icon="checkmark"
              style={{ flex: 1, minHeight: 46 }}
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
    planProgressCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.xs,
    },
    planProgressRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    planProgressTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    planProgressSubtitle: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    progressPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    progressPillSuccess: {
      backgroundColor: colors.fitSoft,
    },
    progressPillDanger: {
      backgroundColor: colors.injuredSoft,
    },
    progressPillText: {
      fontSize: 11,
      fontWeight: "800",
    },
    progressTrack: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      borderRadius: radius.pill,
    },
    metricPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    metricPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.foreground,
    },
    phaseToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 4,
      alignSelf: "flex-start",
    },
    phaseToggleText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    expandedPhasesList: {
      gap: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    miniPhaseBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    miniPhaseBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
    },
    planCardActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: 2,
    },
    planActionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
    },
    planActionChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    phaseAccordionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 2,
    },
    phaseNumberBadge: {
      width: 26,
      height: 26,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    phaseNumberText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
    },
    phaseTitleText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    phaseOrderGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    phaseOrderBtn: {
      paddingVertical: 3,
      paddingHorizontal: 5,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    phaseSmallChip: {
      padding: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    fixedCtaContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      width: "100%",
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
