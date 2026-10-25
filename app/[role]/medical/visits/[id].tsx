import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Field, NativeInput, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { medicalService } from "@/services/medical.service";
import { horseService } from "@/services/horse.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime, formatVnd } from "@/utils/formatters";
import { safeBack } from "@/utils/navigation";
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
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [adjustCost, setAdjustCost] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [replacementRequestIds, setReplacementRequestIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const record = await medicalService.getRecord(token!, id);
    const [horse, examRequests] = await Promise.all([
      horseService.get(token!, record.horseId),
      role === "vet" ? medicalService.listHorseExamRequests(token!, record.horseId) : Promise.resolve([]),
    ]);
    return { ...record, horse, examRequests };
  }, [id, role, token]);
  const resource = useApiResource(
    load,
    Boolean(token && id && role && ["vet", "manager", "trainer", "owner"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer", "owner"].includes(role)) {
    return <Redirect href={`/${role}` as Href} />;
  }

  const voidVisit = () => {
    if (!resource.data || !reason.trim() || saving) return;
    Alert.alert(
      "Hủy buổi khám này?",
      "Biên bản khám vẫn sẽ được lưu trong lịch sử kèm lý do, các chỉ số đo sẽ không còn hiệu lực.",
      [
        { text: "Giữ lại", style: "cancel" },
        {
          text: "Hủy buổi khám",
          style: "destructive",
          onPress: () => {
            setSaving(true);
            const linkedRequestIds = (resource.data?.examRequests ?? [])
              .filter((request) => request.medicalRecordId === id && request.status === "EXAMINED")
              .map((request) => request.id);
            void medicalService
              .voidRecord(token!, id, reason.trim())
              .then(async (voidResult) => {
                setReason("");
                setReplacementRequestIds(linkedRequestIds);
                await resource.refresh();
                const outcome = voidResult.healthOutcome;
                const outcomeText =
                  outcome === "REVERTED"
                    ? "Sức khỏe đã được đưa về trạng thái trước buổi khám."
                    : outcome === "KEPT_LATER_CHANGE"
                      ? `Giữ nguyên sức khỏe hiện tại vì đã có lần cập nhật sau buổi khám${voidResult.laterHealthChange ? ` lúc ${formatDateTime(voidResult.laterHealthChange.changedAt)} bởi ${voidResult.laterHealthChange.changedBy ?? "hệ thống"}` : ""}.`
                      : "Đã hủy lần khám y tế.";
                Alert.alert("Thành công", outcomeText);
              })
              .catch((error) => Alert.alert("Không thể hủy lần khám", extractErrorMessage(error)))
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  const record = resource.data;
  const isNormal = record?.conclusion === "NORMAL";
  const isAuthorVet = role === "vet" && record?.vetId === user?.userId;
  const horseLifecycle = record?.horse.lifecycleStatus;
  const canEditClinicalRecord =
    isAuthorVet &&
    !record?.voidedAt &&
    horseLifecycle !== "TRANSFERRED" &&
    horseLifecycle !== "DECEASED";
  const canAdjustCost = isAuthorVet && !record?.voidedAt;

  const openReplacementVisit = () => {
    if (!record) return;
    const query = new URLSearchParams({
      horseId: record.horseId,
      kind: replacementRequestIds.length ? "REQUEST" : "ROUTINE",
      replacesRecordId: record.id,
    });
    if (replacementRequestIds.length) query.set("requestIds", replacementRequestIds.join(","));
    router.push(`/${role}/medical/visit?${query.toString()}` as Href);
  };

  const submitCostAdjustment = async () => {
    const cost = Number(adjustCost);
    if (!record || !token || !isAuthorVet || !/^[0-9]+$/.test(adjustCost.trim()) || !Number.isSafeInteger(cost) || cost < 0 || cost > 10_000_000_000 || !adjustReason.trim() || adjustReason.trim().length > 500) {
      Alert.alert("Thông tin chi phí chưa hợp lệ", "Nhập số nguyên VND từ 0 đến 10.000.000.000 và lý do tối đa 500 ký tự.");
      return;
    }
    setSaving(true);
    try {
      await medicalService.adjustVisitCost(token, record.id, { cost, reason: adjustReason.trim() });
      setAdjustCost("");
      setAdjustReason("");
      await resource.refresh();
      Alert.alert(
        "Đã cập nhật chi phí",
        "Chi phí buổi khám đã được điều chỉnh thành công.",
        [
          {
            text: "Quay về",
            onPress: () => {
              if (record.caseId) {
                router.replace(`/${role}/medical/cases/${record.caseId}` as Href);
              } else {
                safeBack(`/${role}/medical/requests`);
              }
            },
          },
          { text: "Ở lại", style: "cancel" },
        ],
      );
    } catch (error) {
      Alert.alert("Không thể điều chỉnh chi phí", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      role={role}
      title="Chi tiết lần khám y tế"
      subtitle={
        record
          ? `${record.kind === "ROUTINE" ? "Khám định kỳ" : "Khám theo yêu cầu"} · ${formatDateTime(record.examDate)}`
          : "Chi tiết buổi khám"
      }
      back
      fallbackHref={record?.caseId ? `/${role}/medical/cases/${record.caseId}` : `/${role}/medical/requests`}
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
          {/* Main Visit Overview Card */}
          <View style={styles.overviewCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                <View style={styles.kindBadge}>
                  <Ionicons
                    name={record.kind === "ROUTINE" ? "calendar-outline" : "alert-circle-outline"}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.kindBadgeText}>
                    {record.kind === "ROUTINE" ? "Khám định kỳ" : "Khám theo yêu cầu"}
                  </Text>
                </View>
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
                    isNormal ? styles.conclusionBadgeTextNormal : styles.conclusionBadgeTextIssue,
                  ]}
                >
                  {isNormal ? "BÌNH THƯỜNG" : "CÓ VẤN ĐỀ"}
                </Text>
              </View>
            </View>

            {/* Diagnosis & Resulting Health */}
            <View style={styles.diagnosisSection}>
              <Text style={styles.diagnosisLabel}>Chẩn đoán y tế:</Text>
              <Text style={styles.diagnosisValue}>
                {record.diagnosis || "Không ghi nhận chẩn đoán đặc biệt"}
              </Text>
              <Text style={styles.healthStatusText}>
                Trạng thái sức khỏe sau khám:{" "}
                <Text style={{ fontWeight: "700", color: colors.foreground }}>
                  {record.resultingStatus.replaceAll("_", " ")}
                </Text>
              </Text>
              <Text style={styles.dateText}>Thời điểm khám: {formatDateTime(record.examDate)}</Text>
            </View>

            {/* Cost if present */}
            {typeof record.cost === "number" || typeof record.cost === "string" ? (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Chi phí lần khám:</Text>
                <Text style={styles.costValue}>{formatVnd(Number(record.cost))}</Text>
              </View>
            ) : null}

            {/* Void Notice */}
            {record.voidedAt ? (
              <View style={styles.voidNoticeBox}>
                <Ionicons name="warning" size={16} color={colors.destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.voidNoticeTitle}>Lần khám này đã bị hủy</Text>
                  <Text style={styles.voidNoticeText}>
                    Hủy ngày {formatDateTime(record.voidedAt)} · Lý do: {record.voidReason}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Link to Case */}
            {record.caseId ? (
              <SecondaryButton
                label="Xem bệnh án điều trị liên quan"
                icon="folder-open-outline"
                onPress={() => router.push(`/${role}/medical/cases/${record.caseId}` as Href)}
              />
            ) : null}
          </View>

          {/* Care Instructions */}
          {record.careInstructions ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="reader-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionTitleText}>Hướng dẫn chăm sóc & điều trị</Text>
              </View>
              <Text style={styles.bodyText}>{record.careInstructions}</Text>
            </View>
          ) : null}

          {/* Prescriptions */}
          <View style={uiStyles.section}>
            <SectionTitle>Đơn thuốc chỉ định ({record.prescriptions.length})</SectionTitle>
            {record.prescriptions.map((p) => (
              <View key={p.id} style={styles.prescriptionCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={styles.medicineIcon}>
                    <Ionicons name="flask-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medicineName}>{p.medicine}</Text>
                    {p.dosage ? (
                      <Text style={styles.dosageText}>
                        Liều lượng: {p.dosage} · Tần suất: {p.frequency}
                      </Text>
                    ) : (
                      <Text style={uiStyles.muted}>Chi tiết liều lượng được giới hạn.</Text>
                    )}
                  </View>
                </View>
                <View style={styles.prescriptionDateRow}>
                  <Text style={styles.prescriptionDateText}>
                    Thời gian dùng: {formatDate(p.startDate)}
                    {p.endDate ? ` – ${formatDate(p.endDate)}` : " · Đang điều trị"}
                  </Text>
                </View>
              </View>
            ))}
            {!record.prescriptions.length ? (
              <Text style={uiStyles.muted}>Không có đơn thuốc nào trong lần khám này.</Text>
            ) : null}
          </View>

          {/* Injuries */}
          <View style={uiStyles.section}>
            <SectionTitle>Ghi nhận chấn thương ({record.injuries.length})</SectionTitle>
            {record.injuries.map((inj) => (
              <View key={inj.id} style={styles.injuryCard}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={styles.injuryTitle}>
                    {inj.bodyRegion.replaceAll("_", " ")} · {inj.injuryType.replaceAll("_", " ")}
                  </Text>
                  <View style={styles.recoveryBadge}>
                    <Text style={styles.recoveryBadgeText}>
                      {inj.recoveryStatus.replaceAll("_", " ")}
                    </Text>
                  </View>
                </View>
                {inj.notes ? <Text style={styles.injuryNotes}>{inj.notes}</Text> : null}
              </View>
            ))}
            {!record.injuries.length ? (
              <Text style={uiStyles.muted}>Không có dấu vết chấn thương trong lần khám này.</Text>
            ) : null}
          </View>

          {/* 3D Injury Model */}
          {record.injuries.length ? (
            <Injury3DMapper
              horseId={record.horseId}
              existingInjuries={record.injuries.map((inj) => ({
                id: inj.injuryId,
                horseId: record.horseId,
                bodyRegion: inj.bodyRegion,
                injuryType: inj.injuryType,
                position: inj.position,
                firstMedicalRecordId: record.id,
                firstExamDate: record.examDate,
                currentRecoveryStatus: inj.recoveryStatus,
                history: [
                  {
                    medicalRecordId: record.id,
                    examDate: record.examDate,
                    caseId: record.caseId,
                    recoveryStatus: inj.recoveryStatus,
                    notes: inj.notes,
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

          {/* Void Visit Section */}
          {canAdjustCost ? (
            <View style={uiStyles.section}>
              <SectionTitle>Điều chỉnh chi phí buổi khám</SectionTitle>
              <Field label="Chi phí mới · VND">
                <NativeInput value={adjustCost} onChangeText={setAdjustCost} keyboardType="number-pad" />
              </Field>
              <Field label="Lý do điều chỉnh · bắt buộc">
                <NativeInput value={adjustReason} onChangeText={setAdjustReason} multiline maxLength={500} />
              </Field>
              <PrimaryButton
                label={saving ? "Đang lưu…" : "Lưu chi phí"}
                disabled={saving || !adjustCost.trim() || !adjustReason.trim()}
                onPress={() => void submitCostAdjustment()}
              />
            </View>
          ) : null}

          {canEditClinicalRecord ? (
            <View style={uiStyles.section}>
              <SecondaryButton
                label="Sửa buổi khám"
                icon="create-outline"
                onPress={() => router.push(`/${role}/medical/visits/edit/${record.id}` as Href)}
              />
              {replacementRequestIds.length ? (
                <PrimaryButton
                  label="Ghi buổi khám thay thế"
                  icon="medkit-outline"
                  onPress={openReplacementVisit}
                />
              ) : null}
            </View>
          ) : null}

          {canEditClinicalRecord ? (
            <View style={uiStyles.section}>
              <SectionTitle>Hủy lần khám y tế</SectionTitle>
              <View style={styles.voidBox}>
                <Field label="Lý do hủy (bắt buộc) *">
                  <NativeInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Nhập lý do hủy bỏ kết quả lần khám này"
                    multiline
                  />
                </Field>
                <PrimaryButton
                  label={saving ? "Đang hủy…" : "Xác nhận hủy lần khám"}
                  icon="close-circle-outline"
                  disabled={saving || !reason.trim()}
                  onPress={voidVisit}
                />
              </View>
            </View>
          ) : null}
          {record.voidedAt ? (
            <PrimaryButton label="Ghi buổi khám thay thế" onPress={openReplacementVisit} />
          ) : null}

          <View style={[uiStyles.section, { marginTop: space.sm, gap: space.sm, paddingBottom: space.lg }]}>
            {record.caseId ? (
              <SecondaryButton
                label="Xem hồ sơ bệnh án"
                icon="folder-open-outline"
                onPress={() => router.push(`/${role}/medical/cases/${record.caseId}` as Href)}
              />
            ) : null}
            <SecondaryButton
              label={record.caseId ? "Quay lại hồ sơ bệnh án" : "Quay lại danh sách khám"}
              icon="arrow-back"
              onPress={() => {
                if (record.caseId) {
                  safeBack(`/${role}/medical/cases/${record.caseId}`);
                } else {
                  safeBack(`/${role}/medical/requests`);
                }
              }}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    overviewCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
      marginBottom: space.sm,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    kindBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    kindBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    conclusionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
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
    diagnosisSection: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: 3,
    },
    diagnosisLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    diagnosisValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    healthStatusText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    dateText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    costRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    costLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    costValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    voidNoticeBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: colors.injuredSoft,
      padding: space.sm,
      borderRadius: radius.sm,
    },
    voidNoticeTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.destructive,
    },
    voidNoticeText: {
      fontSize: 11,
      color: colors.foreground,
      marginTop: 1,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.xs,
      marginBottom: space.sm,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    sectionTitleText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    bodyText: {
      fontSize: 13,
      color: colors.foreground,
      lineHeight: 18,
    },
    prescriptionCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: 6,
      marginBottom: space.xs,
    },
    medicineIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    medicineName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    dosageText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    prescriptionDateRow: {
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    prescriptionDateText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    injuryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: 4,
      marginBottom: space.xs,
    },
    injuryTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    recoveryBadge: {
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    recoveryBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    injuryNotes: {
      fontSize: 12,
      color: colors.foreground,
    },
    voidBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.md,
    },
  });
}
