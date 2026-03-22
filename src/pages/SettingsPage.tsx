import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Key, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [budget, setBudget] = useState(String(profile?.monthly_budget_eur || 10));
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  
  // API Keys state
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);

  useEffect(() => {
    setName(profile?.full_name || "");
    setBudget(String(profile?.monthly_budget_eur || 10));
    // Load saved API key
    const savedKey = localStorage.getItem(`savvyowl_google_key_${user?.id}`);
    if (savedKey) setGoogleApiKey(savedKey);
  }, [profile, user]);

  const handleSaveApiKeys = () => {
    setSavingKeys(true);
    if (googleApiKey.trim()) {
      localStorage.setItem(`savvyowl_google_key_${user?.id}`, googleApiKey.trim());
    } else {
      localStorage.removeItem(`savvyowl_google_key_${user?.id}`);
    }
    setSavingKeys(false);
    toast.success(t("settings.apiKeysSaved") || "API keys saved!");
  };

  const handleRemoveApiKey = () => {
    setGoogleApiKey("");
    localStorage.removeItem(`savvyowl_google_key_${user?.id}`);
    toast.success(t("settings.apiKeysRemoved") || "API key removed");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    await refreshProfile();
    setSaving(false);
    toast.success(t("settings.profileUpdated"));
  };

  const handleSaveBudget = async () => {
    if (!user) return;
    const val = parseFloat(budget);
    if (isNaN(val) || val < 0) { toast.error(t("settings.invalidBudget")); return; }
    await supabase.from("profiles").update({ monthly_budget_eur: val }).eq("id", user.id);
    await refreshProfile();
    toast.success(t("settings.budgetUpdated"));
  };

  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
      toast.success(t("settings.deleteRequested"));
    } catch (e: any) {
      toast.error(t("settings.deleteFailed"));
      setDeleting(false);
    }
  };

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const planColors: Record<string, string> = {
    free: "bg-secondary text-secondary-foreground",
    starter: "bg-primary/20 text-primary",
    pro: "bg-accent/20 text-accent",
  };

  const handleUpgrade = async (plan: string) => {
    setCheckoutLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { action: "create-checkout", plan },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { action: "create-portal" },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground text-tracking-tight">{t("settings.title")}</h1>

      <Card className="bg-[hsl(var(--surface-2))] border-border">
        <CardHeader>
          <CardTitle className="text-tracking-tight">{t("settings.profile")}</CardTitle>
          <CardDescription>{t("settings.profileDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("settings.name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("settings.email")}</label>
            <Input value={user?.email || ""} disabled className="bg-[hsl(var(--surface-1))] border-border opacity-60" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="glow-primary">
            {saving ? t("settings.saving") : t("settings.saveChanges")}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--surface-2))] border-border">
        <CardHeader>
          <CardTitle className="text-tracking-tight">{t("settings.subscription")}</CardTitle>
          <CardDescription>{t("settings.subscriptionDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-foreground">{t("settings.currentPlan")}</span>
            <Badge className={planColors[profile?.plan || "free"]}>
              {(profile?.plan || "free").charAt(0).toUpperCase() + (profile?.plan || "free").slice(1)}
            </Badge>
          </div>
          {profile?.plan === "free" && (
            <div className="flex gap-2">
              <Button className="glow-primary" onClick={() => handleUpgrade("starter")} disabled={!!checkoutLoading}>
                {checkoutLoading === "starter" ? t("settings.saving") : t("settings.upgradeStarter")}
              </Button>
            </div>
          )}
          {profile?.plan === "starter" && (
            <div className="flex gap-2">
              <p className="text-sm text-muted-foreground self-center">{t("settings.topPlan")}</p>
              <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
                {portalLoading ? t("settings.saving") : t("settings.manageSubscription", "Manage Subscription")}
              </Button>
            </div>
          )}
          {profile?.plan === "pro" && (
            <div className="flex gap-2">
              <p className="text-sm text-muted-foreground self-center">{t("settings.topPlan")}</p>
              <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
                {portalLoading ? t("settings.saving") : t("settings.manageSubscription", "Manage Subscription")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--surface-2))] border-border">
        <CardHeader>
          <CardTitle className="text-tracking-tight">{t("settings.monthlyBudget")}</CardTitle>
          <CardDescription>{t("settings.budgetDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="bg-[hsl(var(--surface-1))] border-border w-32 focus-visible:border-primary" min={0} step={1} />
            <span className="text-muted-foreground self-center">{t("settings.perMonth")}</span>
          </div>
          <Button onClick={handleSaveBudget} className="glow-primary">{t("settings.saveBudget")}</Button>
        </CardContent>
      </Card>

      {/* API Keys - Generate images/videos inside SavvyOwl */}
      <Card className="bg-[hsl(var(--surface-2))] border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-tracking-tight">{t("settings.apiKeys") || "API Keys (Gerar imagens e videos)"}</CardTitle>
          </div>
          <CardDescription>
            {t("settings.apiKeysDesc") || "Conecta a tua Google Cloud API Key para gerar imagens (Nano Banana) e videos (Veo3) diretamente na SavvyOwl. A tua key fica guardada apenas no teu browser."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Google Cloud API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showGoogleKey ? "text" : "password"}
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {t("settings.apiKeyHint") || "Usada para Nano Banana (imagens) e Veo3 (videos). Ativa a YouTube Data API, Gemini API e Vertex AI no teu projeto Google Cloud."}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSaveApiKeys} disabled={savingKeys} className="glow-primary" size="sm">
              {savingKeys ? "..." : (t("settings.saveApiKeys") || "Guardar API Key")}
            </Button>
            {googleApiKey && (
              <Button onClick={handleRemoveApiKey} variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                {t("settings.removeApiKey") || "Remover"}
              </Button>
            )}
          </div>

          {!googleApiKey && (
            <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground/70">{t("settings.howToGetKey") || "Como obter a API Key:"}</p>
              <p>1. {t("settings.step1") || "Vai a console.cloud.google.com"}</p>
              <p>2. {t("settings.step2") || "Ativa as APIs: YouTube Data, Gemini API, Vertex AI"}</p>
              <p>3. {t("settings.step3") || "Vai a Credentials -> Create API Key"}</p>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline mt-1">
                Google Cloud Console <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {googleApiKey && (
            <div className="bg-primary/5 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="text-primary font-medium mb-1">API Key conectada</p>
              <p>{t("settings.apiKeyConnected") || "Podes agora gerar imagens e videos diretamente nos templates da SavvyOwl. As funcionalidades de geracao vao aparecer automaticamente nos templates compativeis."}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--surface-2))] border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive text-tracking-tight">{t("settings.dangerZone")}</CardTitle>
          <CardDescription>{t("settings.dangerDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>{deleting ? t("settings.saving") : t("settings.deleteAccount")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[hsl(var(--surface-2))] border-border shadow-elevated">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.deleteConfirm")}</AlertDialogTitle>
                <AlertDialogDescription>{t("settings.deleteWarning")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground">
                  {t("settings.deleteAccount")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
