import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  Chips,
  DateRangeBar,
  Field,
  NativeInput,
  Panel,
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
    if (ownerId.trim() && !isUuid(ownerId.trim())) {
      Alert.alert(t("Mã chủ ngựa không hợp lệ"), t("Vui lòng nhập mã UUID hợp lệ hoặc để trống."));
      return;
    }
    setQuery({ from, to, barnId, ownerId: ownerId.trim() });
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
        <Field label={`${t("Mã chủ ngựa")} (${t("tùy chọn")})`}>
          <NativeInput value={ownerId} onChangeText={setOwnerId} placeholder="UUID chủ ngựa" />
        </Field>
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
                  onPress={() => router.push(`/manager/horse/${item.horseId}` as Href)}
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
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.horseCost, { color: colors.foreground }]}>
                          {formatVnd(item.totalCost)}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
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
  });
