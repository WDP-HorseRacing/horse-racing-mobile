import { Ionicons } from "@expo/vector-icons";
import { router, usePathname, type Href } from "expo-router";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { roles } from "@/features/auth/roles";
import { colors, radius, space } from "@/config/theme";
import type { RoleId } from "@/lib/raceos-data";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

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
              .map((part: string) => part[0])
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
});
