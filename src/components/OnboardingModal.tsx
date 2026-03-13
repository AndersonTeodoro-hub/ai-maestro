import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const contentTypeKeys = ["YouTube Videos", "Instagram/TikTok", "Blog Posts", "Email Marketing", "Social Media", "Podcasts"];

export function OnboardingModal() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [contentType, setContentType] = useState("");
  const { user, refreshProfile } = useAuth();
  const { t } = useTranslation();

  const handleFinish = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name || undefined,
        content_preference: contentType || undefined,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) {
      toast.error(t("chat.somethingWrong"));
    } else {
      await refreshProfile();
      toast.success(t("onboarding.welcome"));
    }
  };

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md bg-[hsl(var(--surface-2))] border-border shadow-elevated" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-foreground text-tracking-tight">
            {step === 1 && t("onboarding.step1Title")}
            {step === 2 && t("onboarding.step2Title")}
            {step === 3 && t("onboarding.step3Title")}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && t("onboarding.step1Desc")}
            {step === 2 && t("onboarding.step2Desc")}
            {step === 3 && t("onboarding.step3Desc")}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Input placeholder={t("onboarding.yourName")} value={name} onChange={(e) => setName(e.target.value)} className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary" />
            <Button className="w-full glow-primary" onClick={() => setStep(2)}>{t("common.continue")}</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {contentTypeKeys.map((ct) => (
                <Button key={ct} variant={contentType === ct ? "default" : "outline"} size="sm" onClick={() => setContentType(ct)} className={`text-sm ${contentType === ct ? "glow-primary" : "border-border hover:border-primary/30"}`}>
                  {t(`onboarding.contentTypes.${ct}`, ct)}
                </Button>
              ))}
            </div>
            <Button className="w-full glow-primary" onClick={() => setStep(3)}>{t("common.continue")}</Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>{t("onboarding.starterPrompt1")}</p>
              <p>{t("onboarding.starterPrompt2")}</p>
              <p>{t("onboarding.starterPrompt3")}</p>
              <p>{t("onboarding.starterPrompt4")}</p>
              <p>{t("onboarding.starterPrompt5")}</p>
              <p>{t("onboarding.starterPrompt6")}</p>
            </div>
            <Button className="w-full glow-primary" onClick={handleFinish}>{t("onboarding.letsGo")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
