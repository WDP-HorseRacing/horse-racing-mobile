import { router, type Href, useLocalSearchParams, Redirect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Metric, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { medicalService, type HealthStatusDto } from "@/services/medical.service";
import { stableService } from "@/services/stable.service";
import type { MedicalDashboardDto } from "@/adapters/medical.adapter";
import { formatDate, formatDateTime } from "@/utils/formatters";
import type { RoleId } from "@/types/raceos";

const HEALTH_OPTIONS: {
  raw: string;
  label: string;
  tone: "fit" | "monitor" | "injured" | "raceReady" | "default";
}[] = [
  { raw: "All health states", label: "Tất cả trạng thái", tone: "default" },
  { raw: "ELIGIBLE", label: "Đủ điều kiện", tone: "fit" },
  { raw: "UNDER_OBSERVATION", label: "Theo dõi", tone: "monitor" },
  { raw: "INJURED", label: "Chấn thương", tone: "injured" },
  { raw: "QUARANTINED", label: "Cách ly", tone: "raceReady" },
];

function HealthBadge({
  label,
  tone,
}: {
  label: string;
  tone: "fit" | "monitor" | "injured" | "raceReady" | "default";
}) {
  const { colors } = useTheme();
  const palette = {
    fit: { bg: colors.fitSoft, color: colors.primary },
    monitor: { bg: colors.monitorSoft, color: colors.monitor },
    injured: { bg: colors.injuredSoft, color: colors.destructive },
    raceReady: { bg: colors.raceReadySoft, color: colors.raceReady },
    default: { bg: colors.muted, color: colors.foreground },
  }[tone];

  return (
    <View
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: palette.bg,
        flexShrink: 0,
      }}
    >
      <Text
        style={{ fontSize: 10, fontWeight: "700", color: palette.color, letterSpacing: 0.2 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export function MedicalWorkspaceScreen({ initialRole }: { initialRole?: RoleId }) {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = initialRole ?? (isRole(roleParam) ? roleParam : null);
  const { token } = useAuth();
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [barnId, setBarnId] = useState("");
  const [health, setHealth] = useState("All health states");
  const [barnPickerOpen, setBarnPickerOpen] = useState(false);
  const [healthPickerOpen, setHealthPickerOpen] = useState(false);

  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(
    loadBarns,
    Boolean(token && role && ["vet", "manager", "trainer"].includes(role)),
  );
  const barnOptions = useMemo(
    () => (barnsResource.data ?? []).map(({ id, name }) => ({ id, name })),
    [barnsResource.data],
  );

  const load = useCallback(() => {
    const filters = {
      ...(barnId ? { barnId } : {}),
      ...(health === "All health states" ? {} : { healthStatus: health as HealthStatusDto }),
    };
    return medicalService.getDashboard(token!, filters);
  }, [barnId, health, token]);

  const resource = useApiResource(
    load,
    Boolean(token && role && ["vet", "manager", "trainer"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);

  const horsesByBarn = useMemo(() => {
    const groups = new Map<string, MedicalDashboardDto["herd"]["horses"]>();
    for (const horse of resource.data?.herd.horses ?? []) {
      const key = horse.barnId ?? "unassigned";
      groups.set(key, [...(groups.get(key) ?? []), horse]);
    }
    return [...groups.entries()];
  }, [resource.data]);

  const selectedBarnName = barnId
    ? (barnOptions.find((b) => b.id === barnId)?.name ?? "All barns")
    : "All barns";

  const selectedHealthItem = HEALTH_OPTIONS.find((h) => h.raw === health) ?? HEALTH_OPTIONS[0];

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer"].includes(role)) {
    return <Redirect href={(role === "groom" ? "/groom/incidents" : `/${role}`) as Href} />;
  }

  return (
    <Screen
      role={role}
      title="Medical overview"
      subtitle={
        role === "trainer"
          ? "Horses in your assigned barns"
          : role === "manager"
            ? "Club-wide health and care"
            : "Veterinary workspace"
      }
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
          {/* Top Metric Cards */}
          <View style={uiStyles.metricGrid}>
            <Metric
              label="Open cases"
              value={resource.data.openCases.length}
              hint="active treatment"
              tone={resource.data.openCases.length ? "warning" : "good"}
            />
            <Metric
              label="Requests waiting"
              value={resource.data.pendingRequests.length}
              hint="urgent requests first"
              tone={
                resource.data.pendingRequests.some((request) => request.urgent)
                  ? "warning"
                  : "default"
              }
            />
            <Metric
              label="Checkups due"
              value={resource.data.checkups.length}
              hint="overdue or next 3 days"
              tone={
                resource.data.checkups.some((checkup) => checkup.daysLeft < 0)
                  ? "warning"
                  : "default"
              }
            />
          </View>

          {/* Quick Action Navigation Bar */}
          <View style={styles.quickNavRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/${role}/medical/requests` as Href)}
              style={styles.quickNavCard}
            >
              <View style={styles.quickNavIconWrap}>
                <Ionicons name="list" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.quickNavTitle} numberOfLines={1}>
                  Examination queue
                </Text>
                <Text style={styles.quickNavSubtitle} numberOfLines={1}>
                  {resource.data.pendingRequests.length} requests
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/${role}/medical/checkups` as Href)}
              style={styles.quickNavCard}
            >
              <View style={[styles.quickNavIconWrap, { backgroundColor: colors.monitorSoft }]}>
                <Ionicons name="calendar" size={18} color={colors.monitor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.quickNavTitle} numberOfLines={1}>
                  Periodic checkups
                </Text>
                <Text style={styles.quickNavSubtitle} numberOfLines={1}>
                  {resource.data.checkups.length} due
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Redesigned Compact Herd Filter Section */}
          <View style={uiStyles.section}>
            <SectionTitle>Lọc đàn ngựa</SectionTitle>
            <AsyncStateView
              isLoading={barnsResource.isLoading}
              error={barnsResource.error}
              onRetry={() => void barnsResource.retry()}
            />

            {/* 2-Column Compact Dropdown Buttons */}
            <View style={styles.filterDropdownRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setBarnPickerOpen(true)}
                style={styles.filterDropdownBtn}
              >
                <Ionicons name="home-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.filterDropdownLabel}>Barn</Text>
                  <Text style={styles.filterDropdownValue} numberOfLines={1}>
                    {selectedBarnName}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setHealthPickerOpen(true)}
                style={styles.filterDropdownBtn}
              >
                <Ionicons name="pulse-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.filterDropdownLabel}>Status</Text>
                  <Text style={styles.filterDropdownValue} numberOfLines={1}>
                    {selectedHealthItem.label}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Horizontal Status Summary Counters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusCounterRow}
            >
              {Object.entries(resource.data.herd.counts).map(([statusKey, count]) => {
                const config = HEALTH_OPTIONS.find((opt) => opt.raw === statusKey);
                const isSelected = health === statusKey;
                return (
                  <Pressable
                    key={statusKey}
                    accessibilityRole="button"
                    onPress={() => setHealth(isSelected ? "All health states" : statusKey)}
                    style={[
                      styles.statusCounterPill,
                      isSelected && {
                        borderColor: colors.primary,
                        backgroundColor: colors.fitSoft,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <Text style={styles.statusCounterLabel}>
                      {config?.label ?? statusKey.replaceAll("_", " ")}
                    </Text>
                    <View style={styles.statusCounterBadge}>
                      <Text style={styles.statusCounterBadgeText}>{count}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Barn Picker Modal */}
            <Modal
              visible={barnPickerOpen}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setBarnPickerOpen(false)}
            >
              <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Lọc theo khu chuồng</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setBarnPickerOpen(false)}
                    style={{ padding: space.xs }}
                  >
                    <Ionicons name="close" size={22} color={colors.foreground} />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.modalListContent}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setBarnId("");
                      setBarnPickerOpen(false);
                    }}
                    style={[
                      styles.modalOptionItem,
                      barnId === "" && {
                        borderColor: colors.primary,
                        backgroundColor: colors.fitSoft,
                      },
                    ]}
                  >
                    <Text style={[uiStyles.value, barnId === "" && { color: colors.primary }]}>
                      Tất cả khu chuồng
                    </Text>
                    {barnId === "" ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                  {barnOptions.map((barn) => {
                    const isSelected = barnId === barn.id;
                    return (
                      <Pressable
                        key={barn.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setBarnId(barn.id);
                          setBarnPickerOpen(false);
                        }}
                        style={[
                          styles.modalOptionItem,
                          isSelected && {
                            borderColor: colors.primary,
                            backgroundColor: colors.fitSoft,
                          },
                        ]}
                      >
                        <Text style={[uiStyles.value, isSelected && { color: colors.primary }]}>
                          {barn.name}
                        </Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Modal>

            {/* Health Picker Modal */}
            <Modal
              visible={healthPickerOpen}
              animationType="slide"
              presentationStyle="pageSheet"
              onRequestClose={() => setHealthPickerOpen(false)}
            >
              <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Lọc theo trạng thái sức khỏe</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setHealthPickerOpen(false)}
                    style={{ padding: space.xs }}
                  >
                    <Ionicons name="close" size={22} color={colors.foreground} />
                  </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.modalListContent}>
                  {HEALTH_OPTIONS.map((item) => {
                    const isSelected = health === item.raw;
                    return (
                      <Pressable
                        key={item.raw}
                        accessibilityRole="button"
                        onPress={() => {
                          setHealth(item.raw);
                          setHealthPickerOpen(false);
                        }}
                        style={[
                          styles.modalOptionItem,
                          isSelected && {
                            borderColor: colors.primary,
                            backgroundColor: colors.fitSoft,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <HealthBadge label={item.label} tone={item.tone} />
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Modal>
          </View>

          {/* Herd by Barn and Stall */}
          <View style={uiStyles.section}>
            <SectionTitle>Đàn ngựa theo khu và ô chuồng</SectionTitle>
            {horsesByBarn.map(([groupId, horses]) => (
              <Panel key={groupId}>
                <Text style={uiStyles.value}>
                  {groupId === "unassigned"
                    ? "No barn assigned"
                    : (barnOptions.find((barn) => barn.id === groupId)?.name ??
                      `Barn ${groupId.slice(0, 8)}`)}
                </Text>
                {horses.map((horse) => {
                  const statusConfig = HEALTH_OPTIONS.find((h) => h.raw === horse.healthStatus);
                  return (
                    <Pressable
                      key={horse.horseId}
                      accessibilityRole="button"
                      onPress={() => router.push(`/${role}/horse/${horse.horseId}` as Href)}
                      style={{ paddingVertical: 8 }}
                    >
                      <View style={uiStyles.row}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={uiStyles.value} numberOfLines={1}>
                            {horse.horseName}
                          </Text>
                          <Text style={uiStyles.muted} numberOfLines={1}>
                            {horse.stallCode ? `Stall ${horse.stallCode}` : "No stall assigned"}
                          </Text>
                        </View>
                        <HealthBadge
                          label={statusConfig?.label ?? horse.healthStatus.replaceAll("_", " ")}
                          tone={statusConfig?.tone ?? "default"}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </Panel>
            ))}
            {!resource.data.herd.horses.length ? (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => undefined}
                empty
                emptyLabel="No horses match these filters."
              />
            ) : null}
          </View>

          {/* Open Treatment Cases */}
          <View style={uiStyles.section}>
            <SectionTitle>Open treatment cases</SectionTitle>
            {resource.data.openCases.map((item) => (
              <Pressable
                key={item.caseId}
                accessibilityRole="button"
                onPress={() => router.push(`/${role}/medical/cases/${item.caseId}` as Href)}
              >
                <Panel>
                  <Text style={uiStyles.value}>
                    {item.horseName} · {item.initialDiagnosis}
                  </Text>
                  <Text style={uiStyles.muted}>
                    Opened {formatDateTime(item.openedAt)} · last visit{" "}
                    {item.lastVisitAt ? formatDateTime(item.lastVisitAt) : "not recorded"}
                  </Text>
                  <Text style={uiStyles.label}>
                    {item.nextVisitAt
                      ? `Follow-up ${formatDateTime(item.nextVisitAt)}`
                      : "No follow-up scheduled"}
                  </Text>
                </Panel>
              </Pressable>
            ))}
            {!resource.data.openCases.length ? (
              <Text style={uiStyles.muted}>No cases are open.</Text>
            ) : null}
          </View>

          {/* Urgent-First Examination Queue with Direct View All link */}
          <View style={uiStyles.section}>
            <SectionTitle
              action={
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/${role}/medical/requests` as Href)}
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                    View all
                  </Text>
                </Pressable>
              }
            >
              Urgent-first examination queue
            </SectionTitle>

            {resource.data.pendingRequests.slice(0, 5).map((request) => (
              <Pressable
                key={request.id}
                accessibilityRole="button"
                onPress={() => router.push(`/${role}/medical/requests` as Href)}
              >
                <Panel>
                  <View style={uiStyles.row}>
                    <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {request.horseName}
                    </Text>
                    <HealthBadge
                      label={request.urgent ? "Urgent" : "Pending"}
                      tone={request.urgent ? "injured" : "monitor"}
                    />
                  </View>
                  <Text style={uiStyles.muted}>{request.description}</Text>
                  <View style={[uiStyles.row, { marginTop: 4 }]}>
                    <Text style={[uiStyles.label, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                      {formatDateTime(request.createdAt)}
                    </Text>
                    {role === "vet" ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push(
                            `/vet/medical/visit?requestId=${request.id}&horseId=${request.horseId}&kind=REQUEST` as Href,
                          )
                        }
                        style={styles.recordExamBtn}
                      >
                        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>
                          Record examination
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Panel>
              </Pressable>
            ))}

            {!resource.data.pendingRequests.length ? (
              <Text style={uiStyles.muted}>No pending requests.</Text>
            ) : null}
          </View>

          {/* Checkups and Care Due with Direct View All link */}
          <View style={uiStyles.section}>
            <SectionTitle
              action={
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/${role}/medical/checkups` as Href)}
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                    View all
                  </Text>
                </Pressable>
              }
            >
              Checkups and care due
            </SectionTitle>

            {resource.data.checkups.map((checkup) => {
              const statusConfig = HEALTH_OPTIONS.find((h) => h.raw === checkup.healthStatus);
              return (
                <Pressable
                  key={checkup.horseId}
                  accessibilityRole="button"
                  onPress={() => router.push(`/${role}/medical/checkups` as Href)}
                >
                  <Panel>
                    <View style={uiStyles.row}>
                      <Text style={[uiStyles.value, { flex: 1, minWidth: 0 }]} numberOfLines={1}>
                        {checkup.horseName}
                      </Text>
                      <HealthBadge
                        label={
                          checkup.daysLeft < 0
                            ? `${Math.abs(checkup.daysLeft)} days overdue`
                            : `${checkup.daysLeft} days`
                        }
                        tone={checkup.daysLeft < 0 ? "injured" : "monitor"}
                      />
                    </View>
                    <Text style={uiStyles.muted}>
                      {statusConfig?.label ?? checkup.healthStatus.replaceAll("_", " ")} · due{" "}
                      {formatDate(checkup.dueDate)}
                    </Text>
                    <Text style={uiStyles.label}>
                      {checkup.appointment
                        ? `Appointment ${formatDateTime(checkup.appointment.scheduledAt)}`
                        : "No appointment"}
                    </Text>
                  </Panel>
                </Pressable>
              );
            })}

            {resource.data.careSchedules.map((schedule) => (
              <Pressable
                key={schedule.scheduleId}
                accessibilityRole="button"
                onPress={() =>
                  router.push(`/${role}/medical/care?horseId=${schedule.horseId}` as Href)
                }
              >
                <Panel>
                  <Text style={uiStyles.value}>
                    {schedule.horseName} · {schedule.type.replaceAll("_", " ")}
                  </Text>
                  <Text style={uiStyles.muted}>
                    Due {formatDate(schedule.dueDate)} ·{" "}
                    {schedule.assignedTo
                      ? `assigned staff ${schedule.assignedTo.slice(0, 8)}`
                      : "unassigned"}
                  </Text>
                </Panel>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {role === "manager" ? (
        <PrimaryButton
          label="Medical cost report"
          icon="cash-outline"
          onPress={() => router.push(`/${role}/medical/costs` as Href)}
        />
      ) : null}
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    quickNavRow: {
      flexDirection: "row",
      gap: space.sm,
      marginTop: space.sm,
    },
    quickNavCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickNavIconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    quickNavTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    quickNavSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    filterDropdownRow: {
      flexDirection: "row",
      gap: space.sm,
    },
    filterDropdownBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterDropdownLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    filterDropdownValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: 2,
    },
    statusCounterRow: {
      flexDirection: "row",
      gap: space.sm,
      paddingVertical: space.xs,
    },
    statusCounterPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusCounterLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    statusCounterBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    statusCounterBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalContainer: {
      flex: 1,
      padding: space.lg,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
    },
    modalListContent: {
      gap: space.sm,
      paddingTop: space.md,
      paddingBottom: space.xxl,
    },
    modalOptionItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recordExamBtn: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      backgroundColor: colors.fitSoft,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      flexShrink: 0,
    },
  });
