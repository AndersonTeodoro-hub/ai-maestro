import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, ArrowRight, Coins, Zap, Video, Image, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { LanguageSelector } from "@/components/LanguageSelector";

const FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const FONT_BODY = "'Libre Franklin', sans-serif";
const gold = "#c9a96e";
const dark = "#1a1814";
const light = "#f5f0e8";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } })
};

export default function Pricing() {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (action: string, plan?: string, pack?: string) => {
    if (!user || !session) { navigate("/register"); return; }
    setLoading(plan || pack || "");
    try {
      const body = plan ? { action: "create-checkout", plan } : { action: "buy-credits", pack };
      const { data, error } = await supabase.functions.invoke("stripe-checkout", { body });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Checkout error");
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    { key: "free", label: t("pricing.free_label"), price: t("pricing.free_price"), period: "", subtitle: t("pricing.free_subtitle"), features: t("pricing.free_features", { returnObjects: true }) as string[], cta: t("pricing.free_cta"), onClick: () => navigate("/register"), highlight: false },
    { key: "starter", label: t("pricing.starter_label"), price: t("pricing.starter_price"), period: t("pricing.period"), subtitle: t("pricing.starter_subtitle"), features: t("pricing.starter_features", { returnObjects: true }) as string[], cta: t("pricing.starter_cta"), onClick: () => handleCheckout("create-checkout", "starter"), highlight: false },
    { key: "pro", label: t("pricing.pro_label"), price: t("pricing.pro_price"), period: t("pricing.period"), subtitle: t("pricing.pro_subtitle"), features: t("pricing.pro_features", { returnObjects: true }) as string[], cta: t("pricing.pro_cta"), onClick: () => handleCheckout("create-checkout", "pro"), highlight: true },
    { key: "studio", label: t("pricing.studio_label"), price: t("pricing.studio_price"), period: t("pricing.period"), subtitle: t("pricing.studio_subtitle"), features: t("pricing.studio_features", { returnObjects: true }) as string[], cta: t("pricing.studio_cta"), onClick: () => handleCheckout("create-checkout", "studio"), highlight: false },
  ];

  const packs = [
    { key: "pack_s", name: t("pricing.pack_s_name"), price: t("pricing.pack_s_price"), credits: t("pricing.pack_s_credits"), desc: t("pricing.pack_s_desc"), icon: Image },
    { key: "pack_m", name: t("pricing.pack_m_name"), price: t("pricing.pack_m_price"), credits: t("pricing.pack_m_credits"), desc: t("pricing.pack_m_desc"), icon: Zap },
    { key: "pack_l", name: t("pricing.pack_l_name"), price: t("pricing.pack_l_price"), credits: t("pricing.pack_l_credits"), desc: t("pricing.pack_l_desc"), icon: Video },
  ];

  const faqs = [1, 2, 3, 4].map((n) => ({ q: t(`pricing.faq_q${n}`), a: t(`pricing.faq_a${n}`) }));

  return (
    <div style={{ fontFamily: FONT_BODY, backgroundColor: light, minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{ backgroundColor: dark, borderBottom: `1px solid ${light}0d` }} className="sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="SavvyOwl" className="h-8 w-auto" />
            <span className="text-xs font-medium" style={{ letterSpacing: "0.15em", color: light }}>SAVVYOWL</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="[&_button]:text-white/40 [&_button:hover]:text-white/80">
              <LanguageSelector />
            </div>
            <Link to="/login" className="text-xs" style={{ color: `${light}60`, letterSpacing: "1px" }}>{t("pricing.nav_login")}</Link>
            <Link to="/register" className="text-xs px-4 py-2" style={{ backgroundColor: gold, color: dark, letterSpacing: "1px" }}>{t("pricing.nav_register")}</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ backgroundColor: dark, color: light }} className="py-20 px-4 text-center">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <div className="inline-block px-4 py-1.5 mb-6 text-[10px]" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "4px" }}>{t("pricing.badge")}</div>
          <h1 className="text-4xl md:text-6xl mb-4" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
            {t("pricing.title_a")} <span style={{ color: gold, fontStyle: "italic" }}>{t("pricing.title_b")}</span>
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: `${light}60`, fontWeight: 300 }}>{t("pricing.subtitle")}</p>
        </motion.div>
      </section>

      {/* CREDIT EXPLAINER */}
      <section style={{ backgroundColor: `${dark}f5` }} className="py-8 px-4">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4" style={{ color: gold }} />
            <span className="text-xs" style={{ color: `${light}70`, letterSpacing: "1px" }}>{t("pricing.credit_image")}</span>
          </div>
          <div className="hidden sm:block w-px h-6" style={{ backgroundColor: `${light}15` }} />
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4" style={{ color: gold }} />
            <span className="text-xs" style={{ color: `${light}70`, letterSpacing: "1px" }}>{t("pricing.credit_video")}</span>
          </div>
          <div className="hidden sm:block w-px h-6" style={{ backgroundColor: `${light}15` }} />
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" style={{ color: gold }} />
            <span className="text-xs" style={{ color: `${light}70`, letterSpacing: "1px" }}>{t("pricing.credit_renew")}</span>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="py-20 px-4" style={{ backgroundColor: light }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: `${dark}15` }}>
            {plans.map((plan, i) => (
              <motion.div
                key={plan.key}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="p-8 flex flex-col"
                style={{
                  backgroundColor: plan.highlight ? dark : "#ece5d9",
                  color: plan.highlight ? light : dark,
                  borderTop: plan.highlight ? `3px solid ${gold}` : "3px solid transparent",
                  position: "relative",
                }}
              >
                {plan.highlight && (
                  <span className="absolute top-4 right-4 text-[9px] px-2 py-0.5" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "2px" }}>{t("pricing.popular")}</span>
                )}
                <p className="text-[10px] mb-1" style={{ letterSpacing: "3px", color: plan.highlight ? `${light}50` : `${dark}50` }}>{plan.label}</p>
                <p className="text-5xl mb-1" style={{ fontFamily: FONT_DISPLAY, color: plan.highlight ? light : dark }}>
                  {plan.price}{plan.period && <span className="text-lg" style={{ color: plan.highlight ? `${light}40` : `${dark}40` }}>/{t("pricing.period")}</span>}
                </p>
                <p className="text-sm mb-8" style={{ color: plan.highlight ? `${light}50` : `${dark}50`, fontWeight: 300 }}>{plan.subtitle}</p>
                <ul className="space-y-3 mb-10 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: plan.highlight ? gold : `${dark}40` }} />
                      <span style={{ color: plan.highlight ? `${light}80` : `${dark}70` }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={plan.onClick}
                  disabled={loading === plan.key}
                  className="w-full text-xs py-3 transition-all hover:opacity-90"
                  style={{
                    backgroundColor: plan.highlight ? gold : "transparent",
                    color: plan.highlight ? dark : dark,
                    border: plan.highlight ? "none" : `1px solid ${dark}30`,
                    letterSpacing: "1px",
                    opacity: loading === plan.key ? 0.6 : 1,
                  }}
                >
                  {loading === plan.key ? "..." : plan.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CREDIT PACKS */}
      <section className="py-20 px-4" style={{ backgroundColor: dark, color: light }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-block px-4 py-1.5 mb-6 text-[10px]" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "4px" }}>{t("pricing.packs_badge")}</div>
            <h2 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("pricing.packs_title_a")} <span style={{ color: gold, fontStyle: "italic" }}>{t("pricing.packs_title_b")}</span>
            </h2>
            <p className="text-sm" style={{ color: `${light}50`, fontWeight: 300 }}>{t("pricing.packs_subtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-px" style={{ backgroundColor: `${light}0d` }}>
            {packs.map((pack, i) => (
              <motion.div key={pack.key} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="p-8 flex flex-col" style={{ backgroundColor: "#221f1a" }}>
                <pack.icon className="h-5 w-5 mb-4" style={{ color: gold }} />
                <p className="text-[10px] mb-1" style={{ letterSpacing: "3px", color: `${light}40` }}>{pack.name}</p>
                <p className="text-4xl mb-1" style={{ fontFamily: FONT_DISPLAY }}>{pack.price}</p>
                <p className="text-sm mb-1" style={{ color: gold }}>{pack.credits}</p>
                <p className="text-xs mb-8 flex-1" style={{ color: `${light}40`, fontWeight: 300 }}>{pack.desc}</p>
                <button
                  onClick={() => handleCheckout("buy-credits", undefined, pack.key)}
                  disabled={loading === pack.key}
                  className="w-full text-xs py-3 transition-all hover:opacity-90"
                  style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "1px", opacity: loading === pack.key ? 0.6 : 1 }}
                >
                  {loading === pack.key ? "..." : t("pricing.pack_cta")}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4" style={{ backgroundColor: light }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl mb-10 text-center" style={{ fontFamily: FONT_DISPLAY, color: dark }}>{t("pricing.faq_title")}</h2>
          {faqs.map((item, i) => (
            <div key={i} className="py-5" style={{ borderBottom: `1px solid ${dark}10` }}>
              <p className="text-sm font-medium mb-2" style={{ color: dark }}>{item.q}</p>
              <p className="text-sm" style={{ color: `${dark}60`, fontWeight: 300 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-4 text-center" style={{ backgroundColor: dark, color: light }}>
        <h2 className="text-3xl md:text-4xl mb-4" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
          {t("pricing.cta_title_a")} <span style={{ color: gold, fontStyle: "italic" }}>{t("pricing.cta_title_b")}</span>
        </h2>
        <p className="text-sm mb-10" style={{ color: `${light}50`, fontWeight: 300 }}>{t("pricing.cta_subtitle")}</p>
        <Link to="/register" className="inline-flex items-center gap-2 text-xs px-8 py-4 transition-all hover:opacity-90" style={{ backgroundColor: gold, color: dark, letterSpacing: "1px" }}>
          {t("pricing.cta_button")} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="py-6 px-4 text-center" style={{ backgroundColor: dark, borderTop: `1px solid ${light}0d` }}>
        <p className="text-[11px]" style={{ color: `${light}20`, letterSpacing: "2px" }}>{t("pricing.footer")}</p>
      </footer>
    </div>
  );
}
