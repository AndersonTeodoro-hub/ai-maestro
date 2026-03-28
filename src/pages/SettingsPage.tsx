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
import { Eye, EyeOff, Key, ExternalLink, Mic, Loader2, Coins, Zap, Image, Video, Package } from "lucide-react";
import { useElevenLabsKey } from "@/hooks/useElevenLabsKey";

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

  const handleBuyPack = async (pack: string) => {
    setCheckoutLoading(pack);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { action: "buy-credits", pack },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Falha ao iniciar checkout");
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="glow-primary" onClick={() => handleUpgrade("starter")} disabled={!!checkoutLoading}>
                {checkoutLoading === "starter" ? t("settings.saving") : t("settings.upgradeStarter")}
              </Button>
              <Button variant="outline" onClick={() => handleUpgrade("pro")} disabled={!!checkoutLoading}>
                {checkoutLoading === "pro" ? t("settings.saving") : t("settings.upgradePro")}
              </Button>
            </div>
          )}
          {profile?.plan === "starter" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="glow-primary" onClick={() => handleUpgrade("pro")} disabled={!!checkoutLoading}>
                {checkoutLoading === "pro" ? t("settings.saving") : t("settings.upgradePro")}
              </Button>
              <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
                {portalLoading ? t("settings.saving") : t("settings.manageSubscription", "Gerir Subscrição")}
              </Button>
            </div>
          )}
          {profile?.plan === "pro" && (
            <div className="flex gap-2">
              <p className="text-sm text-muted-foreground self-center">{t("settings.topPlan")}</p>
              <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
                {portalLoading ? t("settings.saving") : t("settings.manageSubscription", "Gerir Subscrição")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--surface-2))] border-border">
        <CardHeader>
          <CardTitle className="text-tracking-tight flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            Créditos SavvyOwl
          </CardTitle>
          <CardDescription>
            Usados para gerar imagens (1 crédito) e vídeos (10 créditos). Renovam com a tua subscrição.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balance display */}
          <div className="flex items-center justify-between bg-[hsl(var(--surface-1))] rounded-lg p-4 border border-border">
            <div>
              <p className="text-2xl font-bold text-primary">{profile?.credits_balance ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">créditos disponíveis</p>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 justify-end">
                <Zap className="h-3 w-3" />
                <span>1 crédito = 1 imagem</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <Zap className="h-3 w-3" />
                <span>10 créditos = 1 vídeo</span>
              </div>
            </div>
          </div>

          {/* Plan credits info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Créditos por plano (renova mensalmente):</p>
            <div className="flex gap-4">
              <span className={profile?.plan === "free" ? "text-primary font-medium" : ""}>Free: 10</span>
              <span className={profile?.plan === "starter" ? "text-primary font-medium" : ""}>Starter: 200</span>
              <span className={profile?.plan === "pro" ? "text-primary font-medium" : ""}>Pro: 1000</span>
            </div>
          </div>

          {/* Upgrade CTA if low credits */}
          {(profile?.credits_balance ?? 0) < 10 && profile?.plan === "free" && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs">
              <p className="text-foreground font-medium mb-2">Créditos a acabar!</p>
              <Button size="sm" className="glow-primary text-xs" onClick={() => handleUpgrade("starter")}>
                Upgrade para Starter — €14,99/mês · 150 créditos
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={refreshProfile}
          >
            Atualizar saldo
          </Button>
        </CardContent>
      </Card>

      {/* Credit Packs — buy extra credits */}
      <Card className="bg-[hsl(var(--surface-2))] border-border">
        <CardHeader>
          <CardTitle className="text-tracking-tight flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Comprar Créditos Extra
          </CardTitle>
          <CardDescription>
            Packs avulso — os créditos nunca expiram e acumulam com os do teu plano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Pack S */}
            <div className="bg-[hsl(var(--surface-1))] border border-border rounded-lg p-4 flex flex-col items-center text-center">
              <Image className="h-5 w-5 text-primary mb-2" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Pack S</p>
              <p className="text-2xl font-bold text-foreground">€4,99</p>
              <p className="text-sm text-primary font-medium mt-1">50 créditos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">50 imagens ou 5 vídeos</p>
              <Button
                size="sm"
                className="w-full glow-primary text-xs"
                onClick={() => handleBuyPack("pack_s")}
                disabled={!!checkoutLoading}
              >
                {checkoutLoading === "pack_s" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Comprar"}
              </Button>
            </div>

            {/* Pack M */}
            <div className="bg-[hsl(var(--surface-1))] border border-primary/30 rounded-lg p-4 flex flex-col items-center text-center relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Popular
              </span>
              <Zap className="h-5 w-5 text-primary mb-2" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Pack M</p>
              <p className="text-2xl font-bold text-foreground">€12,99</p>
              <p className="text-sm text-primary font-medium mt-1">150 créditos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">150 imagens ou 15 vídeos</p>
              <Button
                size="sm"
                className="w-full glow-primary text-xs"
                onClick={() => handleBuyPack("pack_m")}
                disabled={!!checkoutLoading}
              >
                {checkoutLoading === "pack_m" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Comprar"}
              </Button>
            </div>

            {/* Pack L */}
            <div className="bg-[hsl(var(--surface-1))] border border-border rounded-lg p-4 flex flex-col items-center text-center">
              <Video className="h-5 w-5 text-primary mb-2" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Pack L</p>
              <p className="text-2xl font-bold text-foreground">€29,99</p>
              <p className="text-sm text-primary font-medium mt-1">400 créditos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">400 imagens ou 40 vídeos</p>
              <Button
                size="sm"
                className="w-full glow-primary text-xs"
                onClick={() => handleBuyPack("pack_l")}
                disabled={!!checkoutLoading}
              >
                {checkoutLoading === "pack_l" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Comprar"}
              </Button>
            </div>
          </div>
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

      {/* Referral Program */}
      <Card className="bg-[hsl(var(--surface-2))] border-border">
        <CardHeader>
          <CardTitle className="text-tracking-tight">{t("settings.referral") || "Programa de Referencia"}</CardTitle>
          <CardDescription>
            {t("settings.referralDesc") || "Convida amigos para a SavvyOwl. A cada 20 registos com o teu link, ganhas 1 mes gratis!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">{t("settings.yourLink") || "O teu link de convite"}</label>
            <div className="flex gap-2">
              <Input
                value={`https://savvyowl.app/register?ref=${user?.id?.slice(0, 8) || ""}`}
                readOnly
                className="bg-[hsl(var(--surface-1))] border-border text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`https://savvyowl.app/register?ref=${user?.id?.slice(0, 8) || ""}`);
                  toast.success(t("settings.linkCopied") || "Link copiado!");
                }}
              >
                {t("settings.copy") || "Copiar"}
              </Button>
            </div>
          </div>
          <div className="bg-primary/5 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/70 mb-1">{t("settings.howItWorks") || "Como funciona:"}</p>
            <p>1. {t("settings.ref1") || "Partilha o teu link com amigos e colegas"}</p>
            <p>2. {t("settings.ref2") || "Cada pessoa que se regista conta como 1 ponto"}</p>
            <p>3. {t("settings.ref3") || "Ao chegar a 20 pontos, ganhas 1 mes de Starter gratis!"}</p>
          </div>
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

      {/* ElevenLabs - Voice Generation */}
      <ElevenLabsSection />

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

function ElevenLabsSection() {
  const { apiKey, voiceId, voiceName, saveApiKey, saveVoice, hasKey } = useElevenLabsKey();
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [voices, setVoices] = useState<Array<{ voice_id: string; name: string; category: string; preview_url?: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const { t } = useTranslation();

  useEffect(() => { setKeyInput(apiKey); }, [apiKey]);

  const loadVoices = async () => {
    if (!keyInput) return;
    setLoadingVoices(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-voice", {
        body: { action: "list-voices", apiKey: keyInput },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setVoices(data?.voices || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load voices");
    } finally {
      setLoadingVoices(false);
    }
  };

  return (
    <Card className="bg-[hsl(var(--surface-2))] border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-orange-400" />
          <CardTitle className="text-tracking-tight">ElevenLabs (Narracao de Voz)</CardTitle>
        </div>
        <CardDescription>
          Gera narracoes com voz consistente para os teus videos. A mesma voz em todos os videos do teu canal. A key fica guardada no teu browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">ElevenLabs API Key</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk_..."
                className="bg-[hsl(var(--surface-1))] border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                saveApiKey(keyInput);
                toast.success("ElevenLabs key guardada!");
                if (keyInput) loadVoices();
              }}
            >
              Guardar
            </Button>
          </div>
          <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
            Obter API key no ElevenLabs <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {hasKey && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">Voz selecionada</label>
              <Button variant="ghost" size="sm" onClick={loadVoices} disabled={loadingVoices} className="text-xs gap-1">
                {loadingVoices ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {loadingVoices ? "Carregando..." : "Carregar vozes"}
              </Button>
            </div>

            {voiceId && (
              <div className="bg-orange-500/5 rounded-lg p-3 text-sm border border-orange-400/20 mb-3">
                <span className="text-orange-400 font-medium">{voiceName || voiceId}</span>
                <span className="text-muted-foreground text-xs ml-2">-- Esta voz sera usada em todas as narracoes</span>
              </div>
            )}

            {voices.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {voices.map((v) => (
                  <button
                    key={v.voice_id}
                    onClick={() => {
                      saveVoice(v.voice_id, v.name);
                      toast.success(`Voz "${v.name}" selecionada!`);
                    }}
                    className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                      voiceId === v.voice_id
                        ? "border-orange-400 bg-orange-500/10"
                        : "border-border bg-[hsl(var(--surface-1))] hover:bg-[hsl(var(--surface-2))]"
                    }`}
                  >
                    <span className="font-medium block">{v.name}</span>
                    <span className="text-xs text-muted-foreground">{v.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/70 mb-1">Como funciona:</p>
          <p>1. Cria conta gratis em elevenlabs.io</p>
          <p>2. Copia a API key e cola aqui</p>
          <p>3. Seleciona ou clona uma voz</p>
          <p>4. Nos templates Canal Dark e Viral, clica "Gerar Narracao"</p>
          <p className="mt-2 text-orange-400">A mesma voz em todos os videos = identidade do teu canal!</p>
        </div>
      </CardContent>
    </Card>
  );
}