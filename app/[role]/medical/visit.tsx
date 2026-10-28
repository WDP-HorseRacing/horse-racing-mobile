import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, DatePickerField, Field, NativeInput, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
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
  isNotPastDateTime,
  isValidDateOnly,
  isValidMedicalMeasurement,
  isValidRequiredText,
  MEDICAL_MEASUREMENT_RANGES,
  toClubDateTime,
  validateMeasurementField,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime, formatEnum } from "@/utils/formatters";
import { Injury3DMapper } from "@/features/medical/injury-mapper/Injury3DMapper";
import type {
  InjuryDraftMarker,
  InjuryUpdateInput,
} from "@/features/medical/injury-mapper/injury-mapper.types";
import { rememberInjuryPlacements } from "@/features/medical/injury-mapper/injury-model-metadata";
import {
  isValidInjuryDraft,
  toInjuryUpdateApiInputs,
  toNewInjuryApiInputs,
} from "@/features/medical/injury-mapper/injury-mapper-policy";

const measurementInputs: {
  type: MeasurementTypeDto;
  label: string;
  placeholder: string;
  unit: string;
  reference: string;
}[] = [
  {
    type: "TEMPERATURE",
    label: "Nhiệt độ cơ thể",
    placeholder: "Nhập nhiệt độ...",
    unit: "°C",
    reference: "Chuẩn: 37.5 – 38.5 °C",
  },
  {
    type: "WEIGHT",
    label: "Cân nặng",
    placeholder: "Nhập cân nặng...",
    unit: "kg",
    reference: "Chuẩn: 300 – 700 kg",
  },
  {
    type: "HEIGHT",
    label: "Chiều cao vai",
    placeholder: "Nhập chiều cao...",
    unit: "cm",
    reference: "Chuẩn: 140 – 185 cm",
  },
  {
    type: "BODY_CONDITION",
    label: "Điểm thể trạng (BCS)",
    placeholder: "Nhập điểm (1–9)...",
    unit: "1–9",
    reference: "Chuẩn: 4 – 6 (thang Henneke 1–9)",
  },
];

const healthStates: HealthStatusDto[] = ["ELIGIBLE", "UNDER_OBSERVATION", "INJURED", "QUARANTINED"];

export default function MedicalVisitForm() {
  const {
    role: roleParam,
    horseId: horseParam,
    caseId: caseParam,
    requestId: requestParam,
    requestIds: requestIdsParam,
    replacesRecordId: replacesRecordParam,
    kind: kindParam,
  } = useLocalSearchParams<{
    role: string;
    horseId?: string;
    caseId?: string;
    requestId?: string;
    requestIds?: string | string[];
    replacesRecordId?: string;
    kind?: string;
  }>();
  const role = isRole(roleParam) ? roleParam : null;
  const horseId = Array.isArray(horseParam) ? horseParam[0] : (horseParam ?? "");
  const caseId = Array.isArray(caseParam) ? caseParam[0] : (caseParam ?? "");
  const requestId = Array.isArray(requestParam) ? requestParam[0] : (requestParam ?? "");
  const requestIdsText = Array.isArray(requestIdsParam) ? requestIdsParam[0] : requestIdsParam;
  const replacementRequestIds = (requestIdsText ?? "").split(",").filter(Boolean);
  const replacesRecordId = Array.isArray(replacesRecordParam)
    ? replacesRecordParam[0]
    : (replacesRecordParam ?? "");
  const initialKind = requestId || replacementRequestIds.length || kindParam === "REQUEST" ? "REQUEST" : "ROUTINE";
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const now = clubDateTimeParts();
  const [kind, setKind] = useState<"ROUTINE" | "REQUEST">(initialKind);
  const [conclusion, setConclusion] = useState<"NORMAL" | "ISSUE">("NORMAL");
  const [selectedRequests, setSelectedRequests] = useState<string[]>(
    [...new Set([...(requestId ? [requestId] : []), ...replacementRequestIds])],
  );
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
  const [recordInjury, setRecordInjury] = useState(false);
  const [injuryDrafts, setInjuryDrafts] = useState<InjuryDraftMarker[]>([]);
  const [injuryUpdates, setInjuryUpdates] = useState<InjuryUpdateInput[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const medicalCase = caseId ? await medicalService.getCase(token!, caseId) : null;
    const resolvedHorseId = horseId || medicalCase?.horseId || "";
    if (!resolvedHorseId) throw new Error("A horse is required to record an examination.");
    const [horse, requests, care, cases, injuryHistory] = await Promise.all([
      horseService.get(token!, resolvedHorseId),
      medicalService.listHorseExamRequests(token!, resolvedHorseId),
      medicalService.getCareInstructions(token!, resolvedHorseId),
      medicalService.listHorseCases(token!, resolvedHorseId),
      medicalService
        .listInjuries(token!, resolvedHorseId)
        .then((injuries) => ({ injuries, unavailable: false }))
        .catch(() => ({ injuries: [], unavailable: true })),
    ]);
    return {
      horse,
      requests,
      care,
      cases,
      injuries: injuryHistory.injuries,
      injuryHistoryUnavailable: injuryHistory.unavailable,
      medicalCase,
      resolvedHorseId,
    };
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

  const opensCase = Boolean(caseId) || conclusion === "ISSUE";

  const onSelectConclusion = (selected: "NORMAL" | "ISSUE") => {
    if (selected === "NORMAL" && injuryDrafts.length > 0) {
      Alert.alert(
        t("Clear injury markers?"),
        t(
          "Normal examinations do not open a medical case and cannot save new injuries. Switching to Normal will clear your injury markers.",
        ),
        [
          { text: t("Keep Issue"), style: "cancel" },
          {
            text: t("Clear and select Normal"),
            style: "destructive",
            onPress: () => {
              setConclusion("NORMAL");
              setInjuryDrafts([]);
              setRecordInjury(false);
            },
          },
        ],
      );
      return;
    }
    setConclusion(selected);
    if (selected === "NORMAL") {
      setRecordInjury(false);
    }
  };

  const toggleRequest = (id: string) =>
    setSelectedRequests((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const updateMeasurement = (type: MeasurementTypeDto, value: string) =>
    setMeasurementValues((current) => ({ ...current, [type]: value }));

  const addFollowUpDays = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const parts = clubDateTimeParts(d);
    setNextVisitDate(parts.date);
    setNextVisitTime(parts.time || "09:00");
  };

  const submit = async () => {
    if (!resource.data || !token || saving) return;
    if (!caseId && openCase) {
      Alert.alert(
        t("An open case already exists"),
        t("Record a follow-up inside the current case."),
        [
          {
            text: t("Open case"),
            onPress: () => router.push(`/${role}/medical/cases/${openCase.id}` as Href),
          },
          { text: t("Close") },
        ],
      );
      return;
    }
    if (!caseId && kind === "REQUEST" && !selectedRequests.length) {
      Alert.alert(
        t("Select a request"),
        t(
          "A request-based examination must be linked to at least one pending request for this horse.",
        ),
      );
      return;
    }
    if (conclusion === "ISSUE" && !isValidRequiredText(initialDiagnosis, 2000)) {
      Alert.alert(
        t("Initial diagnosis required"),
        t("An examination with an issue must create a case with an initial diagnosis."),
      );
      return;
    }
    if (
      (diagnosis.trim() && diagnosis.trim().length > 4000) ||
      (careInstructions.trim() && careInstructions.trim().length > 2000) ||
      selectedRequests.length > 20
    ) {
      Alert.alert(
        t("Examination details are too long"),
        t(
          "Diagnosis is limited to 4,000 characters, care notes to 2,000, and a visit can link at most 20 requests.",
        ),
      );
      return;
    }
    if (
      healthStatus &&
      healthStatus !== resource.data.horse.healthStatus &&
      !isValidRequiredText(healthReason, 500)
    ) {
      Alert.alert(
        t("Health change reason required"),
        t("Enter a reason when changing the horse’s health status."),
      );
      return;
    }
    if (
      nextVisitDate &&
      (!isValidDateOnly(nextVisitDate) ||
        !isNotPastDateTime(toClubDateTime(nextVisitDate, nextVisitTime) ?? ""))
    ) {
      Alert.alert(t("Invalid follow-up date"), t("Choose a valid future date for the next visit."));
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
          t("Invalid measurement"),
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
        t("Prescription incomplete"),
        t("Enter medicine, dosage, frequency, a valid start date, and a valid optional end date."),
      );
      return;
    }
    if (prescriptionEnd && prescriptionEnd < prescriptionStart) {
      Alert.alert(
        t("Invalid prescription dates"),
        t("The prescription end date cannot be before the start date."),
      );
      return;
    }
    if (hasPrescription && !opensCase && !prescriptionEnd.trim()) {
      Alert.alert(
        t("Prescription end date required"),
        t(
          "A visit that does not open a case must have an end date for every prescription.",
        ),
      );
      return;
    }

    if (!opensCase && nextVisitDate) {
      Alert.alert(
        t("Follow-up appointment not allowed"),
        t(
          "Follow-up appointments can only be scheduled when opening or following up a medical case.",
        ),
      );
      return;
    }

    if (injuryDrafts.length + injuryUpdates.length > 20) {
      Alert.alert(
        t("Too many injury changes"),
        t("A visit can contain at most 20 new markers and recovery updates combined."),
      );
      return;
    }
    if (injuryDrafts.some((marker) => !isValidInjuryDraft(marker))) {
      Alert.alert(
        t("Injury details incomplete"),
        t(
          "Confirm the body region, injury type, recovery status, and position for every new marker.",
        ),
      );
      return;
    }
    if (!opensCase && injuryDrafts.length > 0) {
      Alert.alert(
        t("Injury requires a treatment case"),
        t(
          "A new injury can be saved with a standalone examination only when it opens a treatment case.",
        ),
      );
      return;
    }
    if (!caseId && injuryUpdates.length > 0) {
      Alert.alert(
        t("Follow-up required"),
        t("Existing injury status can be updated only during a follow-up inside its open case."),
      );
      return;
    }

    const base: VisitInputDto = {
      ...(replacesRecordId ? { replacesRecordId } : {}),
      ...(selectedRequests.length ? { requestIds: selectedRequests } : {}),
      ...(diagnosis.trim() ? { diagnosis: diagnosis.trim() } : {}),
      ...(healthStatus && healthStatus !== resource.data.horse.healthStatus
        ? { healthStatus: healthStatus as HealthStatusDto, healthReason: healthReason.trim() }
        : {}),
      ...(finalCareInstructions ? { careInstructions: finalCareInstructions } : {}),
      ...(opensCase && nextVisitDate
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
      ...(opensCase && injuryDrafts.length
        ? {
            newInjuries: toNewInjuryApiInputs(injuryDrafts),
          }
        : {}),
      ...(caseId && injuryUpdates.length
        ? {
            injuryUpdates: toInjuryUpdateApiInputs(injuryUpdates),
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

      const unmappedDrafts = [...injuryDrafts];
      const newlyCreatedInjuries = record.injuries.filter((injury) => {
        const draftIndex = unmappedDrafts.findIndex(
          (draft) =>
            injury.injuryId &&
            draft.bodyRegion === injury.bodyRegion &&
            draft.injuryType === injury.injuryType &&
            injury.position &&
            Math.abs(draft.position.x - injury.position.x) < 0.00001 &&
            Math.abs(draft.position.y - injury.position.y) < 0.00001 &&
            Math.abs(draft.position.z - injury.position.z) < 0.00001,
        );
        if (draftIndex < 0) return false;
        unmappedDrafts.splice(draftIndex, 1);
        return true;
      });
      if (newlyCreatedInjuries.length) {
        try {
          await rememberInjuryPlacements(resource.data.resolvedHorseId, newlyCreatedInjuries);
        } catch {
          // Backend saved the visit; without local frame metadata this point will not be restored as exact 3D.
        }
      }

      if (record.caseId) router.replace(`/${role}/medical/cases/${record.caseId}` as Href);
      else router.replace(`/${role}/medical/visits/${record.id}` as Href);
    } catch (error) {
      Alert.alert(t("Could not save examination"), extractErrorMessage(error));
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
          {/* Step Progress Indicator */}
          <View style={styles.stepProgressContainer}>
            {[
              { num: "1", label: "Lý do khám" },
              { num: "2", label: "Sinh hiệu" },
              { num: "3", label: "Chẩn đoán" },
              { num: "4", label: "Bản đồ 3D" },
              { num: "5", label: "Điều trị" },
            ].map((step, idx) => (
              <View key={step.num} style={styles.stepProgressItem}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepCircleText}>{step.num}</Text>
                </View>
                <Text style={styles.stepLabel} numberOfLines={1}>
                  {step.label}
                </Text>
                {idx < 4 ? <View style={styles.stepLine} /> : null}
              </View>
            ))}
          </View>

          {/* SECTION A: Patient Clinical Profile Header */}
          <View style={uiStyles.section}>
            <SectionTitle>{t("Patient profile")}</SectionTitle>
            <Panel style={styles.patientCard}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[uiStyles.value, { fontSize: 18 }]} numberOfLines={1}>
                    {resource.data.horse.name}
                  </Text>
                  <Text style={uiStyles.muted} numberOfLines={1}>
                    {[
                      resource.data.horse.location.barn?.name ?? t("No barn"),
                      resource.data.horse.location.stall?.code
                        ? `${t("Stall")} ${resource.data.horse.location.stall.code}`
                        : t("No stall"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <View style={styles.healthBadge}>
                  <Text style={styles.healthBadgeText}>
                    {formatEnum(resource.data.horse.healthStatus)}
                  </Text>
                </View>
              </View>

              {resource.data.care.current ? (
                <View style={styles.prefillNotice}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                  <Text style={styles.prefillNoticeText} numberOfLines={2}>
                    {t("Care note prefilled from")}{" "}
                    {formatDateTime(resource.data.care.current.examDate)}
                  </Text>
                </View>
              ) : null}
            </Panel>
          </View>

          {/* SECTION B: Reason for Visit */}
          <View style={uiStyles.section}>
            <SectionTitle>{t("1. Examination reason")}</SectionTitle>

            {!caseId ? (
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
                    {t("Routine checkup")}
                  </Text>
                  <Text style={styles.segmentedCardHint} numberOfLines={2}>
                    {t("Periodic checkup (no prior request required)")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (!pendingRequests.length) {
                      Alert.alert(
                        t("No pending requests"),
                        t("No pending requests for this horse. Please choose Routine checkup."),
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
                    {t("On-demand examination")}
                  </Text>
                  <Text style={styles.segmentedCardHint} numberOfLines={2}>
                    {t("Resolve an existing incident request")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* If On-Demand: Request Selector */}
            {caseId || kind === "REQUEST" || selectedRequests.length ? (
              <View style={{ gap: space.xs, marginTop: space.xs }}>
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
                                  <Text style={styles.urgentMiniBadgeText}>{t("URGENT")}</Text>
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
                              {request.requestedBy
                                ? ` · Người yêu cầu: Nhân sự #${request.requestedBy.slice(0, 8)}`
                                : " · Hệ thống tự động"}
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
              </View>
            ) : null}

            <View style={[styles.prefillNotice, { marginTop: space.sm }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.prefillNoticeText}>
                {t("Examination date and time are recorded by the server when you save.")}
              </Text>
            </View>
          </View>

          {/* SECTION C: Vital Signs & Measurements */}
          <View style={uiStyles.section}>
            <SectionTitle>{t("2. Clinical vital signs")}</SectionTitle>

            <View style={styles.vitalNoticeBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.vitalNoticeText}>
                Các trường dưới đây là số đo mới của buổi khám này. Để trống nếu chưa đo kiểm tra tại chuồng.
              </Text>
            </View>

            <View style={styles.measurementGrid}>
              {measurementInputs.map((item) => {
                const rawVal = measurementValues[item.type] ?? "";
                const validation = validateMeasurementField(item.type, rawVal, t);
                return (
                  <View key={item.type} style={styles.measurementItem}>
                    <Text style={styles.measurementItemLabel}>
                      {item.label} ({item.unit})
                    </Text>
                    <NativeInput
                      value={rawVal}
                      onChangeText={(value) => updateMeasurement(item.type, value)}
                      keyboardType="decimal-pad"
                      placeholder={item.placeholder}
                    />
                    {validation.error ? (
                      <Text style={styles.inlineError}>{validation.error}</Text>
                    ) : validation.warning ? (
                      <Text style={styles.inlineWarning}>{validation.warning}</Text>
                    ) : null}
                    <Text style={styles.measurementItemHint}>{item.reference}</Text>
                  </View>
                );
              })}
            </View>

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
                    { fontSize: 14, fontWeight: "600" },
                    confirmAbnormal && { color: colors.primary, fontWeight: "700" },
                  ]}
                >
                  {t("Xác nhận chỉ số bất thường")}
                </Text>
                <Text style={uiStyles.muted}>
                  {t("Confirm if values exceed standard reference limits")}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* SECTION D: Clinical Findings & Observations */}
          <View style={uiStyles.section}>
            <SectionTitle>{t("3. Clinical findings & conclusion")}</SectionTitle>

            {!caseId ? (
              <View style={styles.segmentedSelectorRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSelectConclusion("NORMAL")}
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
                    {t("Normal")}
                  </Text>
                  <Text style={styles.segmentedCardHint} numberOfLines={2}>
                    {t("Normal health, no case opened")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSelectConclusion("ISSUE")}
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
                    {t("Issue")}
                  </Text>
                  <Text
                    style={[
                      styles.segmentedCardHint,
                      conclusion === "ISSUE" && { color: colors.destructive },
                    ]}
                    numberOfLines={2}
                  >
                    {t("Issue detected, treatment case opened")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Field label="Diagnosis and findings">
              <NativeInput
                value={diagnosis}
                onChangeText={setDiagnosis}
                multiline
                placeholder="Clinical observations, heart sounds, gait examination..."
              />
            </Field>

            {!caseId && conclusion === "ISSUE" ? (
              <Field label="Initial case diagnosis (required)">
                <NativeInput
                  value={initialDiagnosis}
                  onChangeText={setInitialDiagnosis}
                  multiline
                  placeholder="Primary diagnosis for the new medical case..."
                />
              </Field>
            ) : null}
          </View>

          {/* SECTION E: Diagnosis & Injury Tracking */}
          <View style={uiStyles.section}>
            <SectionTitle>{t("4. Diagnosis & health status")}</SectionTitle>

            <Field label="Resulting health status">
              <Chips
                options={["Keep current", ...healthStates]}
                value={healthStatus || "Keep current"}
                onChange={(value) => setHealthStatus(value === "Keep current" ? "" : value)}
              />
            </Field>

            {healthStatus && healthStatus !== resource.data.horse.healthStatus ? (
              <Field label="Reason for health status change (required)">
                <NativeInput
                  value={healthReason}
                  onChangeText={setHealthReason}
                  multiline
                  placeholder="Specify clinical justification for changing health status..."
                />
              </Field>
            ) : null}

            {/* Collapsible Injury Marker Section */}
            <View style={{ marginTop: space.sm }}>
              {!opensCase ? (
                <Panel style={styles.normalNoticeBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                    <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "600", flex: 1 }]}>
                      {t("5. Injury documentation (optional)")}
                    </Text>
                  </View>
                  <Text style={[uiStyles.muted, { fontSize: 13, marginTop: 4 }]}>
                    {t(
                      "Examinations concluded as Normal do not open a medical case and cannot record new injuries.",
                    )}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setConclusion("ISSUE");
                      setRecordInjury(true);
                    }}
                    style={styles.switchIssueButton}
                  >
                    <Ionicons name="warning-outline" size={16} color={colors.destructive} />
                    <Text style={styles.switchIssueButtonText}>
                      {t("Switch to 'Issue' to document injuries & open case")}
                    </Text>
                  </Pressable>
                </Panel>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRecordInjury(!recordInjury)}
                    style={styles.injuryToggleCard}
                  >
                    <Ionicons
                      name={recordInjury ? "bandage" : "bandage-outline"}
                      size={20}
                      color={recordInjury ? colors.destructive : colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[uiStyles.value, { fontSize: 15 }]}>
                        {t("5. Injury documentation (optional)")}
                      </Text>
                      <Text style={uiStyles.muted}>
                        {recordInjury
                          ? t("Document anatomical position")
                          : t("Tap to mark injury location")}
                      </Text>
                    </View>
                    <Ionicons
                      name={recordInjury ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>

                  {recordInjury ? (
                    <Injury3DMapper
                      horseId={resource.data.resolvedHorseId}
                      existingInjuries={resource.data.injuries}
                      drafts={injuryDrafts}
                      onDraftsChange={(markers) => {
                        setInjuryDrafts(markers);
                        if (markers.length && !caseId) setConclusion("ISSUE");
                      }}
                      updates={injuryUpdates}
                      onUpdatesChange={setInjuryUpdates}
                      allowNew
                      allowFollowUpUpdates={Boolean(caseId)}
                      historyUnavailable={resource.data.injuryHistoryUnavailable}
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/* SECTION F: Treatment, Prescriptions & Care Plan */}
          <View style={uiStyles.section}>
            <SectionTitle>{t("6. Treatment & prescriptions (optional)")}</SectionTitle>

            <Field label="Care instructions">
              <NativeInput
                value={careInstructions}
                onChangeText={setCareInstructions}
                multiline
                placeholder={carePrefill || "Rest, cold hosing, hand walking, diet instructions..."}
              />
            </Field>

            {/* Prescriptions */}
            <Panel style={{ gap: space.sm }}>
              <Text style={[uiStyles.value, { fontSize: 15 }]}>{t("Prescription")}</Text>
              <Field label="Medicine">
                <NativeInput
                  value={medicine}
                  onChangeText={setMedicine}
                  placeholder="e.g. Phenylbutazone, Bute paste"
                />
              </Field>
              <View style={uiStyles.row}>
                <View style={{ flex: 1 }}>
                  <Field label="Dosage">
                    <NativeInput value={dosage} onChangeText={setDosage} placeholder="e.g. 2g" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Frequency">
                    <NativeInput
                      value={frequency}
                      onChangeText={setFrequency}
                      placeholder="e.g. Once daily"
                    />
                  </Field>
                </View>
              </View>
              <View style={uiStyles.row}>
                <View style={{ flex: 1 }}>
                  <Field label="Start date">
                    <NativeInput value={prescriptionStart} onChangeText={setPrescriptionStart} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={
                      !opensCase
                        ? t("End date (required for Normal visit)")
                        : t("End date (optional)")
                    }
                  >
                    <NativeInput
                      value={prescriptionEnd}
                      onChangeText={setPrescriptionEnd}
                      placeholder="YYYY-MM-DD"
                    />
                  </Field>
                </View>
              </View>
              {!opensCase && (medicine.trim() || dosage.trim() || frequency.trim()) && !prescriptionEnd.trim() ? (
                <View style={styles.prescriptionNoticeBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.monitor} />
                  <Text style={styles.prescriptionNoticeText}>
                    {t("A visit that does not open a case must have an end date for every prescription.")}
                  </Text>
                </View>
              ) : null}
            </Panel>

            {/* Follow-up appointment scheduling (for case or issues) */}
            {opensCase ? (
              <Panel style={{ marginTop: space.xs, gap: space.sm }}>
                <Text style={[uiStyles.value, { fontSize: 15 }]}>{t("Follow-up appointment")}</Text>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Field label="Next visit date">
                      <DatePickerField
                        value={nextVisitDate}
                        onChangeText={setNextVisitDate}
                        placeholder="YYYY-MM-DD"
                        outputFormat="YYYY-MM-DD"
                        title="Chọn ngày tái khám"
                      />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Next visit time">
                      <NativeInput value={nextVisitTime} onChangeText={setNextVisitTime} />
                    </Field>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: space.xs }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => addFollowUpDays(3)}
                    style={styles.quickPresetBtn}
                  >
                    <Text style={styles.quickPresetBtnText}>+3 days</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => addFollowUpDays(7)}
                    style={styles.quickPresetBtn}
                  >
                    <Text style={styles.quickPresetBtnText}>+7 days</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => addFollowUpDays(14)}
                    style={styles.quickPresetBtn}
                  >
                    <Text style={styles.quickPresetBtnText}>+14 days</Text>
                  </Pressable>
                </View>
              </Panel>
            ) : null}
          </View>

          {/* Sticky Bottom Action Bar */}
          <View style={styles.bottomBar}>
            <PrimaryButton
              label={
                saving
                  ? "Saving examination…"
                  : caseId
                    ? "Save follow-up"
                    : "Save examination record"
              }
              icon="checkmark-done-outline"
              disabled={saving || (!caseId && Boolean(openCase))}
              onPress={() =>
                Alert.alert(
                  t("Save examination?"),
                  conclusion === "ISSUE" && !caseId
                    ? t("Hệ thống sẽ tự động tạo một bệnh án điều trị đang mở cùng buổi khám này.")
                    : t("This visit will be recorded in the horse’s medical history."),
                  [
                    { text: t("Review"), style: "cancel" },
                    { text: t("Save"), onPress: () => void submit() },
                  ],
                )
              }
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    patientCard: {
      gap: space.xs,
      borderColor: colors.border,
    },
    healthBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
    healthBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    prefillNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: space.xs,
    },
    prefillNoticeText: {
      fontSize: 12,
      color: colors.primary,
      flex: 1,
    },
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
    quickPresetBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: space.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      alignSelf: "flex-start",
    },
    quickPresetBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    measurementGrid: {
      gap: space.sm,
    },
    measurementItem: {
      gap: 3,
    },
    measurementItemLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    measurementItemHint: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    inlineError: {
      fontSize: 11,
      color: colors.destructive,
      fontWeight: "600",
      marginTop: 2,
    },
    inlineWarning: {
      fontSize: 11,
      color: colors.monitor ?? "#d97706",
      fontWeight: "600",
      marginTop: 2,
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
    injuryToggleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bottomBar: {
      marginTop: space.lg,
      marginBottom: space.xl,
    },
    stepProgressContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.sm,
      paddingHorizontal: space.xs,
      marginBottom: space.md,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepProgressItem: {
      flex: 1,
      alignItems: "center",
      position: "relative",
    },
    stepCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    stepCircleText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#ffffff",
    },
    stepLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.foreground,
      textAlign: "center",
    },
    stepLine: {
      position: "absolute",
      top: 13,
      right: "-50%",
      width: "100%",
      height: 1,
      backgroundColor: colors.border,
      zIndex: -1,
    },
    vitalNoticeBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      marginBottom: space.sm,
    },
    vitalNoticeText: {
      flex: 1,
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    normalNoticeBox: {
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.xs,
    },
    switchIssueButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: space.xs,
      paddingVertical: space.xs,
      paddingHorizontal: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.injuredSoft ?? "#fee2e2",
      alignSelf: "flex-start",
    },
    switchIssueButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.destructive,
    },
    prescriptionNoticeBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      padding: space.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      marginTop: space.xs,
    },
    prescriptionNoticeText: {
      flex: 1,
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
  });
}
