import { type Href, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import { getHorse, type TrainingPhase, type TrainingPlan } from "@/lib/raceos-data";
import { Field, NativeInput, ProgressBar } from "@/native/components";
import { Metric, Panel, PrimaryButton, Screen, SectionTitle, uiStyles } from "@/native/ui";
import { colors, radius, space } from "@/native/theme";
import { useI18n } from "@/context/I18nContext";

export default function TrainingPlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { horses, plans, saveTrainingPlan } = useRaceOS();
  const { t } = useI18n();
  const horse = horses.find((item) => item.id === id) ?? getHorse(id);
  const stored = plans.find((item) => item.horseId === horse.id);
  const fallback = useMemo(() => createEmptyPlan(horse.id), [horse.id]);
  const plan = stored ?? fallback;
  const [name, setName] = useState(plan.name);
  const [objective, setObjective] = useState(plan.objective);
  const [targetEvent, setTargetEvent] = useState(plan.targetEvent);
  const sessions = plan.phases.flatMap((phase) => phase.sessions);
  const completed = sessions.filter((session) => session.status === "completed").length;
  const progress = sessions.length ? Math.round((completed / sessions.length) * 100) : 0;
  const save = () => {
    saveTrainingPlan({
      ...plan,
      name,
      objective,
      targetEvent,
      publishedAt: new Date().toISOString(),
    });
    Alert.alert(
      t("Plan published"),
      t("All phase schedules are now visible to groom and veterinarian."),
    );
  };
  return (
    <Screen role="trainer" title={plan.name} subtitle={`${horse.name} · ${plan.status}`} back>
      <View style={styles.hero}>
        <Text style={styles.kicker}>{t("Training objective")}</Text>
        <Text style={styles.objective}>{objective}</Text>
        <View style={styles.target}>
          <Text style={uiStyles.label}>{t("Target event")}</Text>
          <Text style={uiStyles.value}>{targetEvent || t("Not set")}</Text>
        </View>
        <ProgressBar value={progress} />
        <View style={uiStyles.row}>
          <Text style={uiStyles.muted}>{progress}% complete</Text>
          <Text style={uiStyles.muted}>
            {plan.startDate} → {plan.endDate}
          </Text>
        </View>
      </View>
      <View style={uiStyles.metricGrid}>
        <Metric label="Phases" value={plan.phases.length} hint="progressive blocks" />
        <Metric label="Sessions" value={sessions.length} hint={`${completed} completed`} />
        <Metric
          label="Scheduled"
          value={sessions.filter((session) => session.status === "scheduled").length}
          hint="ready for groom"
          tone="good"
        />
        <Metric label="Plan status" value={plan.status} hint="published" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Plan definition</SectionTitle>
        <Panel style={styles.form}>
          <Field label="Plan name">
            <NativeInput value={name} onChangeText={setName} />
          </Field>
          <Field label="Primary objective">
            <NativeInput value={objective} onChangeText={setObjective} multiline />
          </Field>
          <Field label="Target event or milestone">
            <NativeInput value={targetEvent} onChangeText={setTargetEvent} />
          </Field>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Phases & sessions</SectionTitle>
        {[...plan.phases]
          .sort((a, b) => a.order - b.order)
          .map((phase, index) => (
            <PhaseCard key={phase.id} plan={plan} phase={phase} index={index} />
          ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Plan note</SectionTitle>
        <Panel>
          <Text style={uiStyles.muted}>{plan.note}</Text>
        </Panel>
      </View>
      <PrimaryButton label="Publish plan changes" icon="checkmark" onPress={save} />
    </Screen>
  );
}

function PhaseCard({
  plan,
  phase,
  index,
}: {
  plan: TrainingPlan;
  phase: TrainingPhase;
  index: number;
}) {
  const { t } = useI18n();
  const done = phase.sessions.filter((session) => session.status === "completed").length;
  return (
    <View style={styles.phase}>
      <View style={styles.phaseRail}>
        <View style={styles.phaseNumber}>
          <Text style={styles.phaseNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.line} />
      </View>
      <View style={styles.phaseBody}>
        <View style={uiStyles.row}>
          <View style={styles.flex}>
            <Text style={styles.phaseName}>{phase.name}</Text>
            <Text style={uiStyles.muted}>
              {phase.startDate} → {phase.endDate}
            </Text>
          </View>
          <Text style={styles.phaseProgress}>
            {done}/{phase.sessions.length}
          </Text>
        </View>
        <Text style={styles.phaseObjective}>{phase.objective}</Text>
        {phase.sessions.map((session) => (
          <Pressable
            key={session.id}
            onPress={() =>
              router.push(
                `/trainer/plan/${plan.horseId}/session/${session.id}?phaseId=${encodeURIComponent(phase.id)}` as Href,
              )
            }
            style={styles.session}
          >
            <View style={styles.sessionTop}>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text
                style={[styles.sessionStatus, session.status === "completed" && styles.sessionDone]}
              >
                {t(session.status)}
              </Text>
            </View>
            <Text style={uiStyles.muted}>
              {session.date} · {session.time} · {session.type}
            </Text>
            <Text style={uiStyles.label}>
              {session.distanceM} m · {session.durationMin} min · {t(session.intensity)} ·{" "}
              {t(session.surface)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() =>
            router.push(
              `/trainer/plan/${plan.horseId}/session/new?phaseId=${encodeURIComponent(phase.id)}` as Href,
            )
          }
          style={styles.add}
        >
          <Text style={styles.addText}>＋ {t("Add session to this phase")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createEmptyPlan(horseId: string): TrainingPlan {
  return {
    id: `plan-${horseId}`,
    horseId,
    name: "New training plan",
    objective: "Define the primary outcome for this training cycle.",
    status: "draft",
    startDate: "2026-09-18",
    endDate: "2026-10-18",
    targetEvent: "",
    note: "",
    publishedAt: "",
    phases: [
      {
        id: `phase-${horseId}-foundation`,
        name: "Foundation",
        objective: "Establish the baseline required for the plan objective.",
        order: 1,
        startDate: "2026-09-18",
        endDate: "2026-09-28",
        sessions: [],
      },
    ],
  };
}

const styles = StyleSheet.create({
  hero: {
    padding: space.xl,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  objective: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: "800" },
  target: { gap: 3 },
  form: { gap: space.lg },
  phase: { flexDirection: "row", gap: space.md },
  phaseRail: { alignItems: "center", width: 32 },
  phaseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  phaseNumberText: { color: "#FFFFFF", fontWeight: "800" },
  line: { flex: 1, width: 1, minHeight: 40, backgroundColor: colors.border },
  phaseBody: { flex: 1, gap: space.md, paddingBottom: space.xl },
  flex: { flex: 1, gap: 3 },
  phaseName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  phaseProgress: { color: colors.primary, fontWeight: "800" },
  phaseObjective: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  session: {
    gap: 5,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sessionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.sm,
  },
  sessionTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  sessionStatus: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sessionDone: { color: colors.primary, backgroundColor: colors.primarySoft },
  add: {
    alignItems: "center",
    padding: space.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: radius.md,
  },
  addText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});
