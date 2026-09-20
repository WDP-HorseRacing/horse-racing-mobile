import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { horses } from "@/lib/raceos-data";
import { Panel, StatusBadge, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function Stable() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const uiStyles = getUiStyles(colors);
  const wings = ["A", "B"];
  return (
    <Screen role="groom" title="Stable" subtitle="16 stalls · 8 in your care">
      {wings.map((wing) => (
        <View key={wing} style={uiStyles.section}>
          <SectionTitle>{wing} wing</SectionTitle>
          <View style={styles.grid}>
            {horses
              .filter((horse) => horse.stall.startsWith(wing))
              .map((horse) => (
                <Pressable
                  key={horse.id}
                  onPress={() => router.push(`/groom/horse/${horse.id}` as Href)}
                  style={styles.stall}
                >
                  <Text style={uiStyles.label}>STALL {horse.stall}</Text>
                  <Text style={uiStyles.value}>{horse.name}</Text>
                  <StatusBadge status={horse.status} />
                </Pressable>
              ))}
            <View style={styles.empty}>
              <Text style={uiStyles.muted}>Empty stall</Text>
            </View>
          </View>
        </View>
      ))}
      <View style={uiStyles.section}>
        <SectionTitle>Feeding round · 15:00</SectionTitle>
        {horses.slice(0, 5).map((horse) => (
          <Panel key={horse.id}>
            <View style={uiStyles.row}>
              <View>
                <Text style={uiStyles.value}>{horse.name}</Text>
                <Text style={uiStyles.muted}>Hard feed 3.2 kg · hay 5 kg · electrolytes</Text>
              </View>
              <Text style={uiStyles.muted}>{horse.stall}</Text>
            </View>
          </Panel>
        ))}
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stall: {
    width: "48%",
    minHeight: 120,
    justifyContent: "space-between",
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  empty: {
    width: "48%",
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
});
