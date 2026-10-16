import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import vi from "@/data/locales/vi.json";
import viUi from "@/data/locales/vi-ui.json";

export type Language = "en" | "vi";

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};

const LANGUAGE_STORAGE_KEY = "@raceos/language";
const I18nContext = createContext<I18nValue | null>(null);

const vietnamese = { ...vi, ...viUi } as Record<string, string>;
vietnamese["HorseRacing"] = "HorseRacing";
vietnamese["HorseRacing Mobile"] = "HorseRacing Mobile";

const english: Record<string, string> = {};
for (const [en, v] of Object.entries(vietnamese)) {
  if (typeof v === "string" && !english[v]) {
    english[v] = en;
  }
}
english["HorseRacing"] = "HorseRacing";
english["HorseRacing Mobile"] = "HorseRacing Mobile";

let currentLanguage: Language = "en";
let currentT: (text: string) => string = (t) => t;

// Global Alert.alert localization hook
let alertPatched = false;
function patchAlert() {
  if (alertPatched) return;
  alertPatched = true;
  const originalAlert = Alert.alert;
  Alert.alert = (title, message, buttons, options) => {
    const locTitle = typeof title === "string" ? currentT(title) : title;
    const locMessage = typeof message === "string" ? currentT(message) : message;
    const locButtons = buttons?.map((b) => ({
      ...b,
      text: typeof b.text === "string" ? currentT(b.text) : b.text,
    }));
    return originalAlert(locTitle, locMessage, locButtons, options);
  };
}
patchAlert();

function translateToEnglish(text: string): string {
  if (english[text]) return english[text];
  const trimmed = text.trim();
  if (english[trimmed]) return text.replace(trimmed, english[trimmed]);

  if (text.startsWith("• ")) {
    return `• ${translateToEnglish(text.slice(2))}`;
  }

  if (text.includes(" · ")) {
    return text
      .split(" · ")
      .map((part) => translateToEnglish(part.trim()))
      .join(" · ");
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

  const changeStatusMatch = text.match(/^Change (.+) to (active|inactive)\?$/i);
  if (changeStatusMatch) {
    const statusText = changeStatusMatch[2].toLowerCase() === "active" ? "hoạt động" : "không hoạt động";
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
  const [language, setLanguageState] = useState<Language>(currentLanguage);

  useEffect(() => {
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "vi") {
          currentLanguage = saved;
          setLanguageState(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    currentT = (text: string) => translateText(text, language);
    currentLanguage = language;
  }, [language]);

  const value = useMemo<I18nValue>(() => {
    const t = (text: string) => translateText(text, language);

    const setLanguage = (next: Language) => {
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
