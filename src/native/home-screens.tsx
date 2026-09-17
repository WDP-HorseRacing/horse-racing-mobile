import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/native/LocalizedText";
import {
  alerts,
  auditLog,
  clubFinance,
  fitnessTrend,
  horses,
  inventory,
  staff,
  type RoleId,
} from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { AlertCard, MiniChart, TaskCard, TimelineItem } from "./components";
import { HorseRow, Metric, Panel, PrimaryButton, SectionTitle, StatusBadge, uiStyles } from "./ui";
import { colors, space } from "./theme";

export function RoleDashboard({ role }: { role: RoleId }) {
  if (role === "trainer") return <TrainerDashboard />;
  if (role === "groom") return <GroomDashboard />;
  if (role === "vet") return <VetDashboard />;
  if (role === "owner") return <OwnerDashboard />;
  return <ManagerDashboard />;
}

function TrainerDashboard() {
  const attention = horses.filter((horse) =>
    ["MONITOR", "INJURED", "LOCKED"].includes(horse.status),
  );
  const training = horses.filter((horse) => horse.status === "TRAINING");
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Stable fitness" value="78%" hint="+3 pts this week" tone="good" />
        <Metric label="Training today" value={12} hint="4 remaining" />
        <Metric
          label="Attention"
          value={attention.length}
          hint="1 locked · 1 injured"
          tone="warning"
        />
        <Metric label="Race ready" value={2} hint="Autumn Sprint" tone="good" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Stable fitness trend</SectionTitle>
        <Panel>
          <MiniChart data={fitnessTrend} valueKey="v" />
          <Text style={uiStyles.muted}>Fitness index · last seven days</Text>
        </Panel>
      </View>
      {training.map((horse) => (
        <Pressable
          key={horse.id}
          onPress={() => router.push(`/trainer/live/${horse.id}` as Href)}
          style={styles.live}
        >
          <View style={styles.liveDot} />
          <View style={styles.flex}>
            <Text style={uiStyles.value}>{horse.name} · live now</Text>
            <Text style={uiStyles.muted}>{horse.phase} · sensor vest active</Text>
          </View>
          <Text style={styles.liveValue}>{horse.hr} bpm</Text>
        </Pressable>
      ))}
      <View style={uiStyles.section}>
        <SectionTitle>Needs a decision</SectionTitle>
        {alerts.slice(0, 2).map((alert) => (
          <AlertCard key={alert.id} alert={alert} role="trainer" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Attention list</SectionTitle>
        {attention.map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="trainer" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>{"Today's sessions"}</SectionTitle>
        {horses.slice(0, 4).map((horse, index) => (
          <Panel key={horse.id}>
            <View style={uiStyles.row}>
              <View>
                <Text style={uiStyles.value}>
                  {["06:00", "06:40", "07:10", "07:40"][index]} · {horse.name}
                </Text>
                <Text style={uiStyles.muted}>{horse.lastSession}</Text>
              </View>
              <StatusBadge status={horse.status} />
            </View>
          </Panel>
        ))}
      </View>
    </>
  );
}

function GroomDashboard() {
  const { tasks, completeTask } = useRaceOS();
  const done = tasks.filter((task) => task.done).length;
  const next = tasks.find((task) => !task.done);
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Tasks" value={`${done}/${tasks.length}`} hint="today" />
        <Metric
          label="Next"
          value={next?.time ?? "—"}
          hint={next?.horse ?? "All done"}
          tone="warning"
        />
        <Metric label="Flags" value={2} hint="vet instructions" tone="danger" />
      </View>
      {next ? (
        <View style={uiStyles.section}>
          <SectionTitle>Do this next</SectionTitle>
          <TaskCard task={next} onComplete={completeTask} />
        </View>
      ) : null}
      <View style={uiStyles.section}>
        <SectionTitle>Vet instructions</SectionTitle>
        <View style={uiStyles.warning}>
          <Text style={uiStyles.value}>Thunder King</Text>
          <Text style={uiStyles.muted}>Training locked — walk in hand only, 20 min.</Text>
        </View>
        <View style={uiStyles.warning}>
          <Text style={uiStyles.value}>Red Storm</Text>
          <Text style={uiStyles.muted}>Ice bath left fore, 15 min after 08:00.</Text>
        </View>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Horses in your care</SectionTitle>
        {horses.slice(0, 4).map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="groom" />
        ))}
      </View>
      <PrimaryButton
        label="Report an incident"
        icon="camera-outline"
        onPress={() => router.push("/groom/report")}
      />
    </>
  );
}

function VetDashboard() {
  const critical = horses.filter((horse) => ["LOCKED", "INJURED"].includes(horse.status));
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Critical" value={critical.length} hint="needs today" tone="danger" />
        <Metric label="Monitoring" value={1} hint="recheck 48h" tone="warning" />
        <Metric label="Healthy" value={5} hint="no findings" tone="good" />
        <Metric label="Due" value={4} hint="vaccine · farrier" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Critical cases</SectionTitle>
        {critical.map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="vet" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Medical alerts</SectionTitle>
        {alerts.slice(0, 3).map((alert) => (
          <AlertCard key={alert.id} alert={alert} role="vet" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Preventive schedule</SectionTitle>
        {[
          ["Vaccination", "Pale Comet", "Due in 3 days"],
          ["Deworming", "Iron Verdict", "Due in 6 days"],
          ["Farrier", "Golden Hour", "Tomorrow 11:00"],
        ].map(([kind, horse, when]) => (
          <Panel key={kind}>
            <View style={uiStyles.row}>
              <View>
                <Text style={uiStyles.value}>{kind}</Text>
                <Text style={uiStyles.muted}>{horse}</Text>
              </View>
              <Text style={uiStyles.muted}>{when}</Text>
            </View>
          </Panel>
        ))}
      </View>
      <PrimaryButton
        label="Record examination"
        onPress={() => router.push("/vet/exam/thunder-king")}
      />
    </>
  );
}

function OwnerDashboard() {
  const mine = horses.filter((horse) => horse.owner === "Marlow Bloodstock");
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Avg fitness" value="64%" hint="three horses" tone="warning" />
        <Metric label="Race ready" value={0} hint="next Sep 28" />
        <Metric label="Prize YTD" value="$41.5k" hint="season" tone="good" />
      </View>
      <View style={uiStyles.section}>
        {mine.map((horse) => (
          <HorseRow key={horse.id} horse={horse} role="owner" />
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Fitness across your horses</SectionTitle>
        <Panel>
          <MiniChart data={fitnessTrend} valueKey="v" />
          <Text style={uiStyles.muted}>Seven-day fitness trend</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Latest updates</SectionTitle>
        <Panel>
          <TimelineItem
            time="Today"
            title="Thunder King"
            detail="Training paused by veterinarian — recovery plan started"
            tone={colors.danger}
          />
          <TimelineItem
            time="Yesterday"
            title="Red Storm"
            detail="Rehabilitation week 3 · recovery 38%"
            tone={colors.warning}
          />
          <TimelineItem
            time="Saturday"
            title="Pale Comet"
            detail="Foundation work progressing well"
            tone={colors.primary}
            last
          />
        </Panel>
      </View>
    </>
  );
}

function ManagerDashboard() {
  const lowStock = inventory.filter((item) => item.low);
  return (
    <>
      <View style={uiStyles.metricGrid}>
        <Metric label="Active horses" value={horses.length} hint="club-wide" />
        <Metric
          label="Staff on duty"
          value={staff.filter((item) => item.status !== "Off shift").length}
          hint="current shift"
          tone="good"
        />
        <Metric label="Low stock" value={lowStock.length} hint="items" tone="warning" />
        <Metric label="Revenue" value="$104k" hint="September" tone="good" />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Stable operations</SectionTitle>
        {lowStock.map((item) => (
          <View key={item.name} style={uiStyles.warning}>
            <Text style={uiStyles.value}>{item.name}</Text>
            <Text style={uiStyles.muted}>
              {item.stock} {item.unit} remaining · reorder required
            </Text>
          </View>
        ))}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Financial trend</SectionTitle>
        <Panel>
          <MiniChart data={clubFinance} valueKey="revenue" />
          <Text style={uiStyles.muted}>Revenue April–September ($k)</Text>
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Recent audit activity</SectionTitle>
        <Panel>
          {auditLog.slice(0, 3).map((entry, index) => (
            <TimelineItem
              key={`${entry.time}-${entry.action}`}
              time={entry.time}
              title={entry.action}
              detail={`${entry.who} · ${entry.object}`}
              tone={index === 0 ? colors.danger : colors.info}
              last={index === 2}
            />
          ))}
        </Panel>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  liveValue: { color: colors.info, fontSize: 15, fontWeight: "800" },
});
