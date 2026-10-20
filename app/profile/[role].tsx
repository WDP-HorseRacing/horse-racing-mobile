import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { isRole, roles } from "@/features/auth/roles";
import { Screen, SectionTitle } from "@/components/common";
import { Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { space, radius } from "@/config/theme";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { authService } from "@/services/auth.service";
import { horseService } from "@/services/horse.service";
import { stableService } from "@/services/stable.service";
import { usersService } from "@/services/users.service";
import { medicalService } from "@/services/medical.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import type { RoleId } from "@/types/raceos";

type WorkStat = {
  label: string;
  value: number;
  route: string;
};

async function loadWorkStats(token: string, role: RoleId, userId: string): Promise<WorkStat[]> {
  switch (role) {
    case "manager": {
      const [horses, barns, users] = await Promise.all([
        horseService.list(token),
        stableService.listBarns(token),
        usersService.list(token),
      ]);
      const activeUsers = users.filter((u) => u.status === "ACTIVE").length;
      return [
        { label: "Horses in club", value: horses.length, route: "/manager/horses" },
        { label: "Active barns", value: barns.length, route: "/manager/operations" },
        { label: "Active staff", value: activeUsers, route: "/manager/staff" },
      ];
    }
    case "trainer": {
      const [barns, horses] = await Promise.all([
        stableService.listBarns(token),
        horseService.list(token, "", { myBarns: true }),
      ]);
      const mine = barns.filter((b) => b.headTrainerId === userId);
      const waiting = mine.reduce((sum, b) => sum + (b.pendingStallHorseCount ?? 0), 0);
      return [
        { label: "Assigned zones", value: mine.length, route: "/trainer/stable" },
        { label: "Horses under care", value: horses.length, route: "/trainer/horses" },
        { label: "Stall assignment pending", value: waiting, route: "/trainer/horses" },
      ];
    }
    case "vet": {
      const medical = await medicalService.getDashboard(token);
      const overdue = medical.checkups.filter((item) => item.daysLeft < 0).length;
      return [
        {
          label: "Pending requests",
          value: medical.pendingRequests.length,
          route: "/vet/medical/requests",
        },
        { label: "Open cases", value: medical.openCases.length, route: "/vet/medical" },
        { label: "Overdue checkups", value: overdue, route: "/vet/medical/checkups" },
      ];
    }
    case "groom": {
      const [horses, requests] = await Promise.all([
        horseService.list(token, "", { myHorses: true }),
        medicalService.listExamRequests(token, { status: "PENDING" }),
      ]);
      return [
        { label: "Assigned horses", value: horses.length, route: "/groom/horses" },
        {
          label: "Pending requests",
          value: requests.meta.total ?? requests.items.length,
          route: "/groom/medical/requests",
        },
      ];
    }
    case "owner": {
      const horses = await horseService.list(token);
      const unwell = horses.filter(
        (h) => h.lifecycleStatus === "ACTIVE" && h.healthStatus !== "ELIGIBLE",
      ).length;
      return [
        { label: "Active horses", value: horses.length, route: "/owner/horses" },
        { label: "Horses needing attention", value: unwell, route: "/owner/horses" },
      ];
    }
  }
}

export default function Profile() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { role } = useLocalSearchParams<{ role: string }>();
  const auth = useAuth();
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const roleId = isRole(role) ? (role as RoleId) : null;
  const authRole = auth.role;
  const authToken = auth.token;
  const authUserId = auth.user?.userId;

  const loadWork = useCallback(async () => {
    if (!authToken || !authUserId || !roleId) return null;
    return loadWorkStats(authToken, roleId, authUserId);
  }, [authToken, authUserId, roleId]);
  const workResource = useApiResource(loadWork, Boolean(authToken && authUserId && roleId));

  if (!roleId || !authRole || roleId !== authRole) {
    return <Redirect href={(authRole ? `/${authRole}` : "/login") as Href} />;
  }
  const profile = roles[roleId];

  const initials =
    auth.user?.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() ?? "R";

  // Include destinations outside the bottom bar so moving a module does not hide it.
  const modules = [
    ...new Set(
      [...profile.nav.filter((item) => item.action !== "more"), ...profile.secondary].map(
        (item) => item.label,
      ),
    ),
  ];

  const systemItems = [
    { key: "Notifications", value: "Critical alerts always on" },
    { key: "Sensor pairing", value: "3 vests linked" },
    { key: "Audit trail", value: "Every action recorded" },
  ];

  const handleChangePassword = async () => {
    if (!auth.token) return;
    setPasswordError("");
    if (!currentPassword) {
      setPasswordError(t("Enter current password"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("Password must be at least 8 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("Passwords do not match."));
      return;
    }
    setChangingPassword(true);
    try {
      await authService.changePassword(auth.token, currentPassword, newPassword);
      Alert.alert(
        t("Password updated"),
        t("Your password has been changed. Please sign in again."),
        [
          {
            text: "OK",
            onPress: () => void auth.signOut(),
          },
        ],
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(extractErrorMessage(error, t("Could not change password")));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Screen role={roleId} title="Profile" subtitle="Profile & permissions" back>
      <Panel style={[uiStyles.row, { justifyContent: "flex-start", gap: space.md }]}>
        <View style={[styles.avatar, { flexShrink: 0 }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.personName} numberOfLines={1}>
            {auth.user?.fullName ?? profile.person}
          </Text>
          <Text style={styles.roleLabel} numberOfLines={1}>
            {profile.label}
          </Text>
          <Text style={styles.scopeLabel} numberOfLines={1}>
            {auth.user?.email ?? profile.scope}
          </Text>
        </View>
      </Panel>

      {/* My work */}
      {workResource.data && workResource.data.length > 0 ? (
        <View style={uiStyles.section}>
          <SectionTitle>My work</SectionTitle>
          <View style={styles.workStatsGrid}>
            {workResource.data.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.route as Href)}
                style={styles.workStatPressable}
              >
                <Panel style={styles.workStatPanel}>
                  <Text style={styles.workStatValue} numberOfLines={1} adjustsFontSizeToFit>
                    {item.value}
                  </Text>
                  <Text style={styles.workStatLabel} numberOfLines={2}>
                    {t(item.label)}
                  </Text>
                </Panel>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

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

      {/* Security */}
      {auth.token ? (
        <View style={uiStyles.section}>
          <SectionTitle>Security</SectionTitle>
          <Panel style={{ gap: space.sm }}>
            <Field label="Current password">
              <NativeInput
                value={currentPassword}
                onChangeText={(text) => {
                  setCurrentPassword(text);
                  setPasswordError("");
                }}
                placeholder="Enter current password"
                secureTextEntry
              />
            </Field>
            <Field label="New password">
              <NativeInput
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  setPasswordError("");
                }}
                placeholder="Enter new password (min 8 chars)"
                secureTextEntry
              />
            </Field>
            <Field label="Confirm new password">
              <NativeInput
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setPasswordError("");
                }}
                placeholder="Re-enter new password"
                secureTextEntry
              />
            </Field>

            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <PrimaryButton
              label={changingPassword ? "Changing password…" : "Change password"}
              icon="key-outline"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              onPress={() => void handleChangePassword()}
            />
          </Panel>
        </View>
      ) : null}

      <View style={uiStyles.section}>
        <SectionTitle>System</SectionTitle>
        <Panel style={{ padding: 0 }}>
          {systemItems.map((item, index) => (
            <View
              key={item.key}
              style={[styles.systemRow, index < systemItems.length - 1 && styles.systemRowBorder]}
            >
              <Text style={styles.systemKey}>{t(item.key)}</Text>
              <Text style={styles.systemValue} numberOfLines={1} ellipsizeMode="tail">
                {item.value}
              </Text>
            </View>
          ))}
        </Panel>
      </View>

      <View style={[uiStyles.section, { gap: space.sm, marginTop: space.sm }]}>
        <PrimaryButton
          label="End-to-end workflow"
          icon="git-merge-outline"
          onPress={() => router.push("/flow" as any)}
        />
        <Pressable style={styles.signOutBtn} onPress={() => void auth.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
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
    workStatsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
    },
    workStatPressable: {
      flex: 1,
      minWidth: "45%",
    },
    workStatPanel: {
      padding: space.md,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    workStatValue: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.primary,
    },
    workStatLabel: {
      fontSize: 12,
      color: colors.foreground,
      opacity: 0.85,
      textAlign: "center",
    },
    errorText: {
      color: colors.destructive,
      fontSize: 12,
      marginVertical: space.xs,
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
    systemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: space.sm,
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
      flexShrink: 0,
    },
    systemValue: {
      color: colors.foreground,
      opacity: 0.85,
      fontSize: 12,
      flex: 1,
      minWidth: 0,
      textAlign: "right",
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
