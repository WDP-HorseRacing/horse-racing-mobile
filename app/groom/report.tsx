import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { incidentKinds } from "@/lib/raceos-data";
import { useAuth } from "@/context/AuthContext";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { groomService, type IncidentDto } from "@/services/groom.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";

export default function GroomReport() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token } = useAuth();
  const [horseId, setHorseId] = useState("");
  const [kind, setKind] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<IncidentDto | null>(null);
  const [saving, setSaving] = useState(false);
  const loadHorses = useCallback(() => horseService.list(token!), [token]);
  const horsesResource = useApiResource(loadHorses, Boolean(token));
  const horse = horsesResource.data?.find((item) => item.id === horseId);

  const send = async () => {
    if (!token || !horse || !kind) {
      Alert.alert("Missing information", "Select a horse and incident type before submitting.");
      return;
    }
    setSaving(true);
    try {
      const description = [`Kind: ${kind}`, `Severity: ${severity}`, note.trim()].filter(Boolean).join("\n");
      setSent(await groomService.reportIncident(token, {
        horseId: horse.id,
        description,
        urgent: severity === "Urgent",
      }));
    } catch (error) {
      Alert.alert("Could not send incident", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (sent) return (
    <Screen role="groom" title="Incident sent" back>
      <Panel>
        <Text style={uiStyles.value}>Incident recorded</Text>
        <Text style={uiStyles.muted}>{sent.horseName} · {sent.status} · {sent.urgent ? "Urgent" : "Normal priority"}</Text>
        <Text style={uiStyles.muted}>{sent.description}</Text>
      </Panel>
      <PrimaryButton label="Back to today" onPress={() => router.replace("/groom")} />
    </Screen>
  );

  return (
    <Screen role="groom" title="Report incident" subtitle="Submit an incident to the stable team" back refreshing={horsesResource.isRefreshing} onRefresh={() => void horsesResource.refresh()}>
      <View style={uiStyles.section}>
        <SectionTitle>1 · Which horse</SectionTitle>
        <AsyncStateView isLoading={horsesResource.isLoading} error={horsesResource.error} onRetry={() => void horsesResource.retry()} empty={!horsesResource.isLoading && !horsesResource.error && (horsesResource.data?.length ?? 0) === 0} emptyLabel="No horses are available." />
        {horsesResource.data?.length ? <Chips options={horsesResource.data.map((item) => `${item.name} · ${item.id.slice(0, 6)}`)} value={horse ? `${horse.name} · ${horse.id.slice(0, 6)}` : ""} onChange={(value) => setHorseId(horsesResource.data?.find((item) => `${item.name} · ${item.id.slice(0, 6)}` === value)?.id ?? "")} /> : null}
      </View>
      <View style={uiStyles.section}><SectionTitle>2 · What did you see</SectionTitle><Chips options={incidentKinds} value={kind} onChange={setKind} /></View>
      <View style={uiStyles.section}><SectionTitle>3 · Severity</SectionTitle><Chips options={["Low", "Medium", "High", "Urgent"]} value={severity} onChange={setSeverity} /></View>
      <Field label="Optional note"><NativeInput value={note} onChangeText={setNote} multiline placeholder="What happened?" /></Field>
      <PrimaryButton label={saving ? "Sending…" : "Send incident"} icon="send" onPress={() => void send()} disabled={saving || !horse || !kind} />
    </Screen>
  );
}
