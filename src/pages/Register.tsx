import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const planParam = searchParams.get("plan");

  // If user is already logged in and came with ?plan=pro, redirect to checkout
  useEffect(() => {
    if (user && session && planParam === "pro") {
      const redirectToCheckout = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("stripe-checkout", {
            body: { action: "create-checkout", plan: "pro" },
          });
          if (error) throw error;
          if (data?.url) {
            window.location.href = data.url;
          }
        } catch (err: any) {
          toast.error(err.message || "Error creating checkout");
          navigate("/dashboard");
        }
      };
      redirectToCheckout();
    }
  }, [user, session, planParam, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: planParam === "pro"
          ? `${window.location.origin}/register?plan=pro`
          : `${window.location.origin}/dashboard`,
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
          <div className="flex items-center gap-3 my-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">{t("auth.or", "or")}</span>
            <Separator className="flex-1" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (error) toast.error(error.message);
            }}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t("auth.continueGoogle", "Continue with Google")}
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
