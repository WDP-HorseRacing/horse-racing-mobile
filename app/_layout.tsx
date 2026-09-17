import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/native/theme";
import { RaceOSProvider } from "@/context/RaceOSContext";
import { I18nProvider } from "@/context/I18nContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <RaceOSProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </RaceOSProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
