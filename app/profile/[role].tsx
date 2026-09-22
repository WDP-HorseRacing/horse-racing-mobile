import { Redirect, router, useLocalSearchParams } from "expo-router";
import { View, StyleSheet, Pressable } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { isRole, roles, roleOrder } from "@/features/auth/roles";
import { Screen, SectionTitle } from "@/components/common";
import { Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { space, radius } from "@/config/theme";

export default function Profile() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { role } = useLocalSearchParams<{ role: string }>();
  
  if (!isRole(role)) return <Redirect href="/" />;
  const profile = roles[role];
  
  // Calculate initials from the person's name
  const initials = profile.person
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Modules they can access based on nav array
  const modules = profile.nav.map((item) => item.label);

  const systemItems = [
    { key: "Notifications", value: "Critical alerts always on" },
    { key: "Sensor pairing", value: "3 vests linked" },
    { key: "Audit trail", value: "Every action recorded" },
  ];

  return (
    <Screen role={role} title="Profile" subtitle="Profile & permissions" back>
      
      {/* Hero Section */}
      <Panel style={[uiStyles.row, { justifyContent: "flex-start", gap: space.md }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.personName}>{profile.person}</Text>
          <Text style={styles.roleLabel}>{profile.label}</Text>
          <Text style={styles.scopeLabel}>{profile.scope}</Text>
        </View>
      </Panel>

      {/* Modules Access */}
      <View style={uiStyles.section}>
        <SectionTitle>Modules you can access</SectionTitle>
        <Panel style={styles.modulesContainer}>
          {modules.map((m) => (
            <View key={m} style={styles.chip}>
              <Text style={styles.chipText}>{m}</Text>
            </View>
          ))}
        </Panel>
      </View>

      {/* Switch Role */}
      <View style={uiStyles.section}>
        <SectionTitle>Switch role</SectionTitle>
        <View style={{ gap: space.sm }}>
          {roleOrder
            .filter((r) => r !== role)
            .map((r) => {
              const rCfg = roles[r];
              const rInitials = rCfg.person
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              return (
                <Pressable
                  key={r}
                  style={styles.roleCard}
                  onPress={() => router.replace(rCfg.nav[0].path as any)}
                >
                  <View style={styles.roleAvatar}>
                    <Text style={styles.roleAvatarText}>{rInitials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleTitle}>{rCfg.label}</Text>
                    <Text style={styles.roleScope}>{rCfg.scope}</Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>

      {/* System */}
      <View style={uiStyles.section}>
        <SectionTitle>System</SectionTitle>
        <Panel style={{ padding: 0 }}>
          {systemItems.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.systemRow,
                index < systemItems.length - 1 && styles.systemRowBorder,
              ]}
            >
              <Text style={styles.systemKey}>{item.key}</Text>
              <Text style={styles.systemValue}>{item.value}</Text>
            </View>
          ))}
        </Panel>
      </View>

      {/* Action Buttons */}
      <View style={[uiStyles.section, { gap: space.sm, marginTop: space.sm }]}>
        <PrimaryButton
          label="End-to-end workflow"
          icon="git-merge-outline"
          onPress={() => router.push("/flow" as any)}
        />
        <Pressable
          style={styles.signOutBtn}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: "600",
  },
  personName: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "600",
  },
  roleLabel: {
    color: colors.foreground,
    opacity: 0.85,
    fontSize: 13,
  },
  scopeLabel: {
    color: colors.foreground,
    opacity: 0.85,
    fontSize: 11,
    marginTop: 2,
  },
  modulesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    color: colors.foreground,
    opacity: 0.85,
    fontSize: 11,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: space.md,
  },
  roleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    justifyContent: "center",
    alignItems: "center",
  },
  roleAvatarText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "500",
  },
  roleTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "500",
  },
  roleScope: {
    color: colors.foreground,
    opacity: 0.85,
    fontSize: 11,
    marginTop: 2,
  },
  systemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  systemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  systemKey: {
    color: colors.foreground,
    fontSize: 14,
  },
  systemValue: {
    color: colors.foreground,
    opacity: 0.85,
    fontSize: 12,
  },
  signOutBtn: {
    height: 48,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  signOutText: {
    color: colors.foreground,
    opacity: 0.85,
    fontSize: 14,
    fontWeight: "500",
  },
});
