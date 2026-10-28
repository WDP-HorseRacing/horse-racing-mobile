import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Platform,
  ActivityIndicator,
} from "react-native";
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
import { GOOGLE_OIDC_REDIRECT_URI, parseGoogleOidcCallbackUrl } from "@/features/auth/google-oidc";
import { authService } from "@/services/auth.service";

WebBrowser.maybeCompleteAuthSession();

const LAST_LOGIN_EMAIL_KEY = "@last_login_email";

export default function Login() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { t } = useI18n();
  const { signIn, signInWithGoogle, isLoading, authError, retrySession, token } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [googlePending, setGooglePending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialChecked, setInitialChecked] = useState(false);
  const loginFeedback = getLoginFeedback(authError, formError, Boolean(token));

  // Load last remembered email on initial mount
  useEffect(() => {
    void AsyncStorage.getItem(LAST_LOGIN_EMAIL_KEY).then((saved) => {
      if (saved) {
        setEmail((prev) => prev || saved);
      }
      setInitialChecked(true);
    });
  }, []);

  // Show full loading screen only during initial app launch session check (not during form submit)
  if (isLoading && !token && !submitting && !initialChecked) {
    return <LoadingScreen label={t("Signing in…")} />;
  }

  const submit = async () => {
    if (!email.trim() || !password || submitting) return;
    setFormError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      // Save email for next attempts
      await AsyncStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim()).catch(() => undefined);
      await signIn(email.trim(), password);
    } catch (error) {
      setFormError(extractErrorMessage(error, t("Unable to sign in.")));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setSubmitting(false);
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={
          Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : Platform.OS === "android" ? "on-drag" : "none"
          }
          keyboardShouldPersistTaps="handled"
        >
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
            <View style={styles.passwordWrapper}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoComplete="password"
                secureTextEntry={!showPassword}
                editable={!submitting && !googlePending}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { paddingRight: 48 }]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
                hitSlop={8}
                accessibilityLabel={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
            {fieldErrors.password ? (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={submitting || googlePending || !email.trim() || !password}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.submit,
                pressed && styles.pressed,
                (submitting || !email.trim() || !password) && styles.disabled,
              ]}
            >
              {submitting ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitText}>{t("Signing in…")}</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>{t("Sign in")}</Text>
              )}
            </Pressable>
          </View>
          <Text style={styles.footer}>
            {t("Your access is determined by the role on your account.")}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    keyboardAvoidingView: { flex: 1 },
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
    passwordWrapper: {
      position: "relative",
      justifyContent: "center",
    },
    eyeButton: {
      position: "absolute",
      right: 14,
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      padding: 4,
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
  });
