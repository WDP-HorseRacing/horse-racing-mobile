import { Pressable, Text as NativeText, type TextProps } from "react-native";
import { Children, type ReactNode } from "react";
import { useI18n } from "@/context/I18nContext";

export function Text({ children, ...props }: TextProps) {
  const { t } = useI18n();
  return <NativeText {...props}>{localize(children, t)}</NativeText>;
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
  if (typeof node === "string") return t(node);
  if (Array.isArray(node)) return Children.map(node, (child) => localize(child, t));
  return node;
}
