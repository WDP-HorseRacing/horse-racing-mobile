import { useCallback, useMemo } from "react";
import { Alert, Pressable, View } from "react-native";
import { type Href, router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { notificationsService } from "@/services/notifications.service";
import { mapHorseAlert, mapNotification } from "@/adapters/notifications.adapter";
import type { RoleId } from "@/types/raceos";
import { extractErrorMessage } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";

export function NotificationsFeed({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
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
          <View style={uiStyles.row}>
            <SectionTitle>Notifications</SectionTitle>
            {unreadCount ? (
              <SecondaryButton label="Mark all read" onPress={() => void markAllRead()} />
            ) : null}
          </View>
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
                  {notification.priority} · {notification.category}
                </Text>
                <Text style={[uiStyles.muted, { flexShrink: 0 }]}>
                  {notification.createdAtLabel}
                </Text>
              </View>
              <Text style={uiStyles.value}>{notification.title}</Text>
              <Text style={uiStyles.muted}>{notification.message}</Text>
              <View style={uiStyles.row}>
                {!notification.readAt ? (
                  <SecondaryButton
                    label="Mark read"
                    onPress={() => void markRead(notification.id)}
                  />
                ) : (
                  <Text style={uiStyles.label}>Read</Text>
                )}
                {notification.resource?.horseId ? (
                  <Pressable
                    onPress={() =>
                      router.push(`/${role}/horse/${notification.resource!.horseId}` as Href)
                    }
                  >
                    <Text style={{ ...uiStyles.label, color: colors.primary }}>Open horse</Text>
                  </Pressable>
                ) : null}
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
              onPress={() => router.push(`/${role}/horse/${alert.horseId}` as Href)}
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
