import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Target, BookOpen, BarChart3, Check, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function Landing() {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: Target,
      title: t("landing.smartRouting"),
      description: t("landing.smartRoutingDesc"),
    },
    {
      icon: BookOpen,
      title: t("landing.promptLibrary"),
      description: t("landing.promptLibraryDesc"),
    },
    {
      icon: BarChart3,
      title: t("landing.costDashboard"),
      description: t("landing.costDashboardDesc"),
    },
  ];

  const plans = [
    {
      name: t("landing.free"),
      price: "€0",
      period: t("landing.forever"),
      features: [t("landing.feat_20req"), t("landing.feat_quickOnly"), t("landing.feat_3prompts"), t("landing.feat_costTracking")],
      cta: t("landing.startFree"),
      popular: false,
    },
    {
      name: t("landing.starter"),
      price: "€19",
      period: t("landing.perMonth"),
      features: [t("landing.feat_300req"), t("landing.feat_allModes"), t("landing.feat_unlimitedPrompts"), t("landing.feat_fullAnalytics"), t("landing.feat_priorityEmail")],
      cta: t("landing.getStarter"),
      popular: true,
    },
    {
      name: t("landing.pro"),
      price: "€49",
      period: t("landing.perMonth"),
      features: [t("landing.feat_1500req"), t("landing.feat_allModes"), t("landing.feat_unlimitedPrompts"), t("landing.feat_advancedAnalytics"), t("landing.feat_prioritySupport"), t("landing.feat_customBudget")],
      cta: t("landing.getPro"),
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">PromptOS</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Button variant="ghost" asChild>
              <Link to="/login">{t("landing.login")}</Link>
            </Button>
            <Button asChild>
              <Link to="/register">{t("landing.startFree")}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6">
            {t("landing.hero")}{" "}
            <span className="text-primary">{t("landing.heroHighlight")}</span>
            <br />
            {t("landing.heroSub")}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {t("landing.heroDesc")}
          </p>
          <Button size="lg" className="text-lg px-8 py-6 rounded-xl" asChild>
            <Link to="/register">{t("landing.startFree")}</Link>
          </Button>
        </motion.div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 pb-32">
        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            >
              <Card className="bg-card border-border/50 hover:border-primary/30 transition-colors h-full">
                <CardContent className="p-8">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <b.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{b.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{b.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 pb-32">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
          {t("landing.pricingTitle")}
        </h2>
        <p className="text-muted-foreground text-center mb-12 text-lg">
          {t("landing.pricingSub")}
        </p>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative bg-card border-border/50 ${
                plan.popular ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  {t("landing.mostPopular")}
                </div>
              )}
              <CardContent className="p-8">
                <h3 className="text-lg font-semibold text-foreground mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link to="/register">{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">PromptOS</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} PromptOS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
