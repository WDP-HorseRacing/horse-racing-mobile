import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { isRole } from "@/features/auth/roles";
import { medicalService } from "@/services/medical.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime } from "@/utils/formatters";
import { Injury3DMapper } from "@/features/medical/injury-mapper/Injury3DMapper";
import type {
  InjuryDraftMarker,
  InjuryUpdateInput,
} from "@/features/medical/injury-mapper/injury-mapper.types";

const noDraftInjuries: InjuryDraftMarker[] = [];
const noInjuryUpdates: InjuryUpdateInput[] = [];

export default function MedicalVisitDetail() {
  const { role: roleParam, id: idParam } = useLocalSearchParams<{ role: string; id: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => medicalService.getRecord(token!, id), [id, token]);
  const resource = useApiResource(
    load,
    Boolean(token && id && role && ["vet", "manager", "trainer", "owner"].includes(role)),
  );

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer", "owner"].includes(role))
    return <Redirect href={`/${role}` as Href} />;

  const voidVisit = () => {
    if (!resource.data || !reason.trim() || saving) return;
    Alert.alert(
      "Void this examination?",
      "The record will remain in history with the reason, and its measurements will be removed from measurement history.",
      [
        { text: "Keep record", style: "cancel" },
        {
          text: "Void examination",
          style: "destructive",
          onPress: () => {
            setSaving(true);
            void medicalService
              .voidRecord(token!, id, reason.trim())
              .then(async () => {
                setReason("");
                await resource.refresh();
              })
              .catch((error) =>
                Alert.alert("Could not void examination", extractErrorMessage(error)),
              )
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  const record = resource.data;
  return (
    <Screen
      role={role}
      title="Medical visit"
      subtitle={
        record
          ? `${record.kind.replaceAll("_", " ")} · ${formatDateTime(record.examDate)}`
          : "Visit details"
      }
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {record ? (
        <>
          <Panel>
            <Text style={uiStyles.value}>
              {record.conclusion ?? "Follow-up"} · {record.diagnosis ?? "No diagnosis recorded"}
            </Text>
            <Text style={uiStyles.muted}>
              Resulting health status: {record.resultingStatus.replaceAll("_", " ")}
            </Text>
            <Text style={uiStyles.muted}>Examined {formatDateTime(record.examDate)}</Text>
            {record.voidedAt ? (
              <Text style={{ ...uiStyles.label, color: colors.destructive }}>
                Voided {formatDateTime(record.voidedAt)} · {record.voidReason}
              </Text>
            ) : null}
            {record.replacesRecordId ? (
              <Text style={uiStyles.muted}>Replaces visit {record.replacesRecordId}</Text>
            ) : null}
            {record.caseId ? (
              <SecondaryButton
                label="Open treatment case"
                onPress={() => router.push(`/${role}/medical/cases/${record.caseId}` as Href)}
              />
            ) : null}
          </Panel>
          {record.careInstructions ? (
            <Panel>
              <SectionTitle>Care instructions</SectionTitle>
              <Text>{record.careInstructions}</Text>
            </Panel>
          ) : null}
          <View style={uiStyles.section}>
            <SectionTitle>Prescriptions</SectionTitle>
            {record.prescriptions.map((prescription) => (
              <Panel key={prescription.id}>
                <Text style={uiStyles.value}>{prescription.medicine}</Text>
                {prescription.dosage ? (
                  <Text>
                    {prescription.dosage} · {prescription.frequency}
                  </Text>
                ) : (
                  <Text style={uiStyles.muted}>
                    Dosage and frequency are restricted for this owner view.
                  </Text>
                )}
                <Text style={uiStyles.muted}>
                  {formatDate(prescription.startDate)}
                  {prescription.endDate ? ` – ${formatDate(prescription.endDate)}` : " · ongoing"}
                </Text>
              </Panel>
            ))}
            {!record.prescriptions.length ? (
              <Text style={uiStyles.muted}>No prescriptions recorded.</Text>
            ) : null}
          </View>
          <View style={uiStyles.section}>
            <SectionTitle>Injuries</SectionTitle>
            {record.injuries.map((injury) => (
              <Panel key={injury.id}>
                <Text style={uiStyles.value}>
                  {injury.bodyRegion.replaceAll("_", " ")} ·{" "}
                  {injury.injuryType.replaceAll("_", " ")}
                </Text>
                <Text style={uiStyles.muted}>{injury.recoveryStatus.replaceAll("_", " ")}</Text>
                {injury.notes ? <Text>{injury.notes}</Text> : null}
              </Panel>
            ))}
            {!record.injuries.length ? (
              <Text style={uiStyles.muted}>No injury markers on this visit.</Text>
            ) : null}
          </View>
          {record.injuries.length ? (
            <Injury3DMapper
              horseId={record.horseId}
              existingInjuries={record.injuries.map((injury) => ({
                id: injury.injuryId,
                horseId: record.horseId,
                bodyRegion: injury.bodyRegion,
                injuryType: injury.injuryType,
                position: injury.position,
                firstMedicalRecordId: record.id,
                firstExamDate: record.examDate,
                currentRecoveryStatus: injury.recoveryStatus,
                history: [
                  {
                    medicalRecordId: record.id,
                    examDate: record.examDate,
                    caseId: record.caseId,
                    recoveryStatus: injury.recoveryStatus,
                    notes: injury.notes,
                  },
                ],
              }))}
              drafts={noDraftInjuries}
              onDraftsChange={() => undefined}
              updates={noInjuryUpdates}
              onUpdatesChange={() => undefined}
              allowNew={false}
              allowFollowUpUpdates={false}
            />
          ) : null}
          {role === "vet" && !record.voidedAt ? (
            <View style={uiStyles.section}>
              <SectionTitle>Void an incorrectly recorded visit</SectionTitle>
              <Field label="Reason (required)">
                <NativeInput value={reason} onChangeText={setReason} multiline />
              </Field>
              <PrimaryButton
                label={saving ? "Voiding…" : "Void visit"}
                icon="close-circle-outline"
                disabled={saving || !reason.trim()}
                onPress={voidVisit}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
