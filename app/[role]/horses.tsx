import { Redirect, useLocalSearchParams } from "expo-router";
import { TextInput, View, StyleSheet } from "react-native";
import { Text } from "@/native/LocalizedText";
import { useMemo, useState } from "react";
import { useRaceOS } from "@/context/RaceOSContext";
import { isRole } from "@/native/roles";
import { HorseRow, Screen, uiStyles } from "@/native/ui";
import { colors, radius, space } from "@/native/theme";
import { Chips } from "@/native/components";

export default function Horses() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const { horses } = useRaceOS();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const list = useMemo(
    () =>
      horses.filter((horse) => {
        const owned = role !== "owner" || horse.owner === "Marlow Bloodstock";
        const matchesQuery = horse.name.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus =
          filter === "All" || horse.status.toLowerCase() === filter.toLowerCase();
        return owned && matchesQuery && matchesStatus;
      }),
    [filter, horses, query, role],
  );
  if (!isRole(role)) return <Redirect href="/" />;
  return (
    <Screen role={role} title={role === "owner" ? "My horses" : "Horses"}>
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search horses"
          placeholderTextColor={colors.muted}
          style={styles.search}
          autoCapitalize="none"
        />
      </View>
      <Chips
        options={["All", "Fit", "Monitor", "Injured", "Training", "Race ready", "Locked"]}
        value={filter}
        onChange={setFilter}
      />
      <Text style={uiStyles.label}>{list.length} horses</Text>
      <View style={styles.list}>
        {list.map((horse) => (
          <HorseRow key={horse.id} horse={horse} role={role} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: { minHeight: 50, color: colors.text, paddingHorizontal: space.lg, fontSize: 15 },
  list: { gap: space.sm },
});
