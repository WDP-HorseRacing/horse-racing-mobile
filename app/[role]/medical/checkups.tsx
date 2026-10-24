import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen } from "@/components/common";
import { Field, NativeInput, PrimaryButton, SecondaryButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import { isRole } from "@/features/auth/roles";
import { medicalService } from "@/services/medical.service";
import {
  clubDateTimeParts,
  isNotPastDateTime,
  isValidRequiredText,
  toClubDateTime,
} from "@/features/medical/medical-validation";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDate, formatDateTime } from "@/utils/formatters";

type FilterTab = "ALL" | "OVERDUE" | "DUE_SOON";

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "Tất cả đến hạn" },
  { key: "OVERDUE", label: "Quá hạn khám" },
  { key: "DUE_SOON", label: "Sắp đến hạn" },
];

export default function PeriodicCheckups() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [appointmentDefault] = useState(() =>
    clubDateTimeParts(new Date(Date.now() + 5 * 60 * 1000)),
  );
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(appointmentDefault.date);
  const [scheduledTime, setScheduledTime] = useState(appointmentDefault.time);
  const [reason, setReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      medicalService.listCheckups(token!, {
        ...(filter === "ALL" ? {} : { status: filter }),
      }),
    [filter, token],
  );

  const resource = useApiResource(
    load,
    Boolean(token && role && ["vet", "manager", "trainer"].includes(role)),
  );
  useRefreshOnFocus(resource.revalidate);
  const checkups = useMemo(() => resource.data ?? [], [resource.data]);
  const overdueCount = useMemo(() => checkups.filter((c) => c.daysLeft < 0).length, [checkups]);
  const selected = checkups.find((item) => item.horseId === selectedHorseId) ?? null;

  if (!role) return <Redirect href="/" />;
  if (!["vet", "manager", "trainer"].includes(role)) return <Redirect href={`/${role}` as Href} />;

  const saveAppointment = async () => {
    if (role !== "vet" || !selected || !token) return;
    const scheduledAt = toClubDateTime(scheduledDate, scheduledTime);
    if (!scheduledAt || !isNotPastDateTime(scheduledAt)) {
      Alert.alert(
        "Lịch hẹn không hợp lệ",
        "Vui lòng chọn ngày giờ hợp lệ và không ở trong quá khứ.",
      );
      return;
    }
    if (selected.daysLeft >= 0 && scheduledDate > selected.dueDate) {
      Alert.alert(
        "Lịch hẹn vượt quá ngày đến hạn",
        "Buổi khám chưa quá hạn phải được lên lịch trước hoặc đúng ngày đến hạn.",
      );
      return;
    }
    if (selected.appointment && !isValidRequiredText(reason, 500)) {
      Alert.alert("Cần lý do dời lịch", "Vui lòng nhập lý do khi dời lịch hẹn khám đã có sẵn.");
      return;
    }
    setSaving(true);
    try {
      await medicalService.setCheckupAppointment(token, selected.horseId, {
        scheduledAt,
        ...(selected.appointment ? { reason: reason.trim() } : {}),
      });
      setSelectedHorseId("");
      setReason("");
      await resource.refresh();
      Alert.alert("Đã lưu lịch hẹn", "Lịch hẹn khám định kỳ đã được cập nhật thành công.");
    } catch (error) {
      Alert.alert("Không thể lưu lịch hẹn", extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const cancelAppointment = async () => {
    if (role !== "vet" || !selected?.appointment || !token) return;
    if (!isValidRequiredText(cancelReason, 500)) {
      Alert.alert("Cần lý do hủy", "Nhập lý do hủy lịch hẹn (tối đa 500 ký tự).");
      return;
    }
    Alert.alert(
      "Hủy lịch hẹn khám?",
      "Lịch hẹn sẽ chuyển sang trạng thái đã hủy và không còn xuất hiện trong lịch hôm nay của Groom.",
      [
        { text: "Giữ lịch", style: "cancel" },
        {
          text: "Hủy lịch hẹn",
          style: "destructive",
          onPress: () => {
            setSaving(true);
            void medicalService
              .cancelCheckupAppointment(token, selected.horseId, cancelReason.trim())
              .then(async () => {
                setSelectedHorseId("");
                setCancelReason("");
                await resource.refresh();
                Alert.alert("Đã hủy lịch hẹn", "Lịch khám định kỳ đã được hủy.");
              })
              .catch((error) =>
                Alert.alert("Không thể hủy lịch hẹn", extractErrorMessage(error)),
              )
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  return (
    <Screen
      role={role}
      title="Khám định kỳ"
      subtitle="Chu kỳ kiểm tra sức khỏe tổng quát 30 ngày"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        {filterTabs.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setFilter(tab.key);
                setSelectedHorseId("");
              }}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              {tab.key === "OVERDUE" && overdueCount > 0 ? (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {overdueCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {/* Cards List */}
      <View style={styles.cardsList}>
        {checkups.map((item) => {
          const isOverdue = item.daysLeft < 0;
          const isSelected = selectedHorseId === item.horseId;

          return (
            <View
              key={item.horseId}
              style={[
                styles.checkupCard,
                isOverdue && styles.checkupCardOverdue,
                isSelected && styles.checkupCardSelected,
              ]}
            >
              {/* Header row: Horse & Due Status Pill */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.horseRow}>
                  <View style={[styles.horseAvatar, isOverdue && styles.horseAvatarOverdue]}>
                    <Ionicons
                      name="paw"
                      size={18}
                      color={isOverdue ? colors.destructive : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.horseNameText}>{item.horseName}</Text>
                    <Text style={styles.horseStatusText}>
                      {item.healthStatus.replaceAll("_", " ")}
                      {item.barnId ? " · Đã xếp khu" : " · Chưa xếp khu"}
                    </Text>
                  </View>
                </View>

                {/* Due status badge */}
                <View
                  style={[
                    styles.dueBadge,
                    isOverdue ? styles.dueBadgeOverdue : styles.dueBadgeNormal,
                  ]}
                >
                  <Ionicons
                    name={isOverdue ? "warning" : "time-outline"}
                    size={12}
                    color={isOverdue ? colors.destructive : colors.primary}
                  />
                  <Text
                    style={[
                      styles.dueBadgeText,
                      isOverdue ? styles.dueBadgeTextOverdue : styles.dueBadgeTextNormal,
                    ]}
                  >
                    {isOverdue
                      ? `Quá hạn ${Math.abs(item.daysLeft)} ngày`
                      : `Còn ${item.daysLeft} ngày`}
                  </Text>
                </View>
              </View>

              {/* Due Date & Last Exam Info */}
              <View style={styles.datesBox}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Hạn khám:</Text>
                  <Text style={[styles.dateVal, isOverdue && { color: colors.destructive }]}>
                    {formatDate(item.dueDate)}
                  </Text>
                </View>
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Lần khám trước:</Text>
                  <Text style={styles.dateVal}>
                    {item.lastVisitDate ? formatDate(item.lastVisitDate) : "Chưa có"}
                  </Text>
                </View>
              </View>

              {/* Appointment Notice if any */}
              {item.appointment ? (
                <View style={styles.appointmentBox}>
                  <Ionicons name="calendar" size={15} color={colors.primary} />
                  <Text style={styles.appointmentText}>
                    Đã hẹn: {formatDateTime(item.appointment.scheduledAt)}
                  </Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              {role === "vet" ? (
                <View style={styles.cardActionsRow}>
                  <PrimaryButton
                    label="Khám định kỳ ngay"
                    icon="medkit-outline"
                    style={{ flex: 1 }}
                    onPress={() =>
                      router.push(
                        `/${role}/medical/visit?horseId=${item.horseId}&kind=ROUTINE` as Href,
                      )
                    }
                  />
                  <SecondaryButton
                    label={item.appointment ? "Dời lịch hẹn" : "Đặt lịch"}
                    icon="calendar-outline"
                    onPress={() => {
                      const parts = item.appointment
                        ? clubDateTimeParts(new Date(item.appointment.scheduledAt))
                        : appointmentDefault;
                      setScheduledDate(parts.date);
                      setScheduledTime(parts.time);
                      setReason("");
                      setCancelReason("");
                      setSelectedHorseId((current) =>
                        current === item.horseId ? "" : item.horseId,
                      );
                    }}
                  />
                </View>
              ) : null}

              {/* Appointment Drawer */}
              {isSelected ? (
                <View style={styles.appointmentDrawer}>
                  <Text style={styles.drawerTitle}>
                    {item.appointment ? "Dời lịch hẹn khám định kỳ" : "Đặt lịch hẹn khám định kỳ"}
                  </Text>
                  <Field label="Ngày hẹn (YYYY-MM-DD)">
                    <NativeInput
                      value={scheduledDate}
                      onChangeText={setScheduledDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </Field>
                  <Field label="Giờ hẹn (HH:mm)">
                    <NativeInput
                      value={scheduledTime}
                      onChangeText={setScheduledTime}
                      placeholder="09:30"
                    />
                  </Field>
                  {item.appointment ? (
                    <Field label="Lý do dời lịch hẹn *">
                      <NativeInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Nhập lý do thay đổi lịch hẹn"
                        multiline
                      />
                    </Field>
                  ) : null}
                  <PrimaryButton
                    label={saving ? "Đang lưu…" : "Xác nhận lịch hẹn"}
                    disabled={saving}
                    onPress={() => void saveAppointment()}
                  />
                  {item.appointment ? (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <Field label="Lý do hủy lịch hẹn *">
                        <NativeInput
                          value={cancelReason}
                          onChangeText={setCancelReason}
                          placeholder="Nhập lý do hủy lịch hẹn"
                          multiline
                          maxLength={500}
                        />
                      </Field>
                      <SecondaryButton
                        label={saving ? "Đang hủy…" : "Hủy lịch hẹn"}
                        icon="close-circle-outline"
                        disabled={saving || !cancelReason.trim()}
                        onPress={() => void cancelAppointment()}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {resource.data && !checkups.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={44} color={colors.primary} />
            <Text style={styles.emptyTitle}>Tất cả ngựa đã được khám</Text>
            <Text style={styles.emptySubtitle}>
              Hiện không có ngựa nào đến hạn khám định kỳ trong chu kỳ này.
            </Text>
          </View>
        ) : null}
      </View>

      {/* System Note */}
      <View style={styles.infoNoteCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.infoNoteText}>
          Chu kỳ khám định kỳ được thiết lập 30 ngày/lần. Khi bác sĩ hoàn thành buổi khám định kỳ,
          lịch hẹn tương ứng sẽ tự động hoàn tất.
        </Text>
      </View>
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    tabContainer: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
      marginBottom: space.sm,
    },
    tabButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 9,
      borderRadius: radius.sm,
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    tabTextActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    tabBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    tabBadgeActive: {
      backgroundColor: "rgba(255,255,255,0.25)",
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.foreground,
    },
    tabBadgeTextActive: {
      color: "#ffffff",
    },
    cardsList: {
      gap: space.sm,
    },
    checkupCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    checkupCardOverdue: {
      borderColor: colors.destructive,
      backgroundColor: colors.injuredSoft,
    },
    checkupCardSelected: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    horseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      flex: 1,
    },
    horseAvatar: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    horseAvatarOverdue: {
      backgroundColor: colors.injuredSoft,
    },
    horseNameText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    horseStatusText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    dueBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    dueBadgeOverdue: {
      backgroundColor: colors.injuredSoft,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    dueBadgeNormal: {
      backgroundColor: colors.fitSoft,
    },
    dueBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    dueBadgeTextOverdue: {
      color: colors.destructive,
    },
    dueBadgeTextNormal: {
      color: colors.primary,
    },
    datesBox: {
      flexDirection: "row",
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      justifyContent: "space-between",
    },
    dateCol: {
      gap: 2,
    },
    dateLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    dateVal: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    appointmentBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.fitSoft,
      padding: space.xs,
      borderRadius: radius.sm,
    },
    appointmentText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    cardActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginTop: 2,
    },
    appointmentDrawer: {
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
      gap: space.xs,
      marginTop: space.xs,
    },
    drawerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 4,
    },
    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      padding: space.xl,
      gap: space.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: space.sm,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: space.xs,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    infoNoteCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      marginTop: space.md,
    },
    infoNoteText: {
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 18,
      flex: 1,
    },
  });
}
