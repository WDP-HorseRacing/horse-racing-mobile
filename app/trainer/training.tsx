import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { Chips, Panel, PrimaryButton, SecondaryButton, getUiStyles } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { trainingService, type TrainingSessionDto } from "@/services/training.service";
import { formatDate } from "@/utils/formatters";
import { formatTrainingStatus } from "@/features/training/training-utils";
import { space } from "@/config/theme";
import { TrainingClassCalendarView } from "@/features/training/components/TrainingClassCalendarView";

type TrainingHubPayload = {
  classes: Awaited<ReturnType<typeof trainingService.listClasses>>;
  plans: Awaited<ReturnType<typeof trainingService.listPlans>>;
  sessions: TrainingSessionDto[];
};

export default function TrainerTraining() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const styles = getStyles(colors);
  const { token } = useAuth();
  const [tab, setTab] = useState("Classes");

  const load = useCallback(async (): Promise<TrainingHubPayload> => {
    const [classes, plans] = await Promise.all([
      trainingService.listClasses(token!),
      trainingService.listPlans(token!),
    ]);
    const sessionGroups = await Promise.all(
      classes.map((trainingClass) => trainingService.listClassSessions(token!, trainingClass.id)),
    );
    return { classes, plans, sessions: sessionGroups.flat() };
  }, [token]);
  const resource = useApiResource(load, Boolean(token));
  const payload = resource.data;
  const activeClasses = payload?.classes.filter((item) => item.status === "ACTIVE") ?? [];
  const liveSessions = payload?.sessions.filter((item) => item.status === "IN_PROGRESS") ?? [];
  const scheduledSessions = payload?.sessions.filter((item) => item.status === "SCHEDULED") ?? [];

  return (
    <Screen
      role="trainer"
      title="Training"
      subtitle="Plans, classes and scheduled sessions"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      {/* Compact Axis-Aligned KPI Stat Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiTile}>
          <View style={[styles.kpiIconBox, { backgroundColor: colors.fitSoft }]}>
            <Ionicons name="school-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.kpiContent}>
            <Text style={styles.kpiValue}>{activeClasses.length}</Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Lớp đang mở")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiTile}>
          <View style={[styles.kpiIconBox, { backgroundColor: colors.accent }]}>
            <Ionicons name="book-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.kpiContent}>
            <Text style={styles.kpiValue}>{payload?.plans.length ?? "—"}</Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Giáo án")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiTile}>
          <View style={[styles.kpiIconBox, { backgroundColor: colors.muted }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.mutedForeground} />
          </View>
          <View style={styles.kpiContent}>
            <Text style={styles.kpiValue}>{scheduledSessions.length}</Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Buổi đã xếp")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiTile}>
          <View
            style={[
              styles.kpiIconBox,
              {
                backgroundColor: liveSessions.length ? colors.injuredSoft : colors.muted,
              },
            ]}
          >
            <Ionicons
              name={liveSessions.length ? "radio" : "radio-outline"}
              size={18}
              color={liveSessions.length ? colors.destructive : colors.mutedForeground}
            />
          </View>
          <View style={styles.kpiContent}>
            <Text
              style={[
                styles.kpiValue,
                liveSessions.length > 0 && { color: colors.destructive },
              ]}
            >
              {liveSessions.length}
            </Text>
            <Text style={styles.kpiLabel} numberOfLines={1}>
              {t("Đang diễn ra")}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Hierarchy: Primary Hero Action + Sleek Secondary Action */}
      <View style={styles.actionSection}>
        <PrimaryButton
          label={t("Tạo lớp huấn luyện")}
          icon="add-circle-outline"
          onPress={() => router.push("/trainer/class/new" as Href)}
        />
        <SecondaryButton
          label={t("Quản lý giáo án")}
          icon="reader-outline"
          onPress={() => router.push("/trainer/plans" as Href)}
        />
      </View>

      <Chips options={["Classes", "Schedule"]} value={tab} onChange={setTab} />
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {payload && tab === "Classes" ? (
        <View style={ui.section}>
          <SectionTitle>{t("Training classes")}</SectionTitle>
          {payload.classes.length ? (
            payload.classes.map((trainingClass) => {
              const plan = payload.plans.find((p) => p.id === trainingClass.planId);
              return (
                <Pressable
                  key={trainingClass.id}
                  onPress={() => router.push(`/trainer/plan/${trainingClass.id}` as Href)}
                >
                  <Panel style={{ gap: space.xs }}>
                    {/* Header: Code badge and Status badge on top row, Class name on second row */}
                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>{trainingClass.code}</Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            trainingClass.status === "ACTIVE"
                              ? { backgroundColor: colors.fitSoft }
                              : { backgroundColor: colors.muted },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              trainingClass.status === "ACTIVE"
                                ? { color: colors.primary }
                                : { color: colors.mutedForeground },
                            ]}
                          >
                            {formatTrainingStatus(trainingClass.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[ui.value, { fontSize: 16 }]} numberOfLines={2}>
                        {trainingClass.name}
                      </Text>
                    </View>

                    {plan ? (
                      <View style={styles.planRow}>
                        <Ionicons name="book-outline" size={13} color={colors.primary} />
                        <Text style={styles.planText} numberOfLines={1}>
                          {plan.name}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>
                          {formatDate(trainingClass.startDate)} – {formatDate(trainingClass.endDate)}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={13} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>
                          {t("Tối đa")} {trainingClass.maxHorses} {t("ngựa")}
                        </Text>
                      </View>
                    </View>
                  </Panel>
                </Pressable>
              );
            })
          ) : (
            <AsyncStateView
              isLoading={false}
              error={null}
              onRetry={() => void resource.refresh()}
              empty
              emptyLabel="No training classes yet. Create a class from one of your plans."
            />
          )}
        </View>
      ) : null}

      {payload && tab === "Schedule" ? (
        <TrainingClassCalendarView
          sessions={payload.sessions}
          classes={payload.classes}
          onSelectSession={(session) => {
            router.push(`/trainer/plan/${session.classId}/session/${session.id}` as Href);
          }}
        />
      ) : null}
    </Screen>
  );
}

const getStyles = (colors: any) => ({
  kpiGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 4,
  },
  kpiTile: {
    flex: 1,
    minWidth: "47%" as any,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  kpiContent: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: colors.mutedForeground,
  },
  actionSection: {
    gap: 8,
    marginVertical: 4,
  },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  planRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  planText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    flexWrap: "wrap" as const,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
});
