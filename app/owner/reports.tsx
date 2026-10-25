import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  DateRangeBar,
  MiniSplitBar,
  Panel,
  SplitBar,
  StatTile,
  formatVnd,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { reportsService } from "@/services/reports.service";
import { clubDate } from "@/utils/horse-validation";
import { radius, space } from "@/config/theme";

const FEE_COLOR = "#059669";
const MEDICAL_COLOR = "#f59e0b";
const SURCHARGE_COLOR = "#3b82f6";

export default function OwnerReports() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { token } = useAuth();

  const today = clubDate();
  const initialFrom = today.slice(0, 7) + "-01";
  const [range, setRange] = useState({ from: initialFrom, to: today });

  const load = useCallback(
    () => reportsService.getOwnerCosts(token!, range.from, range.to),
    [range.from, range.to, token],
  );
  const resource = useApiResource(load, Boolean(token));
  const report = resource.data;

  // SplitBar parts for owner costs
  const costParts = useMemo(() => {
    if (!report) return [];
    return [
      {
        key: "fee",
        label: t("Phí nuôi"),
        value: report.dailyFee,
        color: FEE_COLOR,
        text: formatVnd(report.dailyFee),
      },
      {
        key: "medical",
        label: t("Y tế"),
        value: report.medicalCost,
        color: MEDICAL_COLOR,
        text: formatVnd(report.medicalCost),
      },
      {
        key: "surcharge",
        label: t("Phụ phí"),
        value: report.surcharge,
        color: SURCHARGE_COLOR,
        text: formatVnd(report.surcharge),
      },
    ];
  }, [report, t]);

  return (
    <Screen
      role="owner"
      title={t("Chi phí chủ ngựa")}
      subtitle={report ? `${report.from} → ${report.to}` : t("Chi phí hàng tháng cho đàn ngựa của bạn")}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Date Range Selector with Quick Presets */}
      <DateRangeBar
        from={range.from}
        to={range.to}
        isLoading={resource.isLoading}
        onApply={(newRange) => setRange(newRange)}
      />

      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {report ? (
        <>
          {/* Hero Account Summary Card */}
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
              <View style={[styles.heroIconBox, { backgroundColor: `${FEE_COLOR}18` }]}>
                <Ionicons name="wallet-outline" size={20} color={FEE_COLOR} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                  {t("Tổng chi phí")} · {report.ownerName}
                </Text>
                <Text style={[styles.heroTotal, { color: colors.foreground }]}>
                  {formatVnd(report.total)}
                </Text>
              </View>
            </View>

            <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
              {report.from} → {report.to} · {report.horses.length} {t("ngựa")}
            </Text>

            {/* SplitBar Proportional Bar Chart */}
            <View style={styles.splitBarContainer}>
              <SplitBar parts={costParts} height={12} showLegend />
            </View>
          </View>

          {/* Quick Metrics (Prize Money & Horse Count) */}
          <View style={styles.statTilesRow}>
            <StatTile
              label={t("Tiền thưởng giải đua")}
              value={formatVnd(report.prizeMoney)}
              sub={t("Chưa có giải đua")}
              icon="trophy-outline"
              accentColor="#8b5cf6"
            />
            <StatTile
              label={t("Tổng số ngựa")}
              value={`${report.horses.length} ${t("con")}`}
              sub={t("Trong kỳ báo cáo")}
              icon="stats-chart-outline"
              accentColor="#0284c7"
            />
          </View>

          {/* Costs by Horse Section */}
          <View style={ui.section}>
            <SectionTitle>{`${t("Chi phí theo từng ngựa")} (${report.horses.length})`}</SectionTitle>
            {report.horses.length ? (
              report.horses.map((horse) => {
                const horseParts = [
                  { key: "fee", value: horse.dailyFee, color: FEE_COLOR },
                  { key: "medical", value: horse.medicalCost, color: MEDICAL_COLOR },
                  { key: "surcharge", value: horse.surcharge, color: SURCHARGE_COLOR },
                ];
                return (
                  <Pressable
                    key={horse.horseId}
                    onPress={() => router.push(("/owner/horse/" + horse.horseId) as Href)}
                  >
                    <Panel>
                      <View style={styles.horseHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[ui.value, styles.horseName]} numberOfLines={1}>
                            {horse.horseName}
                          </Text>
                          <Text style={[styles.horseMetaText, { color: colors.mutedForeground }]}>
                            {horse.billedDays} {t("ngày tính phí")} · {horse.visitCount}{" "}
                            {t("lượt khám y tế")}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.horseTotal, { color: colors.foreground }]}>
                            {formatVnd(horse.total)}
                          </Text>
                          <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
                        </View>
                      </View>

                      {/* Mini proportional bar for horse */}
                      {horse.total > 0 ? (
                        <View style={{ marginVertical: space.xs }}>
                          <MiniSplitBar parts={horseParts} total={horse.total} height={6} />
                        </View>
                      ) : null}

                      {/* Breakdown 3-column metrics */}
                      <View style={styles.horseMetricsGrid}>
                        <View style={styles.horseMetricCol}>
                          <View style={styles.metricDotRow}>
                            <View style={[styles.microDot, { backgroundColor: FEE_COLOR }]} />
                            <Text style={[styles.microLabel, { color: colors.mutedForeground }]}>
                              {t("Phí nuôi")}
                            </Text>
                          </View>
                          <Text style={[styles.microValue, { color: colors.foreground }]}>
                            {formatVnd(horse.dailyFee)}
                          </Text>
                        </View>

                        <View style={styles.horseMetricCol}>
                          <View style={styles.metricDotRow}>
                            <View style={[styles.microDot, { backgroundColor: MEDICAL_COLOR }]} />
                            <Text style={[styles.microLabel, { color: colors.mutedForeground }]}>
                              {t("Y tế")}
                            </Text>
                          </View>
                          <Text style={[styles.microValue, { color: colors.foreground }]}>
                            {formatVnd(horse.medicalCost)}
                          </Text>
                        </View>

                        <View style={styles.horseMetricCol}>
                          <View style={styles.metricDotRow}>
                            <View style={[styles.microDot, { backgroundColor: SURCHARGE_COLOR }]} />
                            <Text style={[styles.microLabel, { color: colors.mutedForeground }]}>
                              {t("Phụ phí")}
                            </Text>
                          </View>
                          <Text style={[styles.microValue, { color: colors.foreground }]}>
                            {formatVnd(horse.surcharge)}
                          </Text>
                        </View>
                      </View>
                    </Panel>
                  </Pressable>
                );
              })
            ) : (
              <Panel>
                <Text style={ui.muted}>
                  {t("Không có chi phí ngựa nào phát sinh trong kỳ này.")}
                </Text>
              </Panel>
            )}
          </View>

          {/* Footnote */}
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            {t(
              "Phí nuôi tính từng ngày ngựa còn ở CLB, ngày chuyển chủ tính cho chủ mới. Y tế chỉ tính bệnh án đã đóng trong kỳ.",
            )}
          </Text>
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
      gap: space.sm,
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
    heroMeta: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    splitBarContainer: {
      marginTop: space.xs,
    },
    statTilesRow: {
      flexDirection: "row",
      gap: space.xs,
    },
    horseHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: space.sm,
    },
    horseName: {
      fontSize: 15,
      fontWeight: "700",
    },
    horseMetaText: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    horseTotal: {
      fontSize: 16,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    horseMetricsGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: space.xs,
    },
    horseMetricCol: {
      flex: 1,
      gap: 2,
    },
    metricDotRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    microDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    microLabel: {
      fontSize: 11,
      fontWeight: "500",
    },
    microValue: {
      fontSize: 12,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    footnote: {
      fontSize: 11,
      lineHeight: 16,
      marginTop: space.xs,
      marginBottom: space.md,
      paddingHorizontal: 4,
    },
  });
