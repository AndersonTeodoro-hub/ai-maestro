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

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [budget, setBudget] = useState(String(profile?.monthly_budget_eur || 10));
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setName(profile?.full_name || "");
    setBudget(String(profile?.monthly_budget_eur || 10));
  }, [profile]);

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

  const handleDeleteAccount = async () => {
    await signOut();
    toast.success(t("settings.deleteRequested"));
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
              <Button variant="outline" onClick={() => handleUpgrade("pro")} disabled={!!checkoutLoading}>
                {checkoutLoading === "pro" ? t("settings.saving") : t("settings.upgradePro")}
              </Button>
            </div>
          )}
          {profile?.plan === "starter" && (
            <div className="flex gap-2">
              <Button className="glow-primary" onClick={() => handleUpgrade("pro")} disabled={!!checkoutLoading}>
                {checkoutLoading === "pro" ? t("settings.saving") : t("settings.upgradePro")}
              </Button>
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

      <Card className="bg-[hsl(var(--surface-2))] border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive text-tracking-tight">{t("settings.dangerZone")}</CardTitle>
          <CardDescription>{t("settings.dangerDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t("settings.deleteAccount")}</Button>
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
