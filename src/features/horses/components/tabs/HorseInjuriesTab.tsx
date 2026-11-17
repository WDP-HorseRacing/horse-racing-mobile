import { Pressable } from "react-native";
import { router, type Href } from "expo-router";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { Panel, getUiStyles } from "@/components/ui";
import { Text } from "@/components/common/LocalizedText";
import type { RoleId } from "@/types/raceos";
import { useTheme } from "@/hooks/useTheme";

type HorseInjuriesTabProps = {
  roleId: RoleId;
  medicalResource: {
    isLoading: boolean;
    error: unknown;
    data: { injuries: any[] } | null;
    retry: () => void | Promise<unknown>;
  };
};

export function HorseInjuriesTab({ roleId, medicalResource }: HorseInjuriesTabProps) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);

  return (
    <>
      <AsyncStateView
        isLoading={medicalResource.isLoading}
        error={medicalResource.error}
        onRetry={() => void medicalResource.retry()}
      />
      {medicalResource.data?.injuries.length ? (
        medicalResource.data.injuries.map((injury: any) => {
          const latestEvent = injury.history.at(-1);
          const eventRecordId = latestEvent?.medicalRecordId ?? injury.firstMedicalRecordId;

          return (
            <Pressable
              key={injury.id}
              onPress={() =>
                router.push(
                  latestEvent?.caseId
                    ? (`/${roleId}/medical/cases/${latestEvent.caseId}` as Href)
                    : (`/${roleId}/medical/visits/${eventRecordId}` as Href),
                )
              }
            >
              <Panel>
                <Text style={uiStyles.value}>
                  {injury.bodyRegion} · {injury.injuryType}
                </Text>
                <Text style={uiStyles.muted}>
                  {injury.currentRecoveryStatus.replaceAll("_", " ")} ·{" "}
                  {new Date(latestEvent?.examDate ?? injury.firstExamDate).toLocaleDateString()}
                </Text>
                {latestEvent?.notes ? <Text>{latestEvent.notes}</Text> : null}
                <Text style={{ ...uiStyles.label, color: colors.primary }}>
                  {latestEvent?.caseId ? "Open treatment case" : "Open examination"}
                </Text>
              </Panel>
            </Pressable>
          );
        })
      ) : medicalResource.data ? (
        <AsyncStateView
          isLoading={false}
          error={null}
          onRetry={() => void medicalResource.retry()}
          empty
          emptyLabel="No injury markers are recorded."
        />
      ) : null}
    </>
  );
}
