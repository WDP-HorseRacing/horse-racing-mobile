import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "@/services/api-client";

const DEVICE_TOKEN_STORAGE_KEY = "raceos.push.device-token.v1";

type NativePlatform = "ANDROID";

function getNativePlatform(): NativePlatform | null {
  if (Platform.OS === "android") return "ANDROID";
  return null;
}

export const pushDeviceService = {
  async enableForCurrentDevice(accessToken: string): Promise<boolean> {
    const platform = getNativePlatform();
    if (!platform) return false;

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;

    if (platform === "ANDROID") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Horse Racing",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    return this.registerNativeToken(accessToken, deviceToken);
  },

  async registerIfPermissionGranted(accessToken: string): Promise<void> {
    if (!getNativePlatform()) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    await this.registerNativeToken(accessToken, deviceToken);
  },

  async registerNativeToken(
    accessToken: string,
    token: Notifications.DevicePushToken,
  ): Promise<boolean> {
    if (token.type !== "android" || typeof token.data !== "string" || !token.data.trim())
      return false;

    await apiRequest<void>("/me/devices", {
      method: "PUT",
      token: accessToken,
      body: { token: token.data, platform: "ANDROID" },
    });
    await AsyncStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token.data);
    return true;
  },

  getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
  },

  clearStoredToken(): Promise<void> {
    return AsyncStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
  },

  async hasStoredToken(): Promise<boolean> {
    return Boolean(await AsyncStorage.getItem(DEVICE_TOKEN_STORAGE_KEY));
  },
};
