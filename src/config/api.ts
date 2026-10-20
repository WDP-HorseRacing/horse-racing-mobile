/* eslint-disable @typescript-eslint/no-require-imports */
let hostUri: string | undefined;
try {
  const Constants = require("expo-constants")?.default ?? require("expo-constants");
  hostUri = Constants?.expoConfig?.hostUri;
} catch {
  // Ignored in non-Expo or Node test environments
}
/* eslint-enable @typescript-eslint/no-require-imports */

function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
  const trimmed = configured.replace(/\/$/, "");

  // If already an explicit IP or remote domain, keep as is
  if (!trimmed.includes("localhost") && !trimmed.includes("127.0.0.1")) {
    return trimmed;
  }

  // When running on a physical device with Expo Go, localhost refers to the phone itself.
  // Automatically substitute Metro host IP when available.
  if (hostUri) {
    const hostIp = hostUri.split(":")[0];
    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      return trimmed.replace("localhost", hostIp).replace("127.0.0.1", hostIp);
    }
  }

  return trimmed;
}

export const API_BASE_URL = resolveApiBaseUrl();
