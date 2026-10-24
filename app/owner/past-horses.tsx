import { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Panel, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import {
  horseService,
  type PastHorseDetailDto,
  type PastHorseListItemDto,
} from "@/services/horse.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { radius, space } from "@/config/theme";

export default function PastHorsesScreen() {
  const { colors } = useTheme();
  const ui = getUiStyles(colors);
  const { token } = useAuth();
  const { t } = useI18n();

  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<PastHorseDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadList = useCallback(() => horseService.listPastHorses(token!), [token]);
  const resource = useApiResource(loadList, Boolean(token));

  const openDetail = async (horse: PastHorseListItemDto) => {
    setSelectedHorseId(horse.horseId);
    setLoadingDetail(true);
    setDetailError("");
    setDetailData(null);
    try {
      const detail = await horseService.getPastHorse(token!, horse.horseId);
      setDetailData(detail);
    } catch (err) {
      setDetailError(extractErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedHorseId(null);
    setDetailData(null);
    setDetailError("");
  };

  const pastHorses = resource.data ?? [];

  return (
    <Screen
      role="owner"
      title="Ngựa đã bán"
      subtitle="Danh sách ngựa từng sở hữu đã chuyển nhượng hoặc bán ra ngoài"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
        empty={pastHorses.length === 0}
        emptyLabel="Bạn chưa có con ngựa nào đã bán hoặc chuyển nhượng"
      />

      <View style={{ gap: space.md }}>
        {pastHorses.map((item) => (
          <Pressable key={item.horseId} onPress={() => void openDetail(item)}>
            <Panel style={styles.card}>
              <View style={styles.cardRow}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
                ) : (
                  <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surface }]}>
                    <Ionicons name="hardware-chip-outline" size={24} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 17 }}>
                    {item.name}
                  </Text>
                  <View style={{ gap: 2 }}>
                    {item.periods.map((period, index) => (
                      <Text key={index} style={[ui.muted, { fontSize: 13 }]}>
                        {new Date(period.startedAt).toLocaleDateString()} —{" "}
                        {new Date(period.endedAt).toLocaleDateString()}
                      </Text>
                    ))}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </View>
            </Panel>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={Boolean(selectedHorseId)}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 18 }}>
                {detailData?.name ?? t("Thông tin ngựa đã bán")}
              </Text>
              <Pressable onPress={closeDetail} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}>
              {loadingDetail ? (
                <AsyncStateView isLoading={true} error={null} onRetry={() => undefined} />
              ) : detailError ? (
                <AsyncStateView
                  isLoading={false}
                  error={detailError}
                  onRetry={() => {
                    if (selectedHorseId) {
                      const horse = pastHorses.find((h) => h.horseId === selectedHorseId);
                      if (horse) void openDetail(horse);
                    }
                  }}
                />
              ) : detailData ? (
                <>
                  {detailData.photoUrl ? (
                    <Image source={{ uri: detailData.photoUrl }} style={styles.bannerImage} />
                  ) : null}

                  <Panel>
                    <SectionTitle>Thông tin cơ bản</SectionTitle>
                    <View style={styles.infoGrid}>
                      <View style={styles.infoItem}>
                        <Text style={ui.muted}>Giới tính</Text>
                        <Text style={{ fontWeight: "600" }}>{t(detailData.gender)}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={ui.muted}>Ngày sinh</Text>
                        <Text style={{ fontWeight: "600" }}>
                          {detailData.dateOfBirth
                            ? new Date(detailData.dateOfBirth).toLocaleDateString()
                            : "—"}
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={ui.muted}>Màu lông</Text>
                        <Text style={{ fontWeight: "600" }}>{detailData.color || "—"}</Text>
                      </View>
                    </View>
                  </Panel>

                  <Panel>
                    <SectionTitle>Khoảng thời gian từng sở hữu</SectionTitle>
                    <View style={{ gap: space.sm, marginTop: 4 }}>
                      {detailData.periods.map((p, idx) => (
                        <View key={idx} style={styles.periodRow}>
                          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                          <Text style={{ fontSize: 14 }}>
                            {new Date(p.startedAt).toLocaleDateString()} —{" "}
                            {new Date(p.endedAt).toLocaleDateString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Panel>

                  {detailData.ancestors && detailData.ancestors.length > 0 ? (
                    <Panel>
                      <SectionTitle>Phả hệ (2 đời)</SectionTitle>
                      <View style={{ gap: space.sm, marginTop: 4 }}>
                        {detailData.ancestors.map((ancestor, i) => {
                          const roleLabel =
                            ancestor.generation === 1
                              ? ancestor.parentRole === "SIRE"
                                ? t("Sire")
                                : t("Dam")
                              : ancestor.parentRole === "SIRE"
                                ? t("Grandfather")
                                : t("Grandmother");
                          return (
                            <View key={ancestor.id ?? i} style={styles.ancestorRow}>
                              <Text style={[ui.muted, { width: 110 }]}>{roleLabel}:</Text>
                              <Text style={{ fontWeight: "600", flex: 1 }}>{ancestor.name}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </Panel>
                  ) : null}

                  <SecondaryButton label="Đóng" onPress={closeDetail} />
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "85%",
    padding: space.lg,
    gap: space.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  bannerImage: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.xs,
  },
  infoItem: {
    minWidth: 100,
    gap: 2,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  ancestorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
