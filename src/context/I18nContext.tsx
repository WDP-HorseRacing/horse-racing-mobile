import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import vi from "@/data/locales/vi.json";
import viUi from "@/data/locales/vi-ui.json";

export type Language = "en" | "vi";
type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};
const I18nContext = createContext<I18nValue | null>(null);
const vietnamese = { ...vi, ...viUi } as Record<string, string>;
let currentLanguage: Language = "en";

function translateVietnamese(text: string) {
  if (vietnamese[text]) return vietnamese[text];
  return Object.entries(vietnamese)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((result, [source, translated]) => result.replaceAll(source, translated), text);
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(currentLanguage);
  const value = useMemo<I18nValue>(() => {
    const setLanguage = (next: Language) => {
      currentLanguage = next;
      setLanguageState(next);
    };
    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "en" ? "vi" : "en"),
      t: (text) => (language === "vi" ? translateVietnamese(text) : text),
    };
  }, [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
