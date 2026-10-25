import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import {
  DateRangeBar,
  MiniSplitBar,
  Panel,
  PrimaryButton,
  SecondaryButton,
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

export default function ManagerReports() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { token } = useAuth();

  const today = clubDate();
  const initialFrom = today.slice(0, 7) + "-01";
  const [range, setRange] = useState({ from: initialFrom, to: today });

  const load = useCallback(
    () => reportsService.getClubFinance(token!, range.from, range.to),
    [range.from, range.to, token],
  );
  const resource = useApiResource(load, Boolean(token));
  const report = resource.data;

  // SplitBar parts for club owner charges
  const chargeParts = useMemo(() => {
    if (!report) return [];
    return [
      {
        key: "dailyFee",
        label: t("Phí nuôi"),
        value: report.ownerCharges.dailyFee,
        color: FEE_COLOR,
        text: formatVnd(report.ownerCharges.dailyFee),
      },
      {
        key: "medicalCost",
        label: t("Y tế"),
        value: report.ownerCharges.medicalCost,
        color: MEDICAL_COLOR,
        text: formatVnd(report.ownerCharges.medicalCost),
      },
      {
        key: "surcharge",
        label: t("Phụ phí"),
        value: report.ownerCharges.surcharge,
        color: SURCHARGE_COLOR,
        text: formatVnd(report.ownerCharges.surcharge),
      },
    ];
  }, [report, t]);

  return (
    <Screen
      role="manager"
      title={t("Báo cáo CLB")}
      subtitle={report ? `${report.from} → ${report.to}` : t("Tổng hợp tài chính theo kỳ")}
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
          {/* Hero Financial Summary Card */}
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
                <Ionicons name="cash-outline" size={20} color={FEE_COLOR} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                  {t("Khoản thu của chủ ngựa")}
                </Text>
                <Text style={[styles.heroTotal, { color: colors.foreground }]}>
                  {formatVnd(report.ownerCharges.total)}
                </Text>
              </View>
            </View>

            <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
              {report.from} → {report.to} · {report.owners.length} {t("chủ ngựa")}
            </Text>

            {/* SplitBar Horizontal Proportional Bar Chart */}
            <View style={styles.splitBarContainer}>
              <SplitBar parts={chargeParts} height={12} showLegend />
            </View>
          </View>

          {/* Supply Costs & Inventory Section */}
          <View style={ui.section}>
            <SectionTitle>{t("Chi phí vật tư & Tồn kho")}</SectionTitle>
            <View style={styles.statTilesRow}>
              <StatTile
                label={t("Tiền nhập vật tư")}
                value={formatVnd(report.supplies.purchased)}
                sub={t("Không gồm tồn đầu")}
                icon="cart-outline"
                accentColor="#0284c7"
              />
              <StatTile
                label={t("Vật tư đã dùng")}
                value={formatVnd(report.supplies.used)}
                sub={t("Theo đơn giá lô")}
                icon="cube-outline"
                accentColor="#d97706"
              />
              <StatTile
                label={t("Tồn kho cuối kỳ")}
                value={formatVnd(report.supplies.inventoryValue)}
                sub={t("Giá trị hiện tại")}
                icon="file-tray-full-outline"
                accentColor="#059669"
              />
            </View>
          </View>

          {/* By Horse Owner Section with Mini Charts */}
          <View style={ui.section}>
            <View style={styles.sectionHeaderRow}>
              <SectionTitle>{`${t("Theo chủ ngựa")} (${report.owners.length})`}</SectionTitle>
            </View>
            {report.owners.length ? (
              report.owners.map((owner) => {
                const ownerParts = [
                  { key: "fee", value: owner.dailyFee, color: FEE_COLOR },
                  { key: "medical", value: owner.medicalCost, color: MEDICAL_COLOR },
                  { key: "surcharge", value: owner.surcharge, color: SURCHARGE_COLOR },
                ];
                return (
                  <Panel key={owner.ownerId}>
                    <View style={styles.ownerHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[ui.value, styles.ownerName]} numberOfLines={1}>
                          {owner.ownerName}
                        </Text>
                      </View>
                      <Text style={[styles.ownerTotal, { color: colors.foreground }]}>
                        {formatVnd(owner.total)}
                      </Text>
                    </View>

                    {/* Mini proportional bar for owner */}
                    {owner.total > 0 ? (
                      <View style={{ marginVertical: space.xs }}>
                        <MiniSplitBar parts={ownerParts} total={owner.total} height={6} />
                      </View>
                    ) : null}

                    {/* Breakdown 3-column metrics */}
                    <View style={styles.ownerMetricsGrid}>
                      <View style={styles.ownerMetricCol}>
                        <View style={styles.metricDotRow}>
                          <View style={[styles.microDot, { backgroundColor: FEE_COLOR }]} />
                          <Text style={[styles.microLabel, { color: colors.mutedForeground }]}>
                            {t("Phí nuôi")}
                          </Text>
                        </View>
                        <Text style={[styles.microValue, { color: colors.foreground }]}>
                          {formatVnd(owner.dailyFee)}
                        </Text>
                      </View>

                      <View style={styles.ownerMetricCol}>
                        <View style={styles.metricDotRow}>
                          <View style={[styles.microDot, { backgroundColor: MEDICAL_COLOR }]} />
                          <Text style={[styles.microLabel, { color: colors.mutedForeground }]}>
                            {t("Y tế")}
                          </Text>
                        </View>
                        <Text style={[styles.microValue, { color: colors.foreground }]}>
                          {formatVnd(owner.medicalCost)}
                        </Text>
                      </View>

                      <View style={styles.ownerMetricCol}>
                        <View style={styles.metricDotRow}>
                          <View style={[styles.microDot, { backgroundColor: SURCHARGE_COLOR }]} />
                          <Text style={[styles.microLabel, { color: colors.mutedForeground }]}>
                            {t("Phụ phí")}
                          </Text>
                        </View>
                        <Text style={[styles.microValue, { color: colors.foreground }]}>
                          {formatVnd(owner.surcharge)}
                        </Text>
                      </View>
                    </View>
                  </Panel>
                );
              })
            ) : (
              <Panel>
                <Text style={ui.muted}>
                  {t("Không có chủ ngựa nào phát sinh chi phí trong kỳ này.")}
                </Text>
              </Panel>
            )}
          </View>

          {/* Quick Management Shortcuts */}
          <View style={[ui.section, { gap: space.sm }]}>
            <SectionTitle>{t("Thao tác quản lý")}</SectionTitle>
            <PrimaryButton
              label={t("Xem phụ phí chưa áp dụng")}
              icon="cash-outline"
              onPress={() => router.push("/manager/surcharges")}
            />
            <SecondaryButton
              label={t("Quản lý mức phí nuôi")}
              icon="settings-outline"
              onPress={() => router.push("/manager/daily-fees")}
            />
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
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    ownerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: space.sm,
    },
    ownerName: {
      fontSize: 15,
      fontWeight: "700",
    },
    ownerTotal: {
      fontSize: 16,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    ownerMetricsGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: space.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: space.xs,
    },
    ownerMetricCol: {
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
  });
