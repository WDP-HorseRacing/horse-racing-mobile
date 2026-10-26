import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
  Chips,
  DatePickerField,
  Field,
  NativeInput,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { horseService } from "@/services/horse.service";
import { medicalService } from "@/services/medical.service";
import {
  isNotPastDateTime,
  isValidRequiredText,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime, formatEnum, formatVnd } from "@/utils/formatters";
import { Injury3DMapper } from "@/features/medical/injury-mapper/Injury3DMapper";
import type {
  InjuryDraftMarker,
  InjuryUpdateInput,
} from "@/features/medical/injury-mapper/injury-mapper.types";

const noDraftInjuries: InjuryDraftMarker[] = [];
const noInjuryUpdates: InjuryUpdateInput[] = [];

export default function MedicalCaseDetail() {
  const { role: roleParam, id: idParam } = useLocalSearchParams<{ role: string; id: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [finalConclusion, setFinalConclusion] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctedConclusion, setCorrectedConclusion] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [lockDecision, setLockDecision] = useState<"RELEASE" | "KEEP">("RELEASE");
  const [lockEndDate, setLockEndDate] = useState("");
  const [lockEndTime, setLockEndTime] = useState("09:00");
  const [recordDeath, setRecordDeath] = useState(false);
  const [adjustRecordId, setAdjustRecordId] = useState("");
  const [adjustCost, setAdjustCost] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [voidRecordId, setVoidRecordId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [replacementRequestIds, setReplacementRequestIds] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const medicalCase = await medicalService.getCase(token!, id);
    const [horse, preview, injuryHistory, examRequests] = await Promise.all([
      horseService.get(token!, medicalCase.horseId),
      role === "vet" && medicalCase.status === "OPEN"
        ? medicalService.getClosePreview(token!, id)
        : Promise.resolve(null),
      medicalService
        .listInjuries(token!, medicalCase.horseId)
        .then((injuries) => ({ injuries, unavailable: false }))
        .catch(() => ({ injuries: [], unavailable: true })),
      role === "vet"
        ? medicalService.listHorseExamRequests(token!, medicalCase.horseId)
        : Promise.resolve([]),
    ]);
    return {
      medicalCase,
      horse,
      preview,
      injuries: injuryHistory.injuries,
      injuryHistoryUnavailable: injuryHistory.unavailable,
      examRequests,
    };
  }, [id, role, token]);

  const resource = useApiResource(
    load,
    Boolean(token && id && role && ["vet", "manager", "trainer", "owner"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);
  const medicalCase = resource.data?.medicalCase;
  const visits = medicalCase?.visits ?? [];
  const isVet = role === "vet";
  const canCorrectConclusion =
    isVet &&
    medicalCase?.status === "CLOSED" &&
    resource.data?.horse.lifecycleStatus !== "TRANSFERRED" &&
    resource.data?.horse.lifecycleStatus !== "DECEASED";

  const submitConclusionCorrection = () => {
    if (!medicalCase || !token) return;
    if (
      !isValidRequiredText(correctedConclusion, 4000) ||
      !isValidRequiredText(correctionReason, 500)
    ) {
      Alert.alert(
        "Cần kết luận và lý do",
        "Nhập kết luận mới (tối đa 4.000 ký tự) và lý do đính chính (tối đa 500 ký tự).",
      );
      return;
    }

    Alert.alert(
      "Đính chính kết luận bệnh án?",
      "Hệ thống sẽ lưu kết luận mới cùng lý do vào lịch sử thao tác. Thời điểm đóng bệnh án được giữ nguyên.",
      [
        { text: "Xem lại", style: "cancel" },
        {
          text: "Đính chính",
          onPress: () => {
            setSaving(true);
            void medicalService
              .correctCaseConclusion(token, id, {
                finalConclusion: correctedConclusion.trim(),
                reason: correctionReason.trim(),
              })
              .then(async () => {
                setCorrectionOpen(false);
                setCorrectionReason("");
                await resource.refresh();
                Alert.alert("Đã đính chính", "Kết luận cuối đã được cập nhật.");
              })
              .catch((error) =>
                Alert.alert("Không thể đính chính kết luận", extractErrorMessage(error)),
              )
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer", "owner"].includes(role)) {
    return <Redirect href={`/${role}` as Href} />;
  }

  const submitClose = async () => {
    if (!medicalCase || !resource.data?.preview || !isVet || !token) return;
    if (!isValidRequiredText(finalConclusion, 4000)) {
      Alert.alert(
        "Cần nhập kết luận cuối",
        "Vui lòng nhập kết luận điều trị cuối cùng trước khi đóng bệnh án.",
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
        "Cần ngày gỡ khóa",
        "Vui lòng chọn ngày giờ dự kiến gỡ khóa huấn luyện trong tương lai.",
      );
      return;
    }
    setSaving(true);
    try {
      await medicalService.closeCase(token, id, {
        finalConclusion: finalConclusion.trim(),
        ...(recordDeath
          ? { deceased: true }
          : activeLock
            ? {
                lockDecision,
                ...(lockDecision === "KEEP" && lockExpectedEnd ? { lockExpectedEnd } : {}),
              }
            : {}),
      });
      await resource.refresh();
      Alert.alert(
        "Đã đóng bệnh án",
        recordDeath
          ? "Bệnh án đã được đóng và ghi nhận cập nhật vòng đời của ngựa."
          : "Kết luận điều trị cuối cùng đã được lưu thành công.",
      );
    } catch (error) {
      Alert.alert("Không thể đóng bệnh án", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitCostAdjustment = async (recordId: string) => {
    const costNumber = Number(adjustCost);
    if (
      !/^[0-9]+$/.test(adjustCost.trim()) ||
      !Number.isSafeInteger(costNumber) ||
      costNumber < 0 ||
      costNumber > 10_000_000_000 ||
      !isValidRequiredText(adjustReason, 500)
    ) {
      Alert.alert(
        "Thông tin điều chỉnh",
        "Nhập số nguyên VND từ 0 đến 10.000.000.000 và lý do tối đa 500 ký tự.",
      );
      return;
    }
    setSaving(true);
    try {
      await medicalService.adjustVisitCost(token!, recordId, {
        cost: costNumber,
        reason: adjustReason.trim(),
      });
      setAdjustRecordId("");
      setAdjustCost("");
      setAdjustReason("");
      await resource.refresh();
      Alert.alert("Đã cập nhật chi phí", "Hệ thống đã ghi nhận điều chỉnh chi phí thành công.");
    } catch (error) {
      Alert.alert("Không thể điều chỉnh chi phí", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitVoid = async () => {
    if (!voidRecordId || !isValidRequiredText(voidReason, 500)) return;
    const recordId = voidRecordId;
    const linkedRequestIds = (resource.data?.examRequests ?? [])
      .filter((request) => request.medicalRecordId === recordId && request.status === "EXAMINED")
      .map((request) => request.id);
    setSaving(true);
    try {
      const result = await medicalService.voidRecord(token!, recordId, voidReason.trim());
      setVoidRecordId("");
      setVoidReason("");
      setReplacementRequestIds((current) => ({ ...current, [recordId]: linkedRequestIds }));
      await resource.refresh();
      const message =
        result.healthOutcome === "REVERTED"
          ? "Đã hủy lần khám. Sức khỏe ngựa đã trở về trạng thái trước buổi khám."
          : result.healthOutcome === "KEPT_LATER_CHANGE"
            ? `Đã hủy lần khám. Sức khỏe hiện tại được giữ nguyên vì có lần cập nhật sau buổi khám${result.laterHealthChange ? ` lúc ${formatDateTime(result.laterHealthChange.changedAt)} bởi ${result.laterHealthChange.changedBy ?? "hệ thống"}` : ""}.`
            : "Đã hủy lần khám y tế.";
      Alert.alert("Thành công", message);
    } catch (error) {
      Alert.alert("Không thể hủy lần khám", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const isOpen = medicalCase?.status === "OPEN";

  const openReplacementVisit = (recordId: string) => {
    if (!resource.data) return;
    const requestIds = replacementRequestIds[recordId] ?? [];
    const replacedVisit = medicalCase?.visits.find((visit) => visit.id === recordId);
    const useOpenCase = Boolean(
      replacedVisit?.caseId && medicalCase?.status === "OPEN",
    );
    const params = new URLSearchParams({
      ...(useOpenCase ? { caseId: medicalCase!.id } : { horseId: resource.data.horse.id }),
      kind: requestIds.length ? "REQUEST" : "ROUTINE",
      replacesRecordId: recordId,
    });
    if (requestIds.length) params.set("requestIds", requestIds.join(","));
    router.push(`/${role}/medical/visit?${params.toString()}` as Href);
  };

  return (
    <Screen
      role={role}
      title="Chi tiết bệnh án"
      subtitle={
        medicalCase
          ? `${resource.data?.horse.name} · ${isOpen ? "Đang mở điều trị" : "Đã đóng"}`
          : "Chi tiết hồ sơ bệnh án"
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
          {/* Patient Profile Card */}
          <View style={styles.patientCard}>
            <View style={styles.patientRow}>
              <View style={[styles.avatarBox, isOpen && styles.avatarBoxActive]}>
                <Ionicons
                  name="paw"
                  size={22}
                  color={isOpen ? colors.primary : colors.mutedForeground}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientName}>{resource.data.horse.name}</Text>
                <Text style={styles.patientMeta}>
                  {resource.data.horse.location.barn?.name ?? "Chưa phân khu"}
                  {resource.data.horse.location.stall?.code
                    ? ` · Ô ${resource.data.horse.location.stall.code}`
                    : ""}
                  {resource.data.horse.microchipId
                    ? ` · Chip: ${resource.data.horse.microchipId}`
                    : ""}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isOpen ? styles.statusBadgeTextOpen : styles.statusBadgeTextClosed,
                  ]}
                >
                  {isOpen ? "ĐANG ĐIỀU TRỊ" : "ĐÃ ĐÓNG"}
                </Text>
              </View>
            </View>

            {/* Diagnosis & Summary Row */}
            <View style={styles.diagnosisSection}>
              <View style={styles.diagnosisItem}>
                <Text style={styles.diagnosisItemLabel}>Chẩn đoán ban đầu:</Text>
                <Text style={styles.diagnosisItemValue}>{medicalCase.initialDiagnosis}</Text>
              </View>
              <View style={styles.datesRow}>
                <Text style={styles.dateMetaText}>
                  Bắt đầu: {formatDateTime(medicalCase.openedAt)}
                </Text>
                {medicalCase.closedAt ? (
                  <Text style={styles.dateMetaText}>
                    Đóng: {formatDateTime(medicalCase.closedAt)}
                  </Text>
                ) : null}
              </View>
            </View>

            {medicalCase.finalConclusion ? (
              <View style={styles.conclusionBox}>
                <Text style={styles.conclusionLabel}>Kết luận điều trị cuối:</Text>
                <Text style={styles.conclusionText}>{medicalCase.finalConclusion}</Text>
              </View>
            ) : null}

            {canCorrectConclusion ? (
              <View style={{ gap: space.sm }}>
                {correctionOpen ? (
                  <View style={styles.conclusionBox}>
                    <Text style={styles.conclusionLabel}>Đính chính kết luận cuối</Text>
                    <Field label="Kết luận mới *">
                      <NativeInput
                        value={correctedConclusion}
                        onChangeText={setCorrectedConclusion}
                        multiline
                        placeholder="Nhập kết luận cuối đã được đính chính"
                        style={{ minHeight: 80 }}
                      />
                    </Field>
                    <Field label="Lý do đính chính *">
                      <NativeInput
                        value={correctionReason}
                        onChangeText={setCorrectionReason}
                        multiline
                        placeholder="Nêu lý do cần sửa kết luận"
                        style={{ minHeight: 64 }}
                      />
                    </Field>
                    <View style={{ flexDirection: "row", gap: space.sm }}>
                      <SecondaryButton
                        label="Hủy"
                        style={{ flex: 1 }}
                        disabled={saving}
                        onPress={() => {
                          setCorrectionOpen(false);
                          setCorrectionReason("");
                          setCorrectedConclusion("");
                        }}
                      />
                      <PrimaryButton
                        label={saving ? "Đang lưu…" : "Lưu đính chính"}
                        style={{ flex: 1 }}
                        disabled={saving}
                        onPress={submitConclusionCorrection}
                      />
                    </View>
                  </View>
                ) : (
                  <SecondaryButton
                    label="Đính chính kết luận cuối"
                    icon="create-outline"
                    onPress={() => {
                      setCorrectedConclusion(medicalCase.finalConclusion ?? "");
                      setCorrectionReason("");
                      setCorrectionOpen(true);
                    }}
                  />
                )}
              </View>
            ) : null}

            {/* Total Cost Display */}
            <View style={styles.costSummaryRow}>
              <View style={styles.costInfo}>
                <Text style={styles.costLabel}>Tổng chi phí ca điều trị:</Text>
                <Text style={styles.costValue}>
                  {medicalCase.totalCost == null
                    ? "Không hiển thị cho giai đoạn này"
                    : formatVnd(medicalCase.totalCost)}
                </Text>
              </View>
              <SecondaryButton
                label="Xem hồ sơ ngựa"
                icon="document-text-outline"
                onPress={() => router.push(`/${role}/horse/${medicalCase.horseId}` as Href)}
              />
            </View>
          </View>

          {/* 3D Injury Mapper if horse has injuries */}
          {resource.data.injuries.length || resource.data.injuryHistoryUnavailable ? (
            <Injury3DMapper
              horseId={medicalCase.horseId}
              existingInjuries={resource.data.injuries}
              drafts={noDraftInjuries}
              onDraftsChange={() => undefined}
              updates={noInjuryUpdates}
              onUpdatesChange={() => undefined}
              allowNew={false}
              allowFollowUpUpdates={false}
              historyUnavailable={resource.data.injuryHistoryUnavailable}
            />
          ) : null}

          {/* Quick Action: Follow-up Examination for Vet */}
          {isVet && isOpen ? (
            <View style={{ marginBottom: space.xs }}>
              <PrimaryButton
                label="Ghi buổi tái khám"
                icon="medkit-outline"
                onPress={() =>
                  router.push(
                    `/vet/medical/visit?caseId=${medicalCase.id}&horseId=${medicalCase.horseId}` as Href,
                  )
                }
              />
            </View>
          ) : null}

          {/* Visits Timeline */}
          <View style={uiStyles.section}>
            <SectionTitle
              action={
                isVet && isOpen ? (
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/vet/medical/visit?caseId=${medicalCase.id}&horseId=${medicalCase.horseId}` as Href,
                      )
                    }
                    style={styles.addVisitQuickButton}
                  >
                    <Ionicons name="add" size={15} color="#ffffff" />
                    <Text style={styles.addVisitQuickText}>Tái khám</Text>
                  </Pressable>
                ) : null
              }
            >
              Lịch sử các lần khám ({visits.length})
            </SectionTitle>

            {visits.map((visit, index) => {
              const isNormal = visit.conclusion === "NORMAL";
              return (
                <View key={visit.id} style={styles.visitCard}>
                  <Pressable
                    onPress={() => router.push(`/${role}/medical/visits/${visit.id}` as Href)}
                    style={styles.visitCardHeader}
                  >
                    <View style={styles.visitHeaderTop}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                        <View style={styles.visitNumberBadge}>
                          <Text style={styles.visitNumberText}>#{visits.length - index}</Text>
                        </View>
                        <Text style={styles.visitKindText}>
                          {visit.kind === "ROUTINE" ? "Khám định kỳ" : "Khám theo yêu cầu"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.conclusionBadge,
                          isNormal ? styles.conclusionBadgeNormal : styles.conclusionBadgeIssue,
                        ]}
                      >
                        <Text
                          style={[
                            styles.conclusionBadgeText,
                            isNormal
                              ? styles.conclusionBadgeTextNormal
                              : styles.conclusionBadgeTextIssue,
                          ]}
                        >
                          {isNormal ? "BÌNH THƯỜNG" : "CÓ VẤN ĐỀ"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.visitDateText}>
                      Ngày khám: {formatDateTime(visit.examDate)}
                    </Text>

                    {visit.diagnosis ? (
                      <Text style={styles.visitDiagnosisText}>Chẩn đoán: {visit.diagnosis}</Text>
                    ) : null}

                    {visit.careInstructions ? (
                      <View style={styles.careInstructionBox}>
                        <Ionicons name="reader-outline" size={14} color={colors.primary} />
                        <Text style={styles.careInstructionText} numberOfLines={2}>
                          {visit.careInstructions}
                        </Text>
                      </View>
                    ) : null}

                    {visit.nextVisitAt ? (
                      <Text style={styles.nextVisitText}>
                        Hẹn tái khám: {formatDateTime(visit.nextVisitAt)}
                      </Text>
                    ) : null}

                    {visit.voidedAt ? (
                      <Text style={styles.voidedNoticeText}>
                        Đã hủy lần khám: {visit.voidReason}
                      </Text>
                    ) : null}
                  </Pressable>

                  {/* Prescriptions mini list */}
                  {visit.prescriptions.length ? (
                    <View style={styles.prescriptionsBlock}>
                      <Text style={styles.subBlockTitle}>Đơn thuốc điều trị:</Text>
                      {visit.prescriptions.map((prescription) => (
                        <Text key={prescription.id} style={styles.prescriptionItemText}>
                          • {prescription.medicine}
                          {prescription.dosage ? ` · ${prescription.dosage}` : ""}
                          {prescription.frequency ? ` (${prescription.frequency})` : ""} ·{" "}
                          {formatDate(prescription.startDate)}
                          {prescription.endDate ? ` – ${formatDate(prescription.endDate)}` : ""}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {/* Injuries tags */}
                  {visit.injuries.length ? (
                    <View style={styles.injuriesBlock}>
                      <Text style={styles.subBlockTitle}>Vị trí chấn thương:</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {visit.injuries.map((injury) => (
                          <View key={injury.id} style={styles.injuryPill}>
                            <Text style={styles.injuryPillText}>
                              {injury.bodyRegion} · {injury.injuryType}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* Visit cost display */}
                  <View style={styles.visitCostRow}>
                    <Text style={styles.visitCostLabel}>Chi phí lần khám:</Text>
                    <Text style={styles.visitCostValue}>
                      {visit.costHidden
                        ? "Chi phí thuộc chủ khác"
                        : visit.cost != null
                          ? formatVnd(Number(visit.cost))
                          : "0 đ"}
                    </Text>
                  </View>

                  {/* Vet actions on visit */}
                  {isVet && !visit.voidedAt && visit.vetId === user?.userId ? (
                    <View style={styles.visitActionsRow}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, width: "100%" }}>
                        {resource.data?.horse.lifecycleStatus !== "TRANSFERRED" &&
                        resource.data?.horse.lifecycleStatus !== "DECEASED" ? (
                          <SecondaryButton
                            label="Sửa buổi khám"
                            style={{ flexGrow: 1 }}
                            onPress={() =>
                              router.push(`/${role}/medical/visits/edit/${visit.id}` as Href)
                            }
                          />
                        ) : null}
                        <SecondaryButton
                          label="Sửa chi phí"
                          style={{ flexGrow: 1 }}
                          onPress={() => {
                            setVoidRecordId("");
                            setAdjustRecordId(visit.id);
                            setAdjustCost(visit.cost != null ? String(visit.cost) : "0");
                            setAdjustReason("");
                          }}
                        />
                        {resource.data?.horse.lifecycleStatus !== "TRANSFERRED" &&
                        resource.data?.horse.lifecycleStatus !== "DECEASED" ? (
                          <SecondaryButton
                            label="Hủy buổi khám"
                            style={{ flexGrow: 1 }}
                            onPress={() => {
                              setAdjustRecordId("");
                              setVoidRecordId(visit.id);
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  {visit.voidedAt ? (
                    <PrimaryButton
                      label="Ghi buổi khám thay thế"
                      icon="medkit-outline"
                      onPress={() => openReplacementVisit(visit.id)}
                    />
                  ) : null}
                </View>
              );
            })}

            {!visits.length ? (
              <View style={styles.emptyVisitsBox}>
                <Ionicons name="document-text-outline" size={32} color={colors.mutedForeground} />
                <Text style={uiStyles.muted}>
                  Chưa có lần khám nào được ghi nhận cho bệnh án này.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Modal Bottom Sheet: Sửa chi phí lần khám */}
          <BottomSheetModal
            visible={Boolean(adjustRecordId)}
            title="Điều chỉnh chi phí lần khám"
            onClose={() => {
              setAdjustRecordId("");
              setAdjustCost("");
              setAdjustReason("");
            }}
            onSave={() => void submitCostAdjustment(adjustRecordId)}
            saveLoading={saving}
            saveDisabled={saving || !adjustCost || !adjustReason.trim()}
            saveLabel="Lưu"
            cancelLabel="Hủy"
          >
            <Field label="Chi phí mới (VND)">
              <NativeInput
                value={adjustCost}
                onChangeText={setAdjustCost}
                keyboardType="number-pad"
                placeholder="Nhập số tiền chi phí mới"
              />
            </Field>
            <Field label="Lý do điều chỉnh (bắt buộc)">
              <NativeInput
                value={adjustReason}
                onChangeText={setAdjustReason}
                placeholder="Nhập lý do điều chỉnh chi phí"
                multiline
              />
            </Field>
          </BottomSheetModal>

          {/* Modal Bottom Sheet: Hủy buổi khám */}
          <BottomSheetModal
            visible={Boolean(voidRecordId)}
            title="Hủy buổi khám"
            onClose={() => {
              setVoidRecordId("");
              setVoidReason("");
            }}
            onSave={() =>
              Alert.alert(
                "Hủy buổi khám này?",
                "Buổi khám vẫn được lưu trong lịch sử nhưng các chỉ số sẽ không còn hiệu lực.",
                [
                  { text: "Quay lại", style: "cancel" },
                  {
                    text: "Hủy buổi khám",
                    style: "destructive",
                    onPress: () => void submitVoid(),
                  },
                ],
              )
            }
            saveLoading={saving}
            saveDisabled={saving || !voidReason.trim()}
            saveLabel="Xác nhận hủy"
            cancelLabel="Hủy"
          >
            <Field label="Lý do hủy buổi khám (bắt buộc)">
              <NativeInput
                value={voidReason}
                onChangeText={setVoidReason}
                placeholder="Nhập lý do hủy buổi khám"
                multiline
              />
            </Field>
          </BottomSheetModal>

          {/* Close Case Section for Vet */}
          {isVet && isOpen ? (
            <View style={uiStyles.section}>
              <SectionTitle>Đóng bệnh án điều trị</SectionTitle>
              <View style={styles.closeCard}>
                {resource.data.preview ? (
                  <View style={styles.previewSummaryBox}>
                    <Text style={styles.previewTitle}>Kiểm tra trước khi đóng</Text>
                    <Text style={styles.previewItem}>
                      • Trạng thái sức khỏe:{" "}
                      {formatEnum(resource.data.preview.healthStatus)}
                      {resource.data.preview.healthWarning ? " (vẫn còn cảnh báo sức khỏe)" : ""}
                    </Text>
                    <Text style={styles.previewItem}>
                      • Yêu cầu khám đang chờ: {resource.data.preview.pendingRequestCount}
                    </Text>
                    {resource.data.preview.activeLock ? (
                      <Text style={[styles.previewItem, { color: colors.destructive }]}>
                        • Ngựa còn lệnh khóa huấn luyện đang hiệu lực (kể cả từ bệnh án trước): {resource.data.preview.activeLock.reason}
                      </Text>
                    ) : (
                      <Text style={styles.previewItem}>• Không có lệnh khóa huấn luyện nào.</Text>
                    )}
                    {resource.data.preview.unhealedInjuryCount > 0 ? (
                      <View
                        style={{
                          marginTop: space.xs,
                          padding: space.sm,
                          borderRadius: radius.sm,
                          backgroundColor: colors.injuredSoft,
                          gap: 4,
                        }}
                      >
                        <Text
                          style={[
                            styles.previewItem,
                            { color: colors.destructive, fontWeight: "700" },
                          ]}
                        >
                          • Còn {resource.data.preview.unhealedInjuryCount} chấn thương chưa lành.
                        </Text>
                        <Text style={[uiStyles.muted, { fontSize: 13, color: colors.destructive }]}>
                          Hệ thống không cho phép đóng bệnh án khi còn vết thương chưa lành (trừ trường hợp ghi nhận ngựa mất).
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            if (medicalCase) {
                              router.push(
                                `/${role}/medical/visit?horseId=${medicalCase.horseId}&caseId=${medicalCase.id}` as Href,
                              );
                            }
                          }}
                          style={{
                            marginTop: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            backgroundColor: colors.primary,
                            borderRadius: radius.sm,
                            alignSelf: "flex-start",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.primaryForeground,
                              fontWeight: "700",
                              fontSize: 13,
                            }}
                          >
                            Ghi tái khám để cập nhật lành thương
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={styles.previewItem}>• Toàn bộ chấn thương đã được ghi nhận lành.</Text>
                    )}
                  </View>
                ) : null}

                {/* Final Conclusion Input (Required) */}
                <Field label="Kết luận điều trị cuối cùng *">
                  <NativeInput
                    value={finalConclusion}
                    onChangeText={setFinalConclusion}
                    multiline
                    placeholder="Nhập tóm tắt kết quả điều trị, tiên lượng hoặc hướng dẫn chăm sóc sau khi đóng bệnh án..."
                    style={{ minHeight: 80 }}
                  />
                </Field>

                {/* Training Lock Handling if Active */}
                {resource.data.preview?.activeLock && !recordDeath ? (
                  <View style={styles.lockDecisionBox}>
                    <Text style={styles.lockDecisionTitle}>Xử lý lệnh khóa huấn luyện</Text>
                    <Chips
                      options={["RELEASE", "KEEP"]}
                      value={lockDecision}
                      onChange={(value) => setLockDecision(value as "RELEASE" | "KEEP")}
                    />
                    {lockDecision === "KEEP" ? (
                      <View style={{ gap: space.xs, marginTop: space.xs }}>
                        <Field label="Ngày dự kiến gỡ khóa (YYYY-MM-DD)">
                          <DatePickerField
                            value={lockEndDate}
                            onChangeText={setLockEndDate}
                            placeholder="YYYY-MM-DD"
                            outputFormat="YYYY-MM-DD"
                            title="Chọn ngày dự kiến gỡ khóa"
                          />
                        </Field>
                        <Field label="Giờ dự kiến gỡ khóa (HH:mm)">
                          <NativeInput
                            value={lockEndTime}
                            onChangeText={setLockEndTime}
                            placeholder="09:00"
                          />
                        </Field>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Record Death Option */}
                <Field label="Ghi nhận ngựa mất khi đóng bệnh án">
                  <Chips
                    options={["Ngựa còn sống", "Ghi nhận ngựa mất"]}
                    value={recordDeath ? "Ghi nhận ngựa mất" : "Ngựa còn sống"}
                    onChange={(value) => setRecordDeath(value === "Ghi nhận ngựa mất")}
                  />
                  <Text style={uiStyles.muted}>
                    Khi ghi nhận ngựa mất, hệ thống tự lấy ngày hiện tại theo lịch câu lạc bộ.
                  </Text>
                </Field>

                {recordDeath && resource.data.preview?.deathImpact ? (
                  <View style={styles.deathPreviewBox}>
                    <Text style={styles.deathPreviewTitle}>
                      Hệ quả vòng đời khi ghi nhận ngựa mất
                    </Text>
                    <Text style={styles.deathPreviewText}>
                      {resource.data.preview.deathImpact.summary ??
                        resource.data.preview.deathImpact.blockedReason ??
                        "Chưa có thông tin tổng kết."}
                    </Text>
                  </View>
                ) : null}

                {/* Submit Close Button */}
                <PrimaryButton
                  label={saving ? "Đang đóng bệnh án…" : "Xác nhận đóng bệnh án"}
                  icon="checkmark-done-circle-outline"
                  disabled={
                    saving ||
                    !finalConclusion.trim() ||
                    (!recordDeath && (resource.data.preview?.unhealedInjuryCount ?? 0) > 0)
                  }
                  onPress={() =>
                    Alert.alert(
                      "Đóng bệnh án điều trị?",
                      "Thao tác này sẽ ghi nhận kết luận điều trị cuối cùng. Lệnh khóa và vòng đời sẽ được hệ thống cập nhật đồng thời.",
                      [
                        { text: "Xem lại", style: "cancel" },
                        {
                          text: "Đóng bệnh án",
                          style: "destructive",
                          onPress: () => void submitClose(),
                        },
                      ],
                    )
                  }
                />
                {!recordDeath && (resource.data.preview?.unhealedInjuryCount ?? 0) > 0 ? (
                  <Text
                    style={[
                      uiStyles.muted,
                      { color: colors.destructive, fontSize: 12, textAlign: "center", marginTop: 4 },
                    ]}
                  >
                    {
                      'Nút bị khóa do ngựa còn chấn thương chưa lành. Hãy ghi tái khám cập nhật lành thương hoặc chọn "Ghi nhận ngựa mất".'
                    }
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    patientCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
      marginBottom: space.sm,
    },
    patientRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
    },
    avatarBox: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarBoxActive: {
      backgroundColor: colors.fitSoft,
    },
    patientName: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
    },
    patientMeta: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    statusBadgeOpen: {
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    statusBadgeClosed: {
      backgroundColor: colors.muted,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    statusBadgeTextOpen: {
      color: colors.primary,
    },
    statusBadgeTextClosed: {
      color: colors.mutedForeground,
    },
    diagnosisSection: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: 4,
    },
    diagnosisItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    diagnosisItemLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    diagnosisItemValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      flex: 1,
    },
    datesRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 2,
    },
    dateMetaText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    conclusionBox: {
      backgroundColor: colors.fitSoft,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: 2,
    },
    conclusionLabel: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: "700",
    },
    conclusionText: {
      fontSize: 13,
      color: colors.foreground,
      lineHeight: 18,
    },
    costSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: space.sm,
    },
    costInfo: {
      gap: 2,
    },
    costLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    costValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: space.xs,
    },
    addVisitQuickButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      flexShrink: 0,
    },
    addVisitQuickText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#ffffff",
    },
    visitCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: space.sm,
    },
    visitCardHeader: {
      padding: space.md,
      gap: space.xs,
    },
    visitHeaderTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    visitNumberBadge: {
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    visitNumberText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    visitKindText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    conclusionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    conclusionBadgeNormal: {
      backgroundColor: colors.fitSoft,
    },
    conclusionBadgeIssue: {
      backgroundColor: colors.injuredSoft,
    },
    conclusionBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    conclusionBadgeTextNormal: {
      color: colors.primary,
    },
    conclusionBadgeTextIssue: {
      color: colors.destructive,
    },
    visitDateText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    visitDiagnosisText: {
      fontSize: 13,
      color: colors.foreground,
      fontWeight: "500",
    },
    careInstructionBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.background,
      padding: space.xs,
      borderRadius: radius.sm,
      marginTop: 2,
    },
    careInstructionText: {
      fontSize: 12,
      color: colors.foreground,
      flex: 1,
    },
    nextVisitText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "600",
      marginTop: 2,
    },
    voidedNoticeText: {
      fontSize: 12,
      color: colors.destructive,
      fontWeight: "600",
      marginTop: 2,
    },
    prescriptionsBlock: {
      paddingHorizontal: space.md,
      paddingBottom: space.sm,
      gap: 2,
    },
    subBlockTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      marginBottom: 2,
    },
    prescriptionItemText: {
      fontSize: 12,
      color: colors.foreground,
      paddingLeft: 4,
    },
    injuriesBlock: {
      paddingHorizontal: space.md,
      paddingBottom: space.sm,
      gap: 4,
    },
    injuryPill: {
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    injuryPillText: {
      fontSize: 11,
      color: colors.foreground,
      fontWeight: "600",
    },
    visitCostRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
    },
    visitCostLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    visitCostValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    visitActionsRow: {
      padding: space.md,
      paddingTop: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: space.xs,
    },
    emptyVisitsBox: {
      alignItems: "center",
      justifyContent: "center",
      padding: space.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.xs,
    },
    closeCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.md,
    },
    previewSummaryBox: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: 4,
    },
    previewTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 2,
    },
    previewItem: {
      fontSize: 12,
      color: colors.foreground,
      lineHeight: 16,
    },
    lockDecisionBox: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: space.xs,
    },
    lockDecisionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 4,
    },
    deathPreviewBox: {
      backgroundColor: colors.injuredSoft,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: 2,
    },
    deathPreviewTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.destructive,
    },
    deathPreviewText: {
      fontSize: 12,
      color: colors.foreground,
    },
  });
}
