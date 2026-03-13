import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Check, ArrowDown } from "lucide-react";

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
  const [scrolled, setScrolled] = useState(false);

  // ── Scroll listener for navbar ──
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Optimize demo loop ──
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

      {/* ═══════ 1. NAVBAR ═══════ */}
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
            <span
              className="text-xs font-medium hidden sm:inline"
              style={{ letterSpacing: "0.15em", color: "#F0F6FF" }}
            >
              SAVVYOWL
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-[#f5f0e8]/40 hover:text-[#f5f0e8] text-xs transition-colors" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.product")}
            </a>
            <a href="#pricing" className="text-[#f5f0e8]/40 hover:text-[#f5f0e8] text-xs transition-colors" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.pricing")}
            </a>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeToggle />
            <Link to="/login" className="text-[#f5f0e8]/60 hover:text-[#f5f0e8] text-xs px-3 py-2 transition-colors">
              {t("landing.nav.login")}
            </Link>
            <Link
              to="/register"
              className="text-xs px-4 py-2 transition-all hover:scale-[1.02]"
              style={{
                border: `1px solid ${gold}`,
                color: gold,
                letterSpacing: "1px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = gold;
                e.currentTarget.style.color = "#1a1814";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = gold;
              }}
            >
              {t("landing.nav.cta")}
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════ 2. HERO (dark) ═══════ */}
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
            style={{ fontFamily: FONT_DISPLAY, maxWidth: 680, margin: "0 auto", letterSpacing: "-0.02em" }}
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

          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <Link
              to="/register"
              className="inline-block text-xs px-6 py-3 transition-all hover:scale-[1.03]"
              style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "1px" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = gold; e.currentTarget.style.color = "#1a1814"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = gold; }}
            >
              {t("landing.hero.cta")}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════ 3. OPTIMIZE DEMO (dark) ═══════ */}
      <section className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
            {t("landing.optimize.badge")}
          </div>
          <h2 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
            {t("landing.optimize.title_a")}{" "}
            <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.optimize.title_b")}</span>
          </h2>
          <p className="text-[#f5f0e8]/40 text-sm mb-12" style={{ fontWeight: 300 }}>{t("landing.optimize.subtitle")}</p>

          {/* Demo */}
          <div className="text-left space-y-6">
            <div
              className="p-6 transition-all duration-700"
              style={{
                border: "1px solid rgba(245,240,232,0.07)",
                backgroundColor: "#221f1a",
                opacity: optPhase >= 1 ? 0.35 : 1,
                textDecoration: optPhase >= 1 ? "line-through" : "none",
              }}
            >
              <p className="text-sm leading-relaxed" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>
                {t("landing.optimize.prompt_before")}
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
                style={{ border: `1px solid ${gold}`, backgroundColor: "#221f1a" }}
              >
                <p className="text-sm leading-relaxed" style={{ fontFamily: FONT_BODY, fontWeight: 400 }}>
                  {t("landing.optimize.prompt_after")}
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
              style={{ gap: "1px", backgroundColor: "rgba(245,240,232,0.07)" }}
            >
              {[
                { label: t("landing.optimize.stat1_label"), value: t("landing.optimize.stat1_value"), accent: false },
                { label: t("landing.optimize.stat2_label"), value: t("landing.optimize.stat2_value"), accent: false },
                { label: t("landing.optimize.stat3_label"), value: t("landing.optimize.stat3_value"), accent: true },
                { label: t("landing.optimize.stat4_label"), value: t("landing.optimize.stat4_value"), accent: true },
              ].map((s) => (
                <div key={s.label} className="bg-[#221f1a] p-4 text-center">
                  <p className="text-[10px] text-[#f5f0e8]/40 mb-1" style={{ letterSpacing: "2px" }}>{s.label}</p>
                  <p className="text-lg" style={{ fontFamily: FONT_DISPLAY, color: s.accent ? gold : "#f5f0e8" }}>{s.value}</p>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Gold divider */}
      <div className="bg-[#1a1814] flex justify-center pb-0"><div style={{ width: 40, height: 1, backgroundColor: gold }} /></div>

      {/* ═══════ 4. HOW IT WORKS (light) ═══════ */}
      <section className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
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

          <div className="grid md:grid-cols-3" style={{ gap: "1px", backgroundColor: "rgba(26,24,20,0.08)" }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-[#ece5d9] p-8">
                <span className="text-3xl mb-4 block" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: gold }}>
                  0{n}
                </span>
                <h3 className="text-xl mb-3" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>
                  {t(`landing.howItWorks.step${n}_title`)}
                </h3>
                <p className="text-sm text-[#1a1814]/45 leading-relaxed" style={{ fontWeight: 300 }}>
                  {t(`landing.howItWorks.step${n}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════ 5. WHY SAVVYOWL (dark) ═══════ */}
      <section className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.why.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("landing.why.title_a")}{" "}
              <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.why.title_b")}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: "1px", backgroundColor: "rgba(245,240,232,0.07)" }}>
            {[
              { marker: "◆", key: "card1" },
              { marker: "◇", key: "card2" },
              { marker: "○", key: "card3" },
            ].map((c) => (
              <div key={c.key} className="bg-[#221f1a] p-8">
                <span className="text-lg mb-4 block" style={{ color: gold }}>{c.marker}</span>
                <h3 className="text-xl mb-3" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: "#f5f0e8" }}>
                  {t(`landing.why.${c.key}_title`)}
                </h3>
                <p className="text-sm text-[#f5f0e8]/45 leading-relaxed" style={{ fontWeight: 300 }}>
                  {t(`landing.why.${c.key}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Gold divider */}
      <div className="bg-[#1a1814] flex justify-center pb-0"><div style={{ width: 40, height: 1, backgroundColor: gold }} /></div>

      {/* ═══════ 6. FEATURES (dark) ═══════ */}
      <section id="features" className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.features.badge")}
            </div>
          </div>

          <div className="space-y-0">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="grid grid-cols-[48px_1fr] md:grid-cols-[64px_1fr] gap-4 py-8" style={{ borderTop: "1px solid rgba(245,240,232,0.07)" }}>
                <span className="text-2xl md:text-3xl" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: gold }}>
                  0{n}
                </span>
                <div>
                  <p className="text-[10px] text-[#f5f0e8]/30 mb-2" style={{ letterSpacing: "3px" }}>
                    {t(`landing.features.f${n}_label`)}
                  </p>
                  <h3 className="text-xl md:text-2xl mb-3" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
                    {t(`landing.features.f${n}_title_a`)}{" "}
                    <span style={{ color: gold, fontStyle: "italic" }}>{t(`landing.features.f${n}_title_b`)}</span>
                  </h3>
                  <p className="text-sm text-[#f5f0e8]/40 leading-relaxed" style={{ fontWeight: 300 }}>
                    {t(`landing.features.f${n}_desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════ 7. MODELS (light) ═══════ */}
      <section className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.models.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("landing.models.title_a")}{" "}
              <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.models.title_b")}</span>
            </h2>
            <p className="text-[#1a1814]/45 text-sm" style={{ fontWeight: 300 }}>{t("landing.models.subtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2" style={{ gap: "1px", backgroundColor: "rgba(26,24,20,0.08)" }}>
            <div className="bg-[#ece5d9] p-8">
              <p className="text-2xl mb-2" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>Gemini Flash</p>
              <p className="text-sm text-[#1a1814]/45 leading-relaxed" style={{ fontWeight: 300 }}>
                {t("landing.models.flash_desc")}
              </p>
            </div>
            <div className="bg-[#ece5d9] p-8">
              <p className="text-2xl mb-2" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>Gemini Pro</p>
              <p className="text-sm text-[#1a1814]/45 leading-relaxed" style={{ fontWeight: 300 }}>
                {t("landing.models.pro_desc")}
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-[#1a1814]/30 mt-6" style={{ letterSpacing: "1px" }}>
            {t("landing.models.coming_soon")}
          </p>
        </motion.div>
      </section>

      {/* ═══════ 8. PRICING (light) ═══════ */}
      <section id="pricing" className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4" style={{ borderTop: "1px solid rgba(26,24,20,0.08)" }}>
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

          <div className="grid md:grid-cols-2" style={{ gap: "1px", backgroundColor: "rgba(26,24,20,0.08)" }}>
            {/* Free */}
            <div className="bg-[#ece5d9] p-8">
              <p className="text-[10px] text-[#1a1814]/40 mb-1" style={{ letterSpacing: "3px" }}>{t("landing.pricing.free_label")}</p>
              <p className="text-5xl mb-6" style={{ fontFamily: FONT_DISPLAY }}>€9<span className="text-lg text-[#1a1814]/40">/{t("landing.pricing.month")}</span></p>
              <ul className="space-y-3 mb-8">
                {(t("landing.pricing.free_features", { returnObjects: true }) as string[]).map((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#1a1814]/60">
                    <Check className="h-3.5 w-3.5 text-[#1a1814]/30" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="block text-center text-xs py-3 transition-all"
                style={{ border: "1px solid #1a1814", color: "#1a1814", letterSpacing: "1px" }}
              >
                {t("landing.pricing.free_cta")}
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-[#ece5d9] p-8 relative" style={{ borderTop: `3px solid ${gold}` }}>
              <span className="absolute top-3 right-4 text-[9px] px-2 py-0.5" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "2px" }}>
                {t("landing.pricing.popular")}
              </span>
              <p className="text-[10px] text-[#1a1814]/40 mb-1" style={{ letterSpacing: "3px" }}>{t("landing.pricing.pro_label")}</p>
              <p className="text-5xl mb-6" style={{ fontFamily: FONT_DISPLAY }}>€19<span className="text-lg text-[#1a1814]/40">/{t("landing.pricing.month")}</span></p>
              <ul className="space-y-3 mb-8">
                {(t("landing.pricing.pro_features", { returnObjects: true }) as string[]).map((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#1a1814]/80">
                    <Check className="h-3.5 w-3.5" style={{ color: gold }} />
                    {f}
                  </li>
                ))}
              </ul>
              <div
                className="block text-center text-xs py-3 cursor-default opacity-60"
                style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "1px" }}
              >
                {t("landing.pricing.pro_cta")}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══════ 9. CTA FINAL (dark) ═══════ */}
      <section className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-12"><div style={{ width: 40, height: 1, backgroundColor: gold }} /></div>
          <h2 className="text-3xl md:text-4xl mb-8" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
            {t("landing.cta_final.title_a")}{" "}
            <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.cta_final.title_b")}</span>
          </h2>
          <Link
            to="/register"
            className="inline-block text-xs px-6 py-3 transition-all hover:scale-[1.03]"
            style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "1px" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = gold; e.currentTarget.style.color = "#1a1814"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = gold; }}
          >
            {t("landing.cta_final.cta")}
          </Link>
        </div>
      </section>

      {/* ═══════ 10. FOOTER (dark) ═══════ */}
      <footer className="bg-[#1a1814] py-8 px-4" style={{ borderTop: "1px solid rgba(245,240,232,0.07)" }}>
        <p className="text-center text-[#f5f0e8]/[0.12] text-[11px]" style={{ letterSpacing: "2px" }}>
          {t("landing.footer.text")}
        </p>
      </footer>
    </div>
  );
}
