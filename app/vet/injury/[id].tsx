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
import { useI18n } from "@/context/I18nContext";

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
  const { t } = useI18n();
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
            {injuries.map((injury) => {
              const statusTone =
                injury.recoveryStatus === "HEALED"
                  ? colors.primary
                  : injury.recoveryStatus === "RECOVERING"
                    ? colors.monitor
                    : colors.destructive;
              const statusBg =
                injury.recoveryStatus === "HEALED"
                  ? colors.fitSoft
                  : injury.recoveryStatus === "RECOVERING"
                    ? colors.monitorSoft
                    : colors.injuredSoft;

              return (
                <Pressable
                  key={injury.id}
                  disabled={!injury.caseId}
                  onPress={() =>
                    injury.caseId && router.push(`/vet/medical/cases/${injury.caseId}` as Href)
                  }
                >
                  <Panel style={{ borderLeftWidth: 3, borderLeftColor: statusTone }}>
                    <View style={uiStyles.row}>
                      <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                        {regionLabels[injury.bodyRegion] ?? injury.bodyRegion.replaceAll("_", " ")}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: statusBg,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: statusTone,
                          }}
                        >
                          {injury.recoveryStatus.replaceAll("_", " ")}
                        </Text>
                      </View>
                    </View>
                    <Text style={uiStyles.muted}>
                      {injury.injuryType.replaceAll("_", " ")} · {formatDateTime(injury.examDate)}
                    </Text>
                    {injury.notes ? <Text style={uiStyles.muted}>{injury.notes}</Text> : null}
                    {injury.position ? (
                      <Text
                        style={[uiStyles.label, { fontSize: 11, color: colors.mutedForeground }]}
                      >
                        {t("Model coordinates:")} ({injury.position.x.toFixed(2)},{" "}
                        {injury.position.y.toFixed(2)}, {injury.position.z.toFixed(2)})
                      </Text>
                    ) : null}
                    {injury.caseId ? (
                      <Text style={{ ...uiStyles.label, color: colors.primary, marginTop: 4 }}>
                        {t("Open medical case")}
                      </Text>
                    ) : null}
                  </Panel>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
