import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
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
import {
  trainingService,
  type TrainingPlanDto,
  type TrainingSubjectDto,
} from "@/services/training.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { radius, space } from "@/config/theme";

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
  const ui = getUiStyles(colors);
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
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 2 }}>
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
                        <View key={pIdx} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
                                (item) => `${item.subject.name} (${item.minSessionsPerWeek} buổi/tuần)`,
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
              <View style={ui.row}>
                <SectionTitle>Phase {phaseIndex + 1}</SectionTitle>
                {phases.length > 1 ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setPhases((items) => items.filter((p) => p.id !== phase.id))
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: radius.sm,
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.destructive} />
                    <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: "600" }}>
                      Gỡ giai đoạn
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Field label="Phase length (weeks)">
                <NativeInput
                  value={phase.weeks}
                  onChangeText={(value) =>
                    setPhase(phaseIndex, (item) => ({ ...item, weeks: value }))
                  }
                  keyboardType="number-pad"
                />
              </Field>
              <Text style={ui.label}>
                Choose the subjects in this phase. No weekday pattern is used.
              </Text>
              <View style={{ gap: 8 }}>
                {subjects.map((subject) => {
                  const selected = phase.subjects.find((item) => item.subjectId === subject.id);
                  return (
                    <View
                      key={subject.id}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.fitSoft : colors.surface,
                        padding: 12,
                        borderRadius: 12,
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Pressable
                          onPress={() => toggleSubject(phaseIndex, subject)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <Ionicons
                            name={selected ? "checkmark-circle" : "ellipse-outline"}
                            size={20}
                            color={selected ? colors.primary : colors.mutedForeground}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={ui.value} numberOfLines={1}>
                              {subject.name}
                            </Text>
                            <Text style={ui.muted} numberOfLines={1}>
                              {subject.sessionType.replaceAll("_", " ")} · {subject.intensity} ·{" "}
                              {subject.durationMinutes} min · {subject.plannedDistanceM} m
                            </Text>
                          </View>
                        </Pressable>
                        {selected ? (
                          <Pressable
                            hitSlop={8}
                            onPress={() => toggleSubject(phaseIndex, subject)}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: radius.sm,
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
                            }}
                          >
                            <Text
                              style={{
                                color: colors.destructive,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              Gỡ môn
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {selected ? (
                        <Field label="Minimum sessions each week">
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
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </Panel>
          ))}
          <SecondaryButton
            label="Add phase"
            icon="add"
            disabled={phases.length >= 52}
            onPress={() => setPhases((items) => [...items, emptyPhase()])}
          />
          <Text style={ui.muted}>
            Each phase can be 1–52 weeks; total plan length is at most 104 weeks. A subject can
            appear once per phase.
          </Text>
          <PrimaryButton
            label={saving ? "Saving…" : editingId === "new" ? "Save plan" : "Replace plan"}
            icon="checkmark"
            disabled={saving}
            onPress={() => void save()}
          />
          <SecondaryButton label="Cancel" icon="close" onPress={closeEditor} />
        </>
      ) : null}
    </Screen>
  );
}
