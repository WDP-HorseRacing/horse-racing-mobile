import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  BottomSheetModal,
  Chips,
  DateRangeBar,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  StatTile,
  formatVnd,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { isRole } from "@/features/auth/roles";
import { medicalService } from "@/services/medical.service";
import { clubDateTimeParts, isUuid, isValidDateOnly } from "@/features/medical/medical-validation";
import { stableService } from "@/services/stable.service";
import { usersService } from "@/services/users.service";
import type { StaffDto } from "@/adapters/staff.adapter";
import type { MedicalRecordDto } from "@/adapters/medical.adapter";
import { formatDate, formatDateTime, formatEnum } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

const MEDICAL_COLOR = "#f59e0b";

export default function MedicalCostReport() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const today = clubDateTimeParts().date;
  const initialFrom = `${today.slice(0, 7)}-01`;
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [barnId, setBarnId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [query, setQuery] = useState({ from: initialFrom, to: today, barnId: "", ownerId: "" });

  // Owner picker state
  const [owners, setOwners] = useState<StaffDto[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<StaffDto | null>(null);
  const [ownerPickerVisible, setOwnerPickerVisible] = useState(false);

  // Horse visits breakdown state
  const [selectedHorseBreakdown, setSelectedHorseBreakdown] = useState<{
    horseId: string;
    horseName: string;
    totalCost: number;
    visitCount: number;
  } | null>(null);
  const [horseRecords, setHorseRecords] = useState<MedicalRecordDto[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    if (token && role === "manager") {
      void usersService
        .list(token)
        .then((users) => {
          setOwners(users.filter((u) => u.role === "HORSE_OWNER" || !u.role));
        })
        .catch(() => setOwners([]));
    }
  }, [token, role]);

  const filteredOwners = useMemo(() => {
    if (!ownerSearch.trim()) return owners;
    const q = ownerSearch.toLowerCase();
    return owners.filter(
      (o) => o.fullName.toLowerCase().includes(q) || (o.email && o.email.toLowerCase().includes(q)),
    );
  }, [ownerSearch, owners]);

  const openHorseBreakdown = async (item: {
    horseId: string;
    horseName: string;
    totalCost: number;
    visitCount: number;
  }) => {
    setSelectedHorseBreakdown(item);
    setLoadingRecords(true);
    try {
      const records = await medicalService.listHorseRecords(token!, item.horseId);
      setHorseRecords(records);
    } catch {
      setHorseRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const load = useCallback(
    () =>
      medicalService.getCostReport(token!, {
        from: query.from,
        to: query.to,
        ...(query.barnId ? { barnId: query.barnId } : {}),
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      }),
    [query, token],
  );
  const resource = useApiResource(load, Boolean(token && role === "manager"));
  useRefreshOnFocus(resource.revalidate);
  const loadBarns = useCallback(() => stableService.listBarns(token!), [token]);
  const barnsResource = useApiResource(loadBarns, Boolean(token && role === "manager"));
  const barns = barnsResource.data ?? [];

  if (!role) return <Redirect href="/" />;
  if (role !== "manager") return <Redirect href={`/${role}` as Href} />;

  const handleApplyDateRange = (dates: { from: string; to: string }) => {
    setFrom(dates.from);
    setTo(dates.to);
    setQuery((prev) => ({ ...prev, from: dates.from, to: dates.to }));
  };

  const applyAdditionalFilters = () => {
    if (!isValidDateOnly(from) || !isValidDateOnly(to) || from > to) {
      Alert.alert(
        t("Khoảng ngày không hợp lệ"),
        t("Vui lòng nhập ngày hợp lệ định dạng YYYY-MM-DD và Từ ngày không được sau Đến ngày."),
      );
      return;
    }
    const targetOwnerId = selectedOwner ? selectedOwner.id : ownerId.trim();
    if (targetOwnerId && !isUuid(targetOwnerId)) {
      Alert.alert(t("Mã chủ ngựa không hợp lệ"), t("Vui lòng chọn chủ ngựa hợp lệ hoặc để trống."));
      return;
    }
    setQuery({ from, to, barnId, ownerId: targetOwnerId });
  };

  const totalCost = resource.data?.totalCost ?? 0;
  const visitCount = resource.data?.visitCount ?? 0;
  const avgCostPerVisit = visitCount > 0 ? Math.round(totalCost / visitCount) : 0;

  return (
    <Screen
      role="manager"
      title={t("Báo cáo chi phí y tế")}
      subtitle={resource.data ? `${query.from} → ${query.to}` : t("Lượt khám y tế theo ngày")}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Date Range Selector with Quick Presets */}
      <DateRangeBar
        from={query.from}
        to={query.to}
        isLoading={resource.isLoading}
        onApply={handleApplyDateRange}
      />

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {/* Barn & Owner Filters */}
      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.filterTitle, { color: colors.foreground }]}>
          {t("Bộ lọc bổ sung")}
        </Text>
        <Text style={uiStyles.label}>{t("Khu của ngựa lúc khám")}</Text>
        <Chips
          options={[t("Tất cả khu chuồng"), ...barns.map((barn) => barn.name)]}
          value={
            barnId
              ? (barns.find((barn) => barn.id === barnId)?.name ?? t("Tất cả khu chuồng"))
              : t("Tất cả khu chuồng")
          }
          onChange={(value) =>
            setBarnId(barns.find((barn) => barn.name === value)?.id ?? "")
          }
        />
        <Text style={[uiStyles.label, { marginTop: space.xs }]}>{t("Chủ sở hữu ngựa")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOwnerPickerVisible(true)}
          style={[styles.ownerPickerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
        >
          <Ionicons
            name="person-circle-outline"
            size={18}
            color={selectedOwner ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: selectedOwner ? "700" : "400",
              color: selectedOwner ? colors.foreground : colors.mutedForeground,
            }}
            numberOfLines={1}
          >
            {selectedOwner ? selectedOwner.fullName : t("Tất cả chủ ngựa (bấm để chọn)")}
          </Text>
          {selectedOwner ? (
            <Pressable
              onPress={() => {
                setSelectedOwner(null);
                setOwnerId("");
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          )}
        </Pressable>
        <SecondaryButton
          label={t("Áp dụng lọc khu & chủ ngựa")}
          icon="funnel-outline"
          onPress={applyAdditionalFilters}
        />
      </View>

      {resource.data ? (
        <>
          {/* Hero Medical Cost Card */}
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.heroHeader}>
              <View style={[styles.heroIconBox, { backgroundColor: `${MEDICAL_COLOR}18` }]}>
                <Ionicons name="medkit-outline" size={20} color={MEDICAL_COLOR} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                  {t("Tổng chi phí y tế")}
                </Text>
                <Text style={[styles.heroTotal, { color: colors.foreground }]}>
                  {formatVnd(totalCost)}
                </Text>
              </View>
            </View>

            <View style={styles.statTilesRow}>
              <StatTile
                label={t("Tổng lượt khám")}
                value={`${visitCount} ${t("lượt")}`}
                icon="calendar-outline"
                accentColor={MEDICAL_COLOR}
              />
              <StatTile
                label={t("Trung bình / lượt")}
                value={formatVnd(avgCostPerVisit)}
                icon="calculator-outline"
                accentColor="#0284c7"
              />
            </View>
          </View>

          {/* Cost by Horse with Proportional Visual Bars */}
          <View style={uiStyles.section}>
            <SectionTitle>{`${t("Chi phí theo từng ngựa")} (${resource.data.items.length})`}</SectionTitle>
            {resource.data.items.map((item) => {
              const sharePct = totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0;
              return (
                <Pressable
                  key={item.horseId}
                  onPress={() => void openHorseBreakdown(item)}
                >
                  <Panel>
                    <View style={uiStyles.row}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={[uiStyles.value, styles.horseName]} numberOfLines={1}>
                          {item.horseName}
                        </Text>
                        <Text style={[uiStyles.muted, { fontSize: 11 }]}>
                          {item.visitCount} {item.visitCount === 1 ? t("lượt khám") : t("lượt khám")}
                          {totalCost > 0 ? ` · ${sharePct.toFixed(1)}% ${t("tổng chi phí")}` : ""}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={[styles.horseCost, { color: colors.foreground }]}>
                            {formatVnd(item.totalCost)}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                        </View>
                        <Text style={{ fontSize: 10, color: colors.primary, fontWeight: "600" }}>
                          Xem chi tiết khám →
                        </Text>
                      </View>
                    </View>

                    {/* Proportional visual bar for each horse */}
                    {totalCost > 0 ? (
                      <View style={styles.horseBarTrack}>
                        <View
                          style={[
                            styles.horseBarFill,
                            {
                              width: `${Math.max(2, Math.min(100, sharePct))}%`,
                              backgroundColor: MEDICAL_COLOR,
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </Panel>
                </Pressable>
              );
            })}
            {!resource.data.items.length ? (
              <Panel>
                <Text style={uiStyles.muted}>
                  {t("Không có lượt khám y tế nào phù hợp trong khoảng thời gian này.")}
                </Text>
              </Panel>
            ) : null}
          </View>
        </>
      ) : null}

      {/* Modal: Chọn chủ sở hữu ngựa */}
      <BottomSheetModal
        visible={ownerPickerVisible}
        title="Chọn chủ sở hữu ngựa"
        onClose={() => {
          setOwnerPickerVisible(false);
          setOwnerSearch("");
        }}
        cancelLabel="Đóng"
      >
        <Field label="Tìm kiếm theo tên hoặc email">
          <NativeInput
            value={ownerSearch}
            onChangeText={setOwnerSearch}
            placeholder="Nhập tên chủ sở hữu..."
          />
        </Field>
        <ScrollView style={{ maxHeight: 360 }}>
          <Pressable
            onPress={() => {
              setSelectedOwner(null);
              setOwnerId("");
              setOwnerPickerVisible(false);
              setOwnerSearch("");
            }}
            style={[styles.ownerItem, !selectedOwner && styles.ownerItemActive]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.ownerName, !selectedOwner && { color: colors.primary }]}>
                Tất cả chủ ngựa (Không lọc)
              </Text>
              <Text style={styles.ownerEmail}>Hiển thị chi phí cho toàn câu lạc bộ</Text>
            </View>
            {!selectedOwner ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            ) : null}
          </Pressable>

          {filteredOwners.map((owner) => {
            const isSelected = selectedOwner?.id === owner.id;
            return (
              <Pressable
                key={owner.id}
                onPress={() => {
                  setSelectedOwner(owner);
                  setOwnerId(owner.id);
                  setOwnerPickerVisible(false);
                  setOwnerSearch("");
                }}
                style={[styles.ownerItem, isSelected && styles.ownerItemActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ownerName, isSelected && { color: colors.primary }]}>
                    {owner.fullName}
                  </Text>
                  {owner.email ? <Text style={styles.ownerEmail}>{owner.email}</Text> : null}
                </View>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      {/* Modal: Chi tiết các lượt khám của ngựa */}
      <BottomSheetModal
        visible={Boolean(selectedHorseBreakdown)}
        title={selectedHorseBreakdown ? `Lượt khám — ${selectedHorseBreakdown.horseName}` : ""}
        onClose={() => {
          setSelectedHorseBreakdown(null);
          setHorseRecords([]);
        }}
        cancelLabel="Đóng"
      >
        {selectedHorseBreakdown ? (
          <View style={{ gap: space.sm }}>
            {/* Breakdown Cost Summary */}
            <View style={styles.breakdownHeaderCard}>
              <View>
                <Text style={styles.breakdownSubtitle}>Tổng chi phí các lượt khám</Text>
                <Text style={styles.breakdownTotal}>
                  {formatVnd(selectedHorseBreakdown.totalCost)}
                </Text>
              </View>
              <View style={styles.breakdownCountBadge}>
                <Text style={styles.breakdownCountText}>
                  {selectedHorseBreakdown.visitCount} lượt khám
                </Text>
              </View>
            </View>

            {loadingRecords ? (
              <View style={{ padding: space.xl, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[uiStyles.muted, { marginTop: 8 }]}>Đang tải chi tiết các lượt khám…</Text>
              </View>
            ) : horseRecords.length ? (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {horseRecords.map((rec) => (
                  <Pressable
                    key={rec.id}
                    onPress={() => {
                      setSelectedHorseBreakdown(null);
                      router.push(`/manager/medical/visits/${rec.id}` as Href);
                    }}
                    style={styles.breakdownVisitCard}
                  >
                    <View style={uiStyles.row}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.breakdownVisitTitle} numberOfLines={1}>
                          {rec.conclusion === "NORMAL"
                            ? "Khám sức khỏe bình thường"
                            : rec.conclusion === "ISSUE"
                              ? "Phát hiện bất thường"
                              : rec.conclusion ?? rec.diagnosis ?? formatEnum(rec.kind)}
                        </Text>
                        <Text style={styles.breakdownVisitMeta}>
                          {formatDateTime(rec.examDate)} · {formatEnum(rec.resultingStatus)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={[uiStyles.muted, { textAlign: "center", paddingVertical: space.md }]}>
                Chưa có dữ liệu biên bản khám chi tiết.
              </Text>
            )}

            <PrimaryButton
              label="Mở hồ sơ đầy đủ của ngựa"
              icon="open-outline"
              onPress={() => {
                const horseId = selectedHorseBreakdown.horseId;
                setSelectedHorseBreakdown(null);
                router.push(`/manager/horse/${horseId}` as Href);
              }}
            />
          </View>
        ) : null}
      </BottomSheetModal>
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    heroCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.md,
      gap: space.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
    },
    heroIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    heroSubtitle: {
      fontSize: 12,
      fontWeight: "500",
    },
    heroTotal: {
      fontSize: 26,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      letterSpacing: -0.5,
    },
    statTilesRow: {
      flexDirection: "row",
      gap: space.xs,
    },
    filterCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.md,
      gap: space.sm,
    },
    filterTitle: {
      fontSize: 13,
      fontWeight: "700",
    },
    horseName: {
      fontSize: 15,
      fontWeight: "700",
    },
    horseCost: {
      fontSize: 15,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    horseBarTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.muted,
      overflow: "hidden",
      marginTop: space.xs,
    },
    horseBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    ownerPickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
      paddingHorizontal: space.sm,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    ownerItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    ownerItemActive: {
      backgroundColor: colors.fitSoft,
    },
    ownerName: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    ownerEmail: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    breakdownHeaderCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    breakdownSubtitle: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    breakdownTotal: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.foreground,
      marginTop: 2,
    },
    breakdownCountBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: `${MEDICAL_COLOR}18`,
    },
    breakdownCountText: {
      fontSize: 12,
      fontWeight: "700",
      color: MEDICAL_COLOR,
    },
    breakdownVisitCard: {
      padding: space.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
    },
    breakdownVisitTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    breakdownVisitMeta: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
    },
  });
