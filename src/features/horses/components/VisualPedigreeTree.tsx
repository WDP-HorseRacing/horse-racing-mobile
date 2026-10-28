import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Text } from "@/components/common/LocalizedText";
import { useTheme } from "@/hooks/useTheme";
import { radius, space } from "@/config/theme";
import type { HorsePedigreeDto } from "@/adapters/horse.adapter";

type Ancestor = HorsePedigreeDto["ancestors"][number];

type Props = {
  subject: {
    id: string;
    name: string;
    breed?: string | null;
    color?: string | null;
    gender?: string | null;
  };
  pedigree: HorsePedigreeDto | null;
  roleId: string;
};

export function VisualPedigreeTree({ subject, pedigree, roleId }: Props) {
  const { colors } = useTheme();

  const ancestors = pedigree?.ancestors ?? [];
  const sire = ancestors.find((a) => a.generation === 1 && a.parentRole === "SIRE");
  const dam = ancestors.find((a) => a.generation === 1 && a.parentRole === "DAM");

  const paternalGrandsire = ancestors.find(
    (a) => a.generation === 2 && a.childId === sire?.id && a.parentRole === "SIRE",
  );
  const paternalGranddam = ancestors.find(
    (a) => a.generation === 2 && a.childId === sire?.id && a.parentRole === "DAM",
  );

  const maternalGrandsire = ancestors.find(
    (a) => a.generation === 2 && a.childId === dam?.id && a.parentRole === "SIRE",
  );
  const maternalGranddam = ancestors.find(
    (a) => a.generation === 2 && a.childId === dam?.id && a.parentRole === "DAM",
  );

  const openHorse = (ancestor: Ancestor) => {
    if (ancestor.canOpen) {
      router.push(`/${roleId}/horse/${ancestor.id}` as Href);
    }
  };

  const renderNodeCard = ({
    title,
    roleType,
    ancestor,
    isGrandparent = false,
  }: {
    title: string;
    roleType: "sire" | "dam";
    ancestor?: Ancestor | null;
    isGrandparent?: boolean;
  }) => {
    const isSireLine = roleType === "sire";
    const accentColor = isSireLine ? colors.training : "#EC4899";
    const accentSoft = isSireLine ? colors.trainingSoft : "#FDF2F8";

    if (!ancestor) {
      return (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
            isGrandparent && styles.grandparentCardSize,
          ]}
        >
          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.roleBadgeText, { color: colors.mutedForeground }]}>{title}</Text>
            </View>
          </View>
          <Text style={[styles.emptyName, { color: colors.mutedForeground }]}>Chưa có hồ sơ</Text>
        </View>
      );
    }

    return (
      <Pressable
        disabled={!ancestor.canOpen}
        onPress={() => openHorse(ancestor)}
        style={({ pressed }) => [
          styles.nodeCard,
          {
            backgroundColor: colors.surface,
            borderColor: ancestor.canOpen ? accentColor : colors.border,
            borderLeftColor: accentColor,
            borderLeftWidth: 3.5,
          },
          isGrandparent && styles.grandparentCardSize,
          pressed && ancestor.canOpen && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.roleBadge,
              {
                backgroundColor: accentSoft,
              },
            ]}
          >
            <Ionicons
              name={isSireLine ? "male-outline" : "female-outline"}
              size={12}
              color={accentColor}
            />
            <Text style={[styles.roleBadgeText, { color: accentColor }]}>{title}</Text>
          </View>

          {ancestor.canOpen && (
            <View style={styles.linkIndicator}>
              <Ionicons name="arrow-forward-circle-outline" size={14} color={accentColor} />
            </View>
          )}
        </View>

        <Text
          style={[styles.nodeName, { color: colors.foreground }, isGrandparent && { fontSize: 13 }]}
          numberOfLines={1}
        >
          {ancestor.name}
        </Text>

        <Text style={[styles.nodeDetails, { color: colors.mutedForeground }]} numberOfLines={1}>
          {[ancestor.breed, ancestor.color].filter(Boolean).join(" · ") || "Ngựa đã đăng ký"}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <View style={[styles.iconBox, { backgroundColor: colors.fitSoft }]}>
            <Ionicons name="git-network-outline" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Sơ đồ phả hệ (Pedigree Tree)
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Truy nguyên nguồn gốc phụ mẫu & tổ phụ thế hệ
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.training }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Dòng cha ♂</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EC4899" }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Dòng mẹ ♀</Text>
          </View>
        </View>
      </View>

      {/* Generation 0: Subject Horse */}
      <View style={styles.subjectWrapper}>
        <View
          style={[
            styles.subjectCard,
            {
              backgroundColor: colors.background,
              borderColor: colors.primary,
            },
          ]}
        >
          <View style={styles.subjectBadgeRow}>
            <View style={[styles.subjectBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.subjectBadgeText}>Ngựa chủ thể</Text>
            </View>
            <Text style={[styles.subjectMicrochip, { color: colors.mutedForeground }]}>
              {subject.gender ?? "Ngựa"}
            </Text>
          </View>
          <Text style={[styles.subjectName, { color: colors.foreground }]} numberOfLines={1}>
            {subject.name}
          </Text>
          <Text
            style={[styles.subjectDetails, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {[subject.breed, subject.color].filter(Boolean).join(" · ") || "Hồ sơ chính"}
          </Text>
        </View>

        {/* Downward Connector to Gen 1 */}
        <View style={styles.forkStem}>
          <View style={[styles.stemLine, { backgroundColor: colors.borderStrong }]} />
          <View style={[styles.forkLine, { borderColor: colors.borderStrong }]} />
        </View>
      </View>

      {/* Generation 1 & 2 Columns (Paternal vs Maternal) */}
      <View style={styles.branchesRow}>
        {/* Left Column: SIRE LINE (Dòng Cha) */}
        <View style={styles.branchColumn}>
          {renderNodeCard({
            title: "Ngựa Cha (Sire)",
            roleType: "sire",
            ancestor: sire,
          })}

          {/* Sub-fork to Grandparents */}
          <View style={styles.subForkContainer}>
            <View style={[styles.subStem, { backgroundColor: colors.borderStrong }]} />
            <View style={[styles.subFork, { borderColor: colors.borderStrong }]} />
          </View>

          {/* Generation 2: Paternal Grandparents */}
          <View style={styles.grandparentsRow}>
            <View style={{ flex: 1 }}>
              {renderNodeCard({
                title: "Ông nội",
                roleType: "sire",
                ancestor: paternalGrandsire,
                isGrandparent: true,
              })}
            </View>
            <View style={{ flex: 1 }}>
              {renderNodeCard({
                title: "Bà nội",
                roleType: "dam",
                ancestor: paternalGranddam,
                isGrandparent: true,
              })}
            </View>
          </View>
        </View>

        {/* Right Column: DAM LINE (Dòng Mẹ) */}
        <View style={styles.branchColumn}>
          {renderNodeCard({
            title: "Ngựa Mẹ (Dam)",
            roleType: "dam",
            ancestor: dam,
          })}

          {/* Sub-fork to Grandparents */}
          <View style={styles.subForkContainer}>
            <View style={[styles.subStem, { backgroundColor: colors.borderStrong }]} />
            <View style={[styles.subFork, { borderColor: colors.borderStrong }]} />
          </View>

          {/* Generation 2: Maternal Grandparents */}
          <View style={styles.grandparentsRow}>
            <View style={{ flex: 1 }}>
              {renderNodeCard({
                title: "Ông ngoại",
                roleType: "sire",
                ancestor: maternalGrandsire,
                isGrandparent: true,
              })}
            </View>
            <View style={{ flex: 1 }}>
              {renderNodeCard({
                title: "Bà ngoại",
                roleType: "dam",
                ancestor: maternalGranddam,
                isGrandparent: true,
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.sm,
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: "600",
  },
  subjectWrapper: {
    alignItems: "center",
    width: "100%",
  },
  subjectCard: {
    width: "70%",
    maxWidth: 280,
    borderRadius: radius.md,
    padding: space.sm,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 3,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  subjectBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  subjectBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  subjectMicrochip: {
    fontSize: 11,
    fontWeight: "600",
  },
  subjectName: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 2,
  },
  subjectDetails: {
    fontSize: 11,
    textAlign: "center",
  },
  forkStem: {
    alignItems: "center",
    width: "100%",
    height: 22,
  },
  stemLine: {
    width: 2,
    height: 10,
  },
  forkLine: {
    width: "50%",
    height: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
  },
  branchesRow: {
    flexDirection: "row",
    gap: space.md,
    width: "100%",
  },
  branchColumn: {
    flex: 1,
    gap: 6,
  },
  nodeCard: {
    borderRadius: radius.md,
    padding: space.sm,
    borderWidth: 1,
    gap: 2,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  emptyCard: {
    borderRadius: radius.md,
    padding: space.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 2,
    opacity: 0.75,
  },
  grandparentCardSize: {
    minHeight: 65,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  linkIndicator: {
    padding: 2,
  },
  nodeName: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  emptyName: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  nodeDetails: {
    fontSize: 10,
  },
  subForkContainer: {
    alignItems: "center",
    width: "100%",
    height: 18,
  },
  subStem: {
    width: 1.5,
    height: 8,
  },
  subFork: {
    width: "50%",
    height: 10,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
  },
  grandparentsRow: {
    flexDirection: "row",
    gap: 6,
  },
});
