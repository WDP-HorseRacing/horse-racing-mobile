/* eslint-disable @typescript-eslint/no-require-imports */
function extractHostIp(): string | undefined {
  try {
    const Constants = require("expo-constants")?.default ?? require("expo-constants");
    const rawUri: string | undefined =
      Constants?.expoConfig?.hostUri ??
      Constants?.expoGoConfig?.debuggerHost ??
      Constants?.manifest2?.extra?.expoGo?.debuggerHost ??
      Constants?.manifest2?.extra?.expoClient?.hostUri ??
      Constants?.manifest?.debuggerHost ??
      Constants?.linkingUri;
    if (rawUri) {
      const match = rawUri.match(/(?:exp:\/\/|https?:\/\/)?([^:/]+)/i);
      const candidate = match ? match[1] : rawUri.split(":")[0];
      if (candidate && candidate !== "localhost" && candidate !== "127.0.0.1") {
        return candidate;
      }
    }
  } catch {}

  try {
    const { NativeModules, Platform } = require("react-native");
    if (Platform?.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
      const webHost = window.location.hostname;
      if (webHost && webHost !== "localhost" && webHost !== "127.0.0.1") {
        return webHost;
      }
    }
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = String(scriptURL).match(/https?:\/\/([^:/]+)/i);
      const candidate = match ? match[1] : undefined;
      if (candidate && candidate !== "localhost" && candidate !== "127.0.0.1") {
        return candidate;
      }
    }
  } catch {}

  return undefined;
}
/* eslint-enable @typescript-eslint/no-require-imports */

export const METRO_HOST_IP = extractHostIp();

function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
  const trimmed = configured.replace(/\/$/, "");

  // If already an explicit IP or remote domain, keep as is
  if (!trimmed.includes("localhost") && !trimmed.includes("127.0.0.1")) {
    return trimmed;
  }

  // When running on a physical device with Expo Go, localhost refers to the phone itself.
  // Automatically substitute Metro packager host IP when available.
  if (METRO_HOST_IP) {
    return trimmed.replace("localhost", METRO_HOST_IP).replace("127.0.0.1", METRO_HOST_IP);
  }

  return trimmed;
}

export const API_BASE_URL = resolveApiBaseUrl();

