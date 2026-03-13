import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.checkEmail"));
      navigate("/login");
    }
  };

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-[hsl(var(--surface-1))] to-background px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
      <Card className="w-full max-w-md bg-[hsl(var(--surface-2))] border-border relative z-10 shadow-elevated">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.svg" alt="SavvyOwl" className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl text-tracking-tight">{t("auth.createAccount")}</CardTitle>
          <CardDescription>{t("auth.startSmart")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              placeholder={t("auth.fullName")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary focus-visible:ring-primary/30"
            />
            <Input
              type="email"
              placeholder={t("auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary focus-visible:ring-primary/30"
            />
            <Input
              type="password"
              placeholder={t("auth.passwordMin")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary focus-visible:ring-primary/30"
            />
            <Button type="submit" className="w-full glow-primary" disabled={loading}>
              {loading ? t("auth.creatingAccount") : t("auth.createAccountBtn")}
            </Button>
          </form>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[hsl(var(--surface-2))] px-2 text-muted-foreground">{t("common.or")}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full border-border hover:bg-secondary/50" onClick={handleGoogleSignup}>
            {t("auth.continueGoogle")}
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("auth.hasAccount")}{" "}
            <Link to="/login" className="text-primary hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
