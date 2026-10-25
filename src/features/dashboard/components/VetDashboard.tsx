import { router, type Href } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle, TimelineItem } from "@/components/common";
import { Metric, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import type { MedicalDashboardDto } from "@/adapters/medical.adapter";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import type { SupplyItemDto } from "@/adapters/supplies.adapter";
import type { NotificationDto } from "@/adapters/notifications.adapter";
import type { TrainingSessionDto } from "@/services/training.service";
import { formatDate, formatDateTime, formatQuantity } from "@/utils/formatters";

export interface VetDashboardData {
  dashboard: MedicalDashboardDto;
  horses?: HorseListItemDto[];
  checkups?: MedicalDashboardDto["checkups"];
  supplies?: SupplyItemDto[];
  notifications?: NotificationDto[];
  activeSessions?: TrainingSessionDto[];
}

function HealthStatusBadge({
  status,
}: {
  status: "ELIGIBLE" | "UNDER_OBSERVATION" | "INJURED" | "QUARANTINED" | string;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const config = useMemo(() => {
    switch (status) {
      case "INJURED":
        return {
          bg: colors.injuredSoft,
          color: colors.destructive,
          label: t("Injured"),
        };
      case "QUARANTINED":
        return {
          bg: colors.raceReadySoft,
          color: colors.raceReady,
          label: t("Quarantined"),
        };
      case "UNDER_OBSERVATION":
        return {
          bg: colors.monitorSoft,
          color: colors.monitor,
          label: t("Under observation"),
        };
      case "ELIGIBLE":
        return {
          bg: colors.fitSoft,
          color: colors.primary,
          label: t("Eligible"),
        };
      default:
        return {
          bg: colors.muted,
          color: colors.foreground,
          label: status.replaceAll("_", " "),
        };
    }
  }, [colors, status, t]);

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: config.bg,
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: config.color,
          letterSpacing: 0.3,
        }}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </View>
  );
}

export function VetDashboard({
  data,
}: {
  data: VetDashboardData;
  token: string;
  onRefresh: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const {
    dashboard,
    horses = [],
    checkups = dashboard.checkups,
    supplies = [],
    notifications = [],
    activeSessions = [],
  } = data;

  const performanceNotifications = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.category === "PERFORMANCE_ALERT" ||
          n.resource?.type?.toLowerCase() === "session_participant",
      ),
    [notifications],
  );

  const ongoingSessions = useMemo(
    () => activeSessions.filter((s) => s.status === "IN_PROGRESS"),
    [activeSessions],
  );

  // 1. Critical & Monitored Horses
  const criticalHorses = useMemo(() => {
    if (horses.length) {
      return horses.filter((h) => h.healthStatus === "INJURED" || h.healthStatus === "QUARANTINED");
    }
    return dashboard.herd.horses.filter(
      (h) => h.healthStatus === "INJURED" || h.healthStatus === "QUARANTINED",
    );
  }, [dashboard.herd.horses, horses]);

  const monitoringCount = useMemo(() => {
    if (horses.length) {
      return horses.filter((h) => h.healthStatus === "UNDER_OBSERVATION").length;
    }
    return dashboard.herd.counts.UNDER_OBSERVATION ?? 0;
  }, [dashboard.herd.counts.UNDER_OBSERVATION, horses]);

  const urgentRequests = useMemo(
    () => dashboard.pendingRequests.filter((r) => r.urgent),
    [dashboard.pendingRequests],
  );

  const overdueCheckups = useMemo(() => checkups.filter((c) => c.daysLeft < 0), [checkups]);

  const lowStockSupplies = useMemo(
    () =>
      supplies.filter(
        (s) => s.lowStock || (s.reorderThreshold > 0 && s.quantityOnHand <= s.reorderThreshold),
      ),
    [supplies],
  );

  return (
    <>
      {/* Top Clinical Metrics Grid */}
      <View style={uiStyles.metricGrid}>
        <Metric
          label="Critical attention"
          value={criticalHorses.length + urgentRequests.length}
          hint="urgent care required"
          tone={criticalHorses.length + urgentRequests.length > 0 ? "danger" : "good"}
        />
        <Metric
          label="Monitoring"
          value={monitoringCount}
          hint="daily observations"
          tone={monitoringCount > 0 ? "warning" : "default"}
        />
        <Metric
          label="Pending requests"
          value={dashboard.pendingRequests.length}
          hint="awaiting triage"
          tone={
            urgentRequests.length > 0
              ? "danger"
              : dashboard.pendingRequests.length > 0
                ? "warning"
                : "default"
          }
        />
        <Metric
          label="Checkups due"
          value={checkups.length}
          hint={overdueCheckups.length > 0 ? `${overdueCheckups.length} overdue` : "next 7 days"}
          tone={overdueCheckups.length > 0 ? "danger" : "default"}
        />
      </View>

      {/* Active Training Telemetry & Performance Alerts (Flow 2 / F8-F9) */}
      {performanceNotifications.length > 0 || ongoingSessions.length > 0 ? (
        <View style={uiStyles.section}>
          <SectionTitle
            action={
              <Pressable onPress={() => router.push("/vet/alerts" as Href)}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                  {t("All alerts")}
                </Text>
              </Pressable>
            }
          >
            {t("Live training telemetry & alerts")}
          </SectionTitle>

          {performanceNotifications.slice(0, 2).map((notif) => (
            <Panel
              key={notif.id}
              style={{
                borderColor: colors.destructive,
                backgroundColor: colors.injuredSoft,
                gap: 6,
              }}
            >
              <View style={uiStyles.row}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <Ionicons name="warning" size={18} color={colors.destructive} />
                  <Text
                    style={{ ...uiStyles.label, color: colors.destructive, fontWeight: "700" }}
                    numberOfLines={1}
                  >
                    {notif.title}
                  </Text>
                </View>
                <Text style={uiStyles.muted}>{formatDateTime(notif.createdAt)}</Text>
              </View>
              <Text style={{ ...uiStyles.muted, color: colors.foreground }}>{notif.message}</Text>
              <View style={[uiStyles.row, { marginTop: 4 }]}>
                {notif.resource?.horseId ? (
                  <Pressable
                    onPress={() => router.push(`/vet/horse/${notif.resource!.horseId}` as Href)}
                  >
                    <Text style={{ ...uiStyles.label, color: colors.primary }}>
                      {t("View horse profile")}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => router.push("/vet/alerts" as Href)}>
                  <Text style={{ ...uiStyles.label, color: colors.destructive, fontWeight: "700" }}>
                    Theo dõi cảnh báo (Live) →
                  </Text>
                </Pressable>
              </View>
            </Panel>
          ))}

          {ongoingSessions.map((session) => (
            <Panel key={session.id} style={{ gap: 8 }}>
              <View style={uiStyles.row}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.destructive,
                    }}
                  />
                  <Text style={[uiStyles.value, { fontSize: 15 }]} numberOfLines={1}>
                    {session.name}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    backgroundColor: colors.fitSoft,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                    ĐANG DIỄN RA
                  </Text>
                </View>
              </View>
              <Text style={uiStyles.muted}>
                {formatDate(session.scheduledStartAt)} · {session.sessionType.replaceAll("_", " ")}
              </Text>
              <PrimaryButton
                label="Theo dõi lượt tập (Live)"
                icon="pulse"
                onPress={() =>
                  router.push(`/trainer/plan/${session.classId}/session/${session.id}` as Href)
                }
              />
            </Panel>
          ))}
        </View>
      ) : null}

      {/* Immediate Clinical Attention Queue (Urgent/Injured/Quarantined) */}
      {criticalHorses.length > 0 || urgentRequests.length > 0 ? (
        <View style={uiStyles.section}>
          <SectionTitle>{t("Immediate clinical attention")}</SectionTitle>

          <View style={styles.alertBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.destructive} />
            <Text style={styles.alertBannerText}>
              {criticalHorses.length} {t("horses need urgent medical evaluation or isolation.")}
            </Text>
          </View>

          {criticalHorses.slice(0, 4).map((horse) => {
            const horseId = "id" in horse ? horse.id : horse.horseId;
            const horseName = "name" in horse ? horse.name : horse.horseName;
            const barnName = "location" in horse ? horse.location.barn?.name : undefined;
            const stallCode =
              "location" in horse
                ? horse.location.stall?.code
                : "stallCode" in horse
                  ? horse.stallCode
                  : undefined;

            const activeCase = dashboard.openCases.find((c) => c.horseId === horseId);

            return (
              <Panel key={horseId} style={styles.criticalCard}>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[uiStyles.value, { fontSize: 16 }]} numberOfLines={1}>
                      {horseName}
                    </Text>
                    <Text style={uiStyles.muted} numberOfLines={1}>
                      {[barnName, stallCode ? `Stall ${stallCode}` : null]
                        .filter(Boolean)
                        .join(" · ") || t("No stall assigned")}
                    </Text>
                  </View>
                  <HealthStatusBadge status={horse.healthStatus} />
                </View>

                {activeCase ? (
                  <View style={styles.caseBadgeRow}>
                    <Ionicons name="folder-open-outline" size={14} color={colors.primary} />
                    <Text style={styles.caseBadgeText} numberOfLines={1}>
                      {t("Case:")} {activeCase.initialDiagnosis}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.cardActionRow}>
                  {activeCase ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(
                            `/vet/medical/visit?horseId=${horseId}&caseId=${activeCase.caseId}` as Href,
                          )
                        }
                        style={styles.primaryActionBtn}
                      >
                        <Ionicons name="medkit" size={15} color="#FFFFFF" />
                        <Text style={styles.primaryActionBtnText}>{t("Ghi tái khám")}</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push(`/vet/medical/cases/${activeCase.caseId}` as Href)}
                        style={styles.secondaryActionBtn}
                      >
                        <Text style={styles.secondaryActionBtnText}>{t("View case")}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(`/vet/medical/visit?horseId=${horseId}&kind=REQUEST` as Href)
                        }
                        style={styles.primaryActionBtn}
                      >
                        <Ionicons name="medkit" size={15} color="#FFFFFF" />
                        <Text style={styles.primaryActionBtnText}>{t("Record exam")}</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push(`/vet/horse/${horseId}` as Href)}
                        style={styles.secondaryActionBtn}
                      >
                        <Text style={styles.secondaryActionBtnText}>{t("Profile")}</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </Panel>
            );
          })}
        </View>
      ) : null}

      {/* Pending Examination Requests */}
      <View style={uiStyles.section}>
        <SectionTitle
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/vet/medical/requests" as Href)}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                {t("View all")} ({dashboard.pendingRequests.length})
              </Text>
            </Pressable>
          }
        >
          {t("Pending examination requests")}
        </SectionTitle>

        {dashboard.pendingRequests.slice(0, 3).map((request) => (
          <Panel key={request.id}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {request.urgent ? (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>{t("URGENT")}</Text>
                    </View>
                  ) : null}
                  <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                    {request.horseName}
                  </Text>
                </View>
                <Text style={uiStyles.muted} numberOfLines={2}>
                  {request.description}
                </Text>
                <Text style={[uiStyles.label, { fontSize: 11 }]}>
                  {formatDateTime(request.createdAt)}
                  {request.requestedBy
                    ? ` · ${t("Requested by")} ${request.requestedBy.slice(0, 8)}`
                    : ""}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: space.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push(
                    `/vet/medical/visit?horseId=${request.horseId}&requestId=${request.id}&kind=REQUEST` as Href,
                  )
                }
                style={styles.primaryActionBtn}
              >
                <Ionicons name="medkit-outline" size={15} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>{t("Start examination")}</Text>
              </Pressable>
            </View>
          </Panel>
        ))}

        {!dashboard.pendingRequests.length ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel={t("No examination requests pending review.")}
          />
        ) : null}
      </View>

      {/* Active Medical Cases Under Treatment */}
      <View style={uiStyles.section}>
        <SectionTitle
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/vet/medical" as Href)}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                {t("View cases")} ({dashboard.openCases.length})
              </Text>
            </Pressable>
          }
        >
          {t("Active treatment cases")}
        </SectionTitle>

        {dashboard.openCases.slice(0, 4).map((item) => (
          <Pressable
            key={item.caseId}
            accessibilityRole="button"
            onPress={() => router.push(`/vet/medical/cases/${item.caseId}` as Href)}
          >
            <Panel>
              <TimelineItem
                time={formatDateTime(item.openedAt)}
                title={`${item.horseName} · ${item.initialDiagnosis}`}
                detail={[
                  item.lastVisitAt ? `${t("Last visit:")} ${formatDate(item.lastVisitAt)}` : null,
                  item.nextVisitAt
                    ? `${t("Follow-up:")} ${formatDateTime(item.nextVisitAt)}`
                    : t("No follow-up scheduled"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                tone={colors.destructive}
                last
              />
            </Panel>
          </Pressable>
        ))}

        {!dashboard.openCases.length ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel={t("No open medical cases at this time.")}
          />
        ) : null}
      </View>

      {/* Horses Needing Case (Injured or Quarantined without open case) */}
      {dashboard.horsesWithoutCase && dashboard.horsesWithoutCase.length > 0 ? (
        <View style={uiStyles.section}>
          <SectionTitle>
            {t("Ngựa cần mở bệnh án")} ({dashboard.horsesWithoutCase.length})
          </SectionTitle>
          <View style={styles.alertBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.destructive} />
            <Text style={styles.alertBannerText}>
              {dashboard.horsesWithoutCase.length}{" "}
              {t("ngựa đang chấn thương hoặc cách ly nhưng chưa có bệnh án điều trị.")}
            </Text>
          </View>
          {dashboard.horsesWithoutCase.slice(0, 4).map((h) => (
            <Panel key={h.horseId} style={styles.criticalCard}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[uiStyles.value, { fontSize: 16 }]} numberOfLines={1}>
                    {h.horseName}
                  </Text>
                  <Text style={uiStyles.muted} numberOfLines={1}>
                    {[h.barnName, h.stallCode ? `Ô ${h.stallCode}` : null]
                      .filter(Boolean)
                      .join(" · ") || t("Chưa xếp ô")}
                    {h.since ? ` · ${t("Từ")} ${formatDate(h.since)}` : ""}
                  </Text>
                </View>
                <HealthStatusBadge status={h.healthStatus} />
              </View>
              <View style={styles.cardActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(`/vet/medical/visit?horseId=${h.horseId}&kind=REQUEST` as Href)
                  }
                  style={styles.primaryActionBtn}
                >
                  <Ionicons name="medkit" size={15} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>{t("Khám & Mở bệnh án")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/vet/horse/${h.horseId}` as Href)}
                  style={styles.secondaryActionBtn}
                >
                  <Text style={styles.secondaryActionBtnText}>{t("Profile")}</Text>
                </Pressable>
              </View>
            </Panel>
          ))}
        </View>
      ) : null}

      {/* Today Prescriptions */}
      {dashboard.todayPrescriptions && dashboard.todayPrescriptions.length > 0 ? (
        <View style={uiStyles.section}>
          <SectionTitle>
            {t("Thuốc cần cho hôm nay")} ({dashboard.todayPrescriptions.length})
          </SectionTitle>
          {dashboard.todayPrescriptions.slice(0, 5).map((p) => (
            <Panel key={p.prescriptionId}>
              <View style={uiStyles.row}>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="bandage-outline" size={16} color={colors.primary} />
                    <Text style={[uiStyles.value, { fontSize: 15 }]} numberOfLines={1}>
                      {p.horseName} · {p.medicine}
                    </Text>
                  </View>
                  <Text style={uiStyles.muted}>
                    {t("Liều lượng")}: {p.dosage} · {t("Tần suất")}: {p.frequency}
                  </Text>
                  <Text style={[uiStyles.label, { fontSize: 11 }]}>
                    {t("Từ")} {formatDate(p.startDate)}
                    {p.endDate ? ` ${t("đến")} ${formatDate(p.endDate)}` : ` (${t("Tới khi đóng bệnh án")})`}
                  </Text>
                </View>
                {p.caseId ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/vet/medical/cases/${p.caseId}` as Href)}
                    style={styles.smallCaseBtn}
                  >
                    <Text style={styles.smallCaseBtnText}>{t("Xem ca")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </Panel>
          ))}
        </View>
      ) : null}

      {/* Upcoming Preventive Checkups (Next 7 Days & Overdue) */}
      <View style={uiStyles.section}>
        <SectionTitle
          action={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/vet/medical/checkups" as Href)}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                {t("Checkups schedule")}
              </Text>
            </Pressable>
          }
        >
          {t("Upcoming preventive checkups")}
        </SectionTitle>

        {checkups.slice(0, 4).map((checkup) => {
          const isOverdue = checkup.daysLeft < 0;
          return (
            <Pressable
              key={checkup.horseId}
              accessibilityRole="button"
              onPress={() => router.push("/vet/medical/checkups" as Href)}
            >
              <Panel>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[uiStyles.value, { fontSize: 15 }]} numberOfLines={1}>
                      {checkup.horseName}
                    </Text>
                    <Text style={uiStyles.muted} numberOfLines={1}>
                      {t("Due:")} {formatDate(checkup.dueDate)} ·{" "}
                      {checkup.appointment
                        ? `${t("Appt:")} ${formatDateTime(checkup.appointment.scheduledAt)}`
                        : t("No appointment booked")}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                      backgroundColor: isOverdue ? colors.injuredSoft : colors.monitorSoft,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isOverdue ? colors.destructive : colors.monitor,
                      }}
                    >
                      {isOverdue
                        ? `${Math.abs(checkup.daysLeft)} ${t("days overdue")}`
                        : checkup.daysLeft === 0
                          ? t("Due today")
                          : `${checkup.daysLeft} ${t("days left")}`}
                    </Text>
                  </View>
                </View>
              </Panel>
            </Pressable>
          );
        })}

        {!checkups.length ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel={t("No checkups scheduled in the next 7 days.")}
          />
        ) : null}
      </View>

      {/* Supplies Alert if Low Stock */}
      {lowStockSupplies.length > 0 ? (
        <View style={uiStyles.section}>
          <SectionTitle>{t("Medical supplies warning")}</SectionTitle>
          <Panel>
            <View style={[uiStyles.row, { alignItems: "center", marginBottom: space.xs }]}>
              <Ionicons name="cube-outline" size={18} color={colors.destructive} />
              <Text style={[uiStyles.value, { flex: 1, color: colors.destructive }]}>
                {lowStockSupplies.length} {t("items below reorder threshold")}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/vet/inventory" as Href)}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>
                  {t("View inventory")}
                </Text>
              </Pressable>
            </View>
            {lowStockSupplies.slice(0, 2).map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 4,
                }}
              >
                <Text style={uiStyles.muted}>{item.name}</Text>
                <Text style={{ fontWeight: "700", color: colors.destructive }}>
                  {formatQuantity(item.quantityOnHand, item.unit)}
                </Text>
              </View>
            ))}
          </Panel>
        </View>
      ) : null}

      {/* Quick Clinical Navigation Action Bar */}
      <View style={{ marginTop: space.md, gap: space.sm }}>
        <PrimaryButton
          label="Open medical workspace"
          icon="medkit-outline"
          onPress={() => router.push("/vet/medical" as Href)}
        />
      </View>
    </>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    alertBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      padding: space.sm,
      backgroundColor: colors.injuredSoft,
      borderRadius: radius.md,
      marginBottom: space.xs,
    },
    alertBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.destructive,
    },
    criticalCard: {
      borderColor: colors.destructive,
      borderLeftWidth: 3,
    },
    caseBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: space.xs,
      paddingVertical: 2,
    },
    caseBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
      flex: 1,
    },
    cardActionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginTop: space.sm,
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    primaryActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: space.xs + 2,
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
    },
    primaryActionBtnText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 13,
    },
    secondaryActionBtn: {
      paddingHorizontal: space.md,
      paddingVertical: space.xs + 2,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryActionBtnText: {
      color: colors.foreground,
      fontWeight: "600",
      fontSize: 13,
    },
    urgentBadge: {
      backgroundColor: colors.destructive,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    urgentBadgeText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    smallCaseBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.sm,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
    smallCaseBtnText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },
  });
}
