import React from "react";
import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { SectionTitle } from "@/components/common";
import { Panel } from "@/components/ui";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { getUiStyles } from "@/components/ui";
import { space } from "@/config/theme";
import type { HorseListItemDto, HorseHealthStatusDto } from "@/adapters/horse.adapter";
import type { RoleId } from "@/types/raceos";

interface UnassignedHorsesSectionProps {
  unassignedTab: "barn" | "stall" | "groom";
  setUnassignedTab: (tab: "barn" | "stall" | "groom") => void;
  pendingBarnHorses: HorseListItemDto[];
  pendingStallHorses: HorseListItemDto[];
  pendingGroomHorses: HorseListItemDto[];
  totalAwaitingPlacement: number;
  role: RoleId;
  styles: any;
  renderHealthBadge: (status: HorseHealthStatusDto) => React.ReactNode;
}

export function UnassignedHorsesSection({
  unassignedTab,
  setUnassignedTab,
  pendingBarnHorses,
  pendingStallHorses,
  pendingGroomHorses,
  totalAwaitingPlacement,
  role,
  styles,
  renderHealthBadge,
}: UnassignedHorsesSectionProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);

  return (
    <View style={[uiStyles.section, { marginTop: space.md }]}>
      <View style={uiStyles.row}>
        <SectionTitle>{t("Awaiting placement")}</SectionTitle>
        <View style={styles.pendingCountPill}>
          <Text style={styles.pendingCountPillText}>
            {totalAwaitingPlacement} {t("horses")}
          </Text>
        </View>
      </View>

      {/* Segmented control to prevent overlap and distinguish placement tiers */}
      <View style={styles.segmentContainer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setUnassignedTab("barn")}
          style={[styles.segmentBtn, unassignedTab === "barn" && styles.segmentBtnActive]}
        >
          <Text
            style={[
              styles.segmentBtnText,
              unassignedTab === "barn" && styles.segmentBtnTextActive,
            ]}
          >
            {t("Awaiting barn")} ({pendingBarnHorses.length})
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setUnassignedTab("stall")}
          style={[styles.segmentBtn, unassignedTab === "stall" && styles.segmentBtnActive]}
        >
          <Text
            style={[
              styles.segmentBtnText,
              unassignedTab === "stall" && styles.segmentBtnTextActive,
            ]}
          >
            {t("Awaiting stall")} ({pendingStallHorses.length})
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setUnassignedTab("groom")}
          style={[styles.segmentBtn, unassignedTab === "groom" && styles.segmentBtnActive]}
        >
          <Text
            style={[
              styles.segmentBtnText,
              unassignedTab === "groom" && styles.segmentBtnTextActive,
            ]}
          >
            {t("Awaiting Groom")} ({pendingGroomHorses.length})
          </Text>
        </Pressable>
      </View>

      {unassignedTab === "barn" ? (
        pendingBarnHorses.length === 0 ? (
          <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
            <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
            <Text style={[uiStyles.muted, { marginTop: 4 }]}>
              {t("All horses assigned to barns")}
            </Text>
          </Panel>
        ) : (
          <View style={{ gap: space.xs }}>
            {pendingBarnHorses.map((horse) => (
              <View key={horse.id} style={styles.unassignedCard}>
                <View style={styles.unassignedCardHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.unassignedHorseName} numberOfLines={1}>
                      {horse.name}
                    </Text>
                    <Text style={uiStyles.muted} numberOfLines={1}>
                      {[horse.breed, horse.gender, horse.microchipId]
                        .filter(Boolean)
                        .join(" · ") || t("No barn assigned")}
                    </Text>
                  </View>
                  {renderHealthBadge(horse.healthStatus)}
                </View>
                <View style={styles.unassignedCardFooter}>
                  <View style={styles.unassignedStatusNote}>
                    <Ionicons name="alert-circle-outline" size={13} color={colors.monitor} />
                    <Text
                      style={[styles.unassignedStatusNoteText, { color: colors.monitor }]}
                    >
                      {t("waiting for barn assignment")}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push(`/${role}/horse/${horse.id}/placement` as Href)
                    }
                    style={styles.unassignedActionBtn}
                  >
                    <Ionicons
                      name="business-outline"
                      size={14}
                      color={colors.primaryForeground}
                    />
                    <Text style={styles.unassignedActionBtnText}>{t("Assign barn")}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )
      ) : unassignedTab === "stall" ? (
        pendingStallHorses.length === 0 ? (
          <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
            <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
            <Text style={[uiStyles.muted, { marginTop: 4 }]}>
              {t("All horses assigned to stalls")}
            </Text>
          </Panel>
        ) : (
          <View style={{ gap: space.xs }}>
            {pendingStallHorses.map((horse) => (
              <View key={horse.id} style={styles.unassignedCard}>
                <View style={styles.unassignedCardHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.unassignedHorseName} numberOfLines={1}>
                      {horse.name}
                    </Text>
                    <Text style={uiStyles.muted} numberOfLines={1}>
                      {horse.location.barn?.name ?? t("Barn")}:{" "}
                      {[horse.breed, horse.microchipId].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {renderHealthBadge(horse.healthStatus)}
                </View>
                <View style={styles.unassignedCardFooter}>
                  <View style={styles.unassignedStatusNote}>
                    <Ionicons name="home-outline" size={13} color={colors.primary} />
                    <Text style={[styles.unassignedStatusNoteText, { color: colors.primary }]}>
                      {horse.location.barn?.name || t("Barn")} ·{" "}
                      {t("waiting for stall placement")}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/${role}/horse/${horse.id}/placement` as Href)}
                    style={styles.unassignedActionBtn}
                  >
                    <Ionicons
                      name="checkmark-outline"
                      size={14}
                      color={colors.primaryForeground}
                    />
                    <Text style={styles.unassignedActionBtnText}>{t("Assign stall")}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )
      ) : pendingGroomHorses.length === 0 ? (
        <Panel style={{ paddingVertical: space.md, alignItems: "center" }}>
          <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
          <Text style={[uiStyles.muted, { marginTop: 4 }]}>
            {t("Tất cả ngựa đã có Groom chăm sóc")}
          </Text>
        </Panel>
      ) : (
        <View style={{ gap: space.xs }}>
          {pendingGroomHorses.map((horse) => (
            <View key={horse.id} style={styles.unassignedCard}>
              <View style={styles.unassignedCardHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.unassignedHorseName} numberOfLines={1}>
                    {horse.name}
                  </Text>
                  <Text style={uiStyles.muted} numberOfLines={1}>
                    {horse.location.barn?.name ?? t("Barn")} · {t("Stall")}{" "}
                    {horse.location.stall?.code ?? "—"}
                  </Text>
                </View>
                {renderHealthBadge(horse.healthStatus)}
              </View>
              <View style={styles.unassignedCardFooter}>
                <View style={styles.unassignedStatusNote}>
                  <Ionicons name="people-outline" size={13} color={colors.monitor} />
                  <Text style={[styles.unassignedStatusNoteText, { color: colors.monitor }]}>
                    {t("Đã có ô, chờ phân công Groom")}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/${role}/horse/${horse.id}/placement` as Href)}
                  style={styles.unassignedActionBtn}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={14}
                    color={colors.primaryForeground}
                  />
                  <Text style={styles.unassignedActionBtnText}>{t("Giao Groom")}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
