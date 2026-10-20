import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanguageToggle, Text } from "@/components/common/LocalizedText";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { extractErrorMessage, extractFieldErrors } from "@/utils/errorHandler";
import { useTheme } from "@/hooks/useTheme";
import { getLoginFeedback } from "@/features/auth/login-feedback";
import {
  GOOGLE_OIDC_REDIRECT_URI,
  parseGoogleOidcCallbackUrl,
} from "@/features/auth/google-oidc";
import { authService } from "@/services/auth.service";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { t } = useI18n();
  const { signIn, signInWithGoogle, isLoading, authError, retrySession, token } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [googlePending, setGooglePending] = useState(false);
  const loginFeedback = getLoginFeedback(authError, formError, Boolean(token));

  if (isLoading && !token) return <LoadingScreen label={t("Signing in…")} />;

  const submit = async () => {
    setFormError("");
    setFieldErrors({});
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(extractErrorMessage(error, t("Unable to sign in.")));
      setFieldErrors(extractFieldErrors(error));
    }
  };

  const retry = async () => {
    await retrySession();
  };

  const signInWithGoogleProvider = async () => {
    setFormError("");
    setFieldErrors({});
    setGooglePending(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        authService.googleOidcStartUrl(),
        GOOGLE_OIDC_REDIRECT_URI,
      );
      if (result.type !== "success" || !result.url) return;

      const query = parseGoogleOidcCallbackUrl(result.url);
      const nextRole = await signInWithGoogle(query);
      router.replace(`/${nextRole}` as Href);
    } catch (error) {
      setFormError(extractErrorMessage(error, t("Unable to sign in with Google.")));
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.language}>
        <LanguageToggle />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.brand} translatable={false}>
            Horse
            <Text style={styles.brandAccent} translatable={false}>
              Racing
            </Text>
          </Text>
          <Text style={styles.kicker}>{t("Stable operations, in your hand")}</Text>
        </View>
        <View style={styles.hero}>
          <Text style={styles.title}>{t("Sign in to your workspace")}</Text>
          <Text style={styles.copy}>{t("Use your club account to continue.")}</Text>
        </View>

        {Platform.OS !== "web" ? (
          <View style={styles.googleSection}>
            <Pressable
              accessibilityRole="button"
              disabled={googlePending || isLoading}
              onPress={() => void signInWithGoogleProvider()}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.pressed,
                (googlePending || isLoading) && styles.disabled,
              ]}
            >
              {googlePending ? (
                <View style={styles.googleSpinner} />
              ) : (
                <Ionicons name="logo-google" size={19} color="#4285F4" />
              )}
              <Text style={styles.googleButtonText}>
                {googlePending ? t("Connecting to Google…") : t("Continue with Google")}
              </Text>
            </Pressable>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("Or use email and password")}</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        ) : null}

        {loginFeedback ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{extractErrorMessage(loginFeedback.error)}</Text>
            {loginFeedback.showSessionRetry ? (
              <Pressable onPress={retry} style={styles.retry}>
                <Text style={styles.retryText}>{t("Retry session check")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.inputLabel}>{t("Email")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            autoCorrect={false}
            editable={!isLoading && !googlePending}
            placeholder="name@racehorse.com"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
          {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
          <Text style={styles.inputLabel}>{t("Password")}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            autoComplete="password"
            secureTextEntry
            editable={!isLoading && !googlePending}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
          />
          {fieldErrors.password ? (
            <Text style={styles.fieldError}>{fieldErrors.password}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isLoading || googlePending || !email.trim() || !password}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.submit,
              pressed && styles.pressed,
              (isLoading || !email.trim() || !password) && styles.disabled,
            ]}
          >
            <Text style={styles.submitText}>{isLoading ? t("Signing in…") : t("Sign in")}</Text>
          </Pressable>

          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>Demo Quick Fill:</Text>
            <View style={styles.demoPills}>
              {[
                { label: "Trainer", email: "trainer@racehorse.com" },
                { label: "Groom", email: "groom@racehorse.com" },
                { label: "Vet", email: "vet@racehorse.com" },
                { label: "Owner", email: "owner@racehorse.com" },
                { label: "Manager", email: "manager@racehorse.com" },
              ].map((acc) => (
                <Pressable
                  key={acc.email}
                  onPress={() => {
                    setEmail(acc.email);
                    setPassword("Password123@");
                    setFormError("");
                  }}
                  style={styles.demoPill}
                >
                  <Text style={styles.demoPillText}>{acc.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <Text style={styles.footer}>
          {t("Your access is determined by the role on your account.")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    language: { position: "absolute", right: 18, top: 54, zIndex: 10 },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: space.xl,
      gap: space.xxl,
      maxWidth: 620,
      width: "100%",
      alignSelf: "center",
    },
    brand: { color: colors.foreground, fontSize: 20, fontWeight: "900", letterSpacing: -0.8 },
    brandAccent: { color: colors.primary },
    kicker: { color: colors.mutedForeground, fontSize: 11, marginTop: 4 },
    hero: { marginTop: space.xl, gap: space.md },
    title: { color: colors.foreground, fontSize: 34, lineHeight: 38, fontWeight: "800" },
    copy: { color: colors.mutedForeground, fontSize: 15, lineHeight: 22 },
    form: { gap: space.sm },
    googleSection: { gap: space.md },
    googleButton: {
      minHeight: 50,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space.sm,
      paddingHorizontal: space.md,
    },
    googleButtonText: { color: colors.foreground, fontSize: 14, fontWeight: "700" },
    googleSpinner: {
      width: 17,
      height: 17,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.border,
      borderTopColor: colors.primary,
    },
    divider: { flexDirection: "row", alignItems: "center", gap: space.sm },
    dividerLine: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: colors.border },
    dividerText: { color: colors.mutedForeground, fontSize: 11 },
    inputLabel: { color: colors.mutedForeground, fontSize: 11, marginTop: space.sm },
    input: {
      minHeight: 50,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.foreground,
      paddingHorizontal: space.md,
    },
    fieldError: { color: colors.destructive, fontSize: 12 },
    submit: {
      minHeight: 50,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: space.md,
    },
    submitText: { color: "#FFFFFF", fontWeight: "800" },
    disabled: { opacity: 0.55 },
    pressed: { opacity: 0.8 },
    errorBox: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: colors.surface,
      padding: space.md,
      gap: space.sm,
    },
    errorText: { color: colors.destructive, fontSize: 13, lineHeight: 19 },
    retry: { alignSelf: "flex-start", paddingVertical: space.xs },
    retryText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    footer: { textAlign: "center", color: colors.mutedForeground, fontSize: 11 },
    demoSection: { marginTop: space.md, gap: space.xs },
    demoTitle: { color: colors.mutedForeground, fontSize: 11, fontWeight: "600" },
    demoPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    demoPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    demoPillText: { color: colors.foreground, fontSize: 12, fontWeight: "600" },
  });
