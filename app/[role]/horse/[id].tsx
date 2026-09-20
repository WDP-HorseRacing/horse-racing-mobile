import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { fitnessTrend, getHorse, raceResults, recoveryTrend, speedTrend } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { Chips, MiniChart, ProgressBar , Metric, Panel, PrimaryButton, StatusBadge, uiStyles } from "@/components/ui";
import { KeyValue, TimelineItem , Screen, SectionTitle } from "@/components/common";
import { isRole } from "@/features/auth/roles";
import { colors, space } from "@/config/theme";

const tabsByRole: Record<RoleId, string[]> = {
  trainer: ["Overview", "Training", "Health", "Performance", "Racing", "Timeline"],
  vet: ["Overview", "Health", "Injuries", "Treatment", "Timeline"],
  groom: ["Overview", "Care", "Timeline"],
  owner: ["Overview", "Health", "Performance", "Racing", "Timeline"],
  manager: ["Overview", "Health", "Performance", "Costs", "Timeline"],
};

export default function HorseProfile() {
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const roleId: RoleId = isRole(role) ? role : "trainer";
  const raceOS = useRaceOS();
  const horse = raceOS.horses.find((item) => item.id === id) ?? getHorse(id);
  const tabs = tabsByRole[roleId];
  const [tab, setTab] = useState(tabs[0]);
  const { plans, lockedHorseIds } = raceOS;
  const plan = plans.find((item) => item.horseId === horse.id && item.status === "active");
  const currentPhase =
    plan?.phases.find((phase) =>
      phase.sessions.some((session) => ["scheduled", "in_progress"].includes(session.status)),
    ) ?? plan?.phases[0];
  const nextSession = currentPhase?.sessions.find((session) =>
    ["planned", "scheduled", "in_progress"].includes(session.status),
  );
  const locked = lockedHorseIds.includes(horse.id);
  if (!isRole(role)) return <Redirect href="/" />;
  return (
    <Screen role={roleId} title={horse.name} subtitle={`${roleId} view · role-scoped data`} back>
      <Panel style={styles.hero}>
        <View style={uiStyles.row}>
          <View style={styles.flex}>
            <Text style={styles.name}>{horse.name}</Text>
            <Text style={uiStyles.muted}>
              {horse.age} yo {horse.sex} · {horse.breed} · {horse.color}
            </Text>
            <Text style={uiStyles.muted}>
              Stall {horse.stall} · {horse.weight} kg · {horse.owner}
            </Text>
          </View>
          <StatusBadge status={locked ? "LOCKED" : horse.status} />
        </View>
        {horse.note ? (
          <View style={uiStyles.alert}>
            <Text style={uiStyles.muted}>{horse.note}</Text>
          </View>
        ) : null}
        <View style={uiStyles.metricGrid}>
          <Metric
            label="Fitness"
            value={`${horse.fitness}%`}
            tone={horse.fitness >= 80 ? "good" : "warning"}
          />
          <Metric label="Readiness" value={horse.readiness} />
          <Metric label="Resting HR" value={horse.hr} hint="bpm" />
        </View>
      </Panel>
      <Chips options={tabs} value={tab} onChange={setTab} />
      {tab === "Overview" ? (
        <>
          <Info
            title="Identity & pedigree"
            items={[
              ["Sire", horse.sire],
              ["Dam", horse.dam],
              ["Age", `${horse.age} years`],
              ["Weight", `${horse.weight} kg`],
              ["Breed", horse.breed],
              ["Stall", horse.stall],
            ]}
          />
          <ChartSection
            title="Fitness trend"
            data={fitnessTrend}
            valueKey="v"
            color={colors.primary}
          />
          <PrimaryButton
            label="View full pedigree"
            icon="git-network-outline"
            onPress={() => router.push(`/${roleId}/pedigree/${horse.id}` as Href)}
          />
          {roleId === "manager" ? (
            <>
              <PrimaryButton
                label="Edit horse profile"
                icon="create-outline"
                onPress={() => router.push(`/manager/edit-horse/${horse.id}`)}
              />
              <PrimaryButton
                label="Manage ownership"
                icon="people-outline"
                onPress={() => router.push(`/manager/owners/${horse.id}`)}
              />
            </>
          ) : null}
        </>
      ) : null}
      {tab === "Training" || tab === "Care" ? (
        <>
          <Info
            title="Current plan"
            items={[
              ["Plan objective", plan?.objective ?? "No active plan"],
              ["Current phase", currentPhase?.name ?? horse.phase],
              ["Next session", nextSession?.title ?? "Not scheduled"],
              ["Distance", nextSession ? `${nextSession.distanceM} m` : "—"],
              ["Intensity", nextSession?.intensity ?? "—"],
              ["Assigned groom", nextSession?.assignedGroom ?? "—"],
            ]}
          />
          {roleId === "trainer" ? (
            <PrimaryButton
              label="Edit training plan"
              icon="create-outline"
              onPress={() => router.push(`/trainer/plan/${horse.id}` as Href)}
            />
          ) : null}
          <ChartSection
            title="Training load"
            data={fitnessTrend}
            valueKey="load"
            color={colors.info}
          />
        </>
      ) : null}
      {(["Health", "Injuries", "Treatment"] as string[]).includes(tab) ? (
        <>
          <Info
            title="Vitals & status"
            items={[
              ["Status", locked ? "LOCKED" : horse.status],
              ["Temperature", "38.2 °C"],
              ["Resting HR", `${horse.hr} bpm`],
              ["Respiration", "16 /min"],
              ["Weight", `${horse.weight} kg`],
              ["Hydration", "Normal"],
            ]}
          />
          <View style={uiStyles.section}>
            <SectionTitle>Recovery</SectionTitle>
            <Panel>
              <View style={uiStyles.row}>
                <Text style={uiStyles.value}>Left hind leg · monitoring</Text>
                <Text style={uiStyles.value}>{horse.recovery ?? 100}%</Text>
              </View>
              <View style={{ height: space.md }} />
              <ProgressBar value={horse.recovery ?? 100} tone={colors.warning} />
              <MiniChart data={recoveryTrend} valueKey="v" color={colors.warning} />
            </Panel>
          </View>
          {roleId === "vet" ? (
            <>
              <PrimaryButton
                label="Record examination"
                onPress={() => router.push(`/vet/exam/${horse.id}`)}
              />
              <PrimaryButton
                label="Open injury mapping"
                onPress={() => router.push(`/vet/injury/${horse.id}`)}
              />
              <PrimaryButton
                label="Lock training"
                icon="lock-closed"
                onPress={() => router.push(`/vet/lock/${horse.id}`)}
              />
            </>
          ) : null}
        </>
      ) : null}
      {tab === "Performance" ? (
        <>
          <ChartSection
            title="Top speed"
            data={speedTrend}
            valueKey="speed"
            color={colors.primary}
          />
          <ChartSection
            title="Peak heart rate"
            data={speedTrend}
            valueKey="hr"
            color={colors.danger}
          />
          <ChartSection
            title="Weekly distance"
            data={fitnessTrend}
            valueKey="load"
            color={colors.info}
          />
        </>
      ) : null}
      {tab === "Racing" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Racing</SectionTitle>
          <Panel>
            <Text style={uiStyles.value}>{horse.nextRace ?? "No entry scheduled"}</Text>
            <Text style={uiStyles.muted}>
              Readiness {horse.readiness} · fitness {horse.fitness}%
            </Text>
          </Panel>
          {raceResults.map((result) => (
            <Panel key={result.name}>
              <View style={uiStyles.row}>
                <View>
                  <Text style={uiStyles.value}>{result.name}</Text>
                  <Text style={uiStyles.muted}>{result.date}</Text>
                </View>
                <Text style={{ ...uiStyles.value, color: colors.primary }}>
                  {result.place} · {result.prize}
                </Text>
              </View>
            </Panel>
          ))}
        </View>
      ) : null}
      {tab === "Costs" ? (
        <Info
          title="Cost of ownership"
          items={[
            ["Training / month", "$3,400"],
            ["Medical / month", "$820"],
            ["Feed & bedding", "$610"],
            ["Prize earnings YTD", "$41,500"],
          ]}
        />
      ) : null}
      {tab === "Timeline" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Timeline</SectionTitle>
          <Panel>
            <TimelineItem
              time="10:41"
              title="Trainer published recovery plan"
              detail="800 m · 50% · light · soft surface"
              tone={colors.primary}
            />
            <TimelineItem
              time="10:24"
              title="Training locked by veterinarian"
              detail="Abnormal heart-rate response"
              tone={colors.danger}
            />
            <TimelineItem
              time="10:06"
              title="System raised HR alert"
              detail="188 bpm sustained 42 s"
              tone={colors.info}
            />
            <TimelineItem
              time="06:20"
              title="Training session executed"
              detail="1,600 m · moderate · dirt"
            />
            <TimelineItem
              time="06:00"
              title="Groom completed preparation"
              detail="Sensor vest fitted by Mai Tran"
              last
            />
          </Panel>
        </View>
      ) : null}
    </Screen>
  );
}

function Info({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <KeyValue items={items} />
      </Panel>
    </View>
  );
}
function ChartSection({
  title,
  data,
  valueKey,
  color,
}: {
  title: string;
  data: Record<string, unknown>[];
  valueKey: string;
  color: string;
}) {
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <MiniChart data={data} valueKey={valueKey} color={color} />
      </Panel>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { gap: space.lg },
  flex: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 25, fontWeight: "800" },
});
