import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView, SectionTitle } from "@/components/common";
import { Field, NativeInput, Panel, PrimaryButton } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-gifted-charts";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { validateMeasurementField } from "@/features/medical/medical-validation";
import { horseService, type HorseMeasurementDto } from "@/services/horse.service";
import type { RoleId } from "@/features/auth/roles";
import { extractErrorMessage } from "@/utils/errorHandler";
import { formatDateTime } from "@/utils/formatters";

const TYPES = ["WEIGHT", "HEIGHT", "BODY_CONDITION", "TEMPERATURE"] as const;
type MeasurementType = (typeof TYPES)[number];

interface MetricConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  unit: string;
  color: string;
  bgTint: string;
  normalRange: string;
}

const METRIC_CONFIGS: Record<MeasurementType, MetricConfig> = {
  WEIGHT: {
    label: "Cân nặng",
    icon: "scale-outline",
    unit: "kg",
    color: "#10B981",
    bgTint: "rgba(16, 185, 129, 0.12)",
    normalRange: "400 – 600 kg",
  },
  HEIGHT: {
    label: "Chiều cao",
    icon: "resize-outline",
    unit: "cm",
    color: "#3B82F6",
    bgTint: "rgba(59, 130, 246, 0.12)",
    normalRange: "150 – 175 cm",
  },
  BODY_CONDITION: {
    label: "Điểm thể trạng (BCS)",
    icon: "fitness-outline",
    unit: "điểm",
    color: "#8B5CF6",
    bgTint: "rgba(139, 92, 246, 0.12)",
    normalRange: "4 – 6 điểm (thang 1-9)",
  },
  TEMPERATURE: {
    label: "Thân nhiệt",
    icon: "thermometer-outline",
    unit: "°C",
    color: "#F59E0B",
    bgTint: "rgba(245, 158, 11, 0.12)",
    normalRange: "37.2 – 38.3 °C",
  },
};

function formatMeasurementUnit(unit: string): string {
  return unit.toLowerCase() === "celsius" ? "°C" : unit;
}

export interface HorseMeasurementsViewProps {
  horseId: string;
  roleId: RoleId;
  canRecord?: boolean;
  canDelete?: boolean;
  onUpdated?: () => void;
}

export function HorseMeasurementsView({
  horseId,
  roleId,
  canRecord: explicitCanRecord,
  canDelete: explicitCanDelete,
  onUpdated,
}: HorseMeasurementsViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useI18n();
  const { token } = useAuth();

  const [values, setValues] = useState<Record<MeasurementType, string>>({
    WEIGHT: "",
    HEIGHT: "",
    BODY_CONDITION: "",
    TEMPERATURE: "",
  });
  const [confirmAbnormal, setConfirmAbnormal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [chartType, setChartType] = useState<MeasurementType>("WEIGHT");
  const [chartContainerWidth, setChartContainerWidth] = useState(0);
  const [deleteId, setDeleteId] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadPermissions = useCallback(
    () => horseService.getPermissions(token!, horseId),
    [horseId, token],
  );
  const permissionsResource = useApiResource(
    loadPermissions,
    Boolean(token && horseId && (explicitCanRecord === undefined || explicitCanDelete === undefined)),
  );

  const loadMeasurements = useCallback(
    () => horseService.listMeasurements(token!, horseId),
    [horseId, token],
  );
  const resource = useApiResource(loadMeasurements, Boolean(token && horseId));

  const canRecord =
    explicitCanRecord !== undefined
      ? explicitCanRecord
      : permissionsResource.data?.canRecordMeasurement ?? ["vet", "trainer"].includes(roleId);

  const canDelete =
    explicitCanDelete !== undefined
      ? explicitCanDelete
      : permissionsResource.data?.canDeleteMeasurement ?? ["vet", "trainer"].includes(roleId);

  // Phân loại số đo theo loại (mới nhất đầu tiên)
  const measurementsByType = useMemo(() => {
    const map = new Map<MeasurementType, HorseMeasurementDto[]>();
    for (const type of TYPES) map.set(type, []);
    for (const row of resource.data ?? []) {
      if (map.has(row.type)) {
        map.get(row.type)!.push(row);
      }
    }
    return map;
  }, [resource.data]);

  // Chuẩn bị dữ liệu chuỗi thời gian (cũ -> mới) cho biểu đồ
  const chronologicallySorted = useMemo(() => {
    const list = measurementsByType.get(chartType) ?? [];
    return list
      .slice()
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  }, [measurementsByType, chartType]);

  // Thống kê cho loại chỉ số được chọn
  const chartStats = useMemo(() => {
    if (!chronologicallySorted.length) return null;
    const vals = chronologicallySorted.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    const latest = chronologicallySorted[chronologicallySorted.length - 1];
    return { min, max, avg, latest, count: vals.length };
  }, [chronologicallySorted]);

  // Dữ liệu cho Gifted Charts LineChart
  const chartPoints = useMemo(() => {
    if (!chronologicallySorted.length) return [];
    const len = chronologicallySorted.length;
    return chronologicallySorted.map((item, index) => {
      const date = new Date(item.measuredAt);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const showLabel =
        len <= 6 || index === 0 || index === len - 1 || index % Math.ceil(len / 4) === 0;

      return {
        value: item.value,
        label: showLabel ? `${day}/${month}` : "",
        hideDataPoint: false,
        dataPointColor: item.isAbnormal ? colors.destructive : METRIC_CONFIGS[chartType].color,
        measuredAt: item.measuredAt,
        measuredByName: item.measuredByName,
        unit: formatMeasurementUnit(item.unit),
        isAbnormal: item.isAbnormal,
      };
    });
  }, [chronologicallySorted, chartType, colors.destructive]);

  const updateValue = (type: MeasurementType, value: string) =>
    setValues((current) => ({ ...current, [type]: value }));

  const fieldValidations = useMemo(() => {
    return {
      WEIGHT: validateMeasurementField("WEIGHT", values.WEIGHT, t),
      HEIGHT: validateMeasurementField("HEIGHT", values.HEIGHT, t),
      BODY_CONDITION: validateMeasurementField("BODY_CONDITION", values.BODY_CONDITION, t),
      TEMPERATURE: validateMeasurementField("TEMPERATURE", values.TEMPERATURE, t),
    };
  }, [values, t]);

  const hasAnyInvalidField = useMemo(
    () => TYPES.some((type) => !fieldValidations[type].isValid),
    [fieldValidations],
  );

  const hasAnyAbnormalField = useMemo(
    () => TYPES.some((type) => fieldValidations[type].isAbnormal),
    [fieldValidations],
  );

  const addMeasurement = async () => {
    const selected = TYPES.filter((type) => values[type].trim() !== "");
    if (!token || !selected.length || saving) {
      setFormError(t("Enter at least one measurement."));
      return;
    }
    if (hasAnyInvalidField) {
      setFormError(t("Một hoặc nhiều giá trị không hợp lệ. Vui lòng kiểm tra lại."));
      return;
    }
    const parsedValues = selected.map((type) => ({ type, value: Number(values[type]) }));
    setSaving(true);
    setFormError("");
    try {
      const result = await horseService.addMeasurements(token, horseId, {
        values: parsedValues,
        ...(confirmAbnormal ? { confirmAbnormal: true } : {}),
      });
      const alerts = result.flatMap((measurement) =>
        measurement.alerts.map((alert) => alert.alert),
      );
      Alert.alert(
        t("Measurements saved"),
        alerts.length
          ? `${t("Đã lưu thành công. Cảnh báo ghi nhận")}: ${alerts.join(", ")}.`
          : t("Lịch sử đo lường đã được cập nhật."),
      );
      setValues({ WEIGHT: "", HEIGHT: "", BODY_CONDITION: "", TEMPERATURE: "" });
      setConfirmAbnormal(false);
      await resource.refresh();
      onUpdated?.();
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert(t("Could not save measurements"), message);
    } finally {
      setSaving(false);
    }
  };

  const removeMeasurement = async () => {
    if (!token || !deleteId || !deleteReason.trim() || deleting) return;
    setDeleting(true);
    setFormError("");
    try {
      await horseService.deleteMeasurement(token, horseId, deleteId, deleteReason.trim());
      Alert.alert(t("Measurement removed"), t("The history has been refreshed."));
      setDeleteId("");
      setDeleteReason("");
      await resource.refresh();
      onUpdated?.();
    } catch (error) {
      const message = extractErrorMessage(error);
      setFormError(message);
      Alert.alert(t("Could not remove measurement"), message);
    } finally {
      setDeleting(false);
    }
  };

  // Tính miền giá trị Y cho biểu đồ
  const chartYBounds = useMemo(() => {
    if (!chartPoints.length) return { min: 0, max: 100, step: 25 };
    const vals = chartPoints.map((p) => p.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const padding = Math.max((maxVal - minVal) * 0.2, 2);
    const chartMin = Math.max(0, Math.floor(minVal - padding));
    const chartMax = Math.ceil(maxVal + padding);
    const noOfSections = 4;
    const step = Math.max(1, Math.ceil((chartMax - chartMin) / noOfSections));
    return { min: chartMin, max: chartMin + step * noOfSections, step };
  }, [chartPoints]);

  const activeMetricConfig = METRIC_CONFIGS[chartType];
  const chartWidth = Math.max(0, chartContainerWidth - 45);

  return (
    <View style={{ gap: space.md }}>
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {resource.data ? (
        <>
          {/* SECTION 1: THẺ SỐ ĐO MỚI NHẤT (LATEST MEASUREMENTS) */}
          <View style={{ gap: space.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <SectionTitle>Số đo mới nhất</SectionTitle>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                Cập nhật lần cuối theo từng chỉ số
              </Text>
            </View>

            <View style={styles.metricCardsGrid}>
              {TYPES.map((type) => {
                const config = METRIC_CONFIGS[type];
                const list = measurementsByType.get(type) ?? [];
                const latest = list[0] ?? null;
                const previous = list[1] ?? null;
                const delta =
                  latest && previous ? Number((latest.value - previous.value).toFixed(1)) : null;

                return (
                  <Pressable
                    key={type}
                    onPress={() => setChartType(type)}
                    style={[
                      styles.metricCard,
                      chartType === type && {
                        borderColor: config.color,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    {/* Header: Icon + Name + Abnormal/Normal badge */}
                    <View style={styles.metricCardHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={[styles.metricIconWrap, { backgroundColor: config.bgTint }]}>
                          <Ionicons name={config.icon} size={15} color={config.color} />
                        </View>
                        <Text style={styles.metricCardLabel}>{config.label}</Text>
                      </View>

                      {latest ? (
                        latest.isAbnormal ? (
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: "rgba(239, 68, 68, 0.15)" },
                            ]}
                          >
                            <Text style={[styles.statusBadgeText, { color: colors.destructive }]}>
                              Cảnh báo
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: "rgba(16, 185, 129, 0.15)" },
                            ]}
                          >
                            <Text style={[styles.statusBadgeText, { color: colors.fit }]}>
                              Chuẩn
                            </Text>
                          </View>
                        )
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: colors.surface }]}>
                          <Text style={[styles.statusBadgeText, { color: colors.mutedForeground }]}>
                            Chưa có
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Value + Unit + Delta */}
                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricLargeValue}>{latest ? latest.value : "—"}</Text>
                      <Text style={styles.metricUnitText}>
                        {latest ? formatMeasurementUnit(latest.unit) : config.unit}
                      </Text>

                      {delta !== null && delta !== 0 ? (
                        <View
                          style={[
                            styles.deltaPill,
                            {
                              backgroundColor:
                                delta > 0
                                  ? type === "TEMPERATURE"
                                    ? "rgba(239, 68, 68, 0.12)"
                                    : "rgba(16, 185, 129, 0.12)"
                                  : "rgba(59, 130, 246, 0.12)",
                            },
                          ]}
                        >
                          <Ionicons
                            name={delta > 0 ? "arrow-up" : "arrow-down"}
                            size={10}
                            color={
                              delta > 0
                                ? type === "TEMPERATURE"
                                  ? colors.destructive
                                  : colors.fit
                                : colors.primary
                            }
                          />
                          <Text
                            style={[
                              styles.deltaText,
                              {
                                color:
                                  delta > 0
                                    ? type === "TEMPERATURE"
                                    ? colors.destructive
                                    : colors.fit
                                    : colors.primary,
                              },
                            ]}
                          >
                            {delta > 0 ? `+${delta}` : `${delta}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Footer: Date & Recorded by */}
                    <View style={styles.metricCardFooter}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
                        <Text style={styles.metricFooterText} numberOfLines={1}>
                          {latest ? formatDateTime(latest.measuredAt) : "Chưa có dữ liệu"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="person-outline" size={11} color={colors.mutedForeground} />
                        <Text style={styles.metricFooterText} numberOfLines={1}>
                          {latest ? latest.measuredByName || "Hệ thống" : config.normalRange}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* SECTION 2: BIỂU ĐỒ THEO THỜI GIAN (LINE CHART) */}
          <Panel style={{ gap: space.md, paddingVertical: space.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <SectionTitle>Biểu đồ theo thời gian</SectionTitle>
                <Text
                  style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {activeMetricConfig.label} ({activeMetricConfig.unit}) · Chuẩn:{" "}
                  {activeMetricConfig.normalRange}
                </Text>
              </View>

              {chartStats ? (
                <View
                  style={[
                    styles.statsChip,
                    { borderColor: activeMetricConfig.color, flexShrink: 0 },
                  ]}
                >
                  <Text
                    style={{ fontSize: 11, fontWeight: "700", color: activeMetricConfig.color }}
                  >
                    TB: {chartStats.avg} {activeMetricConfig.unit}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Type Selector Pills */}
            <View style={styles.chartSelectorRow}>
              {TYPES.map((type) => {
                const cfg = METRIC_CONFIGS[type];
                const active = chartType === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    onPress={() => setChartType(type)}
                    style={[
                      styles.chartSelectorPill,
                      active && { backgroundColor: cfg.color, borderColor: cfg.color },
                    ]}
                  >
                    <Ionicons
                      name={cfg.icon}
                      size={14}
                      color={active ? "#FFFFFF" : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.chartSelectorText,
                        active && { color: "#FFFFFF", fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {cfg.label.split(" ")[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Stats Summary Bar */}
            {chartStats ? (
              <View style={styles.statsSummaryBar}>
                <View style={styles.statsItem}>
                  <Text style={styles.statsLabel}>Hiện tại</Text>
                  <Text style={[styles.statsValue, { color: activeMetricConfig.color }]}>
                    {chartStats.latest.value} {activeMetricConfig.unit}
                  </Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsItem}>
                  <Text style={styles.statsLabel}>Thấp nhất</Text>
                  <Text style={styles.statsValue}>
                    {chartStats.min} {activeMetricConfig.unit}
                  </Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsItem}>
                  <Text style={styles.statsLabel}>Cao nhất</Text>
                  <Text style={styles.statsValue}>
                    {chartStats.max} {activeMetricConfig.unit}
                  </Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsItem}>
                  <Text style={styles.statsLabel}>Số lần đo</Text>
                  <Text style={styles.statsValue}>{chartStats.count}</Text>
                </View>
              </View>
            ) : null}

            {/* Chart Area */}
            <View
              style={styles.chartWrapper}
              onLayout={(e) => setChartContainerWidth(e.nativeEvent.layout.width)}
            >
              {chartPoints.length >= 2 ? (
                <LineChart
                  data={chartPoints}
                  width={chartWidth}
                  height={130}
                  color={activeMetricConfig.color}
                  thickness={2.5}
                  startFillColor={activeMetricConfig.color}
                  endFillColor={activeMetricConfig.color}
                  startOpacity={0.25}
                  endOpacity={0.02}
                  areaChart
                  curved
                  curveType={0}
                  isAnimated
                  animationDuration={600}
                  noOfSections={4}
                  maxValue={chartYBounds.max}
                  mostNegativeValue={chartYBounds.min}
                  stepValue={chartYBounds.step}
                  yAxisColor={colors.border}
                  xAxisColor={colors.border}
                  yAxisTextStyle={{ fontSize: 9, color: colors.mutedForeground }}
                  xAxisLabelTextStyle={{ fontSize: 9, color: colors.mutedForeground }}
                  rulesColor={colors.border}
                  rulesType="dashed"
                  dataPointsColor={activeMetricConfig.color}
                  dataPointsRadius={4}
                  pointerConfig={{
                    pointerStripColor: activeMetricConfig.color,
                    pointerStripWidth: 1.5,
                    pointerColor: activeMetricConfig.color,
                    radius: 5,
                    pointerLabelWidth: 130,
                    pointerLabelHeight: 65,
                    activatePointersOnLongPress: false,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: any) => {
                      const pt = items?.[0];
                      if (!pt) return null;
                      return (
                        <View
                          style={[styles.chartTooltip, { borderColor: activeMetricConfig.color }]}
                        >
                          <Text style={styles.tooltipValue}>
                            {pt.value} {pt.unit}
                            {pt.isAbnormal ? " (Cảnh báo)" : ""}
                          </Text>
                          <Text style={styles.tooltipDate}>{formatDateTime(pt.measuredAt)}</Text>
                          <Text style={styles.tooltipAuthor} numberOfLines={1}>
                            {pt.measuredByName || "Hệ thống"}
                          </Text>
                        </View>
                      );
                    },
                  }}
                />
              ) : (
                <View style={styles.chartEmptyContainer}>
                  <Ionicons name="analytics-outline" size={32} color={colors.mutedForeground} />
                  <Text style={styles.chartEmptyText}>
                    Cần tối thiểu 2 lần ghi nhận chỉ số {activeMetricConfig.label.toLowerCase()} để
                    hình thành biểu đồ tiến trình theo thời gian.
                  </Text>
                </View>
              )}
            </View>
          </Panel>

          {/* SECTION 3: LỊCH SỬ ĐO LƯỜNG (HISTORY) */}
          <View style={{ gap: space.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <SectionTitle>Lịch sử ghi nhận</SectionTitle>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                {resource.data.length} bản ghi
              </Text>
            </View>

            {resource.data.length ? (
              resource.data.map((row) => {
                const cfg = METRIC_CONFIGS[row.type] ?? METRIC_CONFIGS.WEIGHT;
                const isDeletingThis = deleteId === row.id;

                return (
                  <Panel key={row.id} style={{ gap: space.sm }}>
                    <View style={styles.recordHeader}>
                      <View style={[styles.recordTypeIcon, { backgroundColor: cfg.bgTint }]}>
                        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.recordTitle}>
                            {cfg.label}: {row.value} {formatMeasurementUnit(row.unit)}
                          </Text>
                          {row.isAbnormal ? (
                            <View
                              style={[
                                styles.statusBadge,
                                { backgroundColor: "rgba(239, 68, 68, 0.15)" },
                              ]}
                            >
                              <Text style={[styles.statusBadgeText, { color: colors.destructive }]}>
                                Bất thường
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.recordMeta}>
                          {formatDateTime(row.measuredAt)} · Người ghi:{" "}
                          {row.measuredByName || "Hệ thống"} ·{" "}
                          {row.source === "MEDICAL_EXAM" ? "Khám thú y" : "Ghi thủ công"}
                        </Text>
                      </View>

                      {canDelete && row.source === "MANUAL" ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setDeleteId(isDeletingThis ? "" : row.id)}
                          style={styles.deleteButton}
                        >
                          <Ionicons
                            name={isDeletingThis ? "close-circle-outline" : "trash-outline"}
                            size={18}
                            color={colors.destructive}
                          />
                        </Pressable>
                      ) : null}
                    </View>

                    {isDeletingThis ? (
                      <View style={styles.deleteSection}>
                        <Field label="Lý do xóa bản ghi sai (bắt buộc)">
                          <NativeInput
                            value={deleteReason}
                            onChangeText={setDeleteReason}
                            multiline
                            placeholder="Giải thích lý do cần gỡ bỏ bản ghi số đo này"
                          />
                        </Field>
                        <PrimaryButton
                          label={deleting ? "Đang xóa…" : "Xác nhận xóa bản ghi"}
                          icon="trash"
                          disabled={deleting || !deleteReason.trim()}
                          onPress={() =>
                            Alert.alert(
                              "Xóa bản ghi số đo?",
                              "Bản ghi này sẽ bị ẩn khỏi lịch sử và không tính vào biểu đồ.",
                              [
                                { text: "Hủy", style: "cancel" },
                                {
                                  text: "Xóa vĩnh viễn",
                                  style: "destructive",
                                  onPress: () => void removeMeasurement(),
                                },
                              ],
                            )
                          }
                        />
                      </View>
                    ) : null}
                  </Panel>
                );
              })
            ) : (
              <AsyncStateView
                isLoading={false}
                error={null}
                onRetry={() => undefined}
                empty
                emptyLabel="Chưa có bản ghi số đo cơ thể nào được ghi nhận."
              />
            )}
          </View>
        </>
      ) : null}

      {/* SECTION 4: FORM GHI NHẬN SỐ ĐO MỚI */}
      {canRecord ? (
        <Panel style={{ gap: space.md }}>
          <View>
            <SectionTitle>Ghi nhận chỉ số đo mới</SectionTitle>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              Nhập ít nhất một chỉ số để cập nhật hồ sơ phát triển của ngựa
            </Text>
          </View>

          <View style={{ gap: space.md }}>
            <View style={styles.formGrid}>
              {TYPES.map((type) => {
                const cfg = METRIC_CONFIGS[type];
                const validation = fieldValidations[type];

                return (
                  <View key={type} style={styles.formFieldCard}>
                    <View style={styles.formFieldHeader}>
                      <View style={[styles.formFieldIcon, { backgroundColor: cfg.bgTint }]}>
                        <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      </View>
                      <Text style={styles.formFieldLabel}>
                        {cfg.label} ({cfg.unit})
                      </Text>
                    </View>

                    <NativeInput
                      value={values[type]}
                      onChangeText={(value) => updateValue(type, value)}
                      keyboardType="decimal-pad"
                      placeholder={`Chuẩn: ${cfg.normalRange}`}
                    />

                    {validation.error ? (
                      <Text style={styles.fieldError}>{validation.error}</Text>
                    ) : validation.warning ? (
                      <Text style={styles.warningText}>{validation.warning}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Xác nhận chỉ số bất thường */}
            <View style={styles.confirmOptions}>
              {["Không xác nhận bất thường", "Xác nhận nếu có cảnh báo"].map((option) => {
                const selected = (option === "Xác nhận nếu có cảnh báo") === confirmAbnormal;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setConfirmAbnormal(option === "Xác nhận nếu có cảnh báo")}
                    style={[styles.confirmOption, selected && styles.confirmOptionActive]}
                  >
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={selected ? "#FFFFFF" : colors.mutedForeground}
                    />
                    <Text
                      style={[styles.confirmOptionText, selected && styles.confirmOptionTextActive]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {hasAnyAbnormalField && !confirmAbnormal ? (
              <View style={styles.warningBanner}>
                <Ionicons name="warning-outline" size={18} color="#D97706" />
                <Text style={styles.warningNotice}>
                  Có chỉ số nằm ngoài khoảng bình thường. Vui lòng chọn &quot;Xác nhận nếu có cảnh
                  báo&quot; để hệ thống chấp thuận lưu.
                </Text>
              </View>
            ) : null}

            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <PrimaryButton
              label={saving ? "Đang lưu chỉ số…" : "Lưu phiên ghi nhận số đo"}
              icon="checkmark"
              disabled={
                saving || hasAnyInvalidField || !TYPES.some((type) => values[type].trim() !== "")
              }
              onPress={() => void addMeasurement()}
            />
          </View>
        </Panel>
      ) : null}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    metricCardsGrid: {
      gap: space.sm,
    },
    metricCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: space.xs,
    },
    metricCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    metricIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 7,
      justifyContent: "center",
      alignItems: "center",
    },
    metricCardLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    metricValueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
      marginVertical: 2,
    },
    metricLargeValue: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
    },
    metricUnitText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    deltaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      marginLeft: 4,
    },
    deltaText: {
      fontSize: 11,
      fontWeight: "700",
    },
    metricCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 6,
      marginTop: 2,
    },
    metricFooterText: {
      fontSize: 10,
      color: colors.mutedForeground,
      maxWidth: 160,
    },
    chartSelectorRow: {
      flexDirection: "row",
      gap: 6,
    },
    chartSelectorPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chartSelectorText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    statsChip: {
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statsSummaryBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    statsItem: {
      alignItems: "center",
      gap: 2,
    },
    statsDivider: {
      width: 1,
      height: 20,
      backgroundColor: colors.border,
    },
    statsLabel: {
      fontSize: 10,
      color: colors.mutedForeground,
    },
    statsValue: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    chartWrapper: {
      width: "100%",
      height: 160,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 4,
    },
    chartTooltip: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1.5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    tooltipValue: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.foreground,
    },
    tooltipDate: {
      fontSize: 9,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    tooltipAuthor: {
      fontSize: 9,
      color: colors.primary,
      fontWeight: "600",
      marginTop: 1,
    },
    chartEmptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: space.lg,
    },
    chartEmptyText: {
      fontSize: 12,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 18,
    },
    recordHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    recordTypeIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 2,
    },
    recordTitle: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "700",
    },
    recordMeta: {
      color: colors.mutedForeground,
      fontSize: 11,
      marginTop: 3,
      lineHeight: 16,
    },
    deleteButton: {
      padding: 4,
    },
    deleteSection: {
      gap: 10,
      marginTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    formGrid: {
      gap: space.sm,
    },
    formFieldCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.sm,
      gap: 6,
    },
    formFieldHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    formFieldIcon: {
      width: 22,
      height: 22,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    formFieldLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.foreground,
    },
    fieldError: {
      color: colors.destructive,
      fontSize: 11,
      fontWeight: "600",
    },
    warningText: {
      color: colors.warning ?? "#d97706",
      fontSize: 11,
      fontWeight: "600",
    },
    warningBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(217, 119, 6, 0.12)",
      borderRadius: radius.sm,
      padding: space.sm,
    },
    warningNotice: {
      flex: 1,
      color: colors.warning ?? "#d97706",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
    },
    confirmOptions: {
      gap: 8,
    },
    confirmOption: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    confirmOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    confirmOptionText: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontWeight: "600",
    },
    confirmOptionTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    error: {
      color: colors.destructive,
      fontSize: 13,
    },
  });
