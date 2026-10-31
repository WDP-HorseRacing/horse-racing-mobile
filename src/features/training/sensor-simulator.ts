import { performanceService } from "@/services/performance.service";

const activeSimulators = new Map<string, ReturnType<typeof setInterval>>();

export type SimTelemetryPoint = {
  sourceId: string;
  recordedAt: string;
  heartRateBpm: number;
  speedMps: number;
};

/**
 * Generate a realistic telemetry point within normal bounds (< 180 bpm)
 */
export function generateNormalMetric(): { heartRateBpm: number; speedMps: number } {
  // Typical safe training heart rate between 135 - 160 bpm (strictly NORMAL < 180)
  const heartRateBpm = Math.floor(135 + Math.random() * 25);
  // Typical canter/gallop speed between 11.0 - 14.5 m/s (approx 40 - 52 km/h)
  const speedMps = Number((11.0 + Math.random() * 3.5).toFixed(2));
  return { heartRateBpm, speedMps };
}

/**
 * Send a single telemetry point to Backend API
 */
export async function sendTelemetryPoint(
  participantId: string,
  overrides?: Partial<SimTelemetryPoint>,
  token?: string | null,
) {
  const normal = generateNormalMetric();
  const point: SimTelemetryPoint = {
    sourceId: overrides?.sourceId ?? "sim-device-01",
    recordedAt: overrides?.recordedAt ?? new Date().toISOString(),
    heartRateBpm: overrides?.heartRateBpm ?? normal.heartRateBpm,
    speedMps: overrides?.speedMps ?? normal.speedMps,
  };

  const result = await performanceService.ingestMetric(participantId, point, token);
  return { point, result };
}

/**
 * Trigger an acute Heart Rate Spike (Vọt nhịp tim)
 * Backend CRITICAL threshold is >= 240 bpm.
 * This triggers domain event PERFORMANCE_METRIC_CRITICAL_EVENT, pushing an URGENT notification
 * to Veterinarians and Head Trainer, and emitting realtime metrics to the socket.
 */
export async function sendHeartRateSpike(participantId: string, token?: string | null) {
  const point: SimTelemetryPoint = {
    sourceId: "sim-device-01",
    recordedAt: new Date().toISOString(),
    heartRateBpm: 248, // Exceeds 240 bpm -> CRITICAL
    speedMps: 16.8, // High galloping speed
  };

  const result = await performanceService.ingestMetric(participantId, point, token);
  return { point, result };
}

/**
 * Start periodic telemetry streaming (simulating an active IoT sensor)
 */
export function startSimulation(
  participantId: string,
  token?: string | null,
  options?: {
    intervalMs?: number;
    onTick?: (point: SimTelemetryPoint) => void;
    onError?: (error: unknown) => void;
  },
) {
  stopSimulation(participantId);

  const intervalMs = options?.intervalMs ?? 1000;
  let timer: ReturnType<typeof setInterval> | null = null;
  let requestInFlight = false;

  const sendPoint = async () => {
    if (requestInFlight || !timer || activeSimulators.get(participantId) !== timer) return;
    requestInFlight = true;

    try {
      const { point } = await sendTelemetryPoint(participantId, undefined, token);
      if (activeSimulators.get(participantId) === timer) options?.onTick?.(point);
    } catch (error) {
      if (activeSimulators.get(participantId) !== timer) return;
      stopSimulation(participantId);
      options?.onError?.(error);
    } finally {
      requestInFlight = false;
    }
  };

  timer = setInterval(() => void sendPoint(), intervalMs);
  activeSimulators.set(participantId, timer);
  void sendPoint();
}

/**
 * Stop simulation for a specific participant or all participants
 */
export function stopSimulation(participantId?: string) {
  if (participantId) {
    const timer = activeSimulators.get(participantId);
    if (timer) {
      clearInterval(timer);
      activeSimulators.delete(participantId);
    }
  } else {
    for (const [, timer] of activeSimulators) {
      clearInterval(timer);
    }
    activeSimulators.clear();
  }
}

/**
 * Check if a participant is currently streaming simulated telemetry
 */
export function isSimulating(participantId: string): boolean {
  return activeSimulators.has(participantId);
}
