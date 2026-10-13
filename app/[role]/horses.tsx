import { Redirect, useLocalSearchParams } from "expo-router";
import { TextInput, View, StyleSheet } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useCallback, useMemo, useState } from "react";
import { isRole } from "@/features/auth/roles";
import { getUiStyles , Chips } from "@/components/ui";
import { Screen } from "@/components/common";
import { HorseRow } from "@/features/horses/components/HorseRow";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { horseService } from "@/services/horse.service";
import { mapHorseSummary, mapHorseSummaryToPrototype } from "@/adapters/horse.adapter";

export default function Horses() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const uiStyles = getUiStyles(colors);
  const { role } = useLocalSearchParams<{ role: string }>();
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const loadHorses = useCallback(() => horseService.list(token!), [token]);
  const resource = useApiResource(loadHorses, Boolean(token));
  const horses = useMemo(
    () => (resource.data ?? []).map(mapHorseSummary).map(mapHorseSummaryToPrototype),
    [resource.data],
  );
  const list = useMemo(
    () =>
      horses.filter((horse) => {
        const matchesQuery = horse.name.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus =
          filter === "All" || horse.status.toLowerCase() === filter.toLowerCase();
        return matchesQuery && matchesStatus;
      }),
    [filter, horses, query, role],
  );
  if (!isRole(role)) return <Redirect href="/" />;
  return (
    <Screen
      role={role}
      title={role === "owner" ? "My horses" : "Horses"}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search horses"
          placeholderTextColor={colors.mutedForeground}
          style={styles.search}
          autoCapitalize="none"
        />
      </View>
      <Chips
        options={["All", "Fit", "Monitor", "Injured", "Locked"]}
        value={filter}
        onChange={setFilter}
      />
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={Boolean(resource.data) && list.length === 0}
        emptyLabel={horses.length ? "No horses match this search or status." : "No horses are available for this account."}
      />
      {resource.data ? (
        <>
          <Text style={uiStyles.label}>{list.length} horses</Text>
          <View style={styles.list}>
            {list.map((horse) => (
              <HorseRow key={horse.id} horse={horse} role={role} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  searchWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: { minHeight: 50, color: colors.foreground, paddingHorizontal: space.lg, fontSize: 15 },
  list: { gap: space.sm },
});
