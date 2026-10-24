import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { isRole } from "@/features/auth/roles";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { horseService } from "@/services/horse.service";
import {
  medicalService,
  type HealthStatusDto,
  type MeasurementTypeDto,
  type MedicalRecordEditInputDto,
} from "@/services/medical.service";
import type { HorseMeasurementDto } from "@/services/horse.service";
import {
  INJURY_BODY_REGIONS,
  INJURY_RECOVERY_STATES,
  INJURY_TYPES,
  type InjuryBodyRegion,
  type HorseLocalPosition,
  type InjuryRecoveryStatus,
  type InjuryType,
} from "@/features/medical/injury-mapper/injury-mapper.types";
import { isHorseModelPosition } from "@/features/medical/injury-mapper/injury-mapper-policy";
import {
  isNotPastDateTime,
  isValidDateOnly,
  isValidMedicalMeasurement,
  isValidRequiredText,
  MEDICAL_MEASUREMENT_RANGES,
  toClubDateTime,
  validateMeasurementField,
} from "@/features/medical/medical-validation";
import { clubDate } from "@/utils/horse-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";

const healthStatuses: HealthStatusDto[] = [
  "ELIGIBLE",
  "UNDER_OBSERVATION",
  "INJURED",
  "QUARANTINED",
];

type PrescriptionDraft = {
  medicine: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
};

type InjuryDraft = {
  injuryId: string;
  recoveryStatus: InjuryRecoveryStatus;
  notes: string;
  bodyRegion: InjuryBodyRegion;
  injuryType: InjuryType;
  position: { x: string; y: string; z: string };
};

const measurementLabels: Record<MeasurementTypeDto, { label: string; unit: string }> = {
  WEIGHT: { label: "Weight", unit: "kg" },
  HEIGHT: { label: "Height", unit: "cm" },
  BODY_CONDITION: { label: "Body condition score", unit: "1–9" },
  TEMPERATURE: { label: "Temperature", unit: "°C" },
};

const isAbnormalMeasurementValue = (type: MeasurementTypeDto, value: number) => {
  const normalRanges: Record<MeasurementTypeDto, { min: number; max: number }> = {
    WEIGHT: { min: 400, max: 600 },
    HEIGHT: { min: 150, max: 175 },
    BODY_CONDITION: { min: 4, max: 6 },
    TEMPERATURE: { min: 37.2, max: 38.3 },
  };
  const range = normalRanges[type];
  return value < range.min || value > range.max;
};

const EMPTY_PRESCRIPTION: PrescriptionDraft = {
  medicine: "",
  dosage: "",
  frequency: "",
  startDate: clubDate(),
  endDate: "",
};

export default function EditMedicalVisit() {
  const { role: roleParam, id: idParam } = useLocalSearchParams<{ role: string; id: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const [diagnosis, setDiagnosis] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [healthStatus, setHealthStatus] = useState<HealthStatusDto | "">("");
  const [kind, setKind] = useState<"ROUTINE" | "REQUEST">("ROUTINE");
  const [conclusion, setConclusion] = useState<"NORMAL" | "ISSUE">("NORMAL");
  const [initialDiagnosis, setInitialDiagnosis] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState("");
  const [nextVisitTime, setNextVisitTime] = useState("");
  const [reason, setReason] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([]);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [confirmAbnormal, setConfirmAbnormal] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<InjuryDraft[]>([]);
  const [removedInjuryIds, setRemovedInjuryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [initializedId, setInitializedId] = useState("");

  const load = useCallback(async () => {
    const record = await medicalService.getRecord(token!, id);
    const [horse, linkedCase, examRequests, injuryTimeline, allMeasurements] = await Promise.all([
      horseService.get(token!, record.horseId),
      record.caseId ? medicalService.getCase(token!, record.caseId) : Promise.resolve(null),
      medicalService.listHorseExamRequests(token!, record.horseId),
      medicalService.listInjuries(token!, record.horseId),
      horseService.listMeasurements(token!, record.horseId),
    ]);
    // The BE stores exam measurements with the visit's examDate. Its measurement-list DTO omits
    // medicalRecordId, so exact timestamp matching safely identifies only this visit's readings.
    const visitMeasurements = allMeasurements.filter(
      (item) =>
        item.source === "MEDICAL_EXAM" &&
        new Date(item.measuredAt).getTime() === new Date(record.examDate).getTime(),
    );
    return { record, horse, linkedCase, examRequests, injuryTimeline, visitMeasurements };
  }, [id, token]);
  const resource = useApiResource(load, Boolean(token && id && role === "vet"));
  const record = resource.data?.record;
  const isAuthor = Boolean(record && user?.userId === record.vetId);
  const isEditable = Boolean(
    record &&
      isAuthor &&
      !record.voidedAt &&
      resource.data?.horse.lifecycleStatus !== "TRANSFERRED" &&
      resource.data?.horse.lifecycleStatus !== "DECEASED",
  );
  const isFollowUp = record?.kind === "FOLLOW_UP";
  const canEditVisitStructure = Boolean(
    record && (!record.caseId || resource.data?.linkedCase?.status === "OPEN"),
  );
  const canEditFollowUp = Boolean(
    (record?.caseId && resource.data?.linkedCase?.status === "OPEN") ||
      (canEditVisitStructure && conclusion === "ISSUE"),
  );
  const isClosedCase = resource.data?.linkedCase?.status === "CLOSED";

  useEffect(() => {
    if (!record || initializedId === record.id || !resource.data) return;
    setDiagnosis(record.diagnosis ?? "");
    setCareInstructions(record.careInstructions ?? "");
    setHealthStatus(record.resultingStatus as HealthStatusDto);
    if (record.kind === "ROUTINE" || record.kind === "REQUEST") setKind(record.kind);
    if (record.conclusion === "NORMAL" || record.conclusion === "ISSUE")
      setConclusion(record.conclusion);
    setInitialDiagnosis(resource.data.linkedCase?.initialDiagnosis ?? "");
    setPrescriptions(
      record.prescriptions.map((item) => ({
        medicine: item.medicine,
        dosage: item.dosage ?? "",
        frequency: item.frequency ?? "",
        startDate: item.startDate.slice(0, 10),
        endDate: item.endDate?.slice(0, 10) ?? "",
      })),
    );
    setMeasurementValues(
      Object.fromEntries(
        resource.data.visitMeasurements.map((item) => [item.type, String(item.value)]),
      ),
    );
    setSelectedRequestIds(
      resource.data.examRequests
        .filter((item) => item.medicalRecordId === record.id && item.status === "EXAMINED")
        .map((item) => item.id),
    );
    setInjuries(
      record.injuries.map((item) => ({
        injuryId: item.injuryId,
        recoveryStatus: item.recoveryStatus as InjuryRecoveryStatus,
        notes: item.notes ?? "",
        bodyRegion: item.bodyRegion as InjuryBodyRegion,
        injuryType: item.injuryType as InjuryType,
        position: {
          x: String(item.position.x),
          y: String(item.position.y),
          z: String(item.position.z),
        },
      })),
    );
    if (record.nextVisitAt) {
      const date = new Date(record.nextVisitAt);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date);
      const part = (name: string) => parts.find((value) => value.type === name)?.value ?? "";
      setNextVisitDate(`${part("year")}-${part("month")}-${part("day")}`);
      setNextVisitTime(`${part("hour")}:${part("minute")}`);
    }
    setInitializedId(record.id);
  }, [initializedId, record, resource.data]);

  if (!role) return <Redirect href="/" />;
  if (role !== "vet") return <Redirect href={`/${role}` as Href} />;

  const updatePrescription = (index: number, patch: Partial<PrescriptionDraft>) =>
    setPrescriptions((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  const updateInjury = (injuryId: string, patch: Partial<InjuryDraft>) =>
    setInjuries((current) =>
      current.map((item) => (item.injuryId === injuryId ? { ...item, ...patch } : item)),
    );
  const toggleRequest = (requestId: string) =>
    setSelectedRequestIds((current) =>
      current.includes(requestId)
        ? current.filter((item) => item !== requestId)
        : [...current, requestId],
    );
  const toggleRemovedInjury = (injuryId: string) =>
    setRemovedInjuryIds((current) =>
      current.includes(injuryId)
        ? current.filter((item) => item !== injuryId)
        : [...current, injuryId],
    );

  const submit = async () => {
    if (!record || !resource.data || !token || !isEditable || saving) return;
    if (!isValidRequiredText(reason, 500)) {
      Alert.alert("Cần lý do đính chính", "Nhập lý do từ 1 đến 500 ký tự.");
      return;
    }
    const input: MedicalRecordEditInputDto = { reason: reason.trim() };
    let changed = false;
    const nextDiagnosis = diagnosis.trim();
    if (nextDiagnosis !== (record.diagnosis ?? "")) {
      input.diagnosis = nextDiagnosis || null;
      changed = true;
    }
    const nextCareInstructions = careInstructions.trim();
    if (nextCareInstructions !== (record.careInstructions ?? "")) {
      input.careInstructions = nextCareInstructions || null;
      changed = true;
    }
    if (healthStatus && healthStatus !== record.resultingStatus) {
      input.healthStatus = healthStatus;
      changed = true;
    }

    const changedMeasurements: NonNullable<MedicalRecordEditInputDto["measurements"]> = [];
    for (const item of resource.data.visitMeasurements) {
      const text = measurementValues[item.type]?.trim();
      if (!text) {
        Alert.alert("Measurement required", "Enter a value for every measurement recorded in this visit.");
        return;
      }
      const value = Number(text);
      if (!isValidMedicalMeasurement(item.type, value)) {
        const range = MEDICAL_MEASUREMENT_RANGES[item.type];
        Alert.alert(
          "Invalid measurement",
          `${measurementLabels[item.type].label} must be between ${range.min} and ${range.max}.`,
        );
        return;
      }
      if (value !== item.value) changedMeasurements.push({ type: item.type, value });
    }
    const hasAbnormalMeasurement = changedMeasurements.some((item) =>
      isAbnormalMeasurementValue(item.type, item.value),
    );
    if (hasAbnormalMeasurement && !confirmAbnormal) {
      Alert.alert(
        "Confirm abnormal measurements",
        "The updated value is outside the normal range. Confirm before saving it.",
      );
      return;
    }
    if (changedMeasurements.length) {
      input.measurements = changedMeasurements;
      if (hasAbnormalMeasurement) input.confirmAbnormal = true;
      changed = true;
    }

    if (canEditVisitStructure && !isFollowUp) {
      if (kind !== record.kind) {
        input.kind = kind;
        changed = true;
      }
      if (conclusion !== record.conclusion) {
        input.conclusion = conclusion;
        changed = true;
      }
      if (conclusion === "ISSUE") {
        const currentInitialDiagnosis = resource.data.linkedCase?.initialDiagnosis ?? "";
        if (!isValidRequiredText(initialDiagnosis, 2000)) {
          Alert.alert("Cần chẩn đoán ban đầu", "Nhập chẩn đoán bệnh án (tối đa 2.000 ký tự).");
          return;
        }
        if (initialDiagnosis.trim() !== currentInitialDiagnosis) {
          input.initialDiagnosis = initialDiagnosis.trim();
          changed = true;
        }
      }
    }

    const currentRequestIds = resource.data.examRequests
      .filter((item) => item.medicalRecordId === record.id && item.status === "EXAMINED")
      .map((item) => item.id)
      .sort();
    const nextRequestIds = [...selectedRequestIds].sort();
    const requestBasedVisit = isFollowUp ? false : kind === "REQUEST";
    if (requestBasedVisit && nextRequestIds.length === 0) {
      Alert.alert("Cần yêu cầu khám", "Buổi khám theo yêu cầu phải gắn ít nhất một yêu cầu.");
      return;
    }
    if (nextRequestIds.length > 20) {
      Alert.alert("Quá nhiều yêu cầu", "Một buổi khám được gắn tối đa 20 yêu cầu.");
      return;
    }
    if (JSON.stringify(currentRequestIds) !== JSON.stringify(nextRequestIds)) {
      input.requestIds = selectedRequestIds;
      changed = true;
    }

    if (canEditFollowUp) {
      const cancelCaseWithVisit = canEditVisitStructure && record.conclusion === "ISSUE" && conclusion === "NORMAL";
      if (cancelCaseWithVisit && record.nextVisitAt) {
        input.nextVisitAt = null;
        changed = true;
      } else if (!nextVisitDate.trim()) {
        if (record.nextVisitAt) {
          input.nextVisitAt = null;
          changed = true;
        }
      } else {
        const nextVisitAt = toClubDateTime(nextVisitDate, nextVisitTime);
        if (
          !isValidDateOnly(nextVisitDate) ||
          !nextVisitAt ||
          !isNotPastDateTime(nextVisitAt)
        ) {
          Alert.alert("Lịch tái khám không hợp lệ", "Chọn ngày giờ hợp lệ trong tương lai.");
          return;
        }
        if (
          !record.nextVisitAt ||
          new Date(nextVisitAt).getTime() !== new Date(record.nextVisitAt).getTime()
        ) {
          input.nextVisitAt = nextVisitAt;
          changed = true;
        }
      }
    }

    const currentPrescriptions = record.prescriptions.map((item) => ({
      medicine: item.medicine,
      dosage: item.dosage ?? "",
      frequency: item.frequency ?? "",
      startDate: item.startDate.slice(0, 10),
      endDate: item.endDate?.slice(0, 10) ?? "",
    }));
    const nextPrescriptions = prescriptions.map((item) => ({
      medicine: item.medicine.trim(),
      dosage: item.dosage.trim(),
      frequency: item.frequency.trim(),
      startDate: item.startDate.trim(),
      endDate: item.endDate.trim(),
    }));
    if (
      !isFollowUp &&
      conclusion === "NORMAL" &&
      nextPrescriptions.some((item) => !item.endDate)
    ) {
      Alert.alert(
        "Cần ngày kết thúc đơn thuốc",
        "Buổi khám không mở bệnh án phải có ngày kết thúc cho tất cả đơn thuốc.",
      );
      return;
    }
    if (JSON.stringify(currentPrescriptions) !== JSON.stringify(nextPrescriptions)) {
      if (
        nextPrescriptions.length > 20 ||
        nextPrescriptions.some(
          (item) =>
            !item.medicine ||
            item.medicine.length > 160 ||
            !item.dosage ||
            item.dosage.length > 160 ||
            !item.frequency ||
            item.frequency.length > 160 ||
            !isValidDateOnly(item.startDate) ||
            (item.endDate && !isValidDateOnly(item.endDate)) ||
            (item.endDate && item.endDate < item.startDate),
        )
      ) {
        Alert.alert(
          "Đơn thuốc chưa hợp lệ",
          "Kiểm tra tên thuốc, liều, tần suất và ngày dùng. Mỗi mục tối đa 160 ký tự; tối đa 20 mục.",
        );
        return;
      }
      input.prescriptions = nextPrescriptions.map(({ endDate, ...item }) => ({
        ...item,
        ...(endDate ? { endDate } : {}),
      }));
      changed = true;
    }

    const timelineById = new Map(
      resource.data.injuryTimeline.map((item) => [item.id, item]),
    );
    const hasInvalidPosition = injuries.some((draft) => {
      const original = record.injuries.find((item) => item.injuryId === draft.injuryId);
      const timeline = timelineById.get(draft.injuryId);
      if (!original || timeline?.firstMedicalRecordId !== record.id) return false;
      const position: HorseLocalPosition = {
        x: Number(draft.position.x),
        y: Number(draft.position.y),
        z: Number(draft.position.z),
      };
      const positionChanged =
        position.x !== original.position.x ||
        position.y !== original.position.y ||
        position.z !== original.position.z;
      return positionChanged && !isHorseModelPosition(position);
    });
    if (hasInvalidPosition) {
      Alert.alert(
        "Invalid 3D position",
        "Use valid horse-model coordinates: X −0.8–0.8 m, Y −0.1–2.4 m, Z −1.5–1.6 m.",
      );
      return;
    }
    const cancellingCaseFromVisit =
      canEditVisitStructure && record.conclusion === "ISSUE" && conclusion === "NORMAL";
    const injuryEdits = injuries.flatMap((draft) => {
      if (removedInjuryIds.includes(draft.injuryId) || cancellingCaseFromVisit) return [];
      const original = record.injuries.find((item) => item.injuryId === draft.injuryId);
      if (!original) return [];
      const edit: NonNullable<MedicalRecordEditInputDto["injuries"]>[number] = {
        injuryId: draft.injuryId,
      };
      let injuryChanged = false;
      if (draft.recoveryStatus !== original.recoveryStatus) {
        edit.recoveryStatus = draft.recoveryStatus;
        injuryChanged = true;
      }
      if (draft.notes.trim() !== (original.notes ?? "")) {
        edit.notes = draft.notes.trim() || null;
        injuryChanged = true;
      }
      const timeline = timelineById.get(draft.injuryId);
      if (timeline?.firstMedicalRecordId === record.id) {
        if (draft.bodyRegion !== original.bodyRegion) {
          edit.bodyRegion = draft.bodyRegion;
          injuryChanged = true;
        }
        if (draft.injuryType !== original.injuryType) {
          edit.injuryType = draft.injuryType;
          injuryChanged = true;
        }
        const position: HorseLocalPosition = {
          x: Number(draft.position.x),
          y: Number(draft.position.y),
          z: Number(draft.position.z),
        };
        const positionChanged =
          position.x !== original.position.x ||
          position.y !== original.position.y ||
          position.z !== original.position.z;
        if (positionChanged) {
          edit.position = position;
          injuryChanged = true;
        }
      }
      if (injuryChanged) return [edit];
      return [];
    });
    if (injuryEdits.length) {
      input.injuries = injuryEdits;
      changed = true;
    }
    if (removedInjuryIds.length) {
      input.removedInjuryIds = removedInjuryIds;
      changed = true;
    }
    if (
      canEditVisitStructure &&
      record.conclusion === "ISSUE" &&
      conclusion === "NORMAL" &&
      record.injuries.length
    ) {
      const allCanBeRemoved = record.injuries.every((injury) => {
        const timeline = timelineById.get(injury.injuryId);
        return timeline?.firstMedicalRecordId === record.id && timeline.history.length <= 1;
      });
      if (!allCanBeRemoved) {
        Alert.alert(
          "Không thể hủy bệnh án từ buổi khám này",
          "Có chấn thương đã được dùng ở buổi khám khác. Giữ kết luận hoặc xử lý chấn thương theo hồ sơ trước khi thử lại.",
        );
        return;
      }
      input.removedInjuryIds = record.injuries.map((injury) => injury.injuryId);
      changed = true;
    }

    if (!changed) {
      Alert.alert("Chưa có nội dung thay đổi", "Hãy sửa ít nhất một trường trước khi lưu.");
      return;
    }

    setSaving(true);
    try {
      const updated = await medicalService.editRecord(token, record.id, input);
      const outcomeMessage =
        updated.healthOutcome === "KEPT_LATER_CHANGE"
          ? `Trạng thái sức khỏe ngựa được giữ nguyên vì đã có cập nhật sau buổi khám${updated.laterHealthChange ? ` lúc ${formatDateTime(updated.laterHealthChange.changedAt)} bởi ${updated.laterHealthChange.changedBy ?? "hệ thống"}` : ""}. Dùng chức năng Cập nhật sức khỏe nếu cần đổi trạng thái hiện tại.`
          : updated.healthOutcome === "UPDATED"
            ? `Trạng thái sức khỏe hiện tại đã cập nhật thành ${updated.resultingStatus.replaceAll("_", " ")}.`
            : "Các thay đổi đã được lưu vào phiếu khám.";
      Alert.alert("Đã sửa buổi khám", outcomeMessage, [
        { text: "Đóng", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Không thể sửa buổi khám", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const availableRequests = (resource.data?.examRequests ?? []).filter(
    (item) => item.status === "PENDING" || item.medicalRecordId === record?.id,
  );

  return (
    <Screen
      role="vet"
      title="Sửa buổi khám"
      subtitle={record ? `${resource.data?.horse.name} · ${formatDateTime(record.examDate)}` : "Đính chính có lý do"}
      back
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {record && resource.data ? (
        isEditable ? (
          <View style={ui.section}>
            <Panel>
              <Text style={ui.muted}>
                Chỉ bác sĩ ghi phiếu mới được sửa. Không thể đổi ngựa, bác sĩ, thời điểm khám hoặc chi phí.
              </Text>
              <Text style={ui.muted}>Chỉ các chỉ số đã ghi trong buổi khám mới có thể sửa; không thể thêm loại đo mới.</Text>
            </Panel>
            <SectionTitle>Thông tin đính chính</SectionTitle>
            <Field label="Chẩn đoán / nhận xét">
              <NativeInput value={diagnosis} onChangeText={setDiagnosis} multiline maxLength={4000} />
            </Field>
            <Field label="Hướng dẫn chăm sóc">
              <NativeInput value={careInstructions} onChangeText={setCareInstructions} multiline maxLength={2000} />
            </Field>
            <Field label="Trạng thái sức khỏe sau khám">
              <Chips options={healthStatuses} value={healthStatus} onChange={(value) => setHealthStatus(value as HealthStatusDto)} />
            </Field>

            {resource.data.visitMeasurements.length ? (
              <>
                <SectionTitle>Exam measurements</SectionTitle>
                {resource.data.visitMeasurements.map((item: HorseMeasurementDto) => {
                  const meta = measurementLabels[item.type];
                  const range = MEDICAL_MEASUREMENT_RANGES[item.type];
                  const rawVal = measurementValues[item.type] ?? String(item.value);
                  const validation = validateMeasurementField(item.type, rawVal);
                  return (
                    <Field key={item.id} label={`${meta.label} · ${meta.unit} (${range.min}–${range.max})`}>
                      <NativeInput
                        value={rawVal}
                        onChangeText={(value) => setMeasurementValues((current) => ({ ...current, [item.type]: value }))}
                        keyboardType="decimal-pad"
                      />
                      {validation.error ? (
                        <Text style={{ color: colors.destructive, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                          {validation.error}
                        </Text>
                      ) : validation.warning ? (
                        <Text style={{ color: colors.monitor ?? "#d97706", fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                          {validation.warning}
                        </Text>
                      ) : null}
                    </Field>
                  );
                })}
                <Pressable onPress={() => setConfirmAbnormal((current) => !current)}>
                  <Text style={ui.muted}>{confirmAbnormal ? "✓ " : "□ "}Confirm saving a value outside the normal range</Text>
                </Pressable>
              </>
            ) : null}

            {canEditVisitStructure && !isFollowUp ? (
              <>
                <SectionTitle>Loại và kết luận buổi khám</SectionTitle>
                <Field label="Loại buổi khám">
                  <Chips options={["ROUTINE", "REQUEST"]} value={kind} onChange={(value) => setKind(value as "ROUTINE" | "REQUEST")} />
                </Field>
                <Field label="Kết luận">
                  <Chips options={["NORMAL", "ISSUE"]} value={conclusion} onChange={(value) => setConclusion(value as "NORMAL" | "ISSUE")} />
                </Field>
                {conclusion === "ISSUE" ? (
                  <Field label="Chẩn đoán ban đầu của bệnh án · bắt buộc">
                    <NativeInput value={initialDiagnosis} onChangeText={setInitialDiagnosis} multiline maxLength={2000} />
                  </Field>
                ) : null}
              </>
            ) : null}

            {
              <>
                <SectionTitle>Yêu cầu khám được liên kết</SectionTitle>
                {availableRequests.map((item) => {
                  const selected = selectedRequestIds.includes(item.id);
                  return (
                    <Pressable key={item.id} onPress={() => toggleRequest(item.id)}>
                      <Panel style={{ borderColor: selected ? colors.primary : colors.border }}>
                        <Text style={ui.value}>{selected ? "✓ " : "○ "}{item.description || "Yêu cầu khám"}</Text>
                        <Text style={ui.muted}>{item.status === "PENDING" ? "Chờ xử lý" : "Đã khám"}</Text>
                      </Panel>
                    </Pressable>
                  );
                })}
                {!availableRequests.length ? <Text style={ui.muted}>Không có yêu cầu đang chờ hoặc đã gắn với buổi khám này.</Text> : null}
              </>
            }

            {canEditFollowUp && !(canEditVisitStructure && record.conclusion === "ISSUE" && conclusion === "NORMAL") ? (
              <>
                <SectionTitle>Lịch tái khám</SectionTitle>
                <Text style={ui.muted}>Để trống ngày và giờ để bỏ lịch; ngày giờ mới phải ở hiện tại hoặc tương lai.</Text>
                <Field label="Ngày tái khám · YYYY-MM-DD"><NativeInput value={nextVisitDate} onChangeText={setNextVisitDate} /></Field>
                <Field label="Giờ tái khám · HH:mm"><NativeInput value={nextVisitTime} onChangeText={setNextVisitTime} /></Field>
              </>
            ) : null}

            <SectionTitle>Đơn thuốc ({prescriptions.length})</SectionTitle>
            {prescriptions.map((item, index) => (
              <Panel key={`${record.id}-prescription-${index}`} style={{ gap: 8 }}>
                <Text style={ui.value}>Đơn thuốc {index + 1}</Text>
                <Field label="Tên thuốc"><NativeInput value={item.medicine} onChangeText={(value) => updatePrescription(index, { medicine: value })} maxLength={160} /></Field>
                <Field label="Liều dùng"><NativeInput value={item.dosage} onChangeText={(value) => updatePrescription(index, { dosage: value })} maxLength={160} /></Field>
                <Field label="Tần suất"><NativeInput value={item.frequency} onChangeText={(value) => updatePrescription(index, { frequency: value })} maxLength={160} /></Field>
                <Field label="Ngày bắt đầu · YYYY-MM-DD"><NativeInput value={item.startDate} onChangeText={(value) => updatePrescription(index, { startDate: value })} /></Field>
                <Field label="Ngày kết thúc · để trống nếu đang dùng"><NativeInput value={item.endDate} onChangeText={(value) => updatePrescription(index, { endDate: value })} /></Field>
                <SecondaryButton label="Xóa đơn thuốc" onPress={() => setPrescriptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
              </Panel>
            ))}
            <SecondaryButton
              label="Thêm đơn thuốc"
              disabled={prescriptions.length >= 20}
              onPress={() => setPrescriptions((current) => [...current, { ...EMPTY_PRESCRIPTION, startDate: clubDate() }])}
            />

            <SectionTitle>Chấn thương ghi trong buổi khám ({injuries.length})</SectionTitle>
            {injuries.map((item) => {
              const timeline = resource.data?.injuryTimeline.find((entry) => entry.id === item.injuryId);
              const canEditFixedDetails = timeline?.firstMedicalRecordId === record.id;
              const canRemove = canEditFixedDetails && (timeline?.history.length ?? 0) <= 1;
              const removed = removedInjuryIds.includes(item.injuryId);
              return (
                <Panel key={item.injuryId} style={{ gap: 8, opacity: removed ? 0.55 : 1 }}>
                  <Text style={ui.value}>{item.bodyRegion.replaceAll("_", " ")} · {item.injuryType.replaceAll("_", " ")}</Text>
                  {!removed ? (
                    <>
                      <Field label="Tiến triển hồi phục"><Chips options={isClosedCase ? ["HEALED"] : [...INJURY_RECOVERY_STATES]} value={item.recoveryStatus} onChange={(value) => updateInjury(item.injuryId, { recoveryStatus: value as InjuryRecoveryStatus })} /></Field>
                      <Field label="Ghi chú"><NativeInput value={item.notes} onChangeText={(value) => updateInjury(item.injuryId, { notes: value })} multiline maxLength={2000} /></Field>
                      {canEditFixedDetails ? (
                        <>
                          <Field label="Vùng cơ thể"><Chips options={[...INJURY_BODY_REGIONS]} value={item.bodyRegion} onChange={(value) => updateInjury(item.injuryId, { bodyRegion: value as InjuryBodyRegion })} /></Field>
                          <Field label="Loại chấn thương"><Chips options={[...INJURY_TYPES]} value={item.injuryType} onChange={(value) => updateInjury(item.injuryId, { injuryType: value as InjuryType })} /></Field>
                          <Text style={ui.muted}>Vị trí theo hệ tọa độ gốc của mô hình (mét).</Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <View style={{ flex: 1, minWidth: 0 }}><Field label="X · m"><NativeInput value={item.position.x} onChangeText={(value) => updateInjury(item.injuryId, { position: { ...item.position, x: value } })} keyboardType="decimal-pad" /></Field></View>
                            <View style={{ flex: 1, minWidth: 0 }}><Field label="Y · m"><NativeInput value={item.position.y} onChangeText={(value) => updateInjury(item.injuryId, { position: { ...item.position, y: value } })} keyboardType="decimal-pad" /></Field></View>
                            <View style={{ flex: 1, minWidth: 0 }}><Field label="Z · m"><NativeInput value={item.position.z} onChangeText={(value) => updateInjury(item.injuryId, { position: { ...item.position, z: value } })} keyboardType="decimal-pad" /></Field></View>
                          </View>
                        </>
                      ) : null}
                      {canRemove ? <SecondaryButton label="Xóa chấn thương khỏi buổi khám" onPress={() => toggleRemovedInjury(item.injuryId)} /> : null}
                    </>
                  ) : <SecondaryButton label="Khôi phục chấn thương" onPress={() => toggleRemovedInjury(item.injuryId)} />}
                  {!canEditFixedDetails ? <Text style={ui.muted}>Vùng, loại và vị trí chỉ sửa được ở buổi phát hiện đầu tiên.</Text> : null}
                </Panel>
              );
            })}

            <Field label="Lý do sửa · bắt buộc (tối đa 500 ký tự)">
              <NativeInput value={reason} onChangeText={setReason} multiline maxLength={500} placeholder="Nêu rõ nội dung cần đính chính" />
            </Field>
            <PrimaryButton label={saving ? "Đang lưu…" : "Lưu đính chính"} disabled={saving || !reason.trim()} onPress={() => void submit()} />
          </View>
        ) : (
          <Panel>
            <Text>Phiếu này không thể sửa: chỉ bác sĩ ghi phiếu được sửa; buổi đã hủy hoặc hồ sơ ngựa đã chuyển nhượng/ghi nhận mất cũng không cho sửa.</Text>
          </Panel>
        )
      ) : null}
    </Screen>
  );
}
