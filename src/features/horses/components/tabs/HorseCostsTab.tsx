import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle } from "@/components/common";
import { Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/types/raceos";
import type { stableCareService } from "@/services/stable-care.service";

export type HorseCostsTabProps = {
  horseId: string;
  roleId: RoleId;
  medicalResource: {
    isLoading: boolean;
    error: unknown;
    data: any;
    retry: () => void | Promise<unknown>;
  };
  surchargesResource: {
    isLoading: boolean;
    error: unknown;
    data: Awaited<ReturnType<typeof stableCareService.listSurcharges>> | null;
    retry: () => void | Promise<unknown>;
  };
};

export function HorseCostsTab({
  horseId,
  roleId,
  medicalResource,
  surchargesResource,
}: HorseCostsTabProps) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);

  return (
    <>
      <AsyncStateView
        isLoading={medicalResource.isLoading}
        error={medicalResource.error}
        onRetry={() => void medicalResource.retry()}
      />
      {medicalResource.data ? (
        <View style={{ gap: space.md }}>
          {/* Cost Summary Header Cards */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            <View
              style={{
                flex: 1,
                minWidth: "47%",
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: space.md,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="cash-outline" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground }}>
                  Tổng chi phí y tế
                </Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                {medicalResource.data.cases.totalCost != null
                  ? `${medicalResource.data.cases.totalCost.toLocaleString("vi-VN")} đ`
                  : "0 đ"}
              </Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                {medicalResource.data.cases.items.length} ca bệnh đã ghi nhận
              </Text>
            </View>

            {["manager", "owner", "trainer"].includes(roleId) ? (
              <View
                style={{
                  flex: 1,
                  minWidth: "47%",
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: space.md,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      backgroundColor: "rgba(59, 130, 246, 0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="receipt-outline" size={16} color="#3B82F6" />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground }}>
                    Phụ phí chăm sóc
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                  {(surchargesResource.data ?? [])
                    .reduce((sum, item) => sum + item.dailyAmount, 0)
                    .toLocaleString("vi-VN")}{" "}
                  đ/ngày
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {(surchargesResource.data ?? []).length} khoản đang áp dụng
                </Text>
              </View>
            ) : null}
          </View>

          {/* Visits with costs breakdown */}
          <View style={uiStyles.section}>
            <SectionTitle>Lịch sử khám & chi phí từng buổi</SectionTitle>
            {medicalResource.data.records.length ? (
              medicalResource.data.records.map((record: any) => {
                const totalItemCost =
                  record.items?.reduce(
                    (sum: number, item: any) => sum + (item.cost || 0),
                    0,
                  ) || 0;
                return (
                  <Pressable
                    key={record.id}
                    onPress={() =>
                      router.push(`/${roleId}/medical/visits/${record.id}` as Href)
                    }
                  >
                    <Panel style={{ gap: space.xs, padding: space.md }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={[uiStyles.value, { fontSize: 14, fontWeight: "700" }]}>
                          {record.purpose}
                        </Text>
                        {totalItemCost > 0 ? (
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "800",
                              color: colors.primary,
                            }}
                          >
                            {totalItemCost.toLocaleString("vi-VN")} đ
                          </Text>
                        ) : (
                          <Text style={uiStyles.muted}>Miễn phí</Text>
                        )}
                      </View>
                      <Text style={uiStyles.muted}>
                        {record.visitedAt} · {record.vet?.fullName ?? "Bác sĩ"}
                      </Text>
                    </Panel>
                  </Pressable>
                );
              })
            ) : (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => undefined}
                empty
                emptyLabel="Không có lịch sử khám bệnh nào có chi phí."
              />
            )}
          </View>

          {/* Surcharges Section in Costs Tab */}
          {["manager", "trainer", "owner"].includes(roleId) ? (
            <View style={uiStyles.section}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <SectionTitle>Khoản phụ phí chăm sóc hàng ngày</SectionTitle>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/${roleId}/horse/${horseId}/stable-care?tab=Surcharges` as Href,
                    )
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
                emptyLabel="Không có khoản phụ phí nào ghi nhận cho ngựa này."
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
                    <Text
                      style={[
                        uiStyles.value,
                        { fontSize: 14, fontWeight: "700", flex: 1, minWidth: 0 },
                      ]}
                      numberOfLines={1}
                    >
                      {surcharge.description}
                    </Text>
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
                  router.push(
                    `/${roleId}/horse/${horseId}/stable-care?tab=Surcharges` as Href,
                  )
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export default HorseCostsTab;
