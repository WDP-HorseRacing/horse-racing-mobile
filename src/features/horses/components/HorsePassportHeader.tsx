import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { Panel } from "@/components/ui";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { formatEnum } from "@/utils/formatters";
import { ageFromDateOfBirth, type HorseDetailDto } from "@/adapters/horse.adapter";

type HorsePassportHeaderProps = {
  horse: HorseDetailDto;
  photoResource: { data?: { url: string } | null };
};

export function HorsePassportHeader({ horse, photoResource }: HorsePassportHeaderProps) {
  const { colors } = useTheme();
  return (
      <Panel style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg }}>
        {/* Top Header: Avatar + Horse Identity */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
          {/* Avatar / Portrait or Shield Badge */}
          {photoResource.data?.url ? (
            <Image
              source={{ uri: photoResource.data.url }}
              accessibilityLabel={`${horse.name} portrait`}
              style={{ width: 68, height: 68, borderRadius: 16 }}
            />
          ) : (
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 16,
                backgroundColor: colors.fitSoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: `${colors.primary}33`,
              }}
            >
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
          )}

          {/* Horse Identity Details */}
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
                {horse.name}
              </Text>
              <View
                style={{
                  backgroundColor: colors.fitSoft,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: radius.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    fontWeight: "700",
                    color: colors.primary,
                  }}
                >
                  #{horse.id.slice(0, 8)}
                </Text>
              </View>
            </View>

            {/* Microchip */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="hardware-chip-outline" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "monospace" }}>
                Chip: {horse.microchipId ? `...${horse.microchipId.slice(-6)}` : "Chưa gắn chip"}
              </Text>
            </View>

            {/* Age, Sex, Breed, Color */}
            <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
              {horse.dateOfBirth ? `${ageFromDateOfBirth(horse.dateOfBirth)} tuổi · ` : ""}
              {horse.gender ? formatEnum(horse.gender) : "Chưa ghi nhận"} · {horse.breed ? formatEnum(horse.breed) : "Chưa ghi nhận"} ·{" "}
              {horse.color ? formatEnum(horse.color) : "Chưa ghi nhận"}
            </Text>

            {/* Health & Status Badges */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              {horse.healthStatus ? (
                <View
                  style={{
                    backgroundColor:
                      horse.healthStatus === "INJURED"
                        ? colors.injuredSoft
                        : horse.healthStatus === "UNDER_OBSERVATION"
                          ? colors.monitorSoft
                          : colors.fitSoft,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color:
                        horse.healthStatus === "INJURED"
                          ? colors.destructive
                          : horse.healthStatus === "UNDER_OBSERVATION"
                            ? colors.monitor
                            : colors.fit,
                    }}
                  >
                    {formatEnum(horse.healthStatus)}
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  backgroundColor: colors.fitSoft,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                  {formatEnum(horse.lifecycleStatus)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Passport Quick Info Box (Rows: Sức khỏe, Vị trí chuồng, Chủ sở hữu, Groom chăm sóc) */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: space.sm,
            paddingVertical: space.xs,
            gap: 6,
            marginTop: 4,
          }}
        >
          {/* Row 1: Tình trạng sức khỏe */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="medkit-outline" size={15} color={colors.fit} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Tình trạng sức khỏe:
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color:
                    horse.healthStatus === "INJURED"
                      ? colors.destructive
                      : horse.healthStatus === "UNDER_OBSERVATION"
                        ? colors.monitor
                        : colors.fit,
                }}
              >
                {formatEnum(horse.healthStatus)}
              </Text>
            </View>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />

          {/* Row 2: Vị trí chuồng & Ô */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="location-outline" size={15} color={colors.training} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Vị trí chuồng & ô:
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.foreground,
                flex: 1,
                textAlign: "right",
              }}
              numberOfLines={1}
            >
              {horse.location?.barn?.name ?? "Chưa xếp khu"}
              {horse.location?.stall?.code ? ` · Ô ${horse.location.stall.code}` : ""}
            </Text>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />

          {/* Row 3: Chủ sở hữu */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="person-circle-outline" size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Chủ sở hữu:
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.foreground,
                flex: 1,
                textAlign: "right",
              }}
              numberOfLines={1}
            >
              {horse.owner?.fullName ?? "Chưa phân công"}
            </Text>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />

          {/* Row 4: Groom chăm sóc */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 2,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>
                Groom chăm sóc:
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.foreground,
                flex: 1,
                textAlign: "right",
              }}
              numberOfLines={1}
            >
              {horse.groom?.fullName ?? "Chưa phân công"}
            </Text>
          </View>
        </View>
      </Panel>
  );
}
