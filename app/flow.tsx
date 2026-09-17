import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { LanguageToggle, Text } from "@/native/LocalizedText";
import { flowSteps } from "@/lib/raceos-data";
import { Panel, PrimaryButton, SectionTitle, uiStyles } from "@/native/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space } from "@/native/theme";

export default function Flow() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ position: "absolute", right: 18, top: 54, zIndex: 10 }}>
        <LanguageToggle />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.title}>Stable workflow</Text>
          <Text style={uiStyles.muted}>One horse, one connected chain of decisions.</Text>
        </View>
        <SectionTitle>End-to-end response</SectionTitle>
        {flowSteps.map((step, index) => (
          <Panel key={`${step.role}-${index}`} style={step.critical ? uiStyles.alert : undefined}>
            <Text style={uiStyles.label}>{step.role}</Text>
            <Text style={uiStyles.value}>{step.action}</Text>
            <Text style={uiStyles.muted}>{step.detail}</Text>
          </Panel>
        ))}
        <PrimaryButton label="Back" icon="arrow-back" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: space.lg,
    paddingBottom: 60,
    gap: space.md,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
});
