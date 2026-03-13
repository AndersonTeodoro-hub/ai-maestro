import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import pt from "./locales/pt.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";

export const supportedLanguages = [
  { code: "auto", label: "Auto-detect", flag: "🌐" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pt: { translation: pt },
      fr: { translation: fr },
      es: { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "pt", "fr", "es"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "savvyowl-language",
      caches: ["localStorage"],
    },
  });

export default i18n;
