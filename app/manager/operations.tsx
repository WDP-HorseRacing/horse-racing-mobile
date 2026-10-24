import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { Chips, Panel, getUiStyles } from "@/components/ui";
import { TimelineItem, Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { auditService } from "@/services/audit.service";
import { formatDateTime } from "@/utils/formatters";
import { space, radius } from "@/config/theme";
import { roles } from "@/features/auth/roles";

export default function Operations() {
  const auditFilters = [
    { label: "All activity", feature: undefined },
    { label: "Horse ownership", feature: "HORSE_OWNER" },
    { label: "Medical visits", feature: "MED_VISIT" },
    { label: "Case visits", feature: "MED_CASE_VISIT" },
    { label: "Training", feature: "TRAIN_SESSION" },
    { label: "Incidents", feature: "INCIDENT" },
  ] as const;
  const [auditFilterLabel, setAuditFilterLabel] = useState("All activity");
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);
  const { token } = useAuth();
  const activeAuditFilter = auditFilters.find((filter) => filter.label === auditFilterLabel);
  const loadAuditLog = useCallback(
    () => auditService.list(token!, 20, { feature: activeAuditFilter?.feature }),
    [activeAuditFilter?.feature, token],
  );
  const auditResource = useApiResource(loadAuditLog, Boolean(token));
  const auditLog = auditResource.data ?? [];

  return (
    <Screen
      role="manager"
      title="Operations"
      subtitle="Staff, finance, training, and care management"
      refreshing={auditResource.isRefreshing}
      onRefresh={() => void auditResource.refresh()}
    >
      <View style={uiStyles.section}>
        <SectionTitle>Management Areas</SectionTitle>
        {roles.manager.secondary.map((item) => (
          <Pressable
            key={item.path}
            accessibilityRole="button"
            style={styles.card}
            onPress={() => router.push(item.path as Href)}
          >
            <View style={styles.iconBox}>
              <Ionicons
                name={item.icon as React.ComponentProps<typeof Ionicons>["name"]}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>

      <View style={uiStyles.section}>
        <SectionTitle>Recent activity (Audit Log)</SectionTitle>
        <Chips
          options={auditFilters.map((filter) => filter.label)}
          value={auditFilterLabel}
          onChange={setAuditFilterLabel}
        />
        <AsyncStateView
          isLoading={auditResource.isLoading}
          error={auditResource.error}
          onRetry={() => void auditResource.retry()}
          empty={Boolean(auditResource.data && auditLog.length === 0)}
          emptyLabel="No audit activity has been recorded."
        />
        {auditLog.length ? (
          <Panel>
            {auditLog.slice(0, 5).map((entry, index) => (
              <TimelineItem
                key={entry.id}
                time={formatDateTime(entry.createdAt)}
                title={entry.action}
                detail={`${entry.actor?.fullName ?? "System"} · ${entry.entityType} · ${entry.entityId.slice(0, 8)}${entry.reason ? ` · ${entry.reason}` : ""}`}
                tone={index === 0 ? colors.destructive : colors.training}
                last={index === 4}
              />
            ))}
          </Panel>
        ) : null}
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      padding: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.md,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.fitSoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: space.md,
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
  });
