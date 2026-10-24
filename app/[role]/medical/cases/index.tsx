import { Redirect, router, type Href, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen } from "@/components/common";
import { NativeInput, PrimaryButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useTheme } from "@/hooks/useTheme";
import { isRole } from "@/features/auth/roles";
import { horseService } from "@/services/horse.service";
import { medicalService, type MedicalCaseSummaryDto } from "@/services/medical.service";
import type { HorseListItemDto } from "@/adapters/horse.adapter";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime, formatVnd } from "@/utils/formatters";
import { radius, space } from "@/config/theme";

type CaseFilterStatus = "ALL" | "OPEN" | "CLOSED";

interface EnrichedMedicalCase extends MedicalCaseSummaryDto {
  horse?: HorseListItemDto;
}

export default function MedicalCasesListScreen() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const role = isRole(roleParam) ? roleParam : null;
  const { token } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [filter, setFilter] = useState<CaseFilterStatus>("ALL");
  const [search, setSearch] = useState("");

  const canView = role && ["vet", "manager", "trainer", "owner"].includes(role);

  const fetchData = useCallback(async () => {
    const [casesRes, horsesRes] = await Promise.all([
      medicalService.listAllCases(token!).catch(() => []),
      horseService.list(token!, "", { includeDeleted: false }).catch(() => []),
    ]);

    const map: Record<string, HorseListItemDto> = {};
    for (const h of horsesRes) {
      map[h.id] = h;
    }
    return { cases: casesRes, horsesMap: map };
  }, [token]);

  const resource = useApiResource(fetchData, Boolean(token && canView));
  useRefreshOnFocus(resource.revalidate);

  const cases = useMemo(() => resource.data?.cases ?? [], [resource.data]);
  const horsesMap = useMemo(() => resource.data?.horsesMap ?? {}, [resource.data]);
  const loading = resource.isLoading;
  const error = resource.error ? extractErrorMessage(resource.error) : null;

  const enrichedCases: EnrichedMedicalCase[] = useMemo(() => {
    return cases.map((c) => ({
      ...c,
      horse: horsesMap[c.horseId],
    }));
  }, [cases, horsesMap]);

  const filteredCases = useMemo(() => {
    let result = enrichedCases;

    // Filter by status tab
    if (filter === "OPEN") {
      result = result.filter((c) => c.status === "OPEN");
    } else if (filter === "CLOSED") {
      result = result.filter((c) => c.status === "CLOSED");
    }

    // Filter by search query
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.horse?.name.toLowerCase().includes(q) ||
          (c.horse?.microchipId && c.horse.microchipId.toLowerCase().includes(q)) ||
          (c.initialDiagnosis && c.initialDiagnosis.toLowerCase().includes(q)) ||
          (c.finalConclusion && c.finalConclusion.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [enrichedCases, filter, search]);

  const openCount = useMemo(() => cases.filter((c) => c.status === "OPEN").length, [cases]);
  const closedCount = useMemo(() => cases.filter((c) => c.status === "CLOSED").length, [cases]);

  if (!role) return <Redirect href="/" />;
  if (!canView) return <Redirect href={`/${role}` as Href} />;

  return (
    <Screen
      role={role}
      title="Bệnh án y tế"
      subtitle="Hồ sơ bệnh án và lịch sử điều trị của câu lạc bộ"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Top action bar */}
      {role === "vet" ? (
        <View style={styles.topActions}>
          <PrimaryButton
            label="Ghi nhận khám bệnh mới"
            icon="medkit-outline"
            onPress={() => router.push(`/${role}/medical/visit` as Href)}
          />
        </View>
      ) : null}

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.mutedForeground}
          style={{ marginLeft: 12 }}
        />
        <NativeInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên ngựa, số chip, chẩn đoán..."
          style={styles.searchInput}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <Pressable
          onPress={() => setFilter("ALL")}
          style={[styles.filterTab, filter === "ALL" && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, filter === "ALL" && styles.filterTabTextActive]}>
            Tất cả ({cases.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("OPEN")}
          style={[styles.filterTab, filter === "OPEN" && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, filter === "OPEN" && styles.filterTabTextActive]}>
            Đang điều trị ({openCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("CLOSED")}
          style={[styles.filterTab, filter === "CLOSED" && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, filter === "CLOSED" && styles.filterTabTextActive]}>
            Đã đóng ({closedCount})
          </Text>
        </Pressable>
      </View>

      {/* Loading & Error States */}
      {loading && !cases.length ? (
        <AsyncStateView isLoading={true} error={null} onRetry={() => void resource.retry()} />
      ) : error && !cases.length ? (
        <AsyncStateView isLoading={false} error={error} onRetry={() => void resource.retry()} />
      ) : null}

      {/* Empty State */}
      {!loading && filteredCases.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="folder-open-outline" size={44} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Không tìm thấy bệnh án</Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? "Không có hồ sơ bệnh án nào khớp với từ khóa tìm kiếm."
              : filter === "OPEN"
                ? "Hiện tại không có bệnh án nào đang mở điều trị."
                : "Chưa có bệnh án nào được ghi nhận."}
          </Text>
        </View>
      ) : null}

      {/* Case Cards List */}
      <View style={styles.casesList}>
        {filteredCases.map((item) => {
          const isOpen = item.status === "OPEN";
          const horseName = item.horse?.name ?? "Ngựa hồ sơ";
          const location = item.horse?.location;
          const barnName = location?.barn?.name ?? "Chưa phân khu";
          const stallCode = location?.stall?.code ? ` · Ô ${location.stall.code}` : "";

          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/${role}/medical/cases/${item.id}` as Href)}
              style={[styles.caseCard, isOpen && styles.caseCardOpen]}
            >
              {/* Header row: Horse info & Status Pill */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.horseInfoRow}>
                  <View style={[styles.horseAvatar, isOpen && styles.horseAvatarOpen]}>
                    <Ionicons
                      name="paw"
                      size={18}
                      color={isOpen ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.horseNameText} numberOfLines={1}>
                      {horseName}
                    </Text>
                    <Text style={styles.horseLocationText}>
                      {barnName}
                      {stallCode}
                      {item.horse?.microchipId ? ` · Chip: ${item.horse.microchipId}` : ""}
                    </Text>
                  </View>
                </View>

                {/* Status Badge */}
                <View
                  style={[
                    styles.statusBadge,
                    isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed,
                  ]}
                >
                  <Ionicons
                    name={isOpen ? "pulse-outline" : "checkmark-circle-outline"}
                    size={12}
                    color={isOpen ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isOpen ? styles.statusBadgeTextOpen : styles.statusBadgeTextClosed,
                    ]}
                  >
                    {isOpen ? "ĐANG ĐIỀU TRỊ" : "ĐÃ ĐÓNG"}
                  </Text>
                </View>
              </View>

              {/* Diagnosis Box */}
              <View style={styles.diagnosisBox}>
                <Ionicons
                  name="medkit-outline"
                  size={15}
                  color={colors.primary}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.diagnosisLabel}>Chẩn đoán ban đầu:</Text>
                  <Text style={styles.diagnosisText}>
                    {item.initialDiagnosis || "Chưa ghi nhận chẩn đoán chi tiết"}
                  </Text>
                </View>
              </View>

              {/* Final Conclusion if closed */}
              {item.finalConclusion ? (
                <View style={styles.conclusionBox}>
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color={colors.mutedForeground}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conclusionLabel}>Kết luận cuối:</Text>
                    <Text style={styles.conclusionText} numberOfLines={2}>
                      {item.finalConclusion}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Footer row: Dates & Cost & Action chevron */}
              <View style={styles.cardFooter}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateText}>Bắt đầu: {formatDateTime(item.openedAt)}</Text>
                  {item.closedAt ? (
                    <Text style={styles.dateText}>Đóng: {formatDateTime(item.closedAt)}</Text>
                  ) : null}
                </View>

                <View style={styles.costAndChevron}>
                  {typeof item.totalCost === "number" ? (
                    <View style={styles.costBadge}>
                      <Text style={styles.costBadgeText}>{formatVnd(item.totalCost)}</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    topActions: {
      marginBottom: space.sm,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.sm,
    },
    searchInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: "transparent",
      paddingHorizontal: space.sm,
    },
    filterTabs: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
      marginBottom: space.md,
    },
    filterTab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: radius.sm,
    },
    filterTabActive: {
      backgroundColor: colors.primary,
    },
    filterTabText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    filterTabTextActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      padding: space.xl,
      gap: space.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: space.sm,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: space.xs,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      maxWidth: 280,
    },
    casesList: {
      gap: space.sm,
    },
    caseCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.sm,
    },
    caseCardOpen: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    horseInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      flex: 1,
    },
    horseAvatar: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    horseAvatarOpen: {
      backgroundColor: colors.fitSoft,
    },
    horseNameText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    horseLocationText: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    statusBadgeOpen: {
      backgroundColor: colors.fitSoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    statusBadgeClosed: {
      backgroundColor: colors.muted,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    statusBadgeTextOpen: {
      color: colors.primary,
    },
    statusBadgeTextClosed: {
      color: colors.mutedForeground,
    },
    diagnosisBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: colors.background,
      padding: space.sm,
      borderRadius: radius.sm,
    },
    diagnosisLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    diagnosisText: {
      fontSize: 13,
      color: colors.foreground,
      fontWeight: "500",
      marginTop: 1,
    },
    conclusionBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: colors.muted,
      padding: space.sm,
      borderRadius: radius.sm,
    },
    conclusionLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    conclusionText: {
      fontSize: 12,
      color: colors.foreground,
      marginTop: 1,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: 2,
    },
    dateCol: {
      gap: 2,
    },
    dateText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },
    costAndChevron: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
    },
    costBadge: {
      backgroundColor: colors.fitSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    costBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
  });
}
