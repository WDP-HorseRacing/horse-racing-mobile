import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { isRole } from "@/features/auth/roles";
import { horseService } from "@/services/horse.service";
import { medicalService } from "@/services/medical.service";
import {
  clubDateTimeParts,
  isNotPastDateTime,
  isValidDateOnly,
  isValidRequiredText,
  parseNonNegativeInteger,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime } from "@/utils/formatters";

export default function MedicalCaseDetail() {
  const { role: roleParam, id: idParam } = useLocalSearchParams<{ role: string; id: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const [finalConclusion, setFinalConclusion] = useState("");
  const [costText, setCostText] = useState("");
  const [lockDecision, setLockDecision] = useState<"RELEASE" | "KEEP">("RELEASE");
  const [lockEndDate, setLockEndDate] = useState("");
  const [lockEndTime, setLockEndTime] = useState("09:00");
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [adjustCost, setAdjustCost] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [voidRecordId, setVoidRecordId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const medicalCase = await medicalService.getCase(token!, id);
    const [horse, preview] = await Promise.all([
      horseService.get(token!, medicalCase.horseId),
      role === "vet" && medicalCase.status === "OPEN"
        ? medicalService.getClosePreview(token!, id)
        : Promise.resolve(null),
    ]);
    return { medicalCase, horse, preview };
  }, [id, role, token]);
  const resource = useApiResource(
    load,
    Boolean(token && id && role && ["vet", "manager", "trainer", "owner"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);
  const medicalCase = resource.data?.medicalCase;
  const visits = medicalCase?.visits ?? [];
  const isVet = role === "vet";

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer", "owner"].includes(role))
    return <Redirect href={`/${role}` as Href} />;

  const submitClose = async () => {
    if (!medicalCase || !resource.data?.preview || !isVet || !token) return;
    const totalCost = parseNonNegativeInteger(costText);
    if (!isValidRequiredText(finalConclusion, 4000) || totalCost === null) {
      Alert.alert(
        "Closing details required",
        "Enter a final conclusion and a whole VND cost from 0 to 10,000,000,000.",
      );
      return;
    }
    const activeLock = resource.data.preview.activeLock;
    const lockExpectedEnd =
      lockDecision === "KEEP" ? toClubDateTime(lockEndDate, lockEndTime) : null;
    if (
      activeLock &&
      lockDecision === "KEEP" &&
      (!lockExpectedEnd || !isNotPastDateTime(lockExpectedEnd))
    ) {
      Alert.alert(
        "Lock release date required",
        "Choose a valid future expected release date for the active training lock.",
      );
      return;
    }
    const today = clubDateTimeParts().date;
    if (
      dateOfDeath &&
      (!isValidDateOnly(dateOfDeath) ||
        dateOfDeath > today ||
        (resource.data.horse.dateOfBirth && dateOfDeath < resource.data.horse.dateOfBirth))
    ) {
      Alert.alert(
        "Invalid date of death",
        "The date must be valid, no later than today, and not before the horse’s birth date.",
      );
      return;
    }
    setSaving(true);
    try {
      await medicalService.closeCase(token, id, {
        finalConclusion: finalConclusion.trim(),
        totalCost,
        ...(dateOfDeath
          ? { dateOfDeath }
          : activeLock
            ? {
                lockDecision,
                ...(lockDecision === "KEEP" && lockExpectedEnd ? { lockExpectedEnd } : {}),
              }
            : {}),
      });
      await resource.refresh();
      Alert.alert(
        "Case closed",
        dateOfDeath
          ? "The Backend closed the case and recorded the horse lifecycle change."
          : "The final conclusion and cost were saved.",
      );
    } catch (error) {
      Alert.alert("Could not close case", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitCostAdjustment = async () => {
    const totalCost = parseNonNegativeInteger(adjustCost);
    if (totalCost === null || !isValidRequiredText(adjustReason, 500)) {
      Alert.alert(
        "Adjustment details required",
        "Enter a non-negative integer VND amount and a reason.",
      );
      return;
    }
    setSaving(true);
    try {
      await medicalService.adjustCaseCost(token!, id, { totalCost, reason: adjustReason.trim() });
      setAdjustCost("");
      setAdjustReason("");
      await resource.refresh();
      Alert.alert("Cost updated", "The Backend has recorded the adjustment.");
    } catch (error) {
      Alert.alert("Could not adjust cost", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitVoid = async () => {
    if (!voidRecordId || !isValidRequiredText(voidReason, 500)) return;
    setSaving(true);
    try {
      await medicalService.voidRecord(token!, voidRecordId, voidReason.trim());
      setVoidRecordId("");
      setVoidReason("");
      await resource.refresh();
    } catch (error) {
      Alert.alert("Could not void visit", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role={role}
      title="Treatment case"
      subtitle={
        medicalCase ? `${resource.data?.horse.name} · ${medicalCase.status}` : "Case details"
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
      {resource.data && medicalCase ? (
        <>
          <Panel>
            <Text style={uiStyles.value}>
              {resource.data.horse.name} · {medicalCase.initialDiagnosis}
            </Text>
            <Text style={uiStyles.muted}>
              Opened {formatDateTime(medicalCase.openedAt)} · {medicalCase.status}
            </Text>
            {medicalCase.closedAt ? (
              <Text style={uiStyles.muted}>Closed {formatDateTime(medicalCase.closedAt)}</Text>
            ) : null}
            {medicalCase.finalConclusion ? <Text>{medicalCase.finalConclusion}</Text> : null}
            {medicalCase.totalCost !== undefined ? (
              <Text>
                Closed-case cost:{" "}
                {medicalCase.costHidden || medicalCase.totalCost == null
                  ? "Not available for this ownership period"
                  : `${medicalCase.totalCost.toLocaleString()} VND`}
              </Text>
            ) : null}
            <SecondaryButton
              label="Open horse medical profile"
              onPress={() => router.push(`/${role}/horse/${medicalCase.horseId}` as Href)}
            />
          </Panel>
          <View style={uiStyles.section}>
            <SectionTitle>Examination and follow-up history</SectionTitle>
            {visits.map((visit) => (
              <Panel key={visit.id}>
                <Pressable
                  onPress={() => router.push(`/${role}/medical/visits/${visit.id}` as Href)}
                >
                  <View style={uiStyles.row}>
                    <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {visit.kind.replaceAll("_", " ")} ·{" "}
                      {visit.conclusion ?? visit.diagnosis ?? "Visit"}
                    </Text>
                    <Text style={[uiStyles.label, { flexShrink: 0 }]}>
                      {formatDateTime(visit.examDate)}
                    </Text>
                  </View>
                  <Text style={uiStyles.muted}>
                    {visit.diagnosis ?? "No diagnosis"} ·{" "}
                    {visit.resultingStatus.replaceAll("_", " ")}
                  </Text>
                  {visit.careInstructions ? <Text>{visit.careInstructions}</Text> : null}
                  {visit.nextVisitAt ? (
                    <Text style={uiStyles.label}>
                      Next visit {formatDateTime(visit.nextVisitAt)}
                    </Text>
                  ) : null}
                  {visit.voidedAt ? (
                    <Text style={{ ...uiStyles.label, color: colors.destructive }}>
                      Voided: {visit.voidReason}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={uiStyles.section}>
                  <SectionTitle>Prescriptions</SectionTitle>
                  {visit.prescriptions.map((prescription) => (
                    <Text key={prescription.id}>
                      {prescription.medicine}
                      {prescription.dosage
                        ? ` · ${prescription.dosage} · ${prescription.frequency}`
                        : ""}{" "}
                      · {formatDate(prescription.startDate)}
                      {prescription.endDate ? ` – ${formatDate(prescription.endDate)}` : ""}
                    </Text>
                  ))}
                  {!visit.prescriptions.length ? (
                    <Text style={uiStyles.muted}>No prescriptions.</Text>
                  ) : null}
                </View>
                <View style={uiStyles.section}>
                  <SectionTitle>Injuries</SectionTitle>
                  {visit.injuries.map((injury) => (
                    <Text key={injury.id}>
                      {injury.bodyRegion.replaceAll("_", " ")} ·{" "}
                      {injury.injuryType.replaceAll("_", " ")} ·{" "}
                      {injury.recoveryStatus.replaceAll("_", " ")}
                      {injury.notes ? ` · ${injury.notes}` : ""}
                    </Text>
                  ))}
                  {!visit.injuries.length ? (
                    <Text style={uiStyles.muted}>No injury markers.</Text>
                  ) : null}
                </View>
                {isVet && !visit.voidedAt ? (
                  <>
                    {voidRecordId === visit.id ? (
                      <>
                        <Field label="Reason for voiding (required)">
                          <NativeInput value={voidReason} onChangeText={setVoidReason} multiline />
                        </Field>
                        <PrimaryButton
                          label={saving ? "Voiding…" : "Confirm void"}
                          disabled={saving || !voidReason.trim()}
                          onPress={() =>
                            Alert.alert(
                              "Void this visit?",
                              "The visit remains in history and its measurements will be removed.",
                              [
                                { text: "Back", style: "cancel" },
                                {
                                  text: "Void",
                                  style: "destructive",
                                  onPress: () => void submitVoid(),
                                },
                              ],
                            )
                          }
                        />
                      </>
                    ) : (
                      <SecondaryButton
                        label="Void visit"
                        onPress={() => setVoidRecordId(visit.id)}
                      />
                    )}
                  </>
                ) : null}
              </Panel>
            ))}
            {!visits.length ? (
              <Text style={uiStyles.muted}>No visits have been recorded.</Text>
            ) : null}
          </View>
          {isVet && medicalCase.status === "OPEN" ? (
            <>
              <PrimaryButton
                label="Add follow-up examination"
                icon="medkit-outline"
                onPress={() =>
                  router.push(
                    `/vet/medical/visit?caseId=${medicalCase.id}&horseId=${medicalCase.horseId}` as Href,
                  )
                }
              />
              {resource.data.preview ? (
                <View style={uiStyles.section}>
                  <SectionTitle>Before closing</SectionTitle>
                  <Panel>
                    <Text style={uiStyles.muted}>
                      Health: {resource.data.preview.healthStatus.replaceAll("_", " ")}
                      {resource.data.preview.healthWarning ? " · health warning remains" : ""}
                    </Text>
                    <Text style={uiStyles.muted}>
                      Pending exam requests: {resource.data.preview.pendingRequestCount}
                    </Text>
                    {resource.data.preview.activeLock ? (
                      <Text style={uiStyles.muted}>
                        Active training lock: {resource.data.preview.activeLock.reason}
                      </Text>
                    ) : (
                      <Text style={uiStyles.muted}>No active case lock.</Text>
                    )}
                  </Panel>
                  <Field label="Final conclusion">
                    <NativeInput
                      value={finalConclusion}
                      onChangeText={setFinalConclusion}
                      multiline
                    />
                  </Field>
                  <Field label="Total treatment cost (whole VND)">
                    <NativeInput
                      value={costText}
                      onChangeText={setCostText}
                      keyboardType="number-pad"
                      placeholder="0"
                    />
                  </Field>
                  {resource.data.preview.activeLock && !dateOfDeath ? (
                    <>
                      <Chips
                        options={["RELEASE", "KEEP"]}
                        value={lockDecision}
                        onChange={(value) => setLockDecision(value as "RELEASE" | "KEEP")}
                      />
                      {lockDecision === "KEEP" ? (
                        <>
                          <Field label="Expected lock release date (YYYY-MM-DD)">
                            <NativeInput value={lockEndDate} onChangeText={setLockEndDate} />
                          </Field>
                          <Field label="Expected lock release time">
                            <NativeInput value={lockEndTime} onChangeText={setLockEndTime} />
                          </Field>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <Field label="Record horse death as part of closure (optional, YYYY-MM-DD)">
                    <NativeInput value={dateOfDeath} onChangeText={setDateOfDeath} />
                  </Field>
                  {dateOfDeath && resource.data.preview.deathImpact ? (
                    <Panel>
                      <Text style={uiStyles.value}>Lifecycle effects preview</Text>
                      <Text>
                        {resource.data.preview.deathImpact.summary ??
                          resource.data.preview.deathImpact.blockedReason ??
                          "Backend returned no summary."}
                      </Text>
                      <Text style={uiStyles.muted}>
                        {resource.data.preview.deathImpact.classesWithdrawn} classes ·{" "}
                        {resource.data.preview.deathImpact.raceRegistrationsWithdrawn} future
                        entries · {resource.data.preview.deathImpact.examRequestsDismissed} requests
                        dismissed · {resource.data.preview.deathImpact.careSchedulesCancelled} care
                        schedules cancelled · {resource.data.preview.deathImpact.incidentsClosed}{" "}
                        incidents closed
                      </Text>
                      <Text style={uiStyles.muted}>
                        {resource.data.preview.deathImpact.trainingLockReleased
                          ? "Active training lock will be released."
                          : "No active training lock will be released."}
                        {resource.data.preview.deathImpact.stallReleased
                          ? ` Stall ${resource.data.preview.deathImpact.stallReleased} will be released.`
                          : ""}
                      </Text>
                    </Panel>
                  ) : null}
                  <PrimaryButton
                    label={saving ? "Closing case…" : "Close treatment case"}
                    disabled={saving || !finalConclusion.trim() || costText === ""}
                    onPress={() =>
                      Alert.alert(
                        "Close treatment case?",
                        "This records the final conclusion and total cost. Any active lock decision and lifecycle effects will be handled by the Backend.",
                        [
                          { text: "Review", style: "cancel" },
                          {
                            text: "Close case",
                            style: "destructive",
                            onPress: () => void submitClose(),
                          },
                        ],
                      )
                    }
                  />
                </View>
              ) : null}
            </>
          ) : null}
          {isVet && medicalCase.status === "CLOSED" && medicalCase.totalCost !== undefined ? (
            <View style={uiStyles.section}>
              <SectionTitle>Adjust closed-case cost</SectionTitle>
              <Field label="New total (whole VND)">
                <NativeInput
                  value={adjustCost}
                  onChangeText={setAdjustCost}
                  keyboardType="number-pad"
                />
              </Field>
              <Field label="Adjustment reason">
                <NativeInput value={adjustReason} onChangeText={setAdjustReason} multiline />
              </Field>
              <PrimaryButton
                label={saving ? "Updating cost…" : "Save cost adjustment"}
                disabled={saving || !adjustCost || !adjustReason.trim()}
                onPress={() => void submitCostAdjustment()}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
