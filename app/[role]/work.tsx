import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { groomTasks, horses, races } from "@/lib/raceos-data";
import { isRole, roles } from "@/features/auth/roles";
import { Panel, PrimaryButton, StatusBadge, uiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { colors, radius, space } from "@/config/theme";

export default function Work() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const [completed, setCompleted] = useState<string[]>(
    groomTasks.filter((task) => task.done).map((task) => task.id),
  );
  if (!isRole(role)) return <Redirect href="/" />;
  return (
    <Screen role={role} title={roles[role].workLabel}>
      {role === "groom" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Today</SectionTitle>
          {groomTasks.map((task) => {
            const done = completed.includes(task.id);
            return (
              <Pressable
                key={task.id}
                onPress={() =>
                  setCompleted((current) =>
                    current.includes(task.id) ? current : [...current, task.id],
                  )
                }
                style={[styles.task, done && styles.taskDone]}
              >
                <Text style={styles.time}>{task.time}</Text>
                <View style={styles.taskCopy}>
                  <Text style={[uiStyles.value, done && styles.doneText]}>{task.title}</Text>
                  <Text style={uiStyles.muted}>
                    {task.horse} · {task.detail}
                  </Text>
                </View>
                <Text style={[styles.check, done && styles.checkDone]}>{done ? "✓" : "○"}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {role === "trainer" ? (
        <>
          <View style={uiStyles.section}>
            <SectionTitle>{"Today's sessions"}</SectionTitle>
            {horses.slice(0, 5).map((horse, index) => (
              <Panel key={horse.id}>
                <View style={uiStyles.row}>
                  <View>
                    <Text style={uiStyles.value}>
                      {["06:00", "06:40", "07:10", "07:40", "08:20"][index]} · {horse.name}
                    </Text>
                    <Text style={uiStyles.muted}>
                      {horse.phase} · {horse.lastSession}
                    </Text>
                  </View>
                  <StatusBadge status={horse.status} />
                </View>
              </Panel>
            ))}
          </View>
          <PrimaryButton
            label="Open live telemetry"
            onPress={() => router.push(`/${role}/live/night-quartz` as Href)}
          />
        </>
      ) : null}

      {role === "vet" ? (
        <>
          <View style={uiStyles.section}>
            <SectionTitle>Medical queue</SectionTitle>
            {horses
              .filter((horse) => ["LOCKED", "INJURED", "MONITOR"].includes(horse.status))
              .map((horse) => (
                <Panel key={horse.id}>
                  <View style={uiStyles.row}>
                    <View>
                      <Text style={uiStyles.value}>{horse.name}</Text>
                      <Text style={uiStyles.muted}>
                        {horse.note ?? `${horse.phase} · recheck required`}
                      </Text>
                    </View>
                    <StatusBadge status={horse.status} />
                  </View>
                </Panel>
              ))}
          </View>
          <PrimaryButton
            label="Review Thunder King"
            onPress={() => router.push(`/${role}/horse/thunder-king` as Href)}
          />
        </>
      ) : null}

      {role === "owner" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Upcoming racing</SectionTitle>
          {races.map((race) => (
            <Panel key={race.name}>
              <Text style={uiStyles.value}>{race.name}</Text>
              <Text style={uiStyles.muted}>
                {race.date} · {race.track}
              </Text>
            </Panel>
          ))}
        </View>
      ) : null}

      {role === "manager" ? (
        <>
          <View style={uiStyles.metricGrid}>
            <Panel style={styles.operation}>
              <Text style={uiStyles.label}>Stable capacity</Text>
              <Text style={styles.big}>18/24</Text>
              <Text style={uiStyles.muted}>75% occupied</Text>
            </Panel>
            <Panel style={styles.operation}>
              <Text style={uiStyles.label}>Staff on duty</Text>
              <Text style={styles.big}>12</Text>
              <Text style={uiStyles.muted}>All areas covered</Text>
            </Panel>
          </View>
          <View style={uiStyles.section}>
            <SectionTitle>Operational exceptions</SectionTitle>
            <View style={uiStyles.warning}>
              <Text style={uiStyles.value}>Low electrolyte stock</Text>
              <Text style={uiStyles.muted}>6 days remaining · purchase request pending</Text>
            </View>
            <View style={uiStyles.alert}>
              <Text style={uiStyles.value}>Two medical cases open</Text>
              <Text style={uiStyles.muted}>Veterinary response is within SLA</Text>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  task: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  taskDone: { opacity: 0.55 },
  time: { color: colors.muted, width: 42, fontSize: 13, fontVariant: ["tabular-nums"] },
  taskCopy: { flex: 1, gap: 3 },
  check: { color: colors.muted, fontSize: 24 },
  checkDone: { color: colors.primary },
  doneText: { textDecorationLine: "line-through" },
  operation: { flexGrow: 1, flexBasis: "45%", gap: space.sm },
  big: { color: colors.text, fontSize: 28, fontWeight: "800" },
});
