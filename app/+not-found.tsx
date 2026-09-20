import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/ui";
import { space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function NotFound() {
    const { colors } = useTheme();
    const styles = getStyles(colors);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.copy}>This workspace is not available for the selected role.</Text>
        <PrimaryButton label="Return to role selection" onPress={() => router.replace("/")} />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: space.xl, gap: space.lg },
  code: { color: colors.primary, fontSize: 64, fontWeight: "800" },
  title: { color: colors.foreground, fontSize: 28, fontWeight: "800" },
  copy: { color: colors.mutedForeground, fontSize: 15, lineHeight: 22, marginBottom: space.md },
});
