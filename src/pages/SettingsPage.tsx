import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [budget, setBudget] = useState(String(profile?.monthly_budget_eur || 10));
  const [saving, setSaving] = useState(false);

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
    toast.success("Profile updated!");
  };

  const handleSaveBudget = async () => {
    if (!user) return;
    const val = parseFloat(budget);
    if (isNaN(val) || val < 0) {
      toast.error("Please enter a valid budget.");
      return;
    }
    await supabase.from("profiles").update({ monthly_budget_eur: val }).eq("id", user.id);
    await refreshProfile();
    toast.success("Budget updated!");
  };

  const handleDeleteAccount = async () => {
    // In production, this would call an edge function to delete the user
    await signOut();
    toast.success("Account deletion requested.");
  };

  const planColors: Record<string, string> = {
    free: "bg-secondary text-secondary-foreground",
    starter: "bg-primary/20 text-primary",
    pro: "bg-accent/20 text-accent",
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      {/* Profile */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Email</label>
            <Input value={user?.email || ""} disabled className="bg-secondary border-border opacity-60" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Manage your plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-foreground">Current plan:</span>
            <Badge className={planColors[profile?.plan || "free"]}>
              {(profile?.plan || "free").charAt(0).toUpperCase() + (profile?.plan || "free").slice(1)}
            </Badge>
          </div>
          {profile?.plan === "free" && (
            <Button>Upgrade to Starter — €19/mo</Button>
          )}
          {profile?.plan === "starter" && (
            <Button>Upgrade to Pro — €49/mo</Button>
          )}
          {profile?.plan === "pro" && (
            <p className="text-sm text-muted-foreground">You're on our top plan! 🎉</p>
          )}
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle>Monthly Budget</CardTitle>
          <CardDescription>Set a spending limit. You'll be warned at 80%.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="bg-secondary border-border w-32"
              min={0}
              step={1}
            />
            <span className="text-muted-foreground self-center">€ / month</span>
          </div>
          <Button onClick={handleSaveBudget}>Save Budget</Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-card border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all your data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground">
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
