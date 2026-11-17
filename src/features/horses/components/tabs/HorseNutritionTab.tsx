import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle } from "@/components/common";
import { Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/lib/raceos-data";
import type { stableCareService } from "@/services/stable-care.service";

export type HorseNutritionTabProps = {
  horseId: string;
  roleId: RoleId;
  surchargesResource: {
    isLoading: boolean;
    error: unknown;
    data: Awaited<ReturnType<typeof stableCareService.listSurcharges>> | null;
    retry: () => void | Promise<unknown>;
  };
};

export function HorseNutritionTab({
  horseId,
  roleId,
  surchargesResource,
}: HorseNutritionTabProps) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  return (
    <View style={{ gap: space.md }}>
      {/* Quick Access: Chuồng trại & Dinh dưỡng */}
      <View style={uiStyles.section}>
        <SectionTitle>Chăm sóc chuồng trại & Dinh dưỡng</SectionTitle>
        <View style={{ gap: space.sm }}>
          <Pressable
            onPress={() =>
              router.push(`/${roleId}/horse/${horseId}/stable-care?tab=Feeding plan` as Href)
            }
            style={styles.actionGridTile}
          >
            <View
              style={[
                styles.actionGridIconWrap,
                { backgroundColor: "rgba(16, 185, 129, 0.12)" },
              ]}
            >
              <Ionicons name="leaf-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.actionGridTitle}>Khẩu phần & Kế hoạch dinh dưỡng</Text>
              <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                Xem lịch ăn 4 bữa & khẩu phần ngũ cốc, cỏ khô
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            onPress={() =>
              router.push(`/${roleId}/horse/${horseId}/stable-care?tab=Care tasks` as Href)
            }
            style={styles.actionGridTile}
          >
            <View
              style={[
                styles.actionGridIconWrap,
                { backgroundColor: "rgba(59, 130, 246, 0.12)" },
              ]}
            >
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.actionGridTitle}>Nhiệm vụ chăm sóc định kỳ</Text>
              <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                Chải lông, tắm rửa, kiểm tra móng & xoa bóp
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>

          {["manager", "trainer", "groom"].includes(roleId) ? (
            <Pressable
              onPress={() =>
                router.push(
                  `/${roleId}/horse/${horseId}/stable-care?tab=Daily checklist` as Href,
                )
              }
              style={styles.actionGridTile}
            >
              <View
                style={[
                  styles.actionGridIconWrap,
                  { backgroundColor: "rgba(245, 158, 11, 0.12)" },
                ]}
              >
                <Ionicons name="checkbox-outline" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.actionGridTitle}>Checklist chăm sóc hàng ngày</Text>
                <Text style={styles.actionGridSubtitle} numberOfLines={1}>
                  Điểm danh & xác nhận công việc chuồng
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Care Surcharges (Phụ phí chăm sóc) */}
      {["manager", "trainer", "owner"].includes(roleId) ? (
        <View style={uiStyles.section}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SectionTitle>Phụ phí chăm sóc đặc biệt</SectionTitle>
            <Pressable
              onPress={() =>
                router.push(`/${roleId}/horse/${horseId}/stable-care?tab=Surcharges` as Href)
              }
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                Quản lý phụ phí →
              </Text>
            </Pressable>
          </View>

          <AsyncStateView
            isLoading={surchargesResource.isLoading}
            error={surchargesResource.error}
            onRetry={() => void surchargesResource.retry()}
            empty={
              !surchargesResource.isLoading &&
              !surchargesResource.error &&
              (surchargesResource.data?.length ?? 0) === 0
            }
            emptyLabel="Không có phụ phí chăm sóc nào đang áp dụng cho ngựa này."
          />

          {(surchargesResource.data ?? []).map((surcharge) => (
            <Panel key={surcharge.id} style={{ gap: space.xs, padding: space.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="cash-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={[uiStyles.value, { fontSize: 14 }]} numberOfLines={1}>
                    {surcharge.description}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary }}>
                  {surcharge.dailyAmount.toLocaleString("vi-VN")} đ / ngày
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                <Text style={uiStyles.muted}>
                  {surcharge.startDate} → {surcharge.endDate}
                </Text>
                <Text style={uiStyles.muted}>·</Text>
                <Text style={uiStyles.muted}>
                  {surcharge.appliedByName ? `Bởi ${surcharge.appliedByName}` : "Chờ duyệt"}
                </Text>
              </View>
            </Panel>
          ))}

          <PrimaryButton
            label={
              roleId === "manager"
                ? "Thêm hoặc điều chỉnh phụ phí"
                : "Xem chi tiết phụ phí"
            }
            icon="cash-outline"
            onPress={() =>
              router.push(`/${roleId}/horse/${horseId}/stable-care?tab=Surcharges` as Href)
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    actionGridTile: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionGridIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    actionGridTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    actionGridSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
  });
}

export default HorseNutritionTab;
