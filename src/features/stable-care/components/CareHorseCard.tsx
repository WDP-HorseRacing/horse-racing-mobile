import React from "react";
import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { getUiStyles } from "@/components/ui";
import { space } from "@/config/theme";
import type { HorseListItemDto, HorseHealthStatusDto } from "@/adapters/horse.adapter";
import type { HorseCareSummary } from "../screens/StableManagementScreen";
import type { RoleId } from "@/types/raceos";

interface CareHorseCardProps {
  horse: HorseListItemDto;
  summary?: HorseCareSummary;
  role: RoleId;
  styles: any;
  renderHealthBadge: (status: HorseHealthStatusDto) => React.ReactNode;
  renderChecklistCareBadge: (status: any, progress?: any) => React.ReactNode;
}

export function CareHorseCard({
  horse,
  summary,
  role,
  styles,
  renderHealthBadge,
  renderChecklistCareBadge,
}: CareHorseCardProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);

  const stallCode = horse.location.stall?.code ?? "—";
  const groomName = summary?.groomName;
  const checklistStatus = summary?.checklistStatus ?? "NOT_GENERATED";
  const progress = summary?.checklistProgress;
  const hasFeeding = summary?.feedingPlanStatus === "ACTIVE";
  const incidentsCount = summary?.openIncidentsCount ?? 0;

  return (
    <View style={styles.careHorseCard}>
      {/* Card Header: Stall Code + Horse Name + Health */}
      <View style={styles.careHorseCardHeader}>
        <View style={styles.stallCodeBadge}>
          <Text style={styles.stallCodeBadgeText}>
            {t("Stall")} {stallCode}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, marginHorizontal: space.xs }}>
          <Text style={styles.careHorseName} numberOfLines={1}>
            {horse.name}
          </Text>
          <Text style={uiStyles.muted} numberOfLines={1}>
            {[horse.breed, horse.gender, horse.microchipId].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {renderHealthBadge(horse.healthStatus)}
      </View>

      {/* 4 Care Aspects: Groom, Checklist, Feeding, Incidents */}
      <View style={styles.careAspectsGrid}>
        {/* 1. Assigned Groom */}
        <View style={styles.careAspectItem}>
          <View style={styles.careAspectLabelRow}>
            <Ionicons name="person-outline" size={13} color={colors.mutedForeground} />
            <Text style={styles.careAspectLabel}>{t("Groom")}</Text>
          </View>
          <Text
            style={[styles.careAspectValue, !groomName && { color: colors.destructive }]}
            numberOfLines={1}
          >
            {groomName ?? t("Unassigned Groom")}
          </Text>
        </View>

        {/* 2. Today's Checklist */}
        <View style={styles.careAspectItem}>
          <View style={styles.careAspectLabelRow}>
            <Ionicons name="checkbox-outline" size={13} color={colors.mutedForeground} />
            <Text style={styles.careAspectLabel}>{t("Checklist")}</Text>
          </View>
          {renderChecklistCareBadge(checklistStatus, progress)}
        </View>

        {/* 3. Feeding Plan */}
        <View style={styles.careAspectItem}>
          <View style={styles.careAspectLabelRow}>
            <Ionicons name="restaurant-outline" size={13} color={colors.mutedForeground} />
            <Text style={styles.careAspectLabel}>{t("Feeding plan")}</Text>
          </View>
          <Text
            style={[
              styles.careAspectValue,
              hasFeeding ? { color: colors.primary } : { color: colors.mutedForeground },
            ]}
            numberOfLines={1}
          >
            {hasFeeding
              ? `${t("Active")} (${summary?.feedingPlanMealsCount ?? 0} ${t("meals")})`
              : t("No plan")}
          </Text>
        </View>

        {/* 4. Incidents */}
        <View style={styles.careAspectItem}>
          <View style={styles.careAspectLabelRow}>
            <Ionicons name="warning-outline" size={13} color={colors.mutedForeground} />
            <Text style={styles.careAspectLabel}>{t("Incidents")}</Text>
          </View>
          <Text
            style={[
              styles.careAspectValue,
              incidentsCount > 0 ? { color: colors.destructive } : { color: colors.primary },
            ]}
            numberOfLines={1}
          >
            {incidentsCount > 0 ? `${incidentsCount} ${t("open incident(s)")}` : t("Normal")}
          </Text>
        </View>
      </View>

      {/* Action Buttons for Horse Care */}
      <View style={styles.careCardActionsRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/${role}/horse/${horse.id}/stable-care` as Href)}
          style={styles.careActionBtnPrimary}
        >
          <Ionicons name="restaurant-outline" size={14} color={colors.primaryForeground} />
          <Text style={styles.careActionBtnPrimaryText}>{t("Diet & Care")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/${role}/horse/${horse.id}/placement` as Href)}
          style={styles.careActionBtnSecondary}
        >
          <Ionicons name="people-outline" size={14} color={colors.foreground} />
          <Text style={styles.careActionBtnSecondaryText}>{t("Stall & Groom")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
