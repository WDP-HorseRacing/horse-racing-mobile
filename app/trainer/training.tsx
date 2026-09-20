import { type Href, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import type { TrainingPlan, TrainingSession } from "@/lib/raceos-data";
import { Chips, ProgressBar , Metric, Panel, uiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { colors, radius, space } from "@/config/theme";
import { useI18n } from "@/context/I18nContext";

export default function TrainerTraining() {
  const { plans, horses } = useRaceOS();
  const { t } = useI18n();
  const [tab, setTab] = useState("Schedule");
  const sessions = useMemo(
    () =>
      plans
        .flatMap((plan) =>
          plan.phases.flatMap((phase) =>
            phase.sessions.map((session) => ({ plan, phase, session })),
          ),
        )
        .sort((a, b) =>
          `${a.session.date}${a.session.time}`.localeCompare(`${b.session.date}${b.session.time}`),
        ),
    [plans],
  );
  const completed = sessions.filter(({ session }) => session.status === "completed").length;
  const live = sessions.filter(({ session }) => session.status === "in_progress");
  return (
    <Screen
      role="trainer"
      title="Training"
      subtitle="Plans connect one objective to many phased sessions"
    >
      <View style={uiStyles.metricGrid}>
        <Metric
          label="Active plans"
          value={plans.filter((plan) => plan.status === "active").length}
          hint={`${plans.length} ${t("total")}`}
          tone="good"
        />
        <Metric label="Sessions" value={sessions.length} hint={`${completed} ${t("completed")}`} />
        <Metric
          label="Live now"
          value={live.length}
          hint={t("sensor sessions")}
          tone={live.length ? "warning" : "default"}
        />
        <Metric
          label="Horses covered"
          value={new Set(plans.map((plan) => plan.horseId)).size}
          hint={`${horses.length} ${t("in stable")}`}
        />
      </View>
      <Chips options={["Schedule", "Plans", "Live"]} value={tab} onChange={setTab} />
      {tab === "Schedule" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Upcoming sessions</SectionTitle>
          {sessions
            .filter(
              ({ session }) => session.status !== "completed" && session.status !== "cancelled",
            )
            .slice(0, 8)
            .map(({ plan, phase, session }) => (
              <SessionRow key={session.id} plan={plan} phaseName={phase.name} session={session} />
            ))}
        </View>
      ) : null}
      {tab === "Plans" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Goal-based plans</SectionTitle>
          {plans.map((plan) => {
            const horse = horses.find((item) => item.id === plan.horseId);
            const all = plan.phases.flatMap((phase) => phase.sessions);
            const done = all.filter((session) => session.status === "completed").length;
            const progress = all.length ? Math.round((done / all.length) * 100) : 0;
            const activePhase =
              plan.phases.find((phase) =>
                phase.sessions.some((session) =>
                  ["scheduled", "in_progress"].includes(session.status),
                ),
              ) ?? plan.phases[0];
            return (
              <Pressable
                key={plan.id}
                onPress={() => router.push(`/trainer/plan/${plan.horseId}` as Href)}
                style={styles.plan}
              >
                <View style={uiStyles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={uiStyles.muted}>
                      {horse?.name ?? plan.horseId} · {activePhase?.name}
                    </Text>
                  </View>
                  <Text style={styles.progress}>{progress}%</Text>
                </View>
                <Text style={styles.objective}>{plan.objective}</Text>
                <ProgressBar value={progress} />
                <View style={uiStyles.row}>
                  <Text style={uiStyles.label}>
                    {plan.phases.length} phases · {all.length} sessions
                  </Text>
                  <Text style={uiStyles.label}>{plan.targetEvent}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {tab === "Live" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Live telemetry sessions</SectionTitle>
          {live.length ? (
            live.map(({ plan, phase, session }) => (
              <SessionRow key={session.id} plan={plan} phaseName={phase.name} session={session} />
            ))
          ) : (
            <Panel>
              <Text style={uiStyles.value}>{t("No session is live")}</Text>
              <Text style={uiStyles.muted}>
                {t("Scheduled sessions will appear here when sensor streaming begins.")}
              </Text>
            </Panel>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function SessionRow({
  plan,
  phaseName,
  session,
}: {
  plan: TrainingPlan;
  phaseName: string;
  session: TrainingSession;
}) {
  const { t } = useI18n();
  return (
    <Pressable
      onPress={() =>
        router.push(
          `/trainer/plan/${plan.horseId}/session/${session.id}?phaseId=${encodeURIComponent(plan.phases.find((phase) => phase.sessions.some((item) => item.id === session.id))?.id ?? "")}` as Href,
        )
      }
      style={styles.session}
    >
      <View style={styles.date}>
        <Text style={styles.day}>{session.date.slice(8)}</Text>
        <Text style={uiStyles.label}>
          {session.date.slice(5, 7)}/{session.date.slice(2, 4)}
        </Text>
      </View>
      <View style={styles.flex}>
        <View style={uiStyles.row}>
          <Text style={uiStyles.value}>{session.title}</Text>
          <Text style={[styles.status, session.status === "completed" && styles.complete]}>
            {t(session.status)}
          </Text>
        </View>
        <Text style={uiStyles.muted}>
          {session.time} · {phaseName} · {session.distanceM} m · {session.intensity}
        </Text>
        <Text style={uiStyles.label}>{plan.name}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  plan: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  objective: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  progress: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  session: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  date: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  status: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "800",
  },
  complete: { color: colors.primary, backgroundColor: colors.primarySoft },
});
