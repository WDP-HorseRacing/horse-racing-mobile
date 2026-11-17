import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { Screen } from "@/components/common";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { radius, space, type ThemeColors } from "@/config/theme";
import { stableCareService } from "@/services/stable-care.service";

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

export function UnappliedSurchargesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const load = useCallback(() => stableCareService.listUnappliedSurcharges(token!), [token]);
  const resource = useApiResource(load, Boolean(token));
  const surcharges = resource.data ?? [];
  const totalDaily = surcharges.reduce((sum, s) => sum + (s.dailyAmount || 0), 0);

  return (
    <Screen
      role="manager"
      title={t("Phụ phí chăm sóc")}
      subtitle={t("Phụ phí chưa áp dụng trên toàn CLB")}
      back
      fallbackHref="/manager"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={!resource.isLoading && !resource.error && surcharges.length === 0}
        emptyLabel={t("Không có phụ phí nào đang chờ áp dụng.")}
      />
      {surcharges.length > 0 ? (
        <View style={careStyles.surchargeSummaryCard}>
          <View style={careStyles.surchargeSummaryRow}>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Số lượng phụ phí")}</Text>
              <Text style={careStyles.surchargeSummaryValue}>
                {surcharges.length} {t("khoản")}
              </Text>
            </View>
            <View style={careStyles.surchargeSummaryCol}>
              <Text style={careStyles.surchargeSummaryLabel}>{t("Tổng cộng / ngày")}</Text>
              <Text style={[careStyles.surchargeSummaryValue, { color: colors.primary }]}>
                {formatVnd(totalDaily)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      {surcharges.map((surcharge) => (
        <View key={surcharge.id} style={careStyles.surchargeCard}>
          <View style={careStyles.surchargeCardHeader}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={careStyles.surchargeHorseName}>{surcharge.horseName}</Text>
                {surcharge.barnName ? (
                  <View style={careStyles.surchargeBarnBadge}>
                    <Ionicons name="home-outline" size={11} color={colors.primary} />
                    <Text style={careStyles.surchargeBarnText}>{surcharge.barnName}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={careStyles.surchargeDescription}>{surcharge.description}</Text>
            </View>
            <View style={careStyles.surchargeAmountBadge}>
              <Text style={careStyles.surchargeAmountText}>
                +{formatVnd(surcharge.dailyAmount)} / {t("ngày")}
              </Text>
            </View>
          </View>
          <View style={careStyles.surchargeMetaRow}>
            <View style={careStyles.surchargeMetaItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
              <Text style={careStyles.surchargeMetaText}>
                {surcharge.startDate} → {surcharge.endDate}
              </Text>
            </View>
            {surcharge.headTrainerName ? (
              <View style={careStyles.surchargeMetaItem}>
                <Ionicons name="person-outline" size={13} color={colors.mutedForeground} />
                <Text style={careStyles.surchargeMetaText}>
                  {t("HLV")}: {surcharge.headTrainerName}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ marginTop: space.xs }}>
            <SecondaryButton
              label={t("Mở chăm sóc ngựa")}
              icon="open-outline"
              onPress={() =>
                router.push(
                  ("/manager/horse/" + surcharge.horseId + "/stable-care?tab=Surcharges") as Href,
                )
              }
            />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const getCareStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    surchargeSummaryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      marginBottom: space.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    surchargeSummaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: space.sm,
    },
    surchargeSummaryCol: {
      flex: 1,
      gap: 3,
    },
    surchargeSummaryLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.mutedForeground,
    },
    surchargeSummaryValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
      fontVariant: ["tabular-nums"],
    },
    surchargeCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
      marginBottom: space.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    surchargeCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: space.sm,
    },
    surchargeHorseName: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.foreground,
    },
    surchargeDescription: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      marginTop: 2,
    },
    surchargeBarnBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: `${colors.primary}12`,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    surchargeBarnText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.primary,
    },
    surchargeAmountBadge: {
      backgroundColor: `${colors.primary}15`,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    surchargeAmountText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    surchargeMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.md,
      alignItems: "center",
    },
    surchargeMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    surchargeMetaText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
  });

export default UnappliedSurchargesScreen;
