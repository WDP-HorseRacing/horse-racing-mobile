import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, type ThemeColors } from "@/config/theme";
import type { FeedingMealName } from "@/services/stable-care.service";
import { clubDate } from "@/utils/horse-validation";

export const MEALS: FeedingMealName[] = ["EARLY_MORNING", "NOON", "AFTERNOON", "EVENING"];

export const MEAL_METADATA: Record<
  FeedingMealName,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  EARLY_MORNING: {
    label: "Early morning",
    icon: "sunny-outline",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
  },
  NOON: {
    label: "Noon",
    icon: "sunny",
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.12)",
  },
  AFTERNOON: {
    label: "Afternoon",
    icon: "partly-sunny-outline",
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.12)",
  },
  EVENING: {
    label: "Evening",
    icon: "moon-outline",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
  },
};

export const QUICK_QUANTITIES = [0.5, 1, 2, 5];
export const TASK_DURATION_PRESETS = [1, 3, 7, 14, 30];
export const CHECKLIST_RANGE_PRESETS = [7, 14, 30];


export function todayDate(): string {
  return clubDate();
}
export function daysAgoDate(days: number): string {
  const date = new Date(clubDate() + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

export function getCareStyles(colors: ThemeColors) {
  return StyleSheet.create({
    planCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    planCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: space.sm,
    },
    planHorseName: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    planCreatorText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    mealsContainer: {
      gap: space.sm,
    },
    mealBox: {
      backgroundColor: colors.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.xs,
    },
    mealBoxHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.xs,
    },
    mealBoxTitle: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.1,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: space.xs,
    },
    createPlanBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    createPlanBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    cardActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      marginTop: space.xs,
    },
    mealItemsWrap: {
      gap: 8,
      marginTop: space.xs,
    },
    mealItemCard: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.sm,
      paddingVertical: 7,
      gap: 4,
    },
    mealItemHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    mealItemName: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
      flex: 1,
    },
    mealItemQtyBadge: {
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    mealItemQtyText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
    },
    mealItemNoteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
    },
    mealItemNote: {
      fontSize: 11,
      fontStyle: "italic",
      color: colors.mutedForeground,
      flexShrink: 1,
    },
    mealEmptyText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontStyle: "italic",
      paddingVertical: 2,
    },
    planNoteBox: {
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
      padding: space.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    planNoteText: {
      fontSize: 13,
      color: colors.foreground,
    },
    builderCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.md,
      marginTop: space.sm,
    },
    builderHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      paddingBottom: space.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    builderTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },

    // Modal & Builder Styles
    modalHorseBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.fitSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: space.sm,
    },
    modalHorseIconContainer: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    modalHorseBannerLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
      textTransform: "uppercase",
    },
    modalHorseBannerName: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.foreground,
    },
    mealGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    mealGridCard: {
      width: "48%",
      backgroundColor: colors.elevated,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: space.sm,
      gap: 6,
    },
    mealGridHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    mealIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    mealItemCountBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
    },
    mealItemCountText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    mealGridLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    quickChipsRow: {
      flexDirection: "row",
      gap: space.xs,
      alignItems: "center",
      flexWrap: "wrap",
    },
    quickQtyChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickQtyChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    quickQtyChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    quickQtyChipTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    taskTypeCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
    },
    taskTypeIconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    taskTypeContent: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    taskTypeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    taskTypeName: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    taskTypeStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    taskTypeStatusText: {
      fontSize: 11,
      fontWeight: "700",
    },
    taskTypeMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    taskTypeScopePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    taskTypeScopeText: {
      fontSize: 11,
      fontWeight: "600",
    },
    taskTypeActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      flexWrap: "wrap",
    },
    taskTypeActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
    },
    taskTypeActionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    taskTypeActionBtnDanger: {
      borderColor: colors.injuredSoft,
      backgroundColor: colors.injuredSoft,
    },
    taskTypeActionBtnSuccess: {
      borderColor: colors.fitSoft,
      backgroundColor: colors.fitSoft,
    },
    taskTypeSearchInput: {
      flex: 1,
      height: 40,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: space.sm,
      color: colors.foreground,
      fontSize: 14,
    },
    configuredLineCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.sm,
      gap: 8,
    },
    lineStepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    stepperBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperQtyDisplay: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
      paddingHorizontal: 4,
    },
    stepperQtyText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.foreground,
    },
    stepperQtyUnit: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    lineActionBtn: {
      padding: 5,
      marginLeft: 2,
    },
    modalBottomActions: {
      gap: space.sm,
      marginTop: space.sm,
      paddingTop: space.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    taskCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
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
    dateRangeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateRangeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    checklistCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    checklistItemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: space.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: space.sm,
    },
  });
}
