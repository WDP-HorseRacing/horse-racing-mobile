import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { SectionTitle } from "@/components/common";
import {
  Chips,
  Field,
  MiniChart,
  NativeInput,
  Panel,
  PrimaryButton,
  ProgressBar,
  getUiStyles,
} from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { formatEnum } from "@/utils/formatters";
import { extractErrorMessage } from "@/utils/errorHandler";
import { isValidRequiredText } from "@/features/medical/medical-validation";
import { medicalService, type HealthStatusDto } from "@/services/medical.service";
import { fitnessTrend, recoveryTrend, type RoleId } from "@/lib/raceos-data";
import { HorseMeasurementsView } from "@/features/horses/components/HorseMeasurementsView";
import { ChartSection, Info } from "./HorseTabHelpers";

export type HorseMedicalTabProps = {
  tab: string;
  horseId: string;
  roleId: RoleId;
  isRealData: boolean;
  horseData: any;
  mockHorse: any;
  locked: boolean;
  plan: any;
  nextSession: any;
  token: string | null;
  medicalResource: {
    isLoading: boolean;
    error: unknown;
    data: any;
    retry: () => void | Promise<unknown>;
    refresh: () => Promise<unknown>;
  };
  careResource: {
    isLoading: boolean;
    error: unknown;
    data: Awaited<ReturnType<typeof medicalService.getCareInstructions>> | null;
    retry: () => void | Promise<unknown>;
  };
  permissionsResource: {
    data?: {
      canChangeHealth?: boolean;
      canRecordMeasurement?: boolean;
      canDeleteMeasurement?: boolean;
    } | null;
  };
  onHorseRefresh: () => Promise<unknown>;
};

export function HorseMedicalTab({
  tab,
  horseId,
  roleId,
  isRealData,
  horseData,
  mockHorse,
  locked,
  plan,
  nextSession,
  token,
  medicalResource,
  careResource,
  permissionsResource,
  onHorseRefresh,
}: HorseMedicalTabProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);

  const [healthStatusDraft, setHealthStatusDraft] = useState("");
  const [healthReason, setHealthReason] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);

  const saveHealthStatus = async () => {
    if (
      !token ||
      !horseData ||
      !healthStatusDraft ||
      !isValidRequiredText(healthReason, 500) ||
      savingHealth
    )
      return;
    setSavingHealth(true);
    try {
      await medicalService.updateHealthStatus(token, horseData.id, {
        healthStatus: healthStatusDraft as HealthStatusDto,
        reason: healthReason.trim(),
      });
      setHealthStatusDraft("");
      setHealthReason("");
      await Promise.all([onHorseRefresh(), medicalResource.refresh()]);
      Alert.alert("Health status updated", "Lịch sử trạng thái sức khỏe đã được làm mới.");
    } catch (error) {
      Alert.alert("Could not update health status", extractErrorMessage(error));
    } finally {
      setSavingHealth(false);
    }
  };

  if (!isRealData) {
    if (tab === "Care") {
      return (
        <>
          <Info
            title="Current care plan"
            items={[
              ["Plan objective", plan?.objective ?? "No active care plan"],
              ["Next care task", nextSession?.title ?? "Not scheduled"],
              ["Assigned groom", nextSession?.assignedGroom ?? "—"],
            ]}
          />
          <ChartSection
            title="Care trend"
            data={fitnessTrend}
            valueKey="load"
            color={colors.training}
          />
        </>
      );
    }

    if (["Health", "Medical", "Injuries", "Treatment"].includes(tab)) {
      return (
        <>
          <Info
            title="Vitals & status"
            items={[
              ["Status", locked ? "LOCKED" : mockHorse.status],
              ["Temperature", "38.2 °C"],
              ["Resting HR", `${mockHorse.hr} bpm`],
              ["Respiration", "16 /min"],
              ["Weight", `${mockHorse.weight} kg`],
              ["Hydration", "Normal"],
            ]}
          />
          <View style={uiStyles.section}>
            <SectionTitle>Recovery</SectionTitle>
            <Panel>
              <View style={uiStyles.row}>
                <Text style={uiStyles.value}>Left hind leg · monitoring</Text>
                <Text style={uiStyles.value}>{mockHorse.recovery ?? 100}%</Text>
              </View>
              <View style={{ height: space.md }} />
              <ProgressBar value={mockHorse.recovery ?? 100} tone={colors.monitor} />
              <MiniChart data={recoveryTrend} valueKey="v" color={colors.monitor} />
            </Panel>
          </View>
          {roleId === "vet" ? (
            <>
              <PrimaryButton
                label="Record examination"
                onPress={() => router.push(`/vet/medical/visit?horseId=${mockHorse.id}` as Href)}
              />
              <PrimaryButton
                label="Open injury mapping"
                onPress={() => router.push(`/vet/injury/${mockHorse.id}`)}
              />
              <PrimaryButton
                label="Lock training"
                icon="lock-closed"
                onPress={() => router.push(`/vet/lock/${mockHorse.id}`)}
              />
            </>
          ) : null}
        </>
      );
    }

    return null;
  }

  // Real data views
  if (tab === "Care") {
    return (
      <>
        <AsyncStateView
          isLoading={careResource.isLoading}
          error={careResource.error}
          onRetry={() => void careResource.retry()}
        />
        {careResource.data ? (
          <Info
            title="Current care instructions"
            items={[
              [
                "Instructions",
                careResource.data.current?.careInstructions ?? "No active care instructions",
              ],
              [
                "Last examined",
                careResource.data.current
                  ? new Date(careResource.data.current.examDate).toLocaleString()
                  : "—",
              ],
            ]}
          />
        ) : null}
        <PrimaryButton
          label="View care schedules"
          icon="calendar-outline"
          onPress={() =>
            router.push(`/${roleId}/medical/care?horseId=${horseData.id}` as Href)
          }
        />
      </>
    );
  }

  if (tab === "Health") {
    return (
      <>
        <Info
          title="Tình trạng sức khỏe & Tập luyện"
          items={[
            ["Trạng thái sức khỏe", formatEnum(horseData.healthStatus)],
            [
              "Điều kiện tập luyện",
              horseData.eligibility.trainingEligible
                ? "Đủ điều kiện"
                : horseData.eligibility.trainingReasons
                    .map((reason: string) => formatEnum(t(reason)))
                    .join(", ") || "Hạn chế",
            ],
          ]}
        />
        <HorseMeasurementsView
          horseId={horseId}
          roleId={roleId}
          canRecord={permissionsResource.data?.canRecordMeasurement}
          canDelete={permissionsResource.data?.canDeleteMeasurement}
          onUpdated={() => {
            void onHorseRefresh();
          }}
        />
      </>
    );
  }

  if (tab === "Medical") {
    return (
      <>
        <AsyncStateView
          isLoading={medicalResource.isLoading}
          error={medicalResource.error}
          onRetry={() => void medicalResource.retry()}
        />

        {/* Action Header: Yêu cầu khám thú y (Trainer, Groom, Manager) */}
        {["trainer", "groom", "manager"].includes(roleId) && !horseData.isDeleted ? (
          <PrimaryButton
            label="Yêu cầu khám thú y"
            icon="medkit-outline"
            onPress={() =>
              router.push(`/${roleId}/medical/requests?horseId=${horseData.id}` as Href)
            }
          />
        ) : null}

        {/* Vet Action Bar */}
        {roleId === "vet" ? (
          <View style={{ gap: space.sm }}>
            <PrimaryButton
              label="Ghi nhận lần khám bệnh mới"
              icon="medkit-outline"
              onPress={() => router.push(`/vet/medical/visit?horseId=${horseData.id}` as Href)}
            />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/vet/lock/${horseData.id}` as Href)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={horseData.activeTrainingLock ? colors.destructive : colors.foreground}
                />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                  {horseData.activeTrainingLock ? "Quản lý khóa tập" : "Khóa tập luyện"}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/vet/medical/care?horseId=${horseData.id}` as Href)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                  Lịch chăm sóc
                </Text>
              </Pressable>
            </View>

            {permissionsResource.data?.canChangeHealth ? (
              <Panel style={{ gap: space.sm, marginTop: 4 }}>
                <SectionTitle>Cập nhật trạng thái sức khỏe</SectionTitle>
                <Chips
                  options={["ELIGIBLE", "UNDER_OBSERVATION", "INJURED", "QUARANTINED"]}
                  value={healthStatusDraft || horseData.healthStatus}
                  onChange={setHealthStatusDraft}
                />
                {healthStatusDraft && healthStatusDraft !== horseData.healthStatus ? (
                  <>
                    <Field label="Lý do thay đổi trạng thái">
                      <NativeInput
                        value={healthReason}
                        onChangeText={setHealthReason}
                        multiline
                        placeholder="Nêu rõ lý do lâm sàng hoặc tình trạng chấn thương..."
                      />
                    </Field>
                    <PrimaryButton
                      style={{ marginTop: space.xs }}
                      label={savingHealth ? "Đang lưu…" : "Lưu trạng thái sức khỏe"}
                      disabled={savingHealth || !isValidRequiredText(healthReason, 500)}
                      onPress={() => void saveHealthStatus()}
                    />
                  </>
                ) : null}
              </Panel>
            ) : null}
          </View>
        ) : null}

        {medicalResource.data ? (
          <View style={{ gap: space.md, marginTop: space.xs }}>
            {/* SECTION: Bệnh án điều trị (Medical Cases) */}
            <View style={uiStyles.section}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <SectionTitle>Bệnh án điều trị</SectionTitle>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {medicalResource.data.cases.items.length} ca bệnh
                </Text>
              </View>

              {medicalResource.data.cases.items.length ? (
                medicalResource.data.cases.items.map((medicalCase: any) => {
                  const isOpen = medicalCase.status === "OPEN";
                  return (
                    <Pressable
                      key={medicalCase.id}
                      onPress={() =>
                        router.push(`/${roleId}/medical/cases/${medicalCase.id}` as Href)
                      }
                    >
                      <Panel style={{ gap: space.xs, padding: space.md }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                backgroundColor: isOpen ? "rgba(239, 68, 68, 0.12)" : colors.surface,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons
                                name={isOpen ? "fitness" : "checkmark-done-circle"}
                                size={18}
                                color={isOpen ? colors.destructive : colors.fit}
                              />
                            </View>
                            <Text style={[uiStyles.value, { fontSize: 15, fontWeight: "700" }]} numberOfLines={1}>
                              {medicalCase.initialDiagnosis}
                            </Text>
                          </View>

                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: radius.pill,
                              backgroundColor: isOpen ? "rgba(239, 68, 68, 0.12)" : colors.elevated,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: isOpen ? colors.destructive : colors.mutedForeground,
                              }}
                            >
                              {isOpen ? "ĐANG ĐIỀU TRỊ" : "ĐÃ ĐÓNG"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                          <Text style={uiStyles.muted}>
                            Mở: {new Date(medicalCase.openedAt).toLocaleDateString()}
                            {medicalCase.closedAt
                              ? ` · Đóng: ${new Date(medicalCase.closedAt).toLocaleDateString()}`
                              : ""}
                          </Text>
                        </View>

                        {medicalCase.finalConclusion ? (
                          <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 2 }}>
                            Kết luận: {medicalCase.finalConclusion}
                          </Text>
                        ) : null}

                        {"totalCost" in medicalCase && medicalCase.totalCost != null ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                            <Ionicons name="cash-outline" size={13} color={colors.primary} />
                            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                              Chi phí: {medicalCase.totalCost.toLocaleString("vi-VN")} VND
                            </Text>
                          </View>
                        ) : null}
                      </Panel>
                    </Pressable>
                  );
                })
              ) : (
                <AsyncStateView
                  isLoading={false}
                  error={null}
                  onRetry={() => void medicalResource.retry()}
                  empty
                  emptyLabel="Chưa có bệnh án y tế nào được ghi nhận."
                />
              )}
            </View>

            {/* SECTION: Lịch sử các lần khám (Medical Visits) */}
            <View style={uiStyles.section}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <SectionTitle>Lịch sử các lần khám</SectionTitle>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {medicalResource.data.records.length} lần khám
                </Text>
              </View>

              {medicalResource.data.records.length ? (
                medicalResource.data.records.slice(0, 12).map((record: any) => {
                  const isIssue = record.conclusion === "ISSUE";
                  return (
                    <Pressable
                      key={record.id}
                      onPress={() => router.push(`/${roleId}/medical/visits/${record.id}` as Href)}
                    >
                      <Panel style={{ gap: space.xs, padding: space.md }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                backgroundColor: isIssue ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons
                                name={isIssue ? "warning-outline" : "medkit-outline"}
                                size={18}
                                color={isIssue ? colors.destructive : colors.primary}
                              />
                            </View>
                            <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "700" }]} numberOfLines={1}>
                              {record.conclusion === "ISSUE"
                                ? (record.diagnosis || "Phát hiện vấn đề sức khỏe")
                                : (record.diagnosis || record.kind?.replaceAll("_", " ") || "Khám định kỳ bình thường")}
                            </Text>
                          </View>

                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: radius.pill,
                              backgroundColor: isIssue ? "rgba(239, 68, 68, 0.12)" : colors.fitSoft,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: isIssue ? colors.destructive : colors.fit,
                              }}
                            >
                              {record.resultingStatus || (isIssue ? "Cần theo dõi" : "Bình thường")}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                          <Text style={uiStyles.muted}>
                            {new Date(record.examDate).toLocaleString()}
                            {record.voidedAt ? ` · Đã hủy: ${record.voidReason ?? ""}` : ""}
                          </Text>
                        </View>

                        {/* Prescriptions preview */}
                        {record.prescriptions && record.prescriptions.length > 0 ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              backgroundColor: colors.surface,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: radius.sm,
                              borderWidth: 1,
                              borderColor: colors.border,
                              marginTop: 4,
                            }}
                          >
                            <Ionicons name="medical-outline" size={13} color={colors.primary} />
                            <Text style={{ fontSize: 12, color: colors.foreground, flex: 1 }} numberOfLines={1}>
                              <Text style={{ fontWeight: "700" }}>Đơn thuốc ({record.prescriptions.length}): </Text>
                              {record.prescriptions.map((p: any) => p.medicine).join(", ")}
                            </Text>
                          </View>
                        ) : null}

                        {record.careInstructions ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <Ionicons name="clipboard-outline" size={12} color={colors.mutedForeground} />
                            <Text style={[uiStyles.muted, { fontSize: 12 }]} numberOfLines={2}>
                              {record.careInstructions}
                            </Text>
                          </View>
                        ) : null}
                      </Panel>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={uiStyles.muted}>Chưa có lần khám thú y nào được ghi nhận.</Text>
              )}
            </View>

            {/* SECTION: Lịch chăm sóc & điều trị */}
            <View style={uiStyles.section}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <SectionTitle>Lịch trình chăm sóc y tế</SectionTitle>
                <Pressable
                  onPress={() => router.push(`/${roleId}/medical/care?horseId=${horseData.id}` as Href)}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                    Mở chi tiết →
                  </Text>
                </Pressable>
              </View>

              {(medicalResource.data.careSchedules ?? []).length ? (
                (medicalResource.data.careSchedules ?? []).map((schedule: any) => (
                  <Panel key={schedule.id} style={{ gap: space.xs, padding: space.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "700", flex: 1 }]} numberOfLines={1}>
                        {schedule.type.replaceAll("_", " ")}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                          backgroundColor:
                            schedule.status === "COMPLETED"
                              ? colors.fitSoft
                              : schedule.status === "CANCELLED"
                                ? colors.elevated
                                : "rgba(245, 158, 11, 0.12)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color:
                              schedule.status === "COMPLETED"
                                ? colors.fit
                                : schedule.status === "CANCELLED"
                                  ? colors.mutedForeground
                                  : "#F59E0B",
                          }}
                        >
                          {schedule.status.replaceAll("_", " ")}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                      <Text style={uiStyles.muted}>
                        Đến hạn: {new Date(schedule.dueAt).toLocaleString()}
                        {schedule.completedAt ? ` · Xong: ${new Date(schedule.completedAt).toLocaleDateString()}` : ""}
                      </Text>
                    </View>
                    {schedule.notes ? <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{schedule.notes}</Text> : null}
                  </Panel>
                ))
              ) : (
                <Text style={uiStyles.muted}>Chưa có lịch trình chăm sóc nào.</Text>
              )}
            </View>

            {/* SECTION: Lịch sử thay đổi trạng thái sức khỏe */}
            <View style={uiStyles.section}>
              <SectionTitle>Lịch sử trạng thái sức khỏe</SectionTitle>
              {medicalResource.data.healthHistory.length ? (
                medicalResource.data.healthHistory.map((item: any, index: number) => (
                  <Panel key={`${item.changedAt}-${index}`} style={{ gap: space.xs, padding: space.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: radius.pill,
                          backgroundColor: colors.elevated,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
                          {item.from ?? "Khởi tạo"} → {item.to}
                        </Text>
                      </View>
                      <Text style={[uiStyles.muted, { fontSize: 11 }]}>
                        {new Date(item.changedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {item.reason ? (
                      <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 2 }}>
                        Lý do: {item.reason}
                      </Text>
                    ) : null}
                  </Panel>
                ))
              ) : (
                <Text style={uiStyles.muted}>Chưa có ghi nhận thay đổi trạng thái sức khỏe.</Text>
              )}
            </View>
          </View>
        ) : null}
      </>
    );
  }

  if (tab === "Treatment") {
    return (
      <>
        <AsyncStateView
          isLoading={medicalResource.isLoading}
          error={medicalResource.error}
          onRetry={() => void medicalResource.retry()}
        />
        <View style={uiStyles.section}>
          <SectionTitle>Training restrictions</SectionTitle>
          {medicalResource.data?.locks.length ? (
            medicalResource.data.locks.map((lock: any) => (
              <Panel key={lock.id}>
                <Text style={uiStyles.value}>{lock.status.replaceAll("_", " ")}</Text>
                <Text>{lock.reason}</Text>
                <Text style={uiStyles.muted}>Locked by staff {lock.lockedBy.slice(0, 8)}</Text>
                <Text style={uiStyles.muted}>
                  Start {new Date(lock.lockStart).toLocaleDateString()}
                  {lock.lockEnd
                    ? ` · expected end ${new Date(lock.lockEnd).toLocaleDateString()}`
                    : ""}
                </Text>
                {lock.releasedAt ? (
                  <Text style={uiStyles.muted}>
                    Released {new Date(lock.releasedAt).toLocaleString()}
                    {lock.releasedBy ? ` · staff ${lock.releasedBy.slice(0, 8)}` : ""}
                  </Text>
                ) : null}
                {lock.releaseConclusion ? <Text>{lock.releaseConclusion}</Text> : null}
              </Panel>
            ))
          ) : medicalResource.data ? (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void medicalResource.retry()}
              empty
              emptyLabel="No veterinary training locks are recorded."
            />
          ) : null}
        </View>
        {medicalResource.data?.cases.items.map((medicalCase: any) => (
          <Pressable
            key={medicalCase.id}
            onPress={() => router.push(`/${roleId}/medical/cases/${medicalCase.id}` as Href)}
          >
            <Panel>
              <Text style={uiStyles.value}>{medicalCase.initialDiagnosis}</Text>
              <Text style={uiStyles.muted}>
                {medicalCase.status} · {medicalCase.finalConclusion ?? "Treatment ongoing"}
              </Text>
            </Panel>
          </Pressable>
        ))}
      </>
    );
  }

  return null;
}
