import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "@/native/ui";
import { colors, space } from "@/native/theme";

export default function NotFound() {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: space.xl, gap: space.lg },
  code: { color: colors.primary, fontSize: 64, fontWeight: "800" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: space.md },
});
