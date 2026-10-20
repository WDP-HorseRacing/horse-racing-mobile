import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RaceOSProvider } from "@/context/RaceOSContext";
import { I18nProvider } from "@/context/I18nContext";
import { AuthProvider } from "@/context/AuthContext";
import { AuthRouteGate } from "@/features/auth/AuthRouteGate";
import { useTheme } from "@/hooks/useTheme";

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <RaceOSProvider>
            <StatusBar style={isDark ? "light" : "dark"} />
            <AuthRouteGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="login" />
              </Stack>
            </AuthRouteGate>
          </RaceOSProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
