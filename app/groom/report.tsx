import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { horses, incidentKinds } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { Chips, Field, NativeInput , Panel, PrimaryButton, uiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { colors, radius, space } from "@/config/theme";

export default function GroomReport() {
  const { reportIncident } = useRaceOS();
  const [horse, setHorse] = useState("");
  const [kind, setKind] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [note, setNote] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [sent, setSent] = useState(false);
  const send = () => {
    if (!horse || !kind) {
      Alert.alert("Missing information", "Select a horse and what you saw.");
      return;
    }
    reportIncident({ horse, kind, severity, note, hasPhoto });
    setSent(true);
  };
  if (sent)
    return (
      <Screen role="groom" title="Incident sent" back>
        <View style={styles.success}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.title}>Sent to the veterinarian</Text>
          <Text style={uiStyles.muted}>
            {horse} · {kind} · severity {severity}
          </Text>
        </View>
        <Panel>
          <Text style={uiStyles.muted}>• Vet notified immediately · escalation timer started</Text>
          <Text style={uiStyles.muted}>• Trainer informed if training is affected</Text>
          <Text style={uiStyles.muted}>• Event added to horse timeline and audit log</Text>
        </Panel>
        <PrimaryButton label="Back to today" onPress={() => router.replace("/groom")} />
      </Screen>
    );
  return (
    <Screen role="groom" title="Report incident" subtitle="Three taps · under 20 seconds" back>
      <View style={uiStyles.section}>
        <SectionTitle>1 · Which horse</SectionTitle>
        <View style={styles.horseGrid}>
          {horses.slice(0, 6).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setHorse(item.name)}
              style={[styles.horse, horse === item.name && styles.selected]}
            >
              <Text style={uiStyles.value}>{item.name}</Text>
              <Text style={uiStyles.muted}>{item.stall}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>2 · What did you see</SectionTitle>
        <Chips options={incidentKinds} value={kind} onChange={setKind} />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>3 · Severity</SectionTitle>
        <Chips
          options={["Low", "Medium", "High", "Urgent"]}
          value={severity}
          onChange={setSeverity}
        />
      </View>
      <Field label="Photo">
        <Pressable onPress={() => setHasPhoto(true)} style={styles.photo}>
          <Text style={uiStyles.value}>{hasPhoto ? "Photo attached ✓" : "Attach a photo"}</Text>
        </Pressable>
      </Field>
      <Field label="Optional note">
        <NativeInput value={note} onChangeText={setNote} multiline placeholder="What happened?" />
      </Field>
      <PrimaryButton label="Send to veterinarian" icon="send" onPress={send} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  horseGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  horse: {
    width: "48%",
    padding: space.md,
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  photo: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  success: {
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: space.xl,
  },
  successIcon: { color: colors.primary, fontSize: 34, fontWeight: "900" },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
});
