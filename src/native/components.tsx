import { type Href, router } from "expo-router";
import { type PropsWithChildren, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/native/LocalizedText";
import type { AlertItem, Task } from "@/lib/raceos-data";
import { colors, radius, space } from "./theme";
import { Panel, uiStyles } from "./ui";
import { useI18n } from "@/context/I18nContext";

export function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.chip, value === option && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === option && styles.chipTextActive]}>
            {t(option)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ProgressBar({ value, tone = colors.primary }: { value: number; tone?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressValue,
          { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: tone },
        ]}
      />
    </View>
  );
}

export function KeyValue({ items }: { items: [string, string][] }) {
  const { t } = useI18n();
  return (
    <View style={styles.keyGrid}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.keyItem}>
          <Text style={uiStyles.label}>{t(label)}</Text>
          <Text style={uiStyles.value} numberOfLines={2}>
            {t(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function TaskCard({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  return (
    <Panel style={[styles.task, task.done && styles.done]}>
      <View style={styles.taskTop}>
        <Text style={styles.time}>{task.time}</Text>
        <View style={styles.flex}>
          <Text style={uiStyles.value}>{task.horse}</Text>
          <Text style={uiStyles.muted}>
            {task.title} · {task.detail}
          </Text>
        </View>
      </View>
      <Pressable
        disabled={task.done}
        onPress={() => {
          onComplete(task.id);
          Alert.alert("Task completed", "Logged to the horse timeline.");
        }}
        style={[styles.complete, task.done && styles.completeDone]}
      >
        <Text style={[styles.completeText, task.done && styles.completeTextDone]}>
          {task.done ? "Completed" : "Complete"}
        </Text>
      </Pressable>
    </Panel>
  );
}

export function AlertCard({ alert, role }: { alert: AlertItem; role: string }) {
  const palette =
    alert.severity === "critical"
      ? { backgroundColor: colors.dangerSoft, borderColor: "#FECACA" }
      : alert.severity === "warning"
        ? { backgroundColor: colors.warningSoft, borderColor: "#FDE68A" }
        : { backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <Pressable
      onPress={() => router.push(`/${role}/horse/${alert.horseId}` as Href)}
      style={[styles.alert, palette]}
    >
      <View style={uiStyles.row}>
        <Text
          style={[
            styles.alertSeverity,
            {
              color:
                alert.severity === "critical"
                  ? colors.danger
                  : alert.severity === "warning"
                    ? colors.warning
                    : colors.info,
            },
          ]}
        >
          {alert.severity}
        </Text>
        <Text style={uiStyles.muted}>{alert.time}</Text>
      </View>
      <Text style={uiStyles.value}>{alert.title}</Text>
      <Text style={uiStyles.muted}>
        {alert.horse} — {alert.detail}
      </Text>
    </Pressable>
  );
}

export function TimelineItem({
  time,
  title,
  detail,
  tone = colors.muted,
  last,
}: {
  time: string;
  title: string;
  detail: string;
  tone?: string;
  last?: boolean;
}) {
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: tone }]} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <View style={uiStyles.row}>
          <Text style={uiStyles.value}>{title}</Text>
          <Text style={uiStyles.muted}>{time}</Text>
        </View>
        <Text style={uiStyles.muted}>{detail}</Text>
      </View>
    </View>
  );
}

export function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  const { t } = useI18n();
  return (
    <View style={styles.field}>
      <Text style={uiStyles.label}>{t(label)}</Text>
      {children}
    </View>
  );
}

export function NativeInput({
  value,
  onChangeText,
  multiline,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const { t } = useI18n();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      placeholder={placeholder ? t(placeholder) : undefined}
      placeholderTextColor={colors.muted}
      style={[styles.input, multiline && styles.multiline]}
    />
  );
}

export function ActionRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.actions, style]}>{children}</View>;
}

export function MiniChart({
  data,
  valueKey,
  color = colors.primary,
  height = 110,
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  color?: string;
  height?: number;
}) {
  const values = data.map((item) => Number(item[valueKey] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <View style={[styles.chart, { height }]}>
      {values.map((value, index) => {
        const normalized = max === min ? 0.5 : (value - min) / (max - min);
        return (
          <View
            key={`${valueKey}-${index}`}
            style={[
              styles.chartBar,
              { height: Math.max(8, normalized * (height - 12) + 8), backgroundColor: color },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  progressTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.elevated,
  },
  progressValue: { height: "100%", borderRadius: radius.pill },
  keyGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.lg },
  keyItem: { width: "50%", paddingRight: space.md, gap: 5 },
  task: { gap: space.md },
  taskTop: { flexDirection: "row", gap: space.md },
  flex: { flex: 1, gap: 4 },
  time: { color: colors.muted, fontSize: 13, width: 45, fontVariant: ["tabular-nums"] },
  done: { opacity: 0.6 },
  complete: {
    minHeight: 45,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  completeDone: { backgroundColor: colors.primarySoft },
  completeText: { color: "#FFFFFF", fontWeight: "800" },
  completeTextDone: { color: colors.primary },
  alert: { borderRadius: radius.md, borderWidth: 1, padding: space.lg, gap: space.sm },
  alertSeverity: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  timeline: { flexDirection: "row", gap: space.md },
  timelineRail: { alignItems: "center", width: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  timelineLine: { width: 1, flex: 1, minHeight: 44, backgroundColor: colors.border, marginTop: 4 },
  timelineCopy: { flex: 1, gap: 3, paddingBottom: space.lg },
  field: { gap: space.sm },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 14,
  },
  multiline: { minHeight: 92, paddingTop: space.md, textAlignVertical: "top" },
  actions: { gap: space.sm },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 5 },
  chartBar: { flex: 1, minWidth: 3, borderRadius: 4, opacity: 0.9 },
});
