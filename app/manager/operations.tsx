import { router } from "expo-router";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { auditLog } from "@/lib/raceos-data";
import { Panel, getUiStyles } from "@/components/ui";
import { TimelineItem, Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { space, radius } from "@/config/theme";

export default function Operations() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  return (
    <Screen role="manager" title="Operations" subtitle="Manage club personnel, inventory, and access">
      <View style={uiStyles.section}>
        <SectionTitle>Management Areas</SectionTitle>
        <Pressable style={styles.card} onPress={() => router.push("/manager/staff")}>
          <View style={styles.iconBox}>
            <Ionicons name="people-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Staff</Text>
            <Text style={styles.cardDesc}>View, add, and edit club personnel.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push("/manager/inventory")}>
          <View style={styles.iconBox}>
            <Ionicons name="cube-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Inventory</Text>
            <Text style={styles.cardDesc}>Manage medical supplies and feed stock.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push("/manager/access")}>
          <View style={styles.iconBox}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Access Control</Text>
            <Text style={styles.cardDesc}>Configure roles, permissions, and scope.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={uiStyles.section}>
        <SectionTitle>Recent activity (Audit Log)</SectionTitle>
        <Panel>
          {auditLog.slice(0, 5).map((entry, index) => (
            <TimelineItem
              key={`${entry.time}-${entry.action}`}
              time={entry.time}
              title={entry.action}
              detail={`${entry.who} · ${entry.object} · ${entry.result}`}
              tone={index === 0 ? colors.destructive : colors.training}
              last={index === 4}
            />
          ))}
        </Panel>
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.fitSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
});
