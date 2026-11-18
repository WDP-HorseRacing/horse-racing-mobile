import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { type Href, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, getUiStyles } from "@/components/ui";
import { useNotifications } from "@/context/NotificationsContext";
import { useI18n } from "@/context/I18nContext";
import {
  notificationCategoryLabel,
  mapNotification,
  type NotificationView,
} from "@/adapters/notifications.adapter";
import { notificationTarget } from "@/features/notifications/notification-target";
import type { RoleId } from "@/types/raceos";
import { extractErrorMessage } from "@/utils/errorHandler";
import { isQaTestContent } from "@/utils/textCleaner";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

type FeedFilter = "ALL" | "UNREAD";

export function NotificationsFeed({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const {
    notifications: rawNotifications,
    unreadNotifications: rawUnreadNotifications,
    unreadCount,
    nextCursor,
    unreadNextCursor,
    unreadLoaded,
    isLoading,
    isRefreshing,
    isLoadingMore,
    isLoadingUnread,
    isRefreshingUnread,
    isLoadingMoreUnread,
    error,
    unreadError,
    refresh,
    loadMore,
    loadUnread,
    loadMoreUnread,
    markRead,
    markAllRead,
  } = useNotifications();
  const [filter, setFilter] = useState<FeedFilter>("ALL");
  const sourceNotifications = filter === "UNREAD" ? rawUnreadNotifications : rawNotifications;

  const notifications = useMemo(
    () =>
      sourceNotifications
        .filter((item) => !isQaTestContent(item.title) && !isQaTestContent(item.message))
        .map(mapNotification),
    [sourceNotifications],
  );
  const visibleNotifications = useMemo(
    () => (filter === "UNREAD" ? notifications.filter((item) => !item.readAt) : notifications),
    [filter, notifications],
  );

  const openNotification = (id: string, target: string) => {
    router.push(target as Href);
    void markRead(id).catch((markError) =>
      Alert.alert(t("Could not update notification"), extractErrorMessage(markError)),
    );
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch (markError) {
      Alert.alert(t("Could not update notifications"), extractErrorMessage(markError));
    }
  };

  const currentCursor = filter === "UNREAD" ? unreadNextCursor : nextCursor;
  const currentIsLoading = filter === "UNREAD" ? isLoadingUnread : isLoading;
  const currentIsRefreshing = filter === "UNREAD" ? isRefreshingUnread : isRefreshing;
  const currentIsLoadingMore = filter === "UNREAD" ? isLoadingMoreUnread : isLoadingMore;
  const currentError = filter === "UNREAD" ? unreadError : error;
  const errorToShow = visibleNotifications.length > 0 ? null : currentError;

  const changeFilter = (nextFilter: FeedFilter) => {
    setFilter(nextFilter);
    if (nextFilter === "UNREAD" && !unreadLoaded) void loadUnread("initial");
  };

  const refreshCurrentFilter = () => {
    if (filter === "UNREAD") {
      void Promise.all([refresh(), loadUnread("refresh")]);
      return;
    }
    void refresh();
  };

  const loadMoreForCurrentFilter = () => {
    const action = filter === "UNREAD" ? loadMoreUnread : loadMore;
    void action().catch((loadError) =>
      Alert.alert(t("Could not load older notifications"), extractErrorMessage(loadError)),
    );
  };

  return (
    <Screen
      role={role}
      title="Notifications"
      subtitle={t("{value} unread notifications".replace("{value}", String(unreadCount)))}
      scrollable={false}
    >
      <FlatList<NotificationView>
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={visibleNotifications}
        keyExtractor={(notification) => notification.id}
        renderItem={({ item: notification }) => {
          const target = notificationTarget(notification, role);
          const isUrgent = notification.priority === "URGENT";
          const isHigh = notification.priority === "HIGH";
          const priorityColor = isUrgent
            ? colors.destructive
            : isHigh
              ? colors.monitor
              : colors.primary;
          const priorityBackground = isUrgent
            ? colors.injuredSoft
            : isHigh
              ? colors.monitorSoft
              : colors.fitSoft;

          return (
            <Panel style={[styles.notificationCard, !notification.readAt && styles.unreadCard]}>
              <View style={uiStyles.row}>
                <View style={styles.categoryRow}>
                  {!notification.readAt ? <View style={styles.unreadDot} /> : null}
                  <Text style={[uiStyles.label, { color: priorityColor }]} numberOfLines={1}>
                    {t(notificationCategoryLabel(notification.category))}
                  </Text>
                </View>
                <Text style={[uiStyles.muted, styles.timestamp]}>
                  {notification.createdAtLabel}
                </Text>
              </View>
              <View style={styles.priorityRow}>
                <View style={[styles.priorityPill, { backgroundColor: priorityBackground }]}>
                  <Text style={[styles.priorityText, { color: priorityColor }]}>
                    {t(notification.priority)}
                  </Text>
                </View>
              </View>
              <Text style={[uiStyles.value, styles.notificationTitle]}>{notification.title}</Text>
              <Text style={uiStyles.muted}>{notification.message}</Text>

              <View style={styles.cardFooter}>
                {!notification.readAt ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void markRead(notification.id).catch((markError) =>
                        Alert.alert(
                          t("Could not update notification"),
                          extractErrorMessage(markError),
                        ),
                      )
                    }
                    style={styles.actionButton}
                  >
                    <Ionicons name="checkmark-done" size={14} color={colors.primary} />
                    <Text style={styles.actionText}>{t("Mark read")}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.readStatus}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <Text style={styles.readStatusText}>{t("Read")}</Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void openNotification(notification.id, target)}
                  style={styles.actionButton}
                >
                  <Text style={[styles.actionText, { color: colors.primary }]}>
                    {t("View details")}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </Pressable>
              </View>
            </Panel>
          );
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.filterRow}>
              {(
                [
                  ["ALL", "All"],
                  ["UNREAD", "Unread"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === key }}
                  onPress={() => changeFilter(key)}
                  style={[styles.filterChip, filter === key && styles.filterChipActive]}
                >
                  <Text
                    style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}
                  >
                    {t(label)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {visibleNotifications.length > 0 ? (
              <SectionTitle
                action={
                  unreadCount > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleMarkAllRead()}
                      style={styles.markAllReadButton}
                    >
                      <Ionicons
                        name="checkmark-done-circle-outline"
                        size={15}
                        color={colors.primary}
                      />
                      <Text style={styles.markAllReadText}>{t("Mark all read")}</Text>
                    </Pressable>
                  ) : null
                }
              >
                {t("Recent notifications")}
              </SectionTitle>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <AsyncStateView
            isLoading={currentIsLoading}
            error={errorToShow}
            onRetry={refreshCurrentFilter}
            empty={!currentIsLoading && !errorToShow}
            emptyLabel={
              filter === "UNREAD" ? "You have no unread notifications." : "No notifications yet."
            }
          />
        }
        ListFooterComponent={
          currentCursor ? (
            <Pressable
              accessibilityRole="button"
              disabled={currentIsLoadingMore}
              onPress={loadMoreForCurrentFilter}
              style={styles.loadMoreButton}
            >
              <Text style={styles.loadMoreText}>
                {currentIsLoadingMore ? t("Loading…") : t("Load older notifications")}
              </Text>
              {!currentIsLoadingMore ? (
                <Ionicons name="chevron-down" size={16} color={colors.primary} />
              ) : null}
            </Pressable>
          ) : undefined
        }
        refreshing={currentIsRefreshing}
        onRefresh={refreshCurrentFilter}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={40}
        windowSize={3}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    list: { flex: 1 },
    listContent: { padding: space.lg, paddingBottom: space.lg },
    filterRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
    filterChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 15,
      paddingVertical: 8,
    },
    filterChipActive: { borderColor: colors.primary, backgroundColor: colors.fitSoft },
    filterChipText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "600" },
    filterChipTextActive: { color: colors.primary },
    markAllReadButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexShrink: 0,
    },
    markAllReadText: { fontSize: 11, fontWeight: "700", color: colors.primary },
    notificationCard: { marginBottom: space.sm, gap: space.xs },
    unreadCard: { borderColor: colors.borderStrong },
    categoryRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
    unreadDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.primary },
    timestamp: { flexShrink: 0 },
    priorityRow: { flexDirection: "row", marginTop: 2 },
    priorityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    priorityText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
    notificationTitle: { marginTop: 3 },
    cardFooter: {
      marginTop: space.xs,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    actionButton: {
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
    },
    actionText: { color: colors.mutedForeground, fontSize: 12, fontWeight: "700" },
    readStatus: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
    readStatusText: { color: colors.mutedForeground, fontSize: 12 },
    loadMoreButton: {
      minHeight: 44,
      marginTop: space.sm,
      marginBottom: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    loadMoreText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  });
}
