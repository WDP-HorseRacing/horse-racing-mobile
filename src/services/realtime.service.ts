import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { API_BASE_URL } from "@/config/api";
import type { NotificationDto } from "@/adapters/notifications.adapter";

export type PerformanceMetricPoint = {
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
  alertLevel: "NORMAL" | "WARNING" | "CRITICAL";
};

export type PerformanceMetricsEvent = {
  sessionParticipantId: string;
  sessionId: string;
  horseId: string;
  points: PerformanceMetricPoint[];
};

function isMetricsEvent(value: unknown): value is PerformanceMetricsEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<PerformanceMetricsEvent>;
  return (
    typeof event.sessionParticipantId === "string" &&
    typeof event.sessionId === "string" &&
    typeof event.horseId === "string" &&
    Array.isArray(event.points) &&
    event.points.every(
      (point) =>
        point &&
        typeof point.recordedAt === "string" &&
        typeof point.heartRateBpm === "number" &&
        typeof point.speedMps === "number" &&
        ["NORMAL", "WARNING", "CRITICAL"].includes(point.alertLevel),
    )
  );
}

type RealtimeNotification = Omit<NotificationDto, "readAt"> & {
  readAt?: NotificationDto["readAt"];
};

function isNotificationEvent(value: unknown): value is RealtimeNotification {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<NotificationDto>;
  return (
    typeof item.id === "string" &&
    typeof item.category === "string" &&
    typeof item.priority === "string" &&
    typeof item.title === "string" &&
    typeof item.message === "string" &&
    (item.readAt === undefined || item.readAt === null || typeof item.readAt === "string") &&
    typeof item.createdAt === "string"
  );
}

type RealtimeListener<T> = {
  token: string;
  listener: (event: T) => void;
  onReconnect?: () => void;
};

let socket: Socket | null = null;
let socketToken: string | null = null;
let hasConnected = false;
const metricListeners = new Set<RealtimeListener<PerformanceMetricsEvent>>();
const notificationListeners = new Set<RealtimeListener<NotificationDto>>();

function hasListenersFor(token: string) {
  return [...metricListeners, ...notificationListeners].some((entry) => entry.token === token);
}

function closeSocketIfUnused() {
  if (!socket || !socketToken || hasListenersFor(socketToken)) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  socketToken = null;
  hasConnected = false;
}

function connectSocket(token: string) {
  if (socket && socketToken === token) return socket;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socketToken = token;
  hasConnected = false;
  socket = io(`${API_BASE_URL.replace(/\/api\/v\d+\/?$/, "")}/events`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
  });
  socket.on("connect", () => {
    if (hasConnected) {
      notificationListeners.forEach((entry) => {
        if (entry.token === socketToken) entry.onReconnect?.();
      });
    }
    hasConnected = true;
  });
  socket.on("performance.metrics", (value: unknown) => {
    if (!isMetricsEvent(value)) return;
    metricListeners.forEach((entry) => {
      if (entry.token === socketToken) entry.listener(value);
    });
  });
  socket.on("notification.created", (value: unknown) => {
    if (!isNotificationEvent(value)) return;
    const notification: NotificationDto = { ...value, readAt: value.readAt ?? null };
    notificationListeners.forEach((entry) => {
      if (entry.token === socketToken) entry.listener(notification);
    });
  });
  return socket;
}

export function subscribeToPerformanceMetrics(
  token: string,
  onMetrics: (event: PerformanceMetricsEvent) => void,
): () => void {
  const entry = { token, listener: onMetrics };
  metricListeners.add(entry);
  connectSocket(token);
  return () => {
    metricListeners.delete(entry);
    closeSocketIfUnused();
  };
}

export function subscribeToNotifications(
  token: string,
  onNotification: (notification: NotificationDto) => void,
  onReconnect?: () => void,
): () => void {
  const entry = { token, listener: onNotification, onReconnect };
  notificationListeners.add(entry);
  connectSocket(token);
  return () => {
    notificationListeners.delete(entry);
    closeSocketIfUnused();
  };
}
