import { io } from "socket.io-client";
import { API_BASE_URL } from "@/config/api";

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

export function subscribeToPerformanceMetrics(
  token: string,
  onMetrics: (event: PerformanceMetricsEvent) => void,
): () => void {
  const socket = io(`${API_BASE_URL.replace(/\/api\/v\d+\/?$/, "")}/events`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
  });
  const onEvent = (value: unknown) => {
    if (isMetricsEvent(value)) onMetrics(value);
  };
  socket.on("performance.metrics", onEvent);
  return () => {
    socket.off("performance.metrics", onEvent);
    socket.disconnect();
  };
}
