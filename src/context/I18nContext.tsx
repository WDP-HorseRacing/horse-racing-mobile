import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import vi from "@/data/locales/vi.json";
import viUi from "@/data/locales/vi-ui.json";
import viUiExtra from "@/data/locales/vi-ui-extra.json";

export type Language = "en" | "vi";

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};

const LANGUAGE_STORAGE_KEY = "@raceos/language";
const I18nContext = createContext<I18nValue | null>(null);

const vietnamese = { ...vi, ...viUi, ...viUiExtra } as Record<string, string>;
vietnamese["HorseRacing"] = "HorseRacing";
vietnamese["HorseRacing Mobile"] = "HorseRacing Mobile";

const english: Record<string, string> = {};
for (const [en, v] of Object.entries(vietnamese)) {
  if (typeof v === "string" && !english[v]) {
    english[v] = en;
  }
}
english["bị khóa"] = "locked";
english["bị thương"] = "injured";
english["HorseRacing"] = "HorseRacing";
english["HorseRacing Mobile"] = "HorseRacing Mobile";
english["Vuot mong ngua"] = "Clean hooves";

type I18nRuntime = typeof globalThis & {
  __raceosLanguage?: Language;
  __raceosTranslateText?: (text: string, language: Language) => string;
  __raceosOriginalAlert?: typeof Alert.alert;
};
const i18nRuntime = globalThis as I18nRuntime;
i18nRuntime.__raceosLanguage ??= "en";
// Keep the Alert wrapper stable across Fast Refresh while refreshing its translator.
// Otherwise a one-time Alert patch can retain an older locale catalog after HMR.
i18nRuntime.__raceosTranslateText = translateText;
const currentT = (text: string) =>
  (i18nRuntime.__raceosTranslateText ?? translateText)(text, i18nRuntime.__raceosLanguage ?? "en");
const templateCache = new WeakMap<Record<string, string>, [string, string][]>();

function translateTemplate(text: string, catalog: Record<string, string>): string | null {
  let templates = templateCache.get(catalog);
  if (!templates) {
    templates = Object.entries(catalog)
      .filter(([template]) => template.includes("{"))
      .sort(
        ([first], [second]) =>
          second.replace(/\{[^{}]+\}/g, "").length - first.replace(/\{[^{}]+\}/g, "").length,
      );
    templateCache.set(catalog, templates);
  }

  for (const [template, translation] of templates) {
    const escaped = template
      .split(/(\{[^{}]+\})/)
      .map((part) =>
        /^\{[^{}]+\}$/.test(part) ? "(.+?)" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("");
    const match = text.match(new RegExp(`^${escaped}$`));
    if (!match) continue;
    let valueIndex = 1;
    return translation.replace(/\{[^{}]+\}/g, () => match[valueIndex++] ?? "");
  }
  return null;
}

// Global Alert.alert localization hook
function patchAlert() {
  type LocalizedAlert = typeof Alert.alert & {
    __raceosAlertWrapper?: true;
    __raceosOriginalAlert?: typeof Alert.alert;
  };
  const currentAlert = Alert.alert as LocalizedAlert;
  const originalAlert = currentAlert.__raceosAlertWrapper
    ? (currentAlert.__raceosOriginalAlert ?? i18nRuntime.__raceosOriginalAlert ?? currentAlert)
    : (i18nRuntime.__raceosOriginalAlert ?? currentAlert);
  i18nRuntime.__raceosOriginalAlert = originalAlert;
  const localizedAlert = ((title, message, buttons, options) => {
    const locTitle = typeof title === "string" ? currentT(title) : title;
    const locMessage = typeof message === "string" ? currentT(message) : message;
    const locButtons = buttons?.map((b) => ({
      ...b,
      text: typeof b.text === "string" ? currentT(b.text) : b.text,
    }));
    return originalAlert(locTitle, locMessage, locButtons, options);
  }) as LocalizedAlert;
  localizedAlert.__raceosAlertWrapper = true;
  localizedAlert.__raceosOriginalAlert = originalAlert;
  Alert.alert = localizedAlert;
}
patchAlert();

export function showLocalizedAlert(
  language: Language,
  title: string,
  message?: string,
  buttons?: Parameters<typeof Alert.alert>[2],
  options?: Parameters<typeof Alert.alert>[3],
) {
  const originalAlert = i18nRuntime.__raceosOriginalAlert ?? Alert.alert;
  const localizedButtons = buttons?.map((button) => ({
    ...button,
    text: typeof button.text === "string" ? translateText(button.text, language) : button.text,
  }));
  return originalAlert(
    translateText(title, language),
    typeof message === "string" ? translateText(message, language) : message,
    localizedButtons,
    options,
  );
}

function translateToEnglish(text: string): string {
  if (english[text]) return english[text];
  const trimmed = text.trim();
  if (english[trimmed]) return text.replace(trimmed, english[trimmed]);
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(text)) return text.replaceAll("_", " ");

  if (text.startsWith("• ")) {
    return `• ${translateToEnglish(text.slice(2))}`;
  }

  const templated = translateTemplate(text, english);
  if (templated) return templated;

  if (text.includes(" · ")) {
    return text
      .split(" · ")
      .map((part) => translateToEnglish(part.trim()))
      .join(" · ");
  }

  const countMatch = text.match(/^(\d+)\s+(.+)$/);
  if (countMatch) {
    const translatedLabel = translateToEnglish(countMatch[2]);
    if (translatedLabel !== countMatch[2]) return `${countMatch[1]} ${translatedLabel}`;
  }

  return text;
}

function translateToVietnameseInternal(text: string): string {
  if (vietnamese[text]) return vietnamese[text];
  const trimmed = text.trim();
  if (vietnamese[trimmed]) return text.replace(trimmed, vietnamese[trimmed]);

  // Already in Vietnamese
  if (english[text] || english[trimmed]) return text;

  if (text.startsWith("• ")) {
    return `• ${translateToVietnamese(text.slice(2))}`;
  }

  const templated = translateTemplate(text, vietnamese);
  if (templated) return templated;

  // Split compound phrases by " · "
  if (text.includes(" · ")) {
    return text
      .split(" · ")
      .map((part) => translateToVietnamese(part.trim()))
      .join(" · ");
  }

  // Common pattern replacements
  const horsesMatch = text.match(/^(\d+)\s+horses$/i);
  if (horsesMatch) return `${horsesMatch[1]} ngựa`;

  const ownedMatch = text.match(/^(\d+)\s+horses\s+owned$/i);
  if (ownedMatch) return `Sở hữu ${ownedMatch[1]} ngựa`;

  const wingMatch = text.match(/^A wing · (\d+) horses$/i);
  if (wingMatch) return `Khu A · ${wingMatch[1]} ngựa`;

  const countMatch = text.match(/^(\d+)\s+(.+)$/);
  if (countMatch) {
    const translatedLabel = translateToVietnameseInternal(countMatch[2]);
    if (translatedLabel !== countMatch[2]) return `${countMatch[1]} ${translatedLabel}`;
  }

  const changeStatusMatch = text.match(/^Change (.+) to (active|inactive)\?$/i);
  if (changeStatusMatch) {
    const statusText =
      changeStatusMatch[2].toLowerCase() === "active" ? "hoạt động" : "không hoạt động";
    return `Đổi ${changeStatusMatch[1]} sang ${statusText}?`;
  }

  const removeInvMatch = text.match(/^Remove (.+) from the active inventory\?$/i);
  if (removeInvMatch) {
    return `Xóa ${removeInvMatch[1]} khỏi kho đang hoạt động?`;
  }

  const rbacMatch = text.match(/^Access control for (.+) saved successfully\.$/i);
  if (rbacMatch) {
    return `Đã lưu quyền truy cập cho ${rbacMatch[1]} thành công.`;
  }

  return text;
}

function translateToVietnamese(text: string): string {
  // Never modify "HorseRacing" in any form
  if (text.includes("HorseRacing")) {
    const placeholder = "__HR_APP_BRAND__";
    const protectedText = text.replaceAll("HorseRacing", placeholder);
    const translated = translateToVietnameseInternal(protectedText);
    return translated.replaceAll(placeholder, "HorseRacing");
  }
  return translateToVietnameseInternal(text);
}

export function translateText(text: string, lang: Language): string {
  if (!text || typeof text !== "string") return text;
  if (text === "HorseRacing" || text === "HorseRacing Mobile") return text;
  return lang === "vi" ? translateToVietnamese(text) : translateToEnglish(text);
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(i18nRuntime.__raceosLanguage ?? "en");

  useEffect(() => {
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "vi") {
          i18nRuntime.__raceosLanguage = saved;
          setLanguageState(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    i18nRuntime.__raceosLanguage = language;
  }, [language]);

  const value = useMemo<I18nValue>(() => {
    const t = (text: string) => translateText(text, language);

    const setLanguage = (next: Language) => {
      i18nRuntime.__raceosLanguage = next;
      setLanguageState(next);
      void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => undefined);
    };

    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "en" ? "vi" : "en"),
      t,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
