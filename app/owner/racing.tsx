import { router, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Chips, Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { racingService } from "@/services/racing.service";
import { trainingService } from "@/services/training.service";
import { mapOwnerRaceResult, type OwnerRaceResultView } from "@/adapters/racing.adapter";
import { mapOwnerTrialVideos } from "@/adapters/training.adapter";
import { formatDurationMs } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

export default function OwnerRacing() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const [tab, setTab] = useState("Race history");

  const loadRaces = useCallback(() => racingService.listRaces(token!), [token]);
  const racesResource = useApiResource(loadRaces, Boolean(token));

  const loadHistory = useCallback(async (): Promise<OwnerRaceResultView[]> => {
    const horses = await horseService.list(token!);
    const resultsByHorse = await Promise.all(horses.map(async (horse) => {
      const results = await racingService.listHorseResults(token!, horse.id);
      return results.map((result) => mapOwnerRaceResult(horse.id, horse.name, result));
    }));
    return resultsByHorse.flat().sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }, [token]);
  const historyResource = useApiResource(loadHistory, Boolean(token));

  const loadTraining = useCallback(() => trainingService.listAllVisibleSessions(token!), [token]);
  const trainingResource = useApiResource(loadTraining, Boolean(token));
  const trials = useMemo(
    () => mapOwnerTrialVideos(trainingResource.data ?? []),
    [trainingResource.data],
  );
  const completedResults = (historyResource.data ?? []).filter(
    (result) => result.raceStatus === "COMPLETED" || result.placing !== null || result.timeSeconds !== null,
  );
  const upcomingRaces = (racesResource.data ?? []).filter(
    (race) => !["COMPLETED", "CANCELLED"].includes(race.status),
  );

  return (
    <Screen
      role="owner"
      title="Racing"
      refreshing={racesResource.isRefreshing || historyResource.isRefreshing || trainingResource.isRefreshing}
      onRefresh={() => {
        void racesResource.refresh();
        void historyResource.refresh();
        void trainingResource.refresh();
      }}
    >
      <Chips options={["Race history", "Trial videos"]} value={tab} onChange={setTab} />

      {tab === "Race history" ? (
        <>
          <View style={uiStyles.section}>
            <SectionTitle>Upcoming races</SectionTitle>
            <AsyncStateView
              isLoading={racesResource.isLoading}
              error={racesResource.error}
              onRetry={() => void racesResource.retry()}
              empty={Boolean(racesResource.data && upcomingRaces.length === 0)}
              emptyLabel="No upcoming races are available."
            />
            {upcomingRaces.map((race) => (
              <Panel key={race.id}>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={uiStyles.value}>{race.name}</Text>
                    <Text style={uiStyles.muted}>{race.status.replaceAll("_", " ")}</Text>
                  </View>
                  <Text style={{ ...uiStyles.label, color: colors.primary }}>
                    {new Intl.DateTimeFormat("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                      dateStyle: "medium",
                    }).format(new Date(race.scheduledAt))}
                  </Text>
                </View>
              </Panel>
            ))}
          </View>

          <View style={uiStyles.section}>
            <SectionTitle>Race results</SectionTitle>
            <AsyncStateView
              isLoading={historyResource.isLoading}
              error={historyResource.error}
              onRetry={() => void historyResource.retry()}
              empty={Boolean(historyResource.data && completedResults.length === 0)}
              emptyLabel="No race results have been recorded for your horses."
            />
            {completedResults.map((result) => (
              <Panel key={result.registrationId}>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={uiStyles.value}>{result.horseName}</Text>
                    <Text style={uiStyles.muted}>{result.raceName} · {result.scheduledAtLabel}</Text>
                    <Text style={uiStyles.label}>{result.registrationStatus.replaceAll("_", " ")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ ...uiStyles.value, color: result.placing === 1 ? colors.primary : colors.foreground }}>
                      {result.placing ? `#${result.placing}` : "—"}
                    </Text>
                    <Text style={uiStyles.muted}>
                      {result.timeSeconds === null ? "No time" : formatDurationMs(result.timeSeconds * 1000)}
                    </Text>
                  </View>
                </View>
              </Panel>
            ))}
          </View>
        </>
      ) : (
        <View style={uiStyles.section}>
          <SectionTitle>Trial videos</SectionTitle>
          <AsyncStateView
            isLoading={trainingResource.isLoading}
            error={trainingResource.error}
            onRetry={() => void trainingResource.retry()}
            empty={Boolean(trainingResource.data && trials.length === 0)}
            emptyLabel="No trial videos are available for your horses."
          />
          {trials.map((trial) => (
            <Pressable
              key={trial.id}
              onPress={() => router.push(`/owner/trial/${trial.participantId}?attemptNo=${trial.attemptNo}` as Href)}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: space.md,
                flexDirection: "row",
                gap: space.md,
              }}
            >
              <View style={{ width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="play-circle" size={32} color={colors.primary} />
              </View>
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={uiStyles.value}>{trial.horseName}</Text>
                <Text style={uiStyles.muted}>{trial.sessionTitle} · {trial.date}</Text>
                <Text style={uiStyles.label}>Attempt {trial.attemptNo} · {trial.elapsedLabel}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
