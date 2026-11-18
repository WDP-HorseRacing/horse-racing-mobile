import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { type Href, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, getUiStyles } from "@/components/ui";
import { mapHorseAlert } from "@/adapters/notifications.adapter";
import type { HorseAlertView } from "@/adapters/notifications.adapter";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { horseService } from "@/services/horse.service";
import { notificationsService } from "@/services/notifications.service";
import type { RoleId } from "@/types/raceos";
import { isQaTestContent } from "@/utils/textCleaner";
import { radius, space } from "@/config/theme";

type GroupedAlert = { alert: HorseAlertView; count: number };

export function HorseAlertsFeed({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { token } = useAuth();
  const [criticalOnly, setCriticalOnly] = useState(false);

  const load = useCallback(async () => {
    if (!token || !(role === "manager" || role === "trainer" || role === "vet")) return [];
    const horses = await horseService.list(token);
    const alertGroups: HorseAlertView[][] = [];
    for (let index = 0; index < horses.length; index += 5) {
      const batch = await Promise.all(
        horses.slice(index, index + 5).map(async (horse) => {
          const alerts = await notificationsService.listHorseAlerts(token, horse.id);
          return alerts.map((alert) => mapHorseAlert(horse.id, horse.name, alert));
        }),
      );
      alertGroups.push(...batch);
    }
    return alertGroups
      .flat()
      .sort((first, second) => second.recordedAt.localeCompare(first.recordedAt));
  }, [role, token]);

  const resource = useApiResource(load, Boolean(token));
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, GroupedAlert>();
    for (const alert of resource.data ?? []) {
      if (isQaTestContent(alert.horseName) || isQaTestContent(alert.sessionName ?? "")) continue;
      const key = `${alert.horseId}_${alert.sessionId || "standalone"}_${alert.alertLevel}`;
      const existing = groups.get(key);
      if (existing) existing.count += 1;
      else groups.set(key, { alert, count: 1 });
    }
    return [...groups.values()];
  }, [resource.data]);
  const visibleAlerts = criticalOnly
    ? groupedAlerts.filter(({ alert }) => alert.alertLevel === "CRITICAL")
    : groupedAlerts;

  const openAlert = (alert: HorseAlertView) => {
    if (role === "trainer" || role === "vet") {
      const query = new URLSearchParams({
        horse: alert.horseName,
        ...(alert.sessionName ? { session: alert.sessionName } : {}),
        horseId: alert.horseId,
        sessionId: alert.sessionId,
      });
      router.push(`/${role}/participant/${alert.sessionParticipantId}?${query.toString()}` as Href);
      return;
    }
    router.push(`/${role}/horse/${alert.horseId}` as Href);
  };

  return (
    <Screen
      role={role}
      title="Alerts"
      subtitle="Horse health and performance alerts."
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <View style={styles.filterRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !criticalOnly }}
          onPress={() => setCriticalOnly(false)}
          style={[styles.filterChip, !criticalOnly && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, !criticalOnly && styles.filterChipTextActive]}>
            {t("All alerts")} · {groupedAlerts.length}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: criticalOnly }}
          onPress={() => setCriticalOnly(true)}
          style={[styles.filterChip, criticalOnly && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, criticalOnly && styles.filterChipTextActive]}>
            {t("Critical")} ·{" "}
            {groupedAlerts.filter(({ alert }) => alert.alertLevel === "CRITICAL").length}
          </Text>
        </Pressable>
      </View>

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && visibleAlerts.length === 0}
        emptyLabel={criticalOnly ? "No critical alerts." : "No horse alerts to review."}
      />

      {visibleAlerts.length > 0 ? (
        <View style={uiStyles.section}>
          <SectionTitle>{t("Horse health alerts")}</SectionTitle>
          {visibleAlerts.map(({ alert, count }) => {
            const critical = alert.alertLevel === "CRITICAL";
            return (
              <Pressable
                key={`${alert.horseId}-${alert.sessionParticipantId}-${alert.recordedAt}`}
                accessibilityRole="button"
                onPress={() => openAlert(alert)}
              >
                <Panel style={styles.alertCard}>
                  <View style={uiStyles.row}>
                    <View style={styles.alertHeading}>
                      <View
                        style={[
                          styles.alertDot,
                          { backgroundColor: critical ? colors.destructive : colors.monitor },
                        ]}
                      />
                      <Text
                        style={[
                          uiStyles.label,
                          { color: critical ? colors.destructive : colors.monitor },
                        ]}
                      >
                        {t(alert.alertLevel)}
                      </Text>
                      {count > 1 ? (
                        <View style={styles.repeatBadge}>
                          <Text style={styles.repeatBadgeText}>
                            {t("Repeated {value} times".replace("{value}", String(count)))}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={uiStyles.muted}>{alert.recordedAtLabel}</Text>
                  </View>
                  <Text style={uiStyles.value}>{alert.horseName}</Text>
                  <Text style={uiStyles.muted}>
                    {alert.sessionName ?? t("Training session")} · {alert.heartRateBpm} bpm ·{" "}
                    {alert.speedMps} m/s
                  </Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.linkButton}>
                      <Ionicons name="pulse" size={14} color={colors.destructive} />
                      <Text style={[styles.linkText, { color: colors.destructive }]}>
                        {t("View sensor data")}
                      </Text>
                    </View>
                    <View style={styles.linkButton}>
                      <Ionicons name="paw-outline" size={14} color={colors.primary} />
                      <Text style={[styles.linkText, { color: colors.primary }]}>
                        {t("Open horse profile")}
                      </Text>
                    </View>
                  </View>
                </Panel>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    filterRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
    filterChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    filterChipActive: { borderColor: colors.primary, backgroundColor: colors.fitSoft },
    filterChipText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
    filterChipTextActive: { color: colors.primary },
    alertCard: { marginBottom: space.sm, gap: space.xs },
    alertHeading: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
    alertDot: { width: 7, height: 7, borderRadius: radius.pill },
    repeatBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.monitorSoft,
    },
    repeatBadgeText: { color: colors.monitor, fontSize: 10, fontWeight: "700" },
    cardFooter: {
      marginTop: space.xs,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: space.sm,
    },
    linkButton: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5 },
    linkText: { fontSize: 12, fontWeight: "700" },
  });
}
