import { type Href, router } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { groomService } from "@/services/groom.service";
import { stableService } from "@/services/stable.service";
import type { GroomTodayDto } from "@/adapters/groom.adapter";
import type { BarnListItemDto, StallDto } from "@/services/stable.service";
import { formatEnum, formatQuantity } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

type StablePayload = {
  barns: BarnListItemDto[];
  stalls: StallDto[];
  today: GroomTodayDto;
};

export default function Stable() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const loadStable = useCallback(async (): Promise<StablePayload> => {
    const [barns, stalls, today] = await Promise.all([
      stableService.listBarns(token!),
      stableService.listStalls(token!),
      groomService.getToday(token!),
    ]);
    return { barns, stalls, today };
  }, [token]);
  const resource = useApiResource(loadStable, Boolean(token));
  const payload = resource.data;
  const horsesByLocation = useMemo(() => {
    const map = new Map<string, GroomTodayDto["horses"][number]>();
    for (const horse of payload?.today.horses ?? []) {
      if (horse.stallCode) map.set(locationKey(horse.barnName, horse.stallCode), horse);
    }
    return map;
  }, [payload]);
  const occupiedCount = payload?.stalls.filter((stall) => stall.status === "OCCUPIED").length ?? 0;

  return (
    <Screen
      role="groom"
      title="Stable"
      subtitle={payload ? `${payload.barns.length} barns · ${occupiedCount}/${payload.stalls.length} occupied` : "Barn and stall assignments"}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {payload && payload.barns.length === 0 ? (
        <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No barns are available." />
      ) : null}

      {payload?.barns.map((barn) => {
        const barnStalls = payload.stalls.filter((stall) => stall.barnId === barn.id);
        return (
          <View key={barn.id} style={uiStyles.section}>
            <SectionTitle>{barn.name}</SectionTitle>
            <Text style={uiStyles.muted}>
              {barn.availableStallCount} available capacity
              {barn.headTrainerFullName ? ` · ${barn.headTrainerFullName}` : ""}
            </Text>
            <View style={styles.grid}>
              {barnStalls.map((stall) => {
                const assignedHorse = horsesByLocation.get(locationKey(barn.name, stall.code));
                const canOpenHorse = Boolean(assignedHorse);
                return (
                  <Pressable
                    key={stall.id}
                    disabled={!canOpenHorse}
                    onPress={() => assignedHorse && router.push(`/groom/horse/${assignedHorse.horseId}` as Href)}
                    style={[styles.stall, stall.status === "MAINTENANCE" && styles.maintenance]}
                  >
                    <Text style={uiStyles.label}>Stall {stall.code}</Text>
                    <Text style={uiStyles.value} numberOfLines={2}>
                      {assignedHorse?.horseName ?? (stall.status === "OCCUPIED" ? "Occupied" : stall.status === "MAINTENANCE" ? "Maintenance" : "Available")}
                    </Text>
                    <Text style={[styles.stallStatus, stall.status === "AVAILABLE" && styles.available]}>
                      {formatEnum(stall.type)} · {formatEnum(stall.status)}
                    </Text>
                    {stall.hasCamera ? <Text style={uiStyles.muted}>Camera monitoring</Text> : null}
                  </Pressable>
                );
              })}
              {!barnStalls.length ? (
                <Panel><Text style={uiStyles.muted}>No stalls are registered in this barn.</Text></Panel>
              ) : null}
            </View>
          </View>
        );
      })}

      {payload ? (
        <View style={uiStyles.section}>
          <SectionTitle>Feeding round · {payload.today.date}</SectionTitle>
          {payload.today.horses.filter((horse) => horse.feedingPlan?.meals.length).map((horse) => (
            <Panel key={horse.horseId}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={uiStyles.value}>{horse.horseName}</Text>
                  <Text style={uiStyles.muted}>{[horse.barnName, horse.stallCode].filter(Boolean).join(" · ") || "Location not assigned"}</Text>
                </View>
              </View>
              {horse.feedingPlan?.meals.map((meal) => (
                <View key={`${horse.horseId}:${meal.meal}`} style={styles.meal}>
                  <Text style={uiStyles.label}>{meal.meal.replaceAll("_", " ")}</Text>
                  <Text style={uiStyles.muted}>
                    {meal.items.map((item) => `${item.name} ${formatQuantity(item.quantity, item.unit)}`).join(" · ")}
                  </Text>
                </View>
              ))}
            </Panel>
          ))}
          {!payload.today.horses.some((horse) => horse.feedingPlan?.meals.length) ? (
            <AsyncStateView isLoading={false} error={null} onRetry={() => undefined} empty emptyLabel="No feeding plans are available for your assigned horses." />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function locationKey(barnName: string | null, stallCode: string) {
  return `${barnName?.trim().toLowerCase() ?? ""}:${stallCode.trim().toLowerCase()}`;
}

const getStyles = (colors: any) => StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stall: {
    width: "48%",
    minHeight: 124,
    justifyContent: "space-between",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  maintenance: { backgroundColor: colors.elevated },
  stallStatus: { color: colors.monitor, fontSize: 10, fontWeight: "700" },
  available: { color: colors.primary },
  meal: { gap: 3, marginTop: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
