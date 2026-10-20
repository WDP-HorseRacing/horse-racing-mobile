import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { googleOidcProviderError } from "@/features/auth/google-oidc";
import { extractErrorMessage } from "@/utils/errorHandler";

export default function GoogleAuthCallback() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    state?: string | string[];
    error?: string | string[];
  }>();
  const code = first(params.code);
  const state = first(params.state);
  const providerError = first(params.error);
  const { signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (providerError) {
      setErrorMessage(t(googleOidcProviderError(providerError)));
    } else if (!code || !state) {
      setErrorMessage(t("The Google sign-in response is incomplete. Please try again."));
    } else {
      void signInWithGoogle({ code, state })
        .then((role) => {
          if (active) router.replace(`/${role}` as Href);
        })
        .catch((error: unknown) => {
          if (active) {
            setErrorMessage(
              t(extractErrorMessage(error, t("Unable to sign in with Google."))),
            );
          }
        });
    }

    return () => {
      active = false;
    };
  }, [code, providerError, signInWithGoogle, state, t]);

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.content}>
          <Text style={styles.title}>{t("Google sign-in failed")}</Text>
          <Text style={styles.message}>{errorMessage}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/login" as Href)}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>{t("Back to sign in")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <LoadingScreen label={t("Completing Google sign-in…")} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      padding: space.xl,
    },
    content: { width: "100%", maxWidth: 520, alignSelf: "center", gap: space.md },
    title: { color: colors.foreground, fontSize: 22, fontWeight: "800" },
    message: { color: colors.mutedForeground, fontSize: 14, lineHeight: 21 },
    backButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      marginTop: space.sm,
      paddingHorizontal: space.lg,
    },
    backButtonText: { color: "#FFFFFF", fontWeight: "800" },
    pressed: { opacity: 0.75 },
  });
