import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { fitnessTrend, getHorse, raceResults, recoveryTrend, speedTrend } from "@/lib/raceos-data";
import type { RoleId } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { Chips, MiniChart, ProgressBar , Metric, Panel, PrimaryButton, StatusBadge, getUiStyles } from "@/components/ui";
import { KeyValue, TimelineItem , Screen, SectionTitle } from "@/components/common";
import { isRole } from "@/features/auth/roles";
import { space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { trainingService } from "@/services/training.service";
import { formatDistance, formatDurationMs, formatWeight } from "@/utils/formatters";
import { horseService } from "@/services/horse.service";
import { mapHorseDetailToPrototype } from "@/adapters/horse.adapter";

const tabsByRole: Record<RoleId, string[]> = {
  trainer: ["Overview", "Training", "Health", "Performance", "Racing", "Timeline"],
  vet: ["Overview", "Training", "Health", "Injuries", "Treatment", "Timeline"],
  groom: ["Overview", "Care", "Timeline"],
  owner: ["Overview", "Training", "Health", "Performance", "Racing", "Timeline"],
  manager: ["Overview", "Health", "Performance", "Costs", "Timeline"],
};

export default function HorseProfile() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const uiStyles = getUiStyles(colors);
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const roleId: RoleId = isRole(role) ? role : "trainer";
  const raceOS = useRaceOS();
  const tabs = tabsByRole[roleId];
  const [tab, setTab] = useState(tabs[0]);
  const { plans, lockedHorseIds } = raceOS;
  const { token } = useAuth();
  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token) && isUuid(id));
  const loadHorseSessions = useCallback(
    () => trainingService.listHorseSessions(token!, id),
    [id, token],
  );
  const trainingResource = useApiResource(
    loadHorseSessions,
    Boolean(token) && roleId !== "groom" && isUuid(id),
  );
  const mockHorse = raceOS.horses.find((item) => item.id === id) ?? getHorse(id);
  const horse = horseResource.data ? mapHorseDetailToPrototype(horseResource.data) : mockHorse;
  const plan = plans.find((item) => item.horseId === horse.id && item.status === "active");
  const currentPhase =
    plan?.phases.find((phase) =>
      phase.sessions.some((session) => ["scheduled", "in_progress"].includes(session.status)),
    ) ?? plan?.phases[0];
  const nextSession = currentPhase?.sessions.find((session) =>
    ["planned", "scheduled", "in_progress"].includes(session.status),
  );
  const locked = lockedHorseIds.includes(horse.id) || Boolean(horseResource.data?.activeTrainingLock);
  if (!isRole(role)) return <Redirect href="/" />;
  if (isUuid(id) && !horseResource.data) {
    return (
      <Screen
        role={roleId}
        title="Horse profile"
        back
        refreshing={horseResource.isRefreshing || trainingResource.isRefreshing}
        onRefresh={() => void Promise.all([horseResource.refresh(), trainingResource.refresh()])}
      >
        <AsyncStateView
          isLoading={horseResource.isLoading}
          error={horseResource.error}
          onRetry={() => void horseResource.retry()}
        />
      </Screen>
    );
  }
  return (
    <Screen
      role={roleId}
      title={horse.name}
      subtitle={`${roleId} view · ${horseResource.data ? "backend profile" : "demo profile"}`}
      back
      refreshing={horseResource.isRefreshing || trainingResource.isRefreshing}
      onRefresh={() => void Promise.all([horseResource.refresh(), trainingResource.refresh()])}
    >
      <AsyncStateView
        isLoading={false}
        error={horseResource.error}
        onRetry={() => void horseResource.retry()}
      />
      <Panel style={styles.hero}>
        <View style={uiStyles.row}>
          <View style={styles.flex}>
            <Text style={styles.name}>{horse.name}</Text>
            <Text style={uiStyles.muted}>
              {horse.age ? `${horse.age} yo ` : ""}{horse.sex} · {horse.breed} · {horse.color}
            </Text>
            <Text style={uiStyles.muted}>
              Stall {horse.stall} · {horse.weight ? formatWeight(horse.weight) : "Weight not recorded"} · {horse.owner}
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
            value={horseResource.data ? "—" : `${horse.fitness}%`}
            tone={horse.fitness >= 80 ? "good" : "warning"}
          />
          <Metric
            label="Readiness"
            value={horseResource.data
              ? horseResource.data.eligibility.trainingEligible ? "Eligible" : "Restricted"
              : horse.readiness}
          />
          <Metric
            label="Resting HR"
            value={horseResource.data || !horse.hr ? "—" : horse.hr}
            hint={horseResource.data || !horse.hr ? undefined : "bpm"}
          />
        </View>
      </Panel>
      <Chips options={tabs} value={tab} onChange={setTab} />
      {tab === "Overview" ? (
        <>
          {horseResource.data ? (
            <Info
              title="Horse profile"
              items={[
                ["Health status", horseResource.data.healthStatus.replaceAll("_", " ")],
                ["Lifecycle", horseResource.data.lifecycleStatus.replaceAll("_", " ")],
                ["Eligibility", horseResource.data.eligibility.trainingEligible ? "Eligible for training" : "Training restricted"],
                ["Owner", horseResource.data.owner?.fullName ?? "Unassigned"],
                ["Barn", horseResource.data.location?.barn?.name ?? "Not assigned"],
                ["Stall", horseResource.data.location?.stall?.code ?? "Not assigned"],
                ["Latest weight", horse.weight ? formatWeight(horse.weight) : "Not recorded"],
              ]}
            />
          ) : (
            <>
              <Info
                title="Identity & pedigree"
                items={[
                  ["Sire", horse.sire],
                  ["Dam", horse.dam],
                  ["Age", `${horse.age} years`],
                  ["Weight", horse.weight ? formatWeight(horse.weight) : "—"],
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
            </>
          )}
          {!horseResource.data && roleId === "manager" ? (
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
      {tab === "Training" ? (
        <>
          <AsyncStateView
            isLoading={trainingResource.isLoading}
            error={trainingResource.error}
            onRetry={() => void trainingResource.retry()}
          />
          {trainingResource.data?.length ? (
            <View style={uiStyles.section}>
              <SectionTitle>Class sessions</SectionTitle>
              {trainingResource.data.map((session) => (
                <Panel key={session.id}>
                  <View style={uiStyles.row}>
                    <View style={styles.flex}>
                      <Text style={uiStyles.value}>{session.title}</Text>
                      <Text style={uiStyles.muted}>{session.className} · {session.planName}</Text>
                    </View>
                    <Text style={uiStyles.label}>{session.status.replaceAll("_", " ")}</Text>
                  </View>
                  <Text style={uiStyles.muted}>
                    {session.scheduledStartLabel}
                    {session.distanceM == null ? "" : ` · ${formatDistance(session.distanceM)}`}
                    {session.surface ? ` · ${session.surface}` : ""}
                  </Text>
                  {session.trials.length ? (
                    <Text style={uiStyles.label}>
                      Trial: {session.trials.map((trial) => trial.elapsedLabel).join(" · ")}
                    </Text>
                  ) : null}
                  {session.targetTimeMs != null ? (
                    <Text style={uiStyles.label}>Target {formatDurationMs(session.targetTimeMs)}</Text>
                  ) : null}
                  {session.evaluation?.comment ? (
                    <Text style={uiStyles.muted}>{session.evaluation.comment}</Text>
                  ) : null}
                </Panel>
              ))}
            </View>
          ) : trainingResource.data ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="This horse has no class sessions."
            />
          ) : !trainingResource.isLoading && !trainingResource.error && !isUuid(id) ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => undefined}
              empty
              emptyLabel="Training sessions are loaded for horse profiles returned by the backend."
            />
          ) : null}
          {roleId === "trainer" && !horseResource.data ? (
            <PrimaryButton
              label="Edit training plan"
              icon="create-outline"
              onPress={() => router.push(`/trainer/plan/${horse.id}` as Href)}
            />
          ) : null}
        </>
      ) : null}
      {tab === "Care" && !horseResource.data ? (
        <>
          <Info
            title="Current care plan"
            items={[
              ["Plan objective", plan?.objective ?? "No active care plan"],
              ["Next care task", nextSession?.title ?? "Not scheduled"],
              ["Assigned groom", nextSession?.assignedGroom ?? "—"],
            ]}
          />
          <ChartSection
            title="Care trend"
            data={fitnessTrend}
            valueKey="load"
            color={colors.training}
          />
        </>
      ) : null}
      {!horseResource.data && (["Health", "Injuries", "Treatment"] as string[]).includes(tab) ? (
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
              <ProgressBar value={horse.recovery ?? 100} tone={colors.monitor} />
              <MiniChart data={recoveryTrend} valueKey="v" color={colors.monitor} />
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
      {tab === "Performance" && !horseResource.data ? (
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
            color={colors.destructive}
          />
          <ChartSection
            title="Weekly distance"
            data={fitnessTrend}
            valueKey="load"
            color={colors.training}
          />
        </>
      ) : null}
      {tab === "Racing" && !horseResource.data ? (
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
      {tab === "Costs" && !horseResource.data ? (
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
      {tab === "Timeline" && !horseResource.data ? (
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
              tone={colors.destructive}
            />
            <TimelineItem
              time="10:06"
              title="System raised HR alert"
              detail="188 bpm sustained 42 s"
              tone={colors.training}
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
      {horseResource.data && !["Overview", "Training"].includes(tab) ? (
        <AsyncStateView
          isLoading={false}
          error={null}
          onRetry={() => undefined}
          empty
          emptyLabel="This profile section is not connected to the backend yet."
        />
      ) : null}
    </Screen>
  );
}

function Info({ title, items }: { title: string; items: [string, string][] }) {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
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
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  return (
    <View style={uiStyles.section}>
      <SectionTitle>{title}</SectionTitle>
      <Panel>
        <MiniChart data={data} valueKey={valueKey} color={color} />
      </Panel>
    </View>
  );
}

function isUuid(value: string | string[] | undefined): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
const getStyles = (colors: any) => StyleSheet.create({
  hero: { gap: space.lg },
  flex: { flex: 1, gap: 4 },
  name: { color: colors.foreground, fontSize: 25, fontWeight: "800" },
});
