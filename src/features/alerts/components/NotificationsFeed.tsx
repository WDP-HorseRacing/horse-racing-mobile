import { useCallback, useMemo } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { type Href, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { notificationsService } from "@/services/notifications.service";
import {
  mapHorseAlert,
  mapNotification,
  notificationCategoryLabel,
} from "@/adapters/notifications.adapter";
import type { RoleId } from "@/types/raceos";
import { extractErrorMessage } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";

export function NotificationsFeed({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { token } = useAuth();
  const load = useCallback(async () => {
    const inboxPromise = notificationsService.list(token!);
    const canReadHorseAlerts = role === "manager" || role === "trainer" || role === "vet";
    if (!canReadHorseAlerts) {
      const inbox = await inboxPromise;
      return {
        notifications: inbox.items.map(mapNotification),
        horseAlerts: [] as ReturnType<typeof mapHorseAlert>[],
      };
    }
    const [inbox, horses] = await Promise.all([inboxPromise, horseService.list(token!)]);
    const alertGroups: ReturnType<typeof mapHorseAlert>[][] = [];
    for (let index = 0; index < horses.length; index += 5) {
      const batch = await Promise.all(
        horses.slice(index, index + 5).map(async (horse) => {
          const alerts = await notificationsService.listHorseAlerts(token!, horse.id);
          return alerts.map((alert) => mapHorseAlert(horse.id, horse.name, alert));
        }),
      );
      alertGroups.push(...batch);
    }
    return {
      notifications: inbox.items.map(mapNotification),
      horseAlerts: alertGroups.flat().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    };
  }, [token, role]);
  const resource = useApiResource(load, Boolean(token));
  const notifications = useMemo(
    () => resource.data?.notifications ?? [],
    [resource.data?.notifications],
  );
  const horseAlerts = useMemo(() => resource.data?.horseAlerts ?? [], [resource.data?.horseAlerts]);
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  const markRead = async (notificationId: string) => {
    if (!token) return;
    try {
      await notificationsService.markRead(token, notificationId);
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not update notification", extractErrorMessage(error));
    }
  };
  const markAllRead = async () => {
    if (!token) return;
    try {
      await notificationsService.markAllRead(token);
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not update notifications", extractErrorMessage(error));
    }
  };

  return (
    <Screen
      role={role}
      title="Alerts"
      subtitle={`${unreadCount} unread notifications`}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={
          !resource.isLoading &&
          !resource.error &&
          notifications.length === 0 &&
          horseAlerts.length === 0
        }
        emptyLabel="No alerts or notifications."
      />
      {notifications.length ? (
        <View style={uiStyles.section}>
          <SectionTitle
            action={
              unreadCount ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void markAllRead()}
                  style={styles.markAllReadBtn}
                >
                  <Ionicons name="checkmark-done-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.markAllReadText}>{t("Đánh dấu tất cả đã đọc")}</Text>
                </Pressable>
              ) : null
            }
          >
            Notifications
          </SectionTitle>
          {notifications.map((notification) => (
            <Panel key={notification.id} style={!notification.readAt ? uiStyles.alert : undefined}>
              <View style={uiStyles.row}>
                <Text
                  style={{
                    ...uiStyles.label,
                    flex: 1,
                    minWidth: 0,
                    color:
                      notification.priority === "CRITICAL" ? colors.destructive : colors.primary,
                  }}
                  numberOfLines={1}
                >
                  {notification.priority} · {t(notificationCategoryLabel(notification.category))}
                </Text>
                <Text style={[uiStyles.muted, { flexShrink: 0 }]}>
                  {notification.createdAtLabel}
                </Text>
              </View>
              <Text style={uiStyles.value}>{notification.title}</Text>
              <Text style={uiStyles.muted}>{notification.message}</Text>
              <View style={styles.cardFooter}>
                {!notification.readAt ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void markRead(notification.id)}
                    style={styles.markReadBtn}
                  >
                    <Ionicons name="checkmark-done" size={14} color={colors.primary} />
                    <Text style={styles.markReadText}>{t("Đánh dấu đã đọc")}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.readStatusBox}>
                    <Ionicons name="checkmark-circle-outline" size={13} color={colors.mutedForeground} />
                    <Text style={styles.readStatusText}>{t("Đã đọc")}</Text>
                  </View>
                )}

                <View style={styles.navLinksGroup}>
                  {notification.resource?.type?.toLowerCase() === "session_participant" &&
                  notification.resource.id ? (
                    (() => {
                      const matchedAlert = horseAlerts.find(
                        (a) => a.sessionParticipantId === notification.resource?.id,
                      );
                      const sessionId = matchedAlert?.sessionId;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            if (role === "trainer" || role === "vet") {
                              const query = new URLSearchParams({
                                ...(matchedAlert?.horseName ? { horse: matchedAlert.horseName } : {}),
                                ...(matchedAlert?.sessionName
                                  ? { session: matchedAlert.sessionName }
                                  : {}),
                                ...(notification.resource?.horseId
                                  ? { horseId: notification.resource.horseId }
                                  : {}),
                                ...(sessionId ? { sessionId } : {}),
                              });
                              router.push(
                                `/${role}/participant/${notification.resource?.id}?${query.toString()}` as Href,
                              );
                            } else if (notification.resource?.horseId) {
                              router.push(`/${role}/horse/${notification.resource.horseId}` as Href);
                            }
                          }}
                          style={styles.sensorLinkBtn}
                        >
                          <Ionicons name="pulse" size={13} color={colors.destructive} />
                          <Text style={styles.sensorLinkText}>
                            {t("Xem dữ liệu cảm biến →")}
                          </Text>
                        </Pressable>
                      );
                    })()
                  ) : null}
                  {notification.resource?.horseId ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push(`/${role}/horse/${notification.resource!.horseId}` as Href)
                      }
                      style={styles.horseLinkBtn}
                    >
                      <Ionicons name="paw-outline" size={13} color={colors.primary} />
                      <Text style={styles.horseLinkText}>{t("Mở hồ sơ ngựa")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Panel>
          ))}
        </View>
      ) : null}
      {horseAlerts.length ? (
        <View style={uiStyles.section}>
          <SectionTitle>Horse performance alerts</SectionTitle>
          {horseAlerts.map((alert) => (
            <Pressable
              key={`${alert.horseId}-${alert.sessionParticipantId}-${alert.recordedAt}`}
              onPress={() => {
                if (role === "trainer" || role === "vet") {
                  const query = new URLSearchParams({
                    horse: alert.horseName,
                    ...(alert.sessionName ? { session: alert.sessionName } : {}),
                    horseId: alert.horseId,
                    sessionId: alert.sessionId,
                  });
                  router.push(
                    `/${role}/participant/${alert.sessionParticipantId}?${query.toString()}` as Href,
                  );
                } else {
                  router.push(`/${role}/horse/${alert.horseId}` as Href);
                }
              }}
            >
              <Panel style={uiStyles.alert}>
                <View style={uiStyles.row}>
                  <Text
                    style={{
                      ...uiStyles.label,
                      color: alert.alertLevel === "CRITICAL" ? colors.destructive : colors.monitor,
                    }}
                  >
                    {alert.alertLevel}
                  </Text>
                  <Text style={uiStyles.muted}>{alert.recordedAtLabel}</Text>
                </View>
                <Text style={uiStyles.value}>{alert.horseName}</Text>
                <Text style={uiStyles.muted}>
                  {alert.sessionName ?? "Training session"} · {alert.heartRateBpm} bpm ·{" "}
                  {alert.speedMps} m/s
                </Text>
                <View style={styles.horseAlertFooter}>
                  {alert.sessionId ? (
                    <Pressable
                      style={styles.sensorLinkBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        if (role === "trainer" || role === "vet") {
                          const query = new URLSearchParams({
                            horse: alert.horseName,
                            ...(alert.sessionName ? { session: alert.sessionName } : {}),
                            horseId: alert.horseId,
                            sessionId: alert.sessionId,
                          });
                          router.push(
                            `/${role}/participant/${alert.sessionParticipantId}?${query.toString()}` as Href,
                          );
                        } else {
                          router.push(`/${role}/horse/${alert.horseId}` as Href);
                        }
                      }}
                    >
                      <Ionicons name="pulse" size={13} color={colors.destructive} />
                      <Text style={styles.sensorLinkText}>
                        {t("Xem dữ liệu cảm biến →")}
                      </Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    hitSlop={8}
                    style={styles.horseLinkBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push(`/${role}/horse/${alert.horseId}` as Href);
                    }}
                  >
                    <Ionicons name="paw-outline" size={13} color={colors.primary} />
                    <Text style={styles.horseLinkText}>
                      {t("Hồ sơ ngựa")}
                    </Text>
                  </Pressable>
                </View>
              </Panel>
            </Pressable>
          ))}
        </View>
      ) : null}
      {resource.data &&
      !resource.isLoading &&
      !resource.error &&
      notifications.length === 0 &&
      horseAlerts.length === 0 ? (
        <PrimaryButton
          label="Refresh alerts"
          icon="refresh"
          onPress={() => void resource.refresh()}
        />
      ) : null}
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    markAllReadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexShrink: 0,
    },
    markAllReadText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    cardFooter: {
      marginTop: space.xs,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    markReadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    markReadText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    readStatusBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    readStatusText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    navLinksGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
    },
    sensorLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.injuredSoft,
    },
    sensorLinkText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.destructive,
    },
    horseLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
    horseLinkText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    horseAlertFooter: {
      marginTop: space.xs,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
  });
}

