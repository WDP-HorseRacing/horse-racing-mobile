import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { radius, space } from "@/config/theme";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { clubDate } from "@/utils/horse-validation";
import { isDateOnly } from "@/features/stable-care/stable-care-validation";

export type PeriodPresetKey = "this_month" | "last_month" | "30d" | "this_quarter";

export interface PeriodPresetOption {
  key: PeriodPresetKey;
  label: string;
}

export const PERIOD_PRESETS: PeriodPresetOption[] = [
  { key: "this_month", label: "Tháng này" },
  { key: "last_month", label: "Tháng trước" },
  { key: "30d", label: "30 ngày qua" },
  { key: "this_quarter", label: "Quý này" },
];

export function getPresetDates(preset: PeriodPresetKey): { from: string; to: string } {
  const today = clubDate();
  const [y, m, d] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (preset === "this_month") {
    return {
      from: `${y}-${pad(m)}-01`,
      to: today,
    };
  }

  if (preset === "last_month") {
    const prevYear = m === 1 ? y - 1 : y;
    const prevMonth = m === 1 ? 12 : m - 1;
    const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    return {
      from: `${prevYear}-${pad(prevMonth)}-01`,
      to: `${prevYear}-${pad(prevMonth)}-${pad(lastDay)}`,
    };
  }

  if (preset === "30d") {
    const dt = new Date(`${today}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - 30);
    return {
      from: dt.toISOString().slice(0, 10),
      to: today,
    };
  }

  if (preset === "this_quarter") {
    const qStart = Math.floor((m - 1) / 3) * 3 + 1;
    return {
      from: `${y}-${pad(qStart)}-01`,
      to: today,
    };
  }

  return { from: `${y}-${pad(m)}-01`, to: today };
}

export function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value))) + " ₫";
}

/* =========================================================================
   DATE RANGE SELECTOR COMPONENT
   ========================================================================= */

export interface DateRangeBarProps {
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }) => void;
  isLoading?: boolean;
}

export function DateRangeBar({ from, to, onApply, isLoading }: DateRangeBarProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  // Determine active preset if matching
  const activePreset = useMemo<PeriodPresetKey | null>(() => {
    for (const p of PERIOD_PRESETS) {
      const dates = getPresetDates(p.key);
      if (dates.from === draftFrom && dates.to === draftTo) {
        return p.key;
      }
    }
    return null;
  }, [draftFrom, draftTo]);

  const handleSelectPreset = (key: PeriodPresetKey) => {
    const dates = getPresetDates(key);
    setDraftFrom(dates.from);
    setDraftTo(dates.to);
    onApply(dates);
  };

  const handleApply = () => {
    if (!isDateOnly(draftFrom) || !isDateOnly(draftTo) || draftFrom > draftTo) {
      Alert.alert(
        t("Kiểm tra ngày báo cáo"),
        t("Vui lòng nhập ngày hợp lệ định dạng YYYY-MM-DD và Từ ngày không được sau Đến ngày."),
      );
      return;
    }
    onApply({ from: draftFrom, to: draftTo });
  };

  const isInvalid = Boolean(
    (draftFrom && !isDateOnly(draftFrom)) ||
      (draftTo && !isDateOnly(draftTo)) ||
      (draftFrom && draftTo && draftFrom > draftTo),
  );

  return (
    <View style={[styles.dateBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Preset Chips */}
      <View style={styles.presetsRow}>
        {PERIOD_PRESETS.map((p) => {
          const isActive = activePreset === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => handleSelectPreset(p.key)}
              style={[
                styles.presetChip,
                {
                  backgroundColor: isActive ? colors.primary : colors.elevated,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  {
                    color: isActive ? "#ffffff" : colors.foreground,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {t(p.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Inline Date Inputs + Filter Button */}
      <View style={styles.inputsRow}>
        <View style={[styles.inputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} style={styles.inputIcon} />
          <Text style={[styles.inputPrefix, { color: colors.mutedForeground }]}>{t("Từ")}:</Text>
          <TextInput
            style={[styles.dateInput, { color: colors.foreground }]}
            value={draftFrom}
            onChangeText={setDraftFrom}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />

        <View style={[styles.inputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} style={styles.inputIcon} />
          <Text style={[styles.inputPrefix, { color: colors.mutedForeground }]}>{t("Đến")}:</Text>
          <TextInput
            style={[styles.dateInput, { color: colors.foreground }]}
            value={draftTo}
            onChangeText={setDraftTo}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Pressable
          onPress={handleApply}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8 },
            isLoading && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="filter" size={14} color="#ffffff" />
          <Text style={styles.applyBtnText}>{t("Lọc")}</Text>
        </Pressable>
      </View>

      {isInvalid ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {t("Từ ngày phải trước hoặc bằng Đến ngày (YYYY-MM-DD).")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* =========================================================================
   SPLIT BAR COMPONENT (HORIZONTAL SEGMENTED PROPORTIONS)
   ========================================================================= */

export interface SplitPart {
  key: string;
  label: string;
  value: number;
  color: string;
  text?: string;
}

export interface SplitBarProps {
  parts: SplitPart[];
  totalOverride?: number;
  height?: number;
  showLegend?: boolean;
}

export function SplitBar({ parts, totalOverride, height = 10, showLegend = true }: SplitBarProps) {
  const { colors } = useTheme();
  const total = totalOverride ?? parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);

  return (
    <View style={styles.splitBarWrapper}>
      {/* Horizontal Bar Track */}
      <View
        style={[
          styles.splitBarTrack,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: colors.muted,
          },
        ]}
      >
        {total > 0 &&
          parts.map((part) => {
            if (part.value <= 0) return null;
            const pct = Math.max(1, Math.min(100, (part.value / total) * 100));
            return (
              <View
                key={part.key}
                style={[
                  styles.splitBarSegment,
                  {
                    width: `${pct}%`,
                    backgroundColor: part.color,
                  },
                ]}
              />
            );
          })}
      </View>

      {/* Legend with percentage & amounts */}
      {showLegend && (
        <View style={styles.legendContainer}>
          {parts.map((part) => {
            const pct = total > 0 ? Math.round((part.value / total) * 100) : 0;
            return (
              <View
                key={part.key}
                style={[
                  styles.legendPill,
                  {
                    backgroundColor: colors.elevated,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.legendDot, { backgroundColor: part.color }]} />
                <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>
                  {part.label}:{" "}
                  <Text style={[styles.legendValue, { color: colors.foreground }]}>
                    {part.text ?? formatVnd(part.value)}
                  </Text>{" "}
                  <Text style={[styles.legendPercent, { color: colors.mutedForeground }]}>
                    ({pct}%)
                  </Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* =========================================================================
   MINI SPLIT BAR (FOR CARDS / ITEMS)
   ========================================================================= */

export function MiniSplitBar({
  parts,
  total,
  height = 6,
}: {
  parts: { key: string; value: number; color: string }[];
  total: number;
  height?: number;
}) {
  const { colors } = useTheme();
  if (total <= 0) return null;

  return (
    <View
      style={[
        styles.miniSplitTrack,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: colors.muted,
        },
      ]}
    >
      {parts.map((part) => {
        if (part.value <= 0) return null;
        const pct = Math.max(1, Math.min(100, (part.value / total) * 100));
        return (
          <View
            key={part.key}
            style={[
              styles.splitBarSegment,
              {
                width: `${pct}%`,
                backgroundColor: part.color,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/* =========================================================================
   STAT TILE / METRIC CARD
   ========================================================================= */

export interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
}

export function StatTile({ label, value, sub, icon, accentColor }: StatTileProps) {
  const { colors } = useTheme();
  const themeAccent = accentColor ?? colors.primary;

  return (
    <View
      style={[
        styles.statTileCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.statTileHeader}>
        <Text style={[styles.statTileLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
          {label}
        </Text>
        {icon ? (
          <View
            style={[
              styles.statTileIconBox,
              { backgroundColor: `${themeAccent}18` },
            ]}
          >
            <Ionicons name={icon} size={15} color={themeAccent} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.statTileValue, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.statTileSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/* =========================================================================
   STYLES
   ========================================================================= */

const styles = StyleSheet.create({
  dateBarContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
    gap: space.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
  },
  inputsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    height: 38,
  },
  inputIcon: {
    marginRight: 4,
  },
  inputPrefix: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 4,
  },
  dateInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: radius.sm,
    justifyContent: "center",
  },
  applyBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
  },
  splitBarWrapper: {
    gap: space.sm,
  },
  splitBarTrack: {
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
  },
  splitBarSegment: {
    height: "100%",
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
  },
  legendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
  },
  legendValue: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  legendPercent: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  miniSplitTrack: {
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
  },
  statTileCard: {
    flex: 1,
    minWidth: 105,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.sm + 2,
    gap: 3,
  },
  statTileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statTileLabel: {
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  statTileIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statTileValue: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statTileSub: {
    fontSize: 10,
  },
});
