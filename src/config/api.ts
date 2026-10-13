const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, "");

