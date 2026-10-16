import { type Href, Redirect, router } from "expo-router";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Metric, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { mapHorseSummary, mapHorseSummaryToPrototype } from "@/adapters/horse.adapter";
import { horseService } from "@/services/horse.service";
import {
  stableService,
  type BarnListItemDto,
  type GroomWorkloadDto,
  type StallDto,
} from "@/services/stable.service";

type StablePayload = {
  barns: BarnListItemDto[];
  stalls: StallDto[];
  horses: Awaited<ReturnType<typeof horseService.list>>;
  grooms: GroomWorkloadDto[];
};

export default function TrainerStable() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token, role, isLoading: authLoading } = useAuth();
  const loadStable = useCallback(async (): Promise<StablePayload> => {
    const [barns, horses, grooms] = await Promise.all([
      stableService.listBarns(token!),
      horseService.list(token!, "", { myBarns: true }),
      stableService.listGroomWorkload(token!),
    ]);
    const stallGroups = await Promise.all(
      barns.map((barn) => stableService.listBarnStalls(token!, barn.id)),
    );
    return { barns, horses, grooms, stalls: stallGroups.flat() };
  }, [token]);
  const resource = useApiResource(loadStable, Boolean(token && role === "trainer"));
  const payload = resource.data;
  const horsesByStall = useMemo(() => {
    const index = new Map<string, StablePayload["horses"][number]>();
    for (const horse of payload?.horses ?? []) {
      const stallId = horse.location.stall?.id;
      if (stallId) index.set(stallId, horse);
    }
    return index;
  }, [payload?.horses]);
  const unplacedByBarn = useMemo(() => {
    const grouped = new Map<string, StablePayload["horses"]>();
    for (const horse of payload?.horses ?? []) {
      const barnId = horse.location.barn?.id;
      if (barnId && !horse.location.stall)
        grouped.set(barnId, [...(grouped.get(barnId) ?? []), horse]);
    }
    return grouped;
  }, [payload?.horses]);

  if (!authLoading && role !== "trainer")
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;

  return (
    <Screen
      role="trainer"
      title="Stable overview"
      subtitle="Barn, stall and Groom assignments"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={authLoading || resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {payload ? (
        <>
          <View style={uiStyles.metricGrid}>
            <Metric label="Barns" value={payload.barns.length} />
            <Metric label="Active horses" value={payload.horses.length} />
            <Metric
              label="Available stalls"
              value={payload.stalls.filter((stall) => stall.status === "AVAILABLE").length}
            />
          </View>
          {payload.barns.length ? (
            payload.barns.map((barn) => {
              const stalls = payload.stalls.filter((stall) => stall.barnId === barn.id);
              const pendingHorses = unplacedByBarn.get(barn.id) ?? [];
              return (
                <View key={barn.id} style={uiStyles.section}>
                  <SectionTitle>{barn.name}</SectionTitle>
                  <Text style={uiStyles.muted}>
                    {barn.headTrainerFullName ?? "Head Trainer not listed"} ·{" "}
                    {barn.availableStallCount} available capacity · {barn.pendingStallHorseCount}{" "}
                    pending stall assignment
                  </Text>
                  <View style={{ gap: 10 }}>
                    {stalls.map((stall) => {
                      const horse = horsesByStall.get(stall.id);
                      return (
                        <Panel key={stall.id}>
                          <View style={uiStyles.row}>
                            <View style={{ flex: 1 }}>
                              <Text style={uiStyles.label}>
                                STALL {stall.code} · {stall.type.replaceAll("_", " ")}
                              </Text>
                              <Text style={uiStyles.muted}>
                                {stall.status.replaceAll("_", " ")}
                                {stall.hasCamera ? " · Camera monitoring" : ""}
                              </Text>
                            </View>
                            {horse ? <Text style={uiStyles.label}>Assigned</Text> : null}
                          </View>
                          {horse ? (
                            <>
                              <HorseRow
                                horse={mapHorseSummaryToPrototype(mapHorseSummary(horse))}
                                role="trainer"
                                horseId={horse.id}
                                location={`${barn.name} · ${stall.code}`}
                                aptitude={horse.raceAptitude}
                                lifecycleStatus={horse.lifecycleStatus}
                              />
                              <PrimaryButton
                                label="Manage stall and Groom"
                                icon="people-outline"
                                onPress={() =>
                                  router.push(`/trainer/horse/${horse.id}/placement` as Href)
                                }
                              />
                            </>
                          ) : (
                            <Text style={uiStyles.muted}>
                              {stall.status === "AVAILABLE"
                                ? "Choose a horse from this barn to assign."
                                : stall.status === "MAINTENANCE"
                                  ? "This stall is unavailable during maintenance."
                                  : "The horse assignment is not visible in the current response."}
                            </Text>
                          )}
                        </Panel>
                      );
                    })}
                  </View>
                  {!stalls.length ? (
                    <AsyncStateView
                      isLoading={false}
                      error={null}
                      onRetry={() => void resource.refresh()}
                      empty
                      emptyLabel="No stalls are registered in this barn."
                    />
                  ) : null}
                  {pendingHorses.length ? (
                    <View style={uiStyles.section}>
                      <SectionTitle>Pending stall assignment</SectionTitle>
                      {pendingHorses.map((horse) => (
                        <View key={horse.id} style={{ gap: 8 }}>
                          <HorseRow
                            horse={mapHorseSummaryToPrototype(mapHorseSummary(horse))}
                            role="trainer"
                            horseId={horse.id}
                            location={`${barn.name} · Pending stall`}
                            aptitude={horse.raceAptitude}
                            lifecycleStatus={horse.lifecycleStatus}
                          />
                          <PrimaryButton
                            label="Assign stall and Groom"
                            icon="business-outline"
                            onPress={() =>
                              router.push(`/trainer/horse/${horse.id}/placement` as Href)
                            }
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void resource.refresh()}
              empty
              emptyLabel="No barns are assigned to this Head Trainer."
            />
          )}
          <View style={uiStyles.section}>
            <SectionTitle>Groom workload</SectionTitle>
            {payload.grooms.length ? (
              payload.grooms.map((groom) => (
                <Panel key={groom.groomId}>
                  <View style={uiStyles.row}>
                    <Text style={uiStyles.value}>{groom.fullName}</Text>
                    <Text style={uiStyles.label}>{groom.activeHorseCount} active horses</Text>
                  </View>
                </Panel>
              ))
            ) : (
              <Text style={uiStyles.muted}>No active Grooms are available for assignment.</Text>
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
