import { type Href, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import type { TrainingPlan, TrainingSession } from "@/lib/raceos-data";
import { Chips, getUiStyles, PrimaryButton } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";

export default function OwnerTraining() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { plans, horses } = useRaceOS();
  const { t } = useI18n();

  // Filter horses to only those owned by Marlow Bloodstock (or current owner logic)
  const myHorses = horses.filter((horse) => horse.owner === "Marlow Bloodstock");
  const myHorseIds = new Set(myHorses.map((h) => h.id));

  const [tab, setTab] = useState("Schedule");

  // Gather all sessions for the owner's horses
  const allSessions = useMemo(
    () =>
      plans
        .filter((plan) => myHorseIds.has(plan.horseId))
        .flatMap((plan) =>
          plan.phases.flatMap((phase) =>
            phase.sessions.map((session) => ({ plan, phase, session })),
          ),
        )
        .sort((a, b) =>
          `${a.session.date}${a.session.time}`.localeCompare(`${b.session.date}${b.session.time}`),
        ),
    [plans, myHorseIds],
  );

  const upcomingSessions = allSessions.filter(
    ({ session }) => session.status !== "completed" && session.status !== "cancelled",
  );
  const completedSessions = allSessions.filter(
    ({ session }) => session.status === "completed"
  ).reverse(); // newest first

  return (
    <Screen
      role="owner"
      title="Training"
      subtitle="Training schedule for your horses"
    >
      <Chips options={["Schedule", "History"]} value={tab} onChange={setTab} />
      
      {tab === "Schedule" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Upcoming / Today</SectionTitle>
          {upcomingSessions.length > 0 ? (
            upcomingSessions.map(({ plan, phase, session }) => (
              <OwnerSessionRow key={session.id} plan={plan} phaseName={phase.name} session={session} />
            ))
          ) : (
            <Text style={uiStyles.muted}>{t("No upcoming training sessions")}</Text>
          )}
        </View>
      ) : null}

      {tab === "History" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Completed sessions</SectionTitle>
          {completedSessions.length > 0 ? (
            completedSessions.map(({ plan, phase, session }) => (
              <OwnerSessionRow key={session.id} plan={plan} phaseName={phase.name} session={session} />
            ))
          ) : (
            <Text style={uiStyles.muted}>{t("No completed sessions")}</Text>
          )}
          <View style={{ marginTop: space.lg }}>
            <PrimaryButton
              label="View Head Trainer Remarks"
              icon="document-text-outline"
              onPress={() => router.push("/owner/remarks")}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function OwnerSessionRow({
  plan,
  phaseName,
  session,
}: {
  plan: TrainingPlan;
  phaseName: string;
  session: TrainingSession;
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { horses } = useRaceOS();
  const i18n = useI18n();
  const horse = horses.find((h) => h.id === plan.horseId);

  return (
    <Pressable
      onPress={() =>
        router.push(`/owner/session/${session.id}?horseId=${plan.horseId}&phaseId=${plan.phases.find((phase) => phase.sessions.some((item) => item.id === session.id))?.id ?? ""}` as Href)
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
          <Text style={[uiStyles.value, { flex: 1 }]} numberOfLines={1}>
            {horse?.name} · {session.title}
          </Text>
          <Text style={[styles.status, session.status === "completed" && styles.complete]}>
            {i18n.t(session.status)}
          </Text>
        </View>
        <Text style={uiStyles.muted}>
          {session.time} · {phaseName} · {session.distanceM} m · {session.surface}
        </Text>
      </View>
    </Pressable>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  flex: { flex: 1, gap: 4 },
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
    backgroundColor: colors.fitSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  status: {
    color: colors.monitor,
    backgroundColor: colors.monitorSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    overflow: "hidden",
  },
  complete: {
    color: colors.primary,
    backgroundColor: colors.fitSoft,
  },
});
