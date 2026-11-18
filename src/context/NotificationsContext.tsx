import { AppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { NotificationDto } from "@/adapters/notifications.adapter";
import { useAuth } from "@/context/AuthContext";
import { notificationsService } from "@/services/notifications.service";
import { subscribeToNotifications } from "@/services/realtime.service";

type NotificationsState = {
  sessionToken: string | null;
  notifications: NotificationDto[];
  unreadNotifications: NotificationDto[];
  unreadCount: number;
  nextCursor: string | null;
  unreadNextCursor: string | null;
  unreadLoaded: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  isLoadingUnread: boolean;
  isRefreshingUnread: boolean;
  isLoadingMoreUnread: boolean;
  error: unknown;
  unreadError: unknown;
};

type NotificationsContextValue = Omit<NotificationsState, "sessionToken"> & {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadUnread: (mode?: "initial" | "refresh") => Promise<void>;
  loadMoreUnread: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function createState(sessionToken: string | null, isLoading = false): NotificationsState {
  return {
    sessionToken,
    notifications: [],
    unreadNotifications: [],
    unreadCount: 0,
    nextCursor: null,
    unreadNextCursor: null,
    unreadLoaded: false,
    isLoading,
    isRefreshing: false,
    isLoadingMore: false,
    isLoadingUnread: false,
    isRefreshingUnread: false,
    isLoadingMoreUnread: false,
    error: null,
    unreadError: null,
  };
}

function mergeNotifications(
  preferred: NotificationDto[],
  fallback: NotificationDto[],
): NotificationDto[] {
  const byId = new Map<string, NotificationDto>();
  for (const item of [...fallback, ...preferred]) byId.set(item.id, item);
  return [...byId.values()].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { token, isAuthenticated } = useAuth();
  const sessionToken = isAuthenticated ? token : null;
  const [state, setState] = useState<NotificationsState>(() => createState(null));
  const requestId = useRef(0);
  const unreadRequestId = useRef(0);
  const unreadPaginationGeneration = useRef(0);
  const notificationIds = useRef(new Set<string>());
  const realtimeNotificationIds = useRef(new Set<string>());
  const activeToken = useRef<string | null>(null);
  const isLoadingMoreRequest = useRef(false);
  const isLoadingMoreUnreadRequest = useRef(false);
  const unreadLoadMoreRequestId = useRef(0);

  const currentState = useMemo(
    () =>
      state.sessionToken === sessionToken
        ? state
        : createState(sessionToken, Boolean(sessionToken)),
    [sessionToken, state],
  );

  const setForToken = useCallback(
    (expectedToken: string, update: (current: NotificationsState) => NotificationsState) => {
      setState((current) => {
        if (activeToken.current !== expectedToken) return current;
        const sessionState =
          current.sessionToken === expectedToken ? current : createState(expectedToken, true);
        return update(sessionState);
      });
    },
    [],
  );

  const loadLatest = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (!sessionToken || activeToken.current !== sessionToken) return;
      const currentRequest = ++requestId.current;
      setForToken(sessionToken, (current) => ({
        ...current,
        isLoading: mode === "initial" ? true : current.isLoading,
        isRefreshing: mode === "refresh",
        error: null,
      }));

      try {
        const [page, unread] = await Promise.all([
          notificationsService.list(sessionToken),
          notificationsService.unreadCount(sessionToken),
        ]);
        if (currentRequest !== requestId.current || activeToken.current !== sessionToken) return;
        page.items.forEach((item) => notificationIds.current.add(item.id));
        setForToken(sessionToken, (current) => ({
          ...current,
          notifications: mergeNotifications(page.items, current.notifications),
          unreadCount: unread.count,
          nextCursor: page.nextCursor,
          error: null,
        }));
      } catch (loadError) {
        if (currentRequest === requestId.current && activeToken.current === sessionToken) {
          setForToken(sessionToken, (current) => ({ ...current, error: loadError }));
        }
      } finally {
        if (currentRequest === requestId.current && activeToken.current === sessionToken) {
          setForToken(sessionToken, (current) => ({
            ...current,
            isLoading: false,
            isRefreshing: false,
          }));
        }
      }
    },
    [sessionToken, setForToken],
  );

  const loadUnread = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (!sessionToken || activeToken.current !== sessionToken) return;
      if (mode === "initial" && currentState.unreadLoaded) return;

      const currentRequest = ++unreadRequestId.current;
      const currentGeneration = ++unreadPaginationGeneration.current;
      setForToken(sessionToken, (current) => ({
        ...current,
        isLoadingUnread: mode === "initial",
        isRefreshingUnread: mode === "refresh",
        unreadError: null,
      }));

      try {
        const page = await notificationsService.list(sessionToken, undefined, {
          unreadOnly: true,
        });
        if (
          currentRequest !== unreadRequestId.current ||
          currentGeneration !== unreadPaginationGeneration.current ||
          activeToken.current !== sessionToken
        ) {
          return;
        }

        page.items.forEach((item) => notificationIds.current.add(item.id));
        const pageIds = new Set(page.items.map((item) => item.id));
        setForToken(sessionToken, (current) => {
          const currentUnread = current.unreadNotifications.filter(
            (item) =>
              !item.readAt && (mode === "initial" || realtimeNotificationIds.current.has(item.id)),
          );
          const latestPageItems = page.items
            .map(
              (item) =>
                current.notifications.find((currentItem) => currentItem.id === item.id) ??
                currentUnread.find((currentItem) => currentItem.id === item.id) ??
                item,
            )
            .filter((item) => !item.readAt);
          const newRealtimeItems = currentUnread.filter((item) => !pageIds.has(item.id));
          return {
            ...current,
            unreadNotifications: mergeNotifications(
              [...latestPageItems, ...newRealtimeItems],
              mode === "initial" ? currentUnread : [],
            ),
            unreadNextCursor: page.nextCursor,
            unreadLoaded: true,
            unreadError: null,
          };
        });
      } catch (loadError) {
        if (
          currentRequest === unreadRequestId.current &&
          currentGeneration === unreadPaginationGeneration.current &&
          activeToken.current === sessionToken
        ) {
          setForToken(sessionToken, (current) => ({ ...current, unreadError: loadError }));
        }
      } finally {
        if (
          currentRequest === unreadRequestId.current &&
          currentGeneration === unreadPaginationGeneration.current &&
          activeToken.current === sessionToken
        ) {
          setForToken(sessionToken, (current) => ({
            ...current,
            isLoadingUnread: false,
            isRefreshingUnread: false,
          }));
        }
      }
    },
    [currentState.unreadLoaded, sessionToken, setForToken],
  );

  useEffect(() => {
    activeToken.current = sessionToken;
    requestId.current += 1;
    unreadRequestId.current += 1;
    unreadPaginationGeneration.current += 1;
    notificationIds.current.clear();
    realtimeNotificationIds.current.clear();
    isLoadingMoreRequest.current = false;
    isLoadingMoreUnreadRequest.current = false;
    unreadLoadMoreRequestId.current += 1;
    if (!sessionToken) return;

    const unsubscribe = subscribeToNotifications(
      sessionToken,
      (notification) => {
        if (activeToken.current !== sessionToken || notificationIds.current.has(notification.id))
          return;
        notificationIds.current.add(notification.id);
        realtimeNotificationIds.current.add(notification.id);
        setForToken(sessionToken, (current) => ({
          ...current,
          notifications: mergeNotifications([notification], current.notifications),
          unreadNotifications: notification.readAt
            ? current.unreadNotifications
            : mergeNotifications([notification], current.unreadNotifications),
          unreadCount: current.unreadCount + (notification.readAt ? 0 : 1),
        }));
      },
      () => void loadLatest("refresh"),
    );
    const appStateSubscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") void loadLatest("refresh");
    });
    void loadLatest("initial");

    return () => {
      if (activeToken.current === sessionToken) activeToken.current = null;
      requestId.current += 1;
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [loadLatest, sessionToken, setForToken]);

  const loadMore = useCallback(async () => {
    const cursor = currentState.nextCursor;
    if (
      !sessionToken ||
      activeToken.current !== sessionToken ||
      !cursor ||
      isLoadingMoreRequest.current
    ) {
      return;
    }
    isLoadingMoreRequest.current = true;
    setForToken(sessionToken, (current) => ({ ...current, isLoadingMore: true }));
    try {
      const page = await notificationsService.list(sessionToken, cursor);
      if (activeToken.current !== sessionToken) return;
      page.items.forEach((item) => notificationIds.current.add(item.id));
      setForToken(sessionToken, (current) => ({
        ...current,
        notifications: mergeNotifications(current.notifications, page.items),
        nextCursor: page.nextCursor,
      }));
    } catch (loadError) {
      if (activeToken.current === sessionToken) {
        setForToken(sessionToken, (current) => ({ ...current, error: loadError }));
      }
      throw loadError;
    } finally {
      isLoadingMoreRequest.current = false;
      if (activeToken.current === sessionToken) {
        setForToken(sessionToken, (current) => ({ ...current, isLoadingMore: false }));
      }
    }
  }, [currentState.nextCursor, sessionToken, setForToken]);

  const loadMoreUnread = useCallback(async () => {
    const cursor = currentState.unreadNextCursor;
    const currentGeneration = unreadPaginationGeneration.current;
    if (
      !sessionToken ||
      activeToken.current !== sessionToken ||
      !cursor ||
      isLoadingMoreUnreadRequest.current
    ) {
      return;
    }
    const currentRequest = ++unreadLoadMoreRequestId.current;
    isLoadingMoreUnreadRequest.current = true;
    setForToken(sessionToken, (current) => ({ ...current, isLoadingMoreUnread: true }));
    try {
      const page = await notificationsService.list(sessionToken, cursor, { unreadOnly: true });
      if (
        activeToken.current !== sessionToken ||
        currentGeneration !== unreadPaginationGeneration.current
      ) {
        return;
      }

      page.items.forEach((item) => notificationIds.current.add(item.id));
      setForToken(sessionToken, (current) => {
        const currentById = new Map(
          [...current.notifications, ...current.unreadNotifications].map((item) => [item.id, item]),
        );
        const pageItems = page.items
          .map((item) => currentById.get(item.id) ?? item)
          .filter((item) => !item.readAt);
        return {
          ...current,
          unreadNotifications: mergeNotifications(pageItems, current.unreadNotifications),
          unreadNextCursor: page.nextCursor,
          unreadError: null,
        };
      });
    } catch (loadError) {
      if (
        activeToken.current === sessionToken &&
        currentGeneration === unreadPaginationGeneration.current
      ) {
        setForToken(sessionToken, (current) => ({ ...current, unreadError: loadError }));
      }
      throw loadError;
    } finally {
      if (unreadLoadMoreRequestId.current === currentRequest) {
        isLoadingMoreUnreadRequest.current = false;
      }
      if (
        activeToken.current === sessionToken &&
        unreadLoadMoreRequestId.current === currentRequest
      ) {
        setForToken(sessionToken, (current) => ({ ...current, isLoadingMoreUnread: false }));
      }
    }
  }, [currentState.unreadNextCursor, sessionToken, setForToken]);

  const refreshUnreadCount = useCallback(async () => {
    if (!sessionToken || activeToken.current !== sessionToken) return;
    const result = await notificationsService.unreadCount(sessionToken);
    if (activeToken.current === sessionToken) {
      setForToken(sessionToken, (current) => ({ ...current, unreadCount: result.count }));
    }
  }, [sessionToken, setForToken]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!sessionToken || activeToken.current !== sessionToken) return;
      const existingInAll = currentState.notifications.find((item) => item.id === notificationId);
      const existingInUnread = currentState.unreadNotifications.find(
        (item) => item.id === notificationId,
      );
      const existing = existingInUnread ?? existingInAll;
      if (!existing || existing.readAt) return;
      const readAt = new Date().toISOString();
      setForToken(sessionToken, (current) => ({
        ...current,
        notifications: current.notifications.map((item) =>
          item.id === notificationId ? { ...item, readAt } : item,
        ),
        unreadNotifications: current.unreadNotifications.filter(
          (item) => item.id !== notificationId,
        ),
        unreadCount: Math.max(0, current.unreadCount - 1),
      }));
      try {
        await notificationsService.markRead(sessionToken, notificationId);
      } catch (markError) {
        if (activeToken.current === sessionToken) {
          setForToken(sessionToken, (current) => ({
            ...current,
            notifications: current.notifications.map((item) =>
              item.id === notificationId ? (existingInAll ?? existing) : item,
            ),
            unreadNotifications: existingInUnread
              ? mergeNotifications([existingInUnread], current.unreadNotifications)
              : current.unreadNotifications,
          }));
          await refreshUnreadCount().catch(() => undefined);
        }
        throw markError;
      }
    },
    [
      currentState.notifications,
      currentState.unreadNotifications,
      refreshUnreadCount,
      sessionToken,
      setForToken,
    ],
  );

  const markAllRead = useCallback(async () => {
    if (!sessionToken || activeToken.current !== sessionToken) return;
    unreadPaginationGeneration.current += 1;
    const readAt = new Date().toISOString();
    setForToken(sessionToken, (current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        item.readAt ? item : { ...item, readAt },
      ),
      unreadNotifications: [],
      unreadCount: 0,
      unreadNextCursor: null,
      unreadLoaded: true,
      isLoadingUnread: false,
      isRefreshingUnread: false,
      isLoadingMoreUnread: false,
      unreadError: null,
    }));
    try {
      await notificationsService.markAllRead(sessionToken);
    } catch (markError) {
      if (activeToken.current === sessionToken) {
        await Promise.all([
          loadLatest("refresh").catch(() => undefined),
          loadUnread("refresh").catch(() => undefined),
        ]);
      }
      throw markError;
    }
  }, [loadLatest, loadUnread, sessionToken, setForToken]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications: currentState.notifications,
      unreadNotifications: currentState.unreadNotifications,
      unreadCount: currentState.unreadCount,
      nextCursor: currentState.nextCursor,
      unreadNextCursor: currentState.unreadNextCursor,
      unreadLoaded: currentState.unreadLoaded,
      isLoading: currentState.isLoading,
      isRefreshing: currentState.isRefreshing,
      isLoadingMore: currentState.isLoadingMore,
      isLoadingUnread: currentState.isLoadingUnread,
      isRefreshingUnread: currentState.isRefreshingUnread,
      isLoadingMoreUnread: currentState.isLoadingMoreUnread,
      error: currentState.error,
      unreadError: currentState.unreadError,
      refresh: () => loadLatest("refresh"),
      loadMore,
      loadUnread,
      loadMoreUnread,
      markRead,
      markAllRead,
    }),
    [currentState, loadLatest, loadMore, loadMoreUnread, loadUnread, markAllRead, markRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used within NotificationsProvider");
  return value;
}
