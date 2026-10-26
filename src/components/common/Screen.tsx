import { Ionicons } from "@expo/vector-icons";
import { router, usePathname, type Href } from "expo-router";
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/common/LocalizedText";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { MAX_BOTTOM_NAV_ITEMS, roles } from "@/features/auth/roles";
import { radius, space } from "@/config/theme";
import type { RoleId } from "@/lib/raceos-data";
import { useTheme } from "@/hooks/useTheme";
import { safeBack } from "@/utils/navigation";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function BottomNav({ role }: { role: RoleId }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const pathname = usePathname();
  const items = roles[role].nav.slice(0, MAX_BOTTOM_NAV_ITEMS);
  const { t } = useI18n();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [moreVisible, setMoreVisible] = useState(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 6,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 40 || gestureState.vy > 0.3) {
            setMoreVisible(false);
          }
        },
      }),
    [setMoreVisible],
  );

  return (
    <>
      <View style={styles.nav}>
        {items.map((item) => {
          const isMore = item.action === "more";
          const active = isMore ? moreVisible : pathname === item.path;
          return (
            <Pressable
              key={item.path ?? item.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={styles.navItem}
              onPress={() => {
                if (isMore) setMoreVisible(true);
                else if (item.path) router.replace(item.path as Href);
              }}
            >
              <Ionicons
                name={item.icon as IconName}
                size={21}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[styles.navLabel, active && styles.navLabelActive]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {t(item.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Modal
        visible={moreVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setMoreVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close More menu")}
            onPress={() => setMoreVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
            <View
              {...panResponder.panHandlers}
              style={{ width: "100%", alignItems: "center", paddingTop: 4, paddingBottom: 8 }}
            >
              <View style={styles.sheetHandle} />
            </View>
            <View {...panResponder.panHandlers} style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>{t("More")}</Text>
                <Text style={styles.sheetSubtitle}>{t("Other features")}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Close")}
                onPress={() => setMoreVisible(false)}
                style={styles.sheetClose}
              >
                <Ionicons name="close" size={21} color={colors.foreground} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {roles[role].secondary.map((item, index) => (
                <Pressable
                  key={`${item.path}-${index}`}
                  accessibilityRole="button"
                  style={styles.moreItem}
                  onPress={() => {
                    setMoreVisible(false);
                    router.push(item.path as Href);
                  }}
                >
                  <View style={styles.moreIconBox}>
                    <Ionicons name={item.icon as IconName} size={21} color={colors.primary} />
                  </View>
                  <View style={styles.moreItemCopy}>
                    <Text style={styles.moreItemTitle}>{t(item.label)}</Text>
                    <Text style={styles.moreItemDescription}>{t(item.description)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMoreVisible(false);
                void auth.signOut();
              }}
              style={styles.signOutMenuItem}
            >
              <Ionicons name="log-out-outline" size={21} color={colors.destructive} />
              <Text style={styles.signOutMenuText}>{t("Sign out")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function Screen({
  role,
  title,
  subtitle,
  children,
  back,
  onBack,
  fallbackHref,
  scrollable = true,
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{
  role: RoleId;
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  fallbackHref?: Href;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const cfg = roles[role];
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useI18n();
  const auth = useAuth();
  const displayName = auth.user?.fullName ?? cfg.person;
  const profilePath = `/profile/${role}`;
  const isProfile = pathname === profilePath;

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    safeBack(fallbackHref ?? (`/${role}` as Href));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Back")}
            onPress={handleBack}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {t(title)}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle ?? `${t(cfg.label)} · ${cfg.scope}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Change language")}
          onPress={toggleLanguage}
          style={styles.language}
        >
          <Text style={styles.languageText}>{language === "en" ? "VI" : "EN"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Open profile")}
          accessibilityState={{ disabled: isProfile }}
          disabled={isProfile}
          onPress={() => router.push(profilePath as Href)}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {displayName
              .split(" ")
              .map((part: string) => part[0])
              .slice(-2)
              .join("")}
          </Text>
        </Pressable>
      </View>
      {scrollable ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.fillContent}>{children}</View>
      )}
      {!back ? <BottomNav role={role} /> : null}
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
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
      flexShrink: 0,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    title: { color: colors.foreground, fontSize: 21, fontWeight: "700", letterSpacing: -0.4 },
    subtitle: { color: colors.mutedForeground, fontSize: 11, marginTop: 3 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    avatarText: { color: colors.foreground, fontSize: 11, fontWeight: "700" },
    language: {
      minWidth: 38,
      flexShrink: 0,
      height: 34,
      paddingHorizontal: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
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
    fillContent: { flex: 1, minHeight: 0, width: "100%", maxWidth: 620, alignSelf: "center" },
    nav: {
      minHeight: 66,
      paddingBottom: space.sm,
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.42)",
    },
    sheet: {
      maxHeight: "88%",
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sheetHandle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      marginTop: 2,
      marginBottom: space.md,
      borderRadius: radius.pill,
      backgroundColor: colors.borderStrong,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: space.md,
    },
    sheetHeaderCopy: { flex: 1, gap: 3 },
    sheetTitle: { color: colors.foreground, fontSize: 20, fontWeight: "700" },
    sheetSubtitle: { color: colors.mutedForeground, fontSize: 12 },
    sheetClose: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.elevated,
    },
    sheetScroll: { flexShrink: 1 },
    sheetScrollContent: { gap: space.sm, paddingBottom: space.md },
    moreItem: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      padding: space.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    moreIconBox: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
      backgroundColor: colors.fitSoft,
    },
    moreItemCopy: { flex: 1, minWidth: 0, gap: 3 },
    moreItemTitle: { color: colors.foreground, fontSize: 14, fontWeight: "700" },
    moreItemDescription: { color: colors.mutedForeground, fontSize: 11, lineHeight: 15 },
    signOutMenuItem: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      marginTop: space.xs,
      paddingHorizontal: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    signOutMenuText: { color: colors.destructive, fontSize: 14, fontWeight: "700" },
    navItem: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingTop: space.sm,
      paddingHorizontal: 2,
    },
    navLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontWeight: "600",
      textAlign: "center",
    },
    navLabelActive: { color: colors.primary },
  });
