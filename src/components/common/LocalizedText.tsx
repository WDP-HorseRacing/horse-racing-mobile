import { Pressable, Text as NativeText, type TextProps } from "react-native";
import { Children, type ReactNode } from "react";
import { useI18n } from "@/context/I18nContext";

import { useTheme } from "@/hooks/useTheme";

export type LocalizedTextProps = TextProps & {
  translatable?: boolean;
};

export function Text({ children, translatable = true, style, ...props }: LocalizedTextProps) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <NativeText style={[{ color: colors.foreground }, style]} {...props}>
      {translatable ? localize(children, t) : children}
    </NativeText>
  );
}

export function LanguageToggle() {
  const { language, toggleLanguage } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change language"
      onPress={toggleLanguage}
      style={{
        borderRadius: 10,
        backgroundColor: "#D1FAE5",
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <NativeText style={{ color: "#047857", fontSize: 11, fontWeight: "800" }}>
        {language === "en" ? "VI" : "EN"}
      </NativeText>
    </Pressable>
  );
}

function localize(node: ReactNode, t: (text: string) => string): ReactNode {
  if (typeof node === "string") {
    if (node === "HorseRacing" || node === "HorseRacing Mobile") return node;
    return t(node);
  }
  if (Array.isArray(node)) return Children.map(node, (child) => localize(child, t));
  return node;
}
