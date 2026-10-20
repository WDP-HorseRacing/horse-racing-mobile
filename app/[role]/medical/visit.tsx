import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { horseService } from "@/services/horse.service";
import {
  medicalService,
  type HealthStatusDto,
  type MeasurementTypeDto,
  type StandaloneVisitInputDto,
  type VisitInputDto,
} from "@/services/medical.service";
import type { ExamRequestDto } from "@/adapters/medical.adapter";
import {
  clubDateTimeParts,
  isAllowedVisitDateTime,
  isNotPastDateTime,
  isValidDateOnly,
  isValidMedicalMeasurement,
  isValidRequiredText,
  MEDICAL_MEASUREMENT_RANGES,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";

const measurementInputs: { type: MeasurementTypeDto; label: string; placeholder: string }[] = [
  { type: "WEIGHT", label: "Weight (kg)", placeholder: "450" },
  { type: "HEIGHT", label: "Height (cm)", placeholder: "165" },
  { type: "BODY_CONDITION", label: "Body condition score (1–9)", placeholder: "5" },
  { type: "TEMPERATURE", label: "Temperature (°C)", placeholder: "38" },
];
const healthStates: HealthStatusDto[] = ["ELIGIBLE", "UNDER_OBSERVATION", "INJURED", "QUARANTINED"];
const bodyRegions = [
  "HEAD",
  "NECK",
  "BACK",
  "CHEST",
  "ABDOMEN",
  "PELVIS",
  "LEFT_FRONT_LEG",
  "RIGHT_FRONT_LEG",
  "LEFT_HIND_LEG",
  "RIGHT_HIND_LEG",
  "OTHER",
];
const injuryTypes = [
  "FRACTURE",
  "SPRAIN",
  "STRAIN",
  "WOUND",
  "LACERATION",
  "INFLAMMATION",
  "CONTUSION",
  "INFECTION",
  "OTHER",
];
const recoveryStates = ["ACUTE", "RECOVERING", "HEALED"];

export default function MedicalVisitForm() {
  const {
    role: roleParam,
    horseId: horseParam,
    caseId: caseParam,
    requestId: requestParam,
    kind: kindParam,
  } = useLocalSearchParams<{
    role: string;
    horseId?: string;
    caseId?: string;
    requestId?: string;
    kind?: string;
  }>();
  const role = isRole(roleParam) ? roleParam : null;
  const horseId = Array.isArray(horseParam) ? horseParam[0] : (horseParam ?? "");
  const caseId = Array.isArray(caseParam) ? caseParam[0] : (caseParam ?? "");
  const requestId = Array.isArray(requestParam) ? requestParam[0] : (requestParam ?? "");
  const initialKind = requestId || kindParam === "REQUEST" ? "REQUEST" : "ROUTINE";
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const now = clubDateTimeParts();
  const [kind, setKind] = useState<"ROUTINE" | "REQUEST">(initialKind);
  const [conclusion, setConclusion] = useState<"NORMAL" | "ISSUE">("NORMAL");
  const [selectedRequests, setSelectedRequests] = useState<string[]>(requestId ? [requestId] : []);
  const [examDate, setExamDate] = useState(now.date);
  const [examTime, setExamTime] = useState(now.time);
  const [diagnosis, setDiagnosis] = useState("");
  const [initialDiagnosis, setInitialDiagnosis] = useState("");
  const [healthStatus, setHealthStatus] = useState("");
  const [healthReason, setHealthReason] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [nextVisitTime, setNextVisitTime] = useState("09:00");
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [confirmAbnormal, setConfirmAbnormal] = useState(false);
  const [medicine, setMedicine] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [prescriptionStart, setPrescriptionStart] = useState(now.date);
  const [prescriptionEnd, setPrescriptionEnd] = useState("");
  const [bodyRegion, setBodyRegion] = useState("");
  const [injuryType, setInjuryType] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [injuryNotes, setInjuryNotes] = useState("");
  const [injuryPositionX, setInjuryPositionX] = useState("");
  const [injuryPositionY, setInjuryPositionY] = useState("");
  const [injuryPositionZ, setInjuryPositionZ] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const medicalCase = caseId ? await medicalService.getCase(token!, caseId) : null;
    const resolvedHorseId = horseId || medicalCase?.horseId || "";
    if (!resolvedHorseId) throw new Error("A horse is required to record an examination.");
    const [horse, requests, care, cases] = await Promise.all([
      horseService.get(token!, resolvedHorseId),
      medicalService.listHorseExamRequests(token!, resolvedHorseId),
      medicalService.getCareInstructions(token!, resolvedHorseId),
      medicalService.listHorseCases(token!, resolvedHorseId),
    ]);
    return { horse, requests, care, cases, medicalCase, resolvedHorseId };
  }, [caseId, horseId, token]);
  const resource = useApiResource(load, Boolean(token && role === "vet" && (horseId || caseId)));
  const pendingRequests = useMemo(
    () => (resource.data?.requests ?? []).filter((item) => item.status === "PENDING"),
    [resource.data],
  );
  const openCase = resource.data?.cases.items.find((item) => item.status === "OPEN");
  const carePrefill = resource.data?.care.current?.careInstructions ?? "";
  const finalCareInstructions = careInstructions.trim() || carePrefill;

  if (!role) return <Redirect href="/" />;
  if (role !== "vet") return <Redirect href={`/${role}` as Href} />;

  const toggleRequest = (id: string) =>
    setSelectedRequests((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const updateMeasurement = (type: MeasurementTypeDto, value: string) =>
    setMeasurementValues((current) => ({ ...current, [type]: value }));

  const submit = async () => {
    if (!resource.data || !token || saving) return;
    if (!isValidDateOnly(examDate)) {
      Alert.alert("Invalid examination date", "Enter a valid date in YYYY-MM-DD format.");
      return;
    }
    const examAt = toClubDateTime(examDate, examTime);
    if (!examAt || !isAllowedVisitDateTime(examAt)) {
      Alert.alert(
        "Date outside allowed range",
        "An examination can be recorded from now back to seven days ago.",
      );
      return;
    }
    if (!caseId && openCase) {
      Alert.alert("An open case already exists", "Record a follow-up inside the current case.", [
        {
          text: "Open case",
          onPress: () => router.push(`/${role}/medical/cases/${openCase.id}` as Href),
        },
        { text: "Close" },
      ]);
      return;
    }
    if (!caseId && kind === "REQUEST" && !selectedRequests.length) {
      Alert.alert(
        "Select a request",
        "A request-based examination must be linked to at least one pending request for this horse.",
      );
      return;
    }
    if (conclusion === "ISSUE" && !isValidRequiredText(initialDiagnosis, 2000)) {
      Alert.alert(
        "Initial diagnosis required",
        "An examination with an issue must create a case with an initial diagnosis.",
      );
      return;
    }
    if (
      (diagnosis.trim() && diagnosis.trim().length > 4000) ||
      (careInstructions.trim() && careInstructions.trim().length > 2000) ||
      selectedRequests.length > 20
    ) {
      Alert.alert(
        "Examination details are too long",
        "Diagnosis is limited to 4,000 characters, care notes to 2,000, and a visit can link at most 20 requests.",
      );
      return;
    }
    if (
      healthStatus &&
      healthStatus !== resource.data.horse.healthStatus &&
      !isValidRequiredText(healthReason, 500)
    ) {
      Alert.alert(
        "Health change reason required",
        "Enter a reason when changing the horse’s health status.",
      );
      return;
    }
    if (
      nextVisitDate &&
      (!isValidDateOnly(nextVisitDate) ||
        !isNotPastDateTime(toClubDateTime(nextVisitDate, nextVisitTime) ?? ""))
    ) {
      Alert.alert("Invalid follow-up date", "Choose a valid future date for the next visit.");
      return;
    }
    const measurements: VisitInputDto["measurements"] = [];
    for (const item of measurementInputs) {
      const text = measurementValues[item.type]?.trim();
      if (!text) continue;
      const value = Number(text);
      const range = MEDICAL_MEASUREMENT_RANGES[item.type];
      if (!isValidMedicalMeasurement(item.type, value)) {
        Alert.alert(
          "Invalid measurement",
          `${item.label} must be between ${range.min} and ${range.max}.`,
        );
        return;
      }
      measurements.push({ type: item.type, value });
    }
    const hasPrescription = Boolean(
      medicine.trim() || dosage.trim() || frequency.trim() || prescriptionEnd.trim(),
    );
    if (
      hasPrescription &&
      (!medicine.trim() ||
        !dosage.trim() ||
        !frequency.trim() ||
        medicine.trim().length > 160 ||
        dosage.trim().length > 160 ||
        frequency.trim().length > 160 ||
        !isValidDateOnly(prescriptionStart) ||
        (prescriptionEnd && !isValidDateOnly(prescriptionEnd)))
    ) {
      Alert.alert(
        "Prescription incomplete",
        "Enter medicine, dosage, frequency, a valid start date, and a valid optional end date.",
      );
      return;
    }
    if (prescriptionEnd && prescriptionEnd < prescriptionStart) {
      Alert.alert(
        "Invalid prescription dates",
        "The prescription end date cannot be before the start date.",
      );
      return;
    }
    const injuryStarted = Boolean(
      bodyRegion ||
      injuryType ||
      recoveryStatus ||
      injuryNotes.trim() ||
      injuryPositionX.trim() ||
      injuryPositionY.trim() ||
      injuryPositionZ.trim(),
    );
    if (
      injuryStarted &&
      (!bodyRegion ||
        !injuryType ||
        !recoveryStatus ||
        !injuryPositionX.trim() ||
        !injuryPositionY.trim() ||
        !injuryPositionZ.trim() ||
        ![injuryPositionX, injuryPositionY, injuryPositionZ].every((coordinate) =>
          Number.isFinite(Number(coordinate)),
        ))
    ) {
      Alert.alert(
        "Injury details incomplete",
        "Choose a body region, injury type, recovery status, and enter numeric X, Y, and Z coordinates.",
      );
      return;
    }
    const base: VisitInputDto = {
      examDate: examAt,
      ...(selectedRequests.length ? { requestIds: selectedRequests } : {}),
      ...(diagnosis.trim() ? { diagnosis: diagnosis.trim() } : {}),
      ...(healthStatus && healthStatus !== resource.data.horse.healthStatus
        ? { healthStatus: healthStatus as HealthStatusDto, healthReason: healthReason.trim() }
        : {}),
      ...(finalCareInstructions ? { careInstructions: finalCareInstructions } : {}),
      ...(nextVisitDate && conclusion === "ISSUE"
        ? { nextVisitAt: toClubDateTime(nextVisitDate, nextVisitTime)! }
        : {}),
      ...(measurements.length ? { measurements } : {}),
      ...(confirmAbnormal ? { confirmAbnormal: true } : {}),
      ...(hasPrescription
        ? {
            prescriptions: [
              {
                medicine: medicine.trim(),
                dosage: dosage.trim(),
                frequency: frequency.trim(),
                startDate: prescriptionStart,
                ...(prescriptionEnd ? { endDate: prescriptionEnd } : {}),
              },
            ],
          }
        : {}),
      ...(injuryStarted
        ? {
            injuries: [
              {
                bodyRegion,
                position: {
                  x: Number(injuryPositionX),
                  y: Number(injuryPositionY),
                  z: Number(injuryPositionZ),
                },
                injuryType,
                recoveryStatus,
                ...(injuryNotes.trim() ? { notes: injuryNotes.trim() } : {}),
              },
            ],
          }
        : {}),
    };
    setSaving(true);
    try {
      const record = caseId
        ? await medicalService.createFollowUpVisit(token, caseId, base)
        : await medicalService.createStandaloneVisit(token, resource.data.resolvedHorseId, {
            ...base,
            kind,
            conclusion,
            ...(conclusion === "ISSUE" ? { initialDiagnosis: initialDiagnosis.trim() } : {}),
          } satisfies StandaloneVisitInputDto);
      if (record.caseId) router.replace(`/${role}/medical/cases/${record.caseId}` as Href);
      else router.replace(`/${role}/medical/visits/${record.id}` as Href);
    } catch (error) {
      Alert.alert("Could not save examination", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role="vet"
      title={caseId ? "Follow-up examination" : "Record examination"}
      subtitle={resource.data?.horse.name ?? "Veterinary visit"}
      back
      fallbackHref="/vet/medical"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        <>
          <Panel>
            <Text style={uiStyles.value}>{resource.data.horse.name}</Text>
            <Text style={uiStyles.muted}>
              {resource.data.horse.location.barn?.name ?? "No barn"} ·{" "}
              {resource.data.horse.location.stall?.code ?? "No stall"}
            </Text>
            {resource.data.care.current ? (
              <Text style={uiStyles.muted}>
                Care note prefilled from {formatDateTime(resource.data.care.current.examDate)}. Edit
                below to replace it.
              </Text>
            ) : null}
          </Panel>
          {!caseId ? (
            <View style={uiStyles.section}>
              <SectionTitle>Examination type</SectionTitle>
              <View style={styles.segmentedSelectorRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setKind("ROUTINE")}
                  style={[
                    styles.segmentedOptionCard,
                    kind === "ROUTINE" && styles.segmentedOptionCardActive,
                  ]}
                >
                  <View style={styles.segmentedHeaderRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={kind === "ROUTINE" ? colors.primary : colors.mutedForeground}
                    />
                    {kind === "ROUTINE" ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.segmentedCardTitle,
                      kind === "ROUTINE" && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    Routine checkup
                  </Text>
                  <Text style={styles.segmentedCardHint} numberOfLines={2}>
                    Routine checkup (does not require a prior request)
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (!pendingRequests.length) {
                      Alert.alert(
                        "No pending requests",
                        "No pending requests for this horse. Please choose Routine checkup.",
                      );
                      return;
                    }
                    setKind("REQUEST");
                  }}
                  style={[
                    styles.segmentedOptionCard,
                    kind === "REQUEST" && styles.segmentedOptionCardActive,
                    !pendingRequests.length && { opacity: 0.5 },
                  ]}
                >
                  <View style={styles.segmentedHeaderRow}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={20}
                      color={kind === "REQUEST" ? colors.primary : colors.mutedForeground}
                    />
                    {kind === "REQUEST" ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.segmentedCardTitle,
                      kind === "REQUEST" && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    On-demand examination
                  </Text>
                  <Text style={styles.segmentedCardHint} numberOfLines={2}>
                    Resolve an existing incident request
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!caseId ? (
            <View style={uiStyles.section}>
              <SectionTitle>Clinical conclusion</SectionTitle>
              <View style={styles.segmentedSelectorRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConclusion("NORMAL")}
                  style={[
                    styles.segmentedOptionCard,
                    conclusion === "NORMAL" && styles.segmentedOptionCardActive,
                  ]}
                >
                  <View style={styles.segmentedHeaderRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color={conclusion === "NORMAL" ? colors.primary : colors.mutedForeground}
                    />
                    {conclusion === "NORMAL" ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.segmentedCardTitle,
                      conclusion === "NORMAL" && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    Normal
                  </Text>
                  <Text style={styles.segmentedCardHint} numberOfLines={2}>
                    Normal health, no case opened
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConclusion("ISSUE")}
                  style={[
                    styles.segmentedOptionCard,
                    conclusion === "ISSUE" && styles.segmentedOptionCardActiveIssue,
                  ]}
                >
                  <View style={styles.segmentedHeaderRow}>
                    <Ionicons
                      name="warning-outline"
                      size={20}
                      color={conclusion === "ISSUE" ? colors.destructive : colors.mutedForeground}
                    />
                    {conclusion === "ISSUE" ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.destructive} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.segmentedCardTitle,
                      conclusion === "ISSUE" && { color: colors.destructive, fontWeight: "700" },
                    ]}
                  >
                    Issue
                  </Text>
                  <Text
                    style={[
                      styles.segmentedCardHint,
                      conclusion === "ISSUE" && { color: colors.destructive },
                    ]}
                    numberOfLines={2}
                  >
                    Issue detected, treatment case opened
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!caseId && kind === "REQUEST" ? (
            <View style={uiStyles.section}>
              <SectionTitle>Pending requests for this horse</SectionTitle>
              {(pendingRequests as ExamRequestDto[]).map((request) => {
                const isSelected = selectedRequests.includes(request.id);
                return (
                  <Pressable
                    key={request.id}
                    accessibilityRole="button"
                    onPress={() => toggleRequest(request.id)}
                  >
                    <Panel
                      style={[
                        styles.requestCard,
                        isSelected && {
                          borderColor: colors.primary,
                          borderWidth: 2,
                          backgroundColor: colors.fitSoft,
                        },
                      ]}
                    >
                      <View style={uiStyles.row}>
                        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            {request.urgent ? (
                              <View style={styles.urgentMiniBadge}>
                                <Text style={styles.urgentMiniBadgeText}>URGENT</Text>
                              </View>
                            ) : null}
                            <Text
                              style={[
                                uiStyles.value,
                                { flex: 1, minWidth: 0 },
                                isSelected && { color: colors.primary },
                              ]}
                              numberOfLines={2}
                            >
                              {request.description}
                            </Text>
                          </View>
                          <Text style={uiStyles.muted}>
                            {formatDateTime(request.createdAt)}
                            {request.requestedBy ? ` · ${request.requestedBy}` : ""}
                          </Text>
                        </View>
                        <Ionicons
                          name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                          size={24}
                          color={isSelected ? colors.primary : colors.mutedForeground}
                          style={{ flexShrink: 0, marginLeft: 8 }}
                        />
                      </View>
                    </Panel>
                  </Pressable>
                );
              })}
              {!pendingRequests.length ? (
                <Text style={uiStyles.muted}>There are no pending requests for this horse.</Text>
              ) : null}
            </View>
          ) : null}
          {!caseId && openCase ? (
            <Panel>
              <Text style={uiStyles.value}>Open case already exists</Text>
              <Text style={uiStyles.muted}>
                Record the next examination inside the case to preserve the visit history.
              </Text>
              <PrimaryButton
                label="Open current case"
                onPress={() => router.push(`/vet/medical/cases/${openCase.id}` as Href)}
              />
            </Panel>
          ) : null}
          <SectionTitle>Examination time</SectionTitle>
          <Field label="Date (YYYY-MM-DD)">
            <NativeInput value={examDate} onChangeText={setExamDate} />
          </Field>
          <Field label="Time (24-hour)">
            <NativeInput value={examTime} onChangeText={setExamTime} />
          </Field>
          <View style={uiStyles.section}>
            <SectionTitle>Measurements</SectionTitle>
            {measurementInputs.map((item) => (
              <Field key={item.type} label={item.label}>
                <NativeInput
                  value={measurementValues[item.type] ?? ""}
                  onChangeText={(value) => updateMeasurement(item.type, value)}
                  keyboardType="decimal-pad"
                  placeholder={item.placeholder}
                />
              </Field>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmAbnormal(!confirmAbnormal)}
              style={[
                styles.confirmAbnormalCard,
                confirmAbnormal && {
                  borderColor: colors.primary,
                  backgroundColor: colors.fitSoft,
                  borderWidth: 1.5,
                },
              ]}
            >
              <Ionicons
                name={confirmAbnormal ? "checkbox" : "square-outline"}
                size={22}
                color={confirmAbnormal ? colors.primary : colors.mutedForeground}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    uiStyles.value,
                    { fontSize: 14 },
                    confirmAbnormal && { color: colors.primary },
                  ]}
                >
                  {confirmAbnormal
                    ? "Confirm abnormal readings"
                    : "Do not confirm abnormal readings"}
                </Text>
                <Text style={uiStyles.muted}>
                  Confirm if values exceed standard reference limits
                </Text>
              </View>
            </Pressable>
          </View>
          <Field label="Diagnosis and findings">
            <NativeInput value={diagnosis} onChangeText={setDiagnosis} multiline />
          </Field>
          {!caseId && conclusion === "ISSUE" ? (
            <Field label="Initial case diagnosis (required)">
              <NativeInput value={initialDiagnosis} onChangeText={setInitialDiagnosis} multiline />
            </Field>
          ) : null}
          <View style={uiStyles.section}>
            <SectionTitle>Health status after the visit</SectionTitle>
            <Chips
              options={["Keep current", ...healthStates]}
              value={healthStatus || "Keep current"}
              onChange={(value) => setHealthStatus(value === "Keep current" ? "" : value)}
            />
            {healthStatus && healthStatus !== resource.data.horse.healthStatus ? (
              <Field label="Reason for health status change">
                <NativeInput value={healthReason} onChangeText={setHealthReason} multiline />
              </Field>
            ) : null}
          </View>
          <Field label="Care instructions">
            <NativeInput
              value={careInstructions}
              onChangeText={setCareInstructions}
              multiline
              placeholder={carePrefill || "Rest, medication, and handling notes"}
            />
          </Field>
          {conclusion === "ISSUE" || caseId ? (
            <>
              <Field label="Next visit date (optional)">
                <NativeInput
                  value={nextVisitDate}
                  onChangeText={setNextVisitDate}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
              {nextVisitDate ? (
                <Field label="Next visit time">
                  <NativeInput value={nextVisitTime} onChangeText={setNextVisitTime} />
                </Field>
              ) : null}
              <View style={uiStyles.section}>
                <SectionTitle>Prescription (optional)</SectionTitle>
                <Field label="Medicine">
                  <NativeInput value={medicine} onChangeText={setMedicine} />
                </Field>
                <Field label="Dosage">
                  <NativeInput value={dosage} onChangeText={setDosage} />
                </Field>
                <Field label="Frequency">
                  <NativeInput value={frequency} onChangeText={setFrequency} />
                </Field>
                <Field label="Start date (YYYY-MM-DD)">
                  <NativeInput value={prescriptionStart} onChangeText={setPrescriptionStart} />
                </Field>
                <Field label="End date (optional)">
                  <NativeInput value={prescriptionEnd} onChangeText={setPrescriptionEnd} />
                </Field>
              </View>
              <View style={uiStyles.section}>
                <SectionTitle>Injury details (optional)</SectionTitle>
                <Chips options={bodyRegions} value={bodyRegion} onChange={setBodyRegion} />
                <Chips options={injuryTypes} value={injuryType} onChange={setInjuryType} />
                <Chips
                  options={recoveryStates}
                  value={recoveryStatus}
                  onChange={setRecoveryStatus}
                />
                <Text style={uiStyles.muted}>
                  Enter the injury point on the horse’s 3D model. All three coordinates are
                  required.
                </Text>
                <Field label="Position X">
                  <NativeInput
                    value={injuryPositionX}
                    onChangeText={setInjuryPositionX}
                    keyboardType="numbers-and-punctuation"
                    placeholder="0.0"
                  />
                </Field>
                <Field label="Position Y">
                  <NativeInput
                    value={injuryPositionY}
                    onChangeText={setInjuryPositionY}
                    keyboardType="numbers-and-punctuation"
                    placeholder="0.0"
                  />
                </Field>
                <Field label="Position Z">
                  <NativeInput
                    value={injuryPositionZ}
                    onChangeText={setInjuryPositionZ}
                    keyboardType="numbers-and-punctuation"
                    placeholder="0.0"
                  />
                </Field>
                <Field label="Injury notes">
                  <NativeInput value={injuryNotes} onChangeText={setInjuryNotes} multiline />
                </Field>
              </View>
            </>
          ) : null}
          <PrimaryButton
            label={saving ? "Saving examination…" : caseId ? "Save follow-up" : "Save examination"}
            icon="checkmark"
            disabled={saving || (!caseId && Boolean(openCase))}
            onPress={() =>
              Alert.alert(
                "Save examination?",
                conclusion === "ISSUE" && !caseId
                  ? "The Backend will create an open treatment case with this visit in one transaction."
                  : "This visit will be recorded in the horse’s medical history.",
                [
                  { text: "Review", style: "cancel" },
                  { text: "Save", onPress: () => void submit() },
                ],
              )
            }
          />
        </>
      ) : null}
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    segmentedSelectorRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    segmentedOptionCard: {
      flex: 1,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    segmentedOptionCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.fitSoft,
      borderWidth: 2,
    },
    segmentedOptionCardActiveIssue: {
      borderColor: colors.destructive,
      backgroundColor: colors.injuredSoft,
      borderWidth: 2,
    },
    segmentedHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    segmentedCardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    segmentedCardHint: {
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    requestCard: {
      gap: space.sm,
    },
    urgentMiniBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.destructive,
    },
    urgentMiniBadgeText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    confirmAbnormalCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: space.xs,
    },
  });
