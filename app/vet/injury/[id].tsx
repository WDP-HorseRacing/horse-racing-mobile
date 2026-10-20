import { type Href, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { Panel, getUiStyles } from "@/components/ui";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { medicalService } from "@/services/medical.service";
import { formatDateTime } from "@/utils/formatters";
import { useTheme } from "@/hooks/useTheme";

const regionLabels: Record<string, string> = {
  HEAD: "Head",
  NECK: "Neck",
  BACK: "Back",
  CHEST: "Chest",
  ABDOMEN: "Abdomen",
  PELVIS: "Pelvis",
  LEFT_FRONT_LEG: "Left front leg",
  RIGHT_FRONT_LEG: "Right front leg",
  LEFT_HIND_LEG: "Left hind leg",
  RIGHT_HIND_LEG: "Right hind leg",
  OTHER: "Other region",
};

export default function InjuryMap() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const horseId = Array.isArray(id) ? id[0] : id;
  const { token } = useAuth();
  const load = useCallback(async () => {
    const [horse, injuries] = await Promise.all([
      horseService.get(token!, horseId),
      medicalService.listInjuries(token!, horseId),
    ]);
    return { horse, injuries };
  }, [token, horseId]);
  const resource = useApiResource(load, Boolean(token && horseId));
  const injuries = resource.data?.injuries ?? [];

  return (
    <Screen
      role="vet"
      title="Injury history"
      subtitle={resource.data?.horse.name ?? ""}
      back
      fallbackHref="/vet/medical"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && injuries.length === 0}
        emptyLabel="No injuries have been recorded for this horse."
      />
      {resource.data && injuries.length ? (
        <>
          <Panel>
            <Text style={uiStyles.value}>{resource.data.horse.name}</Text>
            <Text style={uiStyles.muted}>
              {injuries.length} recorded injury event{injuries.length === 1 ? "" : "s"}
            </Text>
          </Panel>
          <View style={uiStyles.section}>
            <SectionTitle>Injury timeline</SectionTitle>
            {injuries.map((injury) => (
              <Pressable
                key={injury.id}
                disabled={!injury.caseId}
                onPress={() =>
                  injury.caseId && router.push(`/vet/medical/cases/${injury.caseId}` as Href)
                }
              >
                <Panel style={uiStyles.alert}>
                  <View style={uiStyles.row}>
                    <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {regionLabels[injury.bodyRegion] ?? injury.bodyRegion.replaceAll("_", " ")}
                    </Text>
                    <Text style={{ ...uiStyles.label, color: colors.destructive, flexShrink: 0 }}>
                      {injury.recoveryStatus.replaceAll("_", " ")}
                    </Text>
                  </View>
                  <Text style={uiStyles.muted}>
                    {injury.injuryType.replaceAll("_", " ")} · {formatDateTime(injury.examDate)}
                  </Text>
                  {injury.notes ? <Text style={uiStyles.muted}>{injury.notes}</Text> : null}
                  {injury.caseId ? (
                    <Text style={{ ...uiStyles.label, color: colors.primary }}>
                      Open medical case
                    </Text>
                  ) : null}
                </Panel>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
