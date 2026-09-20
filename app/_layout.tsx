import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RaceOSProvider } from "@/context/RaceOSContext";
import { I18nProvider } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";

export default function RootLayout() {
    const { colors, isDark } = useTheme();
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <RaceOSProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
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
