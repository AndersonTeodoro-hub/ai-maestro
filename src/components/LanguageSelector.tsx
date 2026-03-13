import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { supportedLanguages } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import i18n from "@/i18n";

export function LanguageSelector() {
  const { i18n: i18nInstance } = useTranslation();
  const { user } = useAuth();

  const currentLang = localStorage.getItem("savvyowl-language") || "auto";
  const currentDisplay = supportedLanguages.find((l) => l.code === currentLang) || supportedLanguages[0];

  const handleChange = async (code: string) => {
    if (code === "auto") {
      localStorage.setItem("savvyowl-language", "auto");
      // Re-detect from browser
      const detected = navigator.language?.split("-")[0];
      const supported = ["en", "pt", "fr", "es"];
      const lang = supported.includes(detected) ? detected : "en";
      i18nInstance.changeLanguage(lang);
    } else {
      localStorage.setItem("savvyowl-language", code);
      i18nInstance.changeLanguage(code);
    }

    // Save to profile if logged in
    if (user) {
      await supabase.from("profiles").update({ language: code } as any).eq("id", user.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{currentDisplay.flag} {currentDisplay.code === "auto" ? i18n.t("common.autoDetect") : currentDisplay.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={currentLang === lang.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.code === "auto" ? i18n.t("common.autoDetect") : lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
