import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import type { PerformanceMetricPointDto } from "@/services/performance.service";
import { formatTime } from "@/utils/formatters";

type Props = {
  isStreaming: boolean;
  emittedCount: number;
  lastPoint: PerformanceMetricPointDto | null;
  onToggleStreaming: () => void;
  onEmitSpike: () => void | Promise<void>;
  onEmitSinglePoint: () => void | Promise<void>;
  disabled?: boolean;
  isSending?: boolean;
};

export function IoTSimulatorControlCard({
  isStreaming,
  emittedCount,
  lastPoint,
  onToggleStreaming,
  onEmitSpike,
  onEmitSinglePoint,
  disabled = false,
  isSending = false,
}: Props) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isStreaming) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      animation?.stop();
    };
  }, [isStreaming, pulseAnim]);

  const hrColor = !lastPoint
    ? colors.foreground
    : lastPoint.heartRateBpm >= 240
      ? colors.destructive
      : lastPoint.heartRateBpm >= 180
        ? colors.monitor
        : colors.fit;

  const hrStatusLabel = !lastPoint
    ? "Chưa phát"
    : lastPoint.heartRateBpm >= 240
      ? "NGUY CẤP"
      : lastPoint.heartRateBpm >= 180
        ? "CẢNH BÁO"
        : "BÌNH THƯỜNG";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isStreaming ? colors.primary : colors.border,
          borderWidth: isStreaming ? 2 : 1,
          shadowColor: isStreaming ? colors.primary : "#000",
          shadowOpacity: isStreaming ? 0.15 : 0.05,
          shadowRadius: isStreaming ? 8 : 4,
          elevation: isStreaming ? 4 : 1,
        },
      ]}
    >
      {/* Header with status badge */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: isStreaming ? colors.fitSoft : colors.muted },
            ]}
          >
            <Ionicons
              name="hardware-chip-outline"
              size={18}
              color={isStreaming ? colors.primary : colors.mutedForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Giả lập cảm biến IoT
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Mô phỏng phát dữ liệu nhịp tim & vận tốc thời gian thực
            </Text>
          </View>
        </View>

        {/* Live indicator badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isStreaming ? colors.fitSoft : colors.muted,
              borderColor: isStreaming ? colors.primary : colors.border,
            },
          ]}
        >
          {isStreaming ? (
            <Animated.View
              style={[
                styles.liveDot,
                { backgroundColor: colors.primary, opacity: pulseAnim },
              ]}
            />
          ) : (
            <View
              style={[styles.liveDot, { backgroundColor: colors.mutedForeground }]}
            />
          )}
          <Text
            style={[
              styles.statusText,
              {
                color: isStreaming ? colors.primary : colors.mutedForeground,
                fontWeight: isStreaming ? "700" : "600",
              },
            ]}
          >
            {isStreaming ? "Đang phát trực tiếp (3s)" : "Đang dừng"}
          </Text>
        </View>
      </View>

      {/* Live Readout Dashboard (2x2 Grid) */}
      <View
        style={[
          styles.readoutGrid,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <View style={styles.readoutItem}>
          <Text style={[styles.readoutLabel, { color: colors.mutedForeground }]}>
            Điểm đã phát
          </Text>
          <Text style={[styles.readoutValue, { color: colors.foreground }]}>
            {emittedCount}
          </Text>
        </View>

        <View style={styles.readoutItem}>
          <Text style={[styles.readoutLabel, { color: colors.mutedForeground }]}>
            Nhịp tim hiện tại
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <Text style={[styles.readoutValue, { color: hrColor }]}>
              {lastPoint ? lastPoint.heartRateBpm : "—"}
            </Text>
            {lastPoint && (
              <Text style={{ fontSize: 11, fontWeight: "600", color: hrColor }}>
                bpm
              </Text>
            )}
          </View>
        </View>

        <View style={styles.readoutItem}>
          <Text style={[styles.readoutLabel, { color: colors.mutedForeground }]}>
            Vận tốc
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <Text style={[styles.readoutValue, { color: colors.foreground }]}>
              {lastPoint ? lastPoint.speedMps.toFixed(1) : "—"}
            </Text>
            {lastPoint && (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: colors.mutedForeground,
                }}
              >
                m/s
              </Text>
            )}
          </View>
        </View>

        <View style={styles.readoutItem}>
          <Text style={[styles.readoutLabel, { color: colors.mutedForeground }]}>
            Mức cảnh báo
          </Text>
          <View
            style={[
              styles.levelChip,
              {
                backgroundColor:
                  lastPoint?.heartRateBpm && lastPoint.heartRateBpm >= 240
                    ? colors.injuredSoft
                    : lastPoint?.heartRateBpm && lastPoint.heartRateBpm >= 180
                      ? colors.monitorSoft
                      : colors.fitSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.levelChipText,
                { color: hrColor },
              ]}
              numberOfLines={1}
            >
              {hrStatusLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Controls */}
      <View style={styles.actionsContainer}>
        {/* Row 1: Main Streaming Toggle */}
        <PrimaryButton
          label={
            isStreaming
              ? "Tạm dừng phát tín hiệu"
              : "Phát nhịp tim tự động (1s/lần)"
          }
          icon={isStreaming ? "pause" : "pulse"}
          disabled={disabled || isSending}
          onPress={onToggleStreaming}
          style={
            isStreaming
              ? { backgroundColor: colors.monitor, borderColor: colors.monitor }
              : undefined
          }
        />

        {/* Row 2: Acute Heart Rate Spike Button (CRITICAL 248 BPM) */}
        <Pressable
          disabled={disabled || isSending}
          onPress={onEmitSpike}
          style={({ pressed }) => [
            styles.spikeButton,
            {
              backgroundColor: colors.destructive,
              opacity: disabled || isSending ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.spikeButtonContent}>
            <Ionicons name="flash" size={17} color="#FFFFFF" />
            <Text style={styles.spikeButtonText}>
              ⚡ Kích hoạt vọt nhịp tim (248 bpm)
            </Text>
          </View>
          <Text style={styles.spikeButtonHint}>
            Phát xung nhịp tim 248 bpm (≥ 240 bpm) để kích hoạt cảnh báo nguy cấp tới Bác sĩ & HLV
          </Text>
        </Pressable>

        {/* Row 3: Single Test Point */}
        <SecondaryButton
          label="Gửi 1 điểm đo chuẩn (135 - 160 bpm)"
          icon="add-circle-outline"
          disabled={disabled || isSending}
          onPress={onEmitSinglePoint}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    flexWrap: "wrap",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flex: 1,
    minWidth: 200,
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
  },
  readoutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    rowGap: space.sm,
  },
  readoutItem: {
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 3,
  },
  readoutLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  readoutValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  levelChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 2,
  },
  levelChipText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  actionsContainer: {
    gap: space.sm,
  },
  spikeButton: {
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    gap: 4,
  },
  spikeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  spikeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  spikeButtonHint: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
});
