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
import { Injury3DMapper } from "@/features/medical/injury-mapper/Injury3DMapper";

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
            <Injury3DMapper
              horseId={horseId}
              existingInjuries={injuries}
              drafts={[]}
              onDraftsChange={() => undefined}
              updates={[]}
              onUpdatesChange={() => undefined}
              allowNew={false}
              allowFollowUpUpdates={false}
            />
          </View>
          <View style={uiStyles.section}>
            <SectionTitle>Injury timeline</SectionTitle>
            {injuries.map((injury) => {
              return (
                <Panel key={injury.id}>
                  <Text style={uiStyles.value}>
                    {regionLabels[injury.bodyRegion] ?? injury.bodyRegion.replaceAll("_", " ")} ·{" "}
                    {injury.injuryType.replaceAll("_", " ")}
                  </Text>
                  <Text style={uiStyles.muted}>
                    {t("Current status")}: {injury.currentRecoveryStatus.replaceAll("_", " ")}
                  </Text>
                  {injury.history.map((event) => {
                    const statusTone =
                      event.recoveryStatus === "HEALED"
                        ? colors.primary
                        : event.recoveryStatus === "RECOVERING"
                          ? colors.monitor
                          : colors.destructive;
                    const statusBg =
                      event.recoveryStatus === "HEALED"
                        ? colors.fitSoft
                        : event.recoveryStatus === "RECOVERING"
                          ? colors.monitorSoft
                          : colors.injuredSoft;

                    return (
                      <Pressable
                        key={event.medicalRecordId}
                        onPress={() =>
                          router.push(
                            event.caseId
                              ? (`/vet/medical/cases/${event.caseId}` as Href)
                              : (`/vet/medical/visits/${event.medicalRecordId}` as Href),
                          )
                        }
                        style={{
                          marginTop: 8,
                          borderLeftWidth: 3,
                          borderLeftColor: statusTone,
                          paddingLeft: 10,
                        }}
                      >
                        <View style={uiStyles.row}>
                          <Text
                            style={[uiStyles.value, { flex: 1, minWidth: 0 }]}
                            numberOfLines={1}
                          >
                            {formatDateTime(event.examDate)}
                          </Text>
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 999,
                              backgroundColor: statusBg,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: statusTone }}>
                              {event.recoveryStatus.replaceAll("_", " ")}
                            </Text>
                          </View>
                        </View>
                        {event.notes ? <Text style={uiStyles.muted}>{event.notes}</Text> : null}
                        <Text style={{ ...uiStyles.label, color: colors.primary, marginTop: 4 }}>
                          {event.caseId ? t("Open medical case") : t("Open examination")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Panel>
              );
            })}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
