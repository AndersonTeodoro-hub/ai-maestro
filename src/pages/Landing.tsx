import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Check, ArrowDown, Menu as MenuIcon, X, ArrowRight, Clock, Sparkles, DollarSign, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const FONT_BODY = "'Libre Franklin', sans-serif";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const fadeInView = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function Landing() {
  const { t } = useTranslation();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [proLoading, setProLoading] = useState(false);

  const handleProClick = async () => {
    if (!user || !session) {
      navigate("/register?plan=starter");
      return;
    }
    setProLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { action: "create-checkout", plan: "starter" },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Error creating checkout session");
    } finally {
      setProLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Demo animation
  const [optPhase, setOptPhase] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    const run = () => {
      setOptPhase(0);
      timers.push(setTimeout(() => setOptPhase(1), 3000));
      timers.push(setTimeout(() => setOptPhase(2), 4000));
      timers.push(setTimeout(run, 9000));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, []);

  const gold = "#c9a96e";

  return (
    <div className="relative" style={{ fontFamily: FONT_BODY }}>
      {/* Grain overlay */}
      <div className="pointer-events-none fixed inset-0 z-[100] opacity-[0.02]">
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* ═══════ NAVBAR ═══════ */}
      <nav
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "rgba(26,24,20,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(245,240,232,0.07)" : "1px solid transparent",
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-4 md:px-8">
          <div className="flex items-center">
            <img src="/logo.svg" alt="SavvyOwl" className="h-[44px] w-auto" style={{ marginRight: "8px" }} />
            <span className="text-xs font-medium hidden sm:inline" style={{ letterSpacing: "0.15em", color: "#F0F6FF" }}>
              SAVVYOWL
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <a href="#how" className="text-[#f5f0e8]/40 hover:text-[#f5f0e8] text-xs transition-colors" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.product")}
            </a>
            <a href="#pricing" className="text-[#f5f0e8]/40 hover:text-[#f5f0e8] text-xs transition-colors" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.pricing")}
            </a>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <LanguageSelector />
              <ThemeToggle />
            </div>
            <Link to="/login" className="text-[#f5f0e8]/60 hover:text-[#f5f0e8] text-xs px-3 py-2 transition-colors hidden md:inline">
              {t("landing.nav.login")}
            </Link>
            <Link
              to="/register"
              className="text-xs px-4 py-2 transition-all hover:scale-[1.02] hidden md:inline-block"
              style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "1px" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = gold; e.currentTarget.style.color = "#1a1814"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = gold; }}
            >
              {t("landing.nav.cta")}
            </Link>
            <button
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-[#f5f0e8]/60"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#1a1814]/95 backdrop-blur-xl border-t border-[#f5f0e8]/10 px-4 py-6 space-y-4">
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="block text-[#f5f0e8]/60 text-sm py-2 min-h-[44px] flex items-center" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.product")}
            </a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-[#f5f0e8]/60 text-sm py-2 min-h-[44px] flex items-center" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.pricing")}
            </a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block text-[#f5f0e8]/60 text-sm py-2 min-h-[44px] flex items-center">
              {t("landing.nav.login")}
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-center text-xs px-4 py-3 min-h-[44px]"
              style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "1px" }}
            >
              {t("landing.nav.cta")}
            </Link>
            <div className="flex items-center gap-2 pt-2">
              <LanguageSelector />
              <ThemeToggle />
            </div>
          </div>
        )}
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="min-h-screen flex items-center justify-center bg-[#1a1814] text-[#f5f0e8] pt-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible"
            className="inline-block px-4 py-1.5 mb-10"
            style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}
          >
            {t("landing.hero.badge")}
          </motion.div>

          <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-6"
            style={{ fontFamily: FONT_DISPLAY, maxWidth: 720, margin: "0 auto", letterSpacing: "-0.02em" }}
          >
            {t("landing.hero.h1a")}
            <br />
            <span style={{ color: gold, fontStyle: "italic", fontWeight: 500 }}>
              {t("landing.hero.h1b")}
            </span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="text-sm sm:text-base text-[#f5f0e8]/40 leading-relaxed mb-10 mx-auto"
            style={{ fontWeight: 300, maxWidth: 520 }}
          >
            {t("landing.hero.subtitle")}
          </motion.p>

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 text-xs px-6 py-3 transition-all hover:scale-[1.03]"
              style={{ backgroundColor: gold, color: "#1a1814", letterSpacing: "1px" }}
            >
              {t("landing.hero.cta")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <a
              href="#how"
              className="inline-block text-xs px-6 py-3 text-[#f5f0e8]/40 hover:text-[#f5f0e8] transition-colors"
              style={{ letterSpacing: "1px" }}
            >
              {t("landing.hero.ctaSecondary")}
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.p custom={4} variants={fadeUp} initial="hidden" animate="visible"
            className="mt-12 text-[11px] text-[#f5f0e8]/20" style={{ letterSpacing: "2px" }}
          >
            {t("landing.hero.socialProof")}
          </motion.p>
        </div>
      </section>

      {/* ═══════ PAIN POINTS ═══════ */}
      <section className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-14">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.pain.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("landing.pain.title_a")}{" "}
              <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.pain.title_b")}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: "1px", backgroundColor: "rgba(245,240,232,0.07)" }}>
            {[
              { icon: Clock, key: "pain1" },
              { icon: Sparkles, key: "pain2" },
              { icon: DollarSign, key: "pain3" },
            ].map((c) => (
              <div key={c.key} className="bg-[#221f1a] p-8">
                <c.icon className="h-5 w-5 mb-4" style={{ color: gold }} />
                <h3 className="text-lg mb-3" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: "#f5f0e8" }}>
                  {t(`landing.pain.${c.key}_title`)}
                </h3>
                <p className="text-sm text-[#f5f0e8]/40 leading-relaxed" style={{ fontWeight: 300 }}>
                  {t(`landing.pain.${c.key}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Gold divider */}
      <div className="bg-[#1a1814] flex justify-center pb-0"><div style={{ width: 40, height: 1, backgroundColor: gold }} /></div>

      {/* ═══════ DEMO ═══════ */}
      <section className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
            {t("landing.demo.badge")}
          </div>
          <h2 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
            {t("landing.demo.title_a")}{" "}
            <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.demo.title_b")}</span>
          </h2>
          <p className="text-[#1a1814]/45 text-sm mb-12" style={{ fontWeight: 300 }}>{t("landing.demo.subtitle")}</p>

          <div className="text-left space-y-6">
            <div
              className="p-6 transition-all duration-700"
              style={{
                border: "1px solid rgba(26,24,20,0.1)",
                backgroundColor: "#ece5d9",
                opacity: optPhase >= 1 ? 0.35 : 1,
                textDecoration: optPhase >= 1 ? "line-through" : "none",
              }}
            >
              <p className="text-[10px] uppercase mb-2 text-[#1a1814]/30" style={{ letterSpacing: "3px" }}>
                {t("landing.demo.youWrote")}
              </p>
              <p className="text-sm leading-relaxed" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>
                {t("landing.demo.before_text")}
              </p>
            </div>

            {optPhase >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                <ArrowDown className="h-5 w-5" style={{ color: gold }} />
              </motion.div>
            )}

            {optPhase >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="p-6"
                style={{ border: `1px solid ${gold}`, backgroundColor: "#ece5d9" }}
              >
                <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: "3px", color: gold }}>
                  {t("landing.demo.savvySent")}
                </p>
                <p className="text-sm leading-relaxed" style={{ fontFamily: FONT_BODY, fontWeight: 400 }}>
                  {t("landing.demo.after_text")}
                </p>
              </motion.div>
            )}
          </div>

          {optPhase >= 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-4 mt-8"
              style={{ gap: "1px", backgroundColor: "rgba(26,24,20,0.08)" }}
            >
              {[
                { label: t("landing.demo.stat1_label"), value: t("landing.demo.stat1_value"), accent: false },
                { label: t("landing.demo.stat2_label"), value: t("landing.demo.stat2_value"), accent: false },
                { label: t("landing.demo.stat3_label"), value: t("landing.demo.stat3_value"), accent: true },
                { label: t("landing.demo.stat4_label"), value: t("landing.demo.stat4_value"), accent: true },
              ].map((s) => (
                <div key={s.label} className="bg-[#ece5d9] p-4 text-center">
                  <p className="text-[10px] text-[#1a1814]/35 mb-1" style={{ letterSpacing: "2px" }}>{s.label}</p>
                  <p className="text-lg" style={{ fontFamily: FONT_DISPLAY, color: s.accent ? gold : "#1a1814" }}>{s.value}</p>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how" className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.howItWorks.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("landing.howItWorks.title_a")}{" "}
              <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.howItWorks.title_b")}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: "1px", backgroundColor: "rgba(245,240,232,0.07)" }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-[#221f1a] p-8">
                <span className="text-3xl mb-4 block" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: gold }}>
                  0{n}
                </span>
                <h3 className="text-xl mb-3" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>
                  {t(`landing.howItWorks.step${n}_title`)}
                </h3>
                <p className="text-sm text-[#f5f0e8]/45 leading-relaxed" style={{ fontWeight: 300 }}>
                  {t(`landing.howItWorks.step${n}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Gold divider */}
      <div className="bg-[#1a1814] flex justify-center pb-0"><div style={{ width: 40, height: 1, backgroundColor: gold }} /></div>

      {/* ═══════ BENEFITS ═══════ */}
      <section id="features" className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.benefits.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("landing.benefits.title_a")}{" "}
              <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.benefits.title_b")}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: "1px", backgroundColor: "rgba(26,24,20,0.08)" }}>
            {[
              { marker: "◆", key: "card1" },
              { marker: "◇", key: "card2" },
              { marker: "○", key: "card3" },
            ].map((c) => (
              <div key={c.key} className="bg-[#ece5d9] p-8">
                <span className="text-lg mb-4 block" style={{ color: gold }}>{c.marker}</span>
                <h3 className="text-xl mb-3" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: "#1a1814" }}>
                  {t(`landing.benefits.${c.key}_title`)}
                </h3>
                <p className="text-sm text-[#1a1814]/45 leading-relaxed" style={{ fontWeight: 300 }}>
                  {t(`landing.benefits.${c.key}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.pricing.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("landing.pricing.title_a")}{" "}
              <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.pricing.title_b")}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2" style={{ gap: "1px", backgroundColor: "rgba(245,240,232,0.07)" }}>
            {/* Essential */}
            <div className="bg-[#221f1a] p-8">
              <p className="text-[10px] text-[#f5f0e8]/30 mb-1" style={{ letterSpacing: "3px" }}>{t("landing.pricing.free_label")}</p>
              <p className="text-5xl mb-2" style={{ fontFamily: FONT_DISPLAY }}>
                {t("landing.pricing.free_price")}
              </p>
              <p className="text-sm text-[#f5f0e8]/30 mb-6" style={{ fontWeight: 300 }}>{t("landing.pricing.free_subtitle")}</p>
              <ul className="space-y-3 mb-8">
                {(t("landing.pricing.free_features", { returnObjects: true }) as string[]).map((f: string) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#f5f0e8]/50">
                    <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#f5f0e8]/20" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="block text-center text-xs py-3 transition-all"
                style={{ border: "1px solid rgba(245,240,232,0.2)", color: "#f5f0e8", letterSpacing: "1px" }}
              >
                {t("landing.pricing.free_cta")}
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-[#221f1a] p-8 relative" style={{ borderTop: `3px solid ${gold}` }}>
              <span className="absolute top-3 right-4 text-[9px] px-2 py-0.5" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "2px" }}>
                {t("landing.pricing.popular")}
              </span>
              <p className="text-[10px] text-[#f5f0e8]/30 mb-1" style={{ letterSpacing: "3px" }}>{t("landing.pricing.pro_label")}</p>
              <p className="text-5xl mb-2" style={{ fontFamily: FONT_DISPLAY }}>
                €9<span className="text-lg text-[#f5f0e8]/30">/{t("landing.pricing.month")}</span>
              </p>
              <p className="text-sm text-[#f5f0e8]/30 mb-6" style={{ fontWeight: 300 }}>{t("landing.pricing.pro_subtitle")}</p>
              <ul className="space-y-3 mb-8">
                {(t("landing.pricing.pro_features", { returnObjects: true }) as string[]).map((f: string) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#f5f0e8]/70">
                    <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: gold }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleProClick}
                disabled={proLoading}
                className="block w-full text-center text-xs py-3 transition-all hover:scale-[1.02] cursor-pointer"
                style={{ backgroundColor: gold, color: "#1a1814", letterSpacing: "1px", opacity: proLoading ? 0.6 : 1 }}
              >
                {proLoading ? "..." : t("landing.pricing.pro_cta")}
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════ CTA FINAL ═══════ */}
      <section className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-12"><div style={{ width: 40, height: 1, backgroundColor: gold }} /></div>
          <h2 className="text-3xl md:text-4xl mb-4" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
            {t("landing.cta_final.title_a")}{" "}
            <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.cta_final.title_b")}</span>
          </h2>
          <p className="text-[#1a1814]/40 text-sm mb-10" style={{ fontWeight: 300 }}>
            {t("landing.cta_final.subtitle")}
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 text-xs px-6 py-3 transition-all hover:scale-[1.03]"
            style={{ backgroundColor: gold, color: "#1a1814", letterSpacing: "1px" }}
          >
            {t("landing.cta_final.cta")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-[#1a1814] py-8 px-4" style={{ borderTop: "1px solid rgba(245,240,232,0.07)" }}>
        <p className="text-center text-[#f5f0e8]/[0.12] text-[11px]" style={{ letterSpacing: "2px" }}>
          {t("landing.footer.text")}
        </p>
      </footer>
    </div>
  );
}
