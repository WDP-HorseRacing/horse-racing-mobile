import { useColorScheme } from "react-native";
import { lightColors, darkColors, type ThemeColors } from "@/config/theme";

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
  };
}
