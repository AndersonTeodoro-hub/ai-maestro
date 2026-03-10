import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
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

// ── Tool data (not translated — brand names) ──
const toolTabs = [
  {
    key: "text",
    tools: [
      { name: "GPT-4o", tag: "Copy · Scripts" },
      { name: "Claude", tag: "Artigos · Estratégia" },
      { name: "Gemini", tag: "Research · SEO" },
      { name: "Llama 3", tag: "Tarefas rápidas" },
    ],
  },
  {
    key: "image",
    tools: [
      { name: "DALL·E 3", tag: "Thumbnails · Posts" },
      { name: "Midjourney", tag: "Branding · Visual" },
      { name: "Stable Diffusion", tag: "Volume · Variações" },
    ],
  },
  {
    key: "video",
    tools: [
      { name: "Runway", tag: "Clips · Efeitos" },
      { name: "Pika", tag: "Reels · Shorts" },
      { name: "Sora", tag: "Cinematic" },
    ],
  },
  {
    key: "audio",
    tools: [
      { name: "ElevenLabs", tag: "Voiceover · Narração" },
      { name: "Suno", tag: "Música · Jingles" },
    ],
  },
];

const routingModels = [
  { name: "GPT-4o", pct: 88, winner: true },
  { name: "Claude", pct: 71, winner: false },
  { name: "Gemini", pct: 64, winner: false },
  { name: "Llama 3", pct: 42, winner: false },
];

export default function Landing() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [activeToolTab, setActiveToolTab] = useState("text");

  // ── Scroll listener for navbar ──
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Optimize demo loop ──
  const [optPhase, setOptPhase] = useState<0 | 1 | 2>(0); // 0=show original, 1=strike, 2=show optimized
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

  // ── Routing demo loop ──
  const [routePhase, setRoutePhase] = useState<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    const run = () => {
      setRoutePhase(0);
      timers.push(setTimeout(() => setRoutePhase(1), 1500));
      timers.push(setTimeout(() => setRoutePhase(2), 3000));
      timers.push(setTimeout(() => setRoutePhase(3), 4500));
      timers.push(setTimeout(run, 10000));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, []);

  const gold = "#c9a96e";

  return (
    <div className="relative" style={{ fontFamily: FONT_BODY }}>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Libre+Franklin:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />

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
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ border: `1.5px solid ${gold}` }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: gold, fontSize: 18 }}>P</span>
            </div>
            <span
              className="text-[#f5f0e8] text-xs font-medium hidden sm:inline"
              style={{ letterSpacing: "4px" }}
            >
              PROMPTOS
            </span>
          </div>

          {/* Center links */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-[#f5f0e8]/40 hover:text-[#f5f0e8] text-xs transition-colors" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.product")}
            </a>
            <a href="#pricing" className="text-[#f5f0e8]/40 hover:text-[#f5f0e8] text-xs transition-colors" style={{ letterSpacing: "2px" }}>
              {t("landing.nav.pricing")}
            </a>
          </div>

          {/* Right */}
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
            {/* Before */}
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

            {/* Arrow */}
            {optPhase >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                <ArrowDown className="h-5 w-5" style={{ color: gold }} />
              </motion.div>
            )}

            {/* After */}
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

          {/* Stats */}
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

      {/* ═══════ 4. ALL YOUR AIs (light) ═══════ */}
      <section className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.tools.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              {t("landing.tools.title_a")}{" "}
              <span style={{ color: gold, fontStyle: "italic" }}>{t("landing.tools.title_b")}</span>
            </h2>
            <p className="text-[#1a1814]/45 text-sm" style={{ fontWeight: 300 }}>{t("landing.tools.subtitle")}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mb-8 justify-center" style={{ borderBottom: "1px solid rgba(26,24,20,0.08)" }}>
            {toolTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveToolTab(tab.key)}
                className="pb-3 text-xs transition-colors relative"
                style={{
                  letterSpacing: "2px",
                  color: activeToolTab === tab.key ? gold : "rgba(26,24,20,0.45)",
                  fontWeight: activeToolTab === tab.key ? 500 : 400,
                }}
              >
                {t(`landing.tools.tab_${tab.key}`)}
                {activeToolTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ backgroundColor: gold }} />
                )}
              </button>
            ))}
          </div>

          {/* Tool grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: "1px", backgroundColor: "rgba(26,24,20,0.08)" }}>
            {toolTabs
              .find((t) => t.key === activeToolTab)
              ?.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="bg-[#ece5d9] p-6 transition-colors hover:bg-[rgba(201,169,110,0.06)] cursor-default"
                >
                  <p className="text-lg mb-1" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>{tool.name}</p>
                  <p className="text-xs text-[#1a1814]/45" style={{ fontWeight: 300 }}>{tool.tag}</p>
                </div>
              ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════ 5. ROUTING DEMO (dark) ═══════ */}
      <section className="bg-[#1a1814] text-[#f5f0e8] py-24 md:py-32 px-4">
        <motion.div variants={fadeInView} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-6" style={{ border: `1px solid ${gold}`, color: gold, fontSize: 10, letterSpacing: "4px" }}>
              {t("landing.routing.badge")}
            </div>
          </div>

          {/* Demo card */}
          <div className="p-6 md:p-8" style={{ backgroundColor: "#221f1a", border: "1px solid rgba(245,240,232,0.07)" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px]" style={{ letterSpacing: "3px", color: gold }}>{t("landing.routing.header")}</span>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: gold, opacity: 0.4 }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: gold, opacity: 0.25 }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: gold, opacity: 0.15 }} />
              </div>
            </div>

            {/* Prompt */}
            <p className="text-sm leading-relaxed mb-6" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>
              {t("landing.routing.prompt")}
            </p>

            {/* Tags */}
            {routePhase >= 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 mb-8">
                {(t("landing.routing.tags", { returnObjects: true }) as string[]).map((tag: string) => (
                  <span key={tag} className="text-[10px] px-3 py-1" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "2px" }}>
                    {tag}
                  </span>
                ))}
              </motion.div>
            )}

            {/* Bars */}
            {routePhase >= 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 mb-8">
                {routingModels.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-xs text-[#f5f0e8]/40 w-16 text-right">{m.name}</span>
                    <div className="flex-1 h-[3px] bg-[#f5f0e8]/[0.05] overflow-hidden">
                      <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: `${m.pct}%` }}
                        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                        style={{ height: "100%", backgroundColor: m.winner ? gold : "rgba(245,240,232,0.15)" }}
                      />
                    </div>
                    <span className="text-xs text-[#f5f0e8]/40 w-8">{m.pct}%</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Result */}
            {routePhase >= 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-6" style={{ borderTop: "1px solid rgba(245,240,232,0.07)" }}>
                <p className="text-2xl mb-1" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic", color: gold }}>GPT-4o</p>
                <p className="text-xs text-[#f5f0e8]/40 mb-3" style={{ fontWeight: 300 }}>{t("landing.routing.result_desc")}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm text-[#f5f0e8]">{t("landing.routing.result_cost")}</span>
                  <span className="text-xs text-[#f5f0e8]/30">{t("landing.routing.result_vs")}</span>
                  <span className="text-[10px] px-3 py-1" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "1px" }}>
                    {t("landing.routing.result_saved")}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Gold divider */}
      <div className="bg-[#1a1814] flex justify-center pb-0"><div style={{ width: 40, height: 1, backgroundColor: gold }} /></div>

      {/* ═══════ 6. FOR WHO (light) ═══════ */}
      <section className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
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

          <div className="grid md:grid-cols-3" style={{ gap: "1px", backgroundColor: "rgba(26,24,20,0.08)" }}>
            {[
              { marker: "◆", key: "card1" },
              { marker: "◇", key: "card2" },
              { marker: "○", key: "card3" },
            ].map((c) => (
              <div key={c.key} className="bg-[#ece5d9] p-8">
                <span className="text-lg mb-4 block" style={{ color: gold }}>{c.marker}</span>
                <h3 className="text-xl mb-3" style={{ fontFamily: FONT_DISPLAY, fontStyle: "italic" }}>
                  {t(`landing.why.${c.key}_title`)}
                </h3>
                <p className="text-sm text-[#1a1814]/45 leading-relaxed" style={{ fontWeight: 300 }}>
                  {t(`landing.why.${c.key}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════ 7. FEATURES (dark) ═══════ */}
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

      {/* ═══════ 8. PRICING (light) ═══════ */}
      <section id="pricing" className="bg-[#f5f0e8] text-[#1a1814] py-24 md:py-32 px-4">
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
              <p className="text-5xl mb-6" style={{ fontFamily: FONT_DISPLAY }}>€0<span className="text-lg text-[#1a1814]/40">/{t("landing.pricing.month")}</span></p>
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
              <p className="text-5xl mb-6" style={{ fontFamily: FONT_DISPLAY }}>€12<span className="text-lg text-[#1a1814]/40">/{t("landing.pricing.month")}</span></p>
              <ul className="space-y-3 mb-8">
                {(t("landing.pricing.pro_features", { returnObjects: true }) as string[]).map((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#1a1814]/80">
                    <Check className="h-3.5 w-3.5" style={{ color: gold }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="block text-center text-xs py-3 transition-all"
                style={{ backgroundColor: gold, color: "#1a1814", letterSpacing: "1px" }}
              >
                {t("landing.pricing.pro_cta")}
              </Link>
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
