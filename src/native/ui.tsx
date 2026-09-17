import { Ionicons } from "@expo/vector-icons";
import { type Href, router, usePathname } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Text } from "@/native/LocalizedText";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Horse, HorseStatus, RoleId } from "@/lib/raceos-data";
import { roles } from "./roles";
import { colors, radius, space } from "./theme";
import { useI18n } from "@/context/I18nContext";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Screen({
  role,
  title,
  subtitle,
  children,
  back,
}: PropsWithChildren<{ role: RoleId; title: string; subtitle?: string; back?: boolean }>) {
  const cfg = roles[role];
  const { language, toggleLanguage, t } = useI18n();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t(title)}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle ?? `${t(cfg.label)} · ${cfg.scope}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change language"
          onPress={toggleLanguage}
          style={styles.language}
        >
          <Text style={styles.languageText}>{language === "en" ? "VI" : "EN"}</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {cfg.person
              .split(" ")
              .map((part) => part[0])
              .slice(-2)
              .join("")}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {!back ? <BottomNav role={role} /> : null}
    </SafeAreaView>
  );
}

function BottomNav({ role }: { role: RoleId }) {
  const pathname = usePathname();
  const items = roles[role].nav;
  const { t } = useI18n();
  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const active = pathname === item.path;
        return (
          <Pressable
            key={item.path}
            style={styles.navItem}
            onPress={() => router.replace(item.path as Href)}
          >
            <Ionicons
              name={item.icon as IconName}
              size={21}
              color={active ? colors.primary : colors.muted}
            />
            <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
              {t(item.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  const { t } = useI18n();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>
        {typeof children === "string" ? t(children) : children}
      </Text>
      {action}
    </View>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const { t } = useI18n();
  const toneColor =
    tone === "good"
      ? colors.primary
      : tone === "warning"
        ? colors.warning
        : tone === "danger"
          ? colors.danger
          : colors.text;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{t(label)}</Text>
      <Text style={[styles.metricValue, { color: toneColor }]}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{t(hint)}</Text> : null}
    </View>
  );
}

const statusPalette: Record<HorseStatus, { color: string; background: string }> = {
  FIT: { color: colors.primary, background: colors.primarySoft },
  "RACE READY": { color: colors.primary, background: colors.primarySoft },
  TRAINING: { color: colors.info, background: colors.infoSoft },
  MONITOR: { color: colors.warning, background: colors.warningSoft },
  INJURED: { color: colors.danger, background: colors.dangerSoft },
  LOCKED: { color: colors.danger, background: colors.dangerSoft },
};

export function StatusBadge({ status }: { status: HorseStatus }) {
  const palette = statusPalette[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.color }]}>{status}</Text>
    </View>
  );
}

export function HorseRow({ horse, role }: { horse: Horse; role: RoleId }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.horseRow, pressed && styles.pressed]}
      onPress={() => router.push(`/${role}/horse/${horse.id}` as Href)}
    >
      <View
        style={[
          styles.horseMark,
          {
            backgroundColor:
              horse.status === "LOCKED" || horse.status === "INJURED"
                ? colors.dangerSoft
                : colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name="fitness-outline"
          size={22}
          color={
            horse.status === "LOCKED" || horse.status === "INJURED" ? colors.danger : colors.primary
          }
        />
      </View>
      <View style={styles.horseCopy}>
        <View style={styles.rowTitle}>
          <Text style={styles.horseName}>{horse.name}</Text>
          <StatusBadge status={horse.status} />
        </View>
        <Text style={styles.rowMeta}>
          {horse.age} yo {horse.sex} · Stall {horse.stall}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {horse.lastSession}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon = "arrow-forward",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{t(label)}</Text>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  );
}

export const uiStyles = StyleSheet.create({
  section: { gap: space.md },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 0.7 },
  value: { color: colors.text, fontSize: 15, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  alert: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.elevated,
  },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 21, fontWeight: "700", letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  language: {
    minWidth: 38,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  languageText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  content: {
    padding: space.lg,
    paddingBottom: 116,
    gap: space.xl,
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
  },
  nav: {
    minHeight: 66,
    paddingBottom: space.sm,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: space.sm,
  },
  navLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  navLabelActive: { color: colors.primary },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    shadowColor: "#065F46",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  metric: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 104,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: { color: colors.muted, fontSize: 11 },
  metricValue: { fontSize: 26, fontWeight: "700", letterSpacing: -0.7 },
  metricHint: { color: colors.muted, fontSize: 10 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  horseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  horseMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  horseCopy: { flex: 1, gap: 3 },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  horseName: { flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: colors.muted, fontSize: 11 },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.primary,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  buttonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
