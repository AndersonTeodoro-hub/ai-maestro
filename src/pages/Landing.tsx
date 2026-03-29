import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Check, ChevronDown, Play, Zap, Users, Video, Image, Sparkles, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#080808",
  surface: "#111111",
  surfaceHover: "#1a1a1a",
  border: "rgba(255,255,255,0.06)",
  borderGold: "rgba(201,169,110,0.3)",
  gold: "#c9a96e",
  goldLight: "#e8c98a",
  text: "#f0ede8",
  textMuted: "rgba(240,237,232,0.4)",
  textFaint: "rgba(240,237,232,0.18)",
  white: "#ffffff",
};

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ── Components ────────────────────────────────────────────────────────────────

function GoldLine({ className = "" }: { className?: string }) {
  return <div className={className} style={{ width: 40, height: 1, backgroundColor: C.gold, opacity: 0.6 }} />;
}

function Tag({ children }: { children: string }) {
  return (
    <span style={{ fontSize: 10, letterSpacing: "3px", color: C.gold, border: `1px solid ${C.borderGold}`, padding: "4px 12px", display: "inline-block" }}>
      {children}
    </span>
  );
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("savvyowl_referral", ref);
  }, [searchParams]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleCheckout = async (plan: string) => {
    if (!user || !session) { navigate(`/register?plan=${plan}`); return; }
    setLoadingPlan(plan);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: { action: "create-checkout", plan } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No URL");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoadingPlan(null);
    }
  };

  const stats = [
    { value: "Veo 3.1", label: "Motor de vídeo" },
    { value: "Imagen 3", label: "Motor de imagem" },
    { value: "10+", label: "Templates UGC" },
    { value: "100%", label: "Personagem consistente" },
  ];

  const features = [
    {
      icon: Users,
      title: "Character Engine",
      desc: "O teu influencer virtual mantém o mesmo rosto, estilo e energia em cada imagem e vídeo gerado. Zero inconsistências.",
      tag: "EXCLUSIVO",
    },
    {
      icon: Video,
      title: "Vídeo UGC Autêntico",
      desc: "Gera vídeos de 8 segundos com Veo 3.1 que parecem filmados com telemóvel — não parecem feitos por IA.",
      tag: "VEO 3.1",
    },
    {
      icon: Image,
      title: "Imagens Profissionais",
      desc: "Vertex AI Imagen 3 para imagens de produto e lifestyle que vendem. Identity lock automático do teu personagem.",
      tag: "IMAGEN 3",
    },
    {
      icon: Sparkles,
      title: "10 Templates Profissionais",
      desc: "Viral Pipeline, Dark Channel, Scene Generator, UGC Influencer — fluxos completos do prompt ao conteúdo publicado.",
      tag: "TEMPLATES",
    },
    {
      icon: Zap,
      title: "Pipeline Completo",
      desc: "Texto, imagem e vídeo num só lugar. Sem saltar entre apps. Da ideia ao conteúdo em minutos, não horas.",
      tag: "WORKFLOW",
    },
    {
      icon: Play,
      title: "Modela Vídeos Virais",
      desc: "Encontra vídeos virais do YouTube e adapta-os ao teu nicho com prompts prontos — tudo automaticamente.",
      tag: "VIRAL",
    },
  ];

  const plans = [
    {
      key: "free",
      name: "Gratuito",
      price: "€0",
      period: "",
      sub: "Para começar",
      features: ["10 créditos", "Até 10 imagens", "Todos os templates", "Character Engine"],
      cta: "Começar Grátis",
      primary: false,
      action: () => navigate("/register"),
    },
    {
      key: "starter",
      name: "Starter",
      price: "€14,99",
      period: "/mês",
      sub: "Para criadores individuais",
      features: ["150 créditos/mês", "150 imagens ou 15 vídeos", "Character Engine ilimitado", "Vídeo UGC com Veo 3.1", "Suporte prioritário"],
      cta: "Começar Agora",
      primary: true,
      action: () => handleCheckout("starter"),
    },
    {
      key: "pro",
      name: "Pro",
      price: "€34,99",
      period: "/mês",
      sub: "Para equipas profissionais",
      features: ["500 créditos/mês", "500 imagens ou 50 vídeos", "Character Engine ilimitado", "Veo 3.1 + acesso antecipado", "Suporte dedicado"],
      cta: "Começar Agora",
      primary: false,
      action: () => handleCheckout("pro"),
    },
  ];

  const faqs = [
    { q: "O que são créditos?", a: "1 crédito = 1 imagem. 10 créditos = 1 vídeo de 8 segundos. Os créditos do plano renovam mensalmente. Packs avulso nunca expiram." },
    { q: "O que é o Character Engine?", a: "É o nosso sistema exclusivo que mantém o teu influencer virtual visualmente consistente em todas as imagens e vídeos. O mesmo rosto, o mesmo estilo, sempre." },
    { q: "Os vídeos parecem feitos por IA?", a: "Não é esse o objetivo. Usamos Veo 3.1 com prompts otimizados para estética UGC — câmara instável, pele com textura, iluminação natural. O resultado parece filmado com telemóvel." },
    { q: "Posso cancelar quando quiser?", a: "Sim. Cancelas a qualquer momento. O acesso continua até ao fim do período já pago." },
    { q: "Precisam de cartão de crédito para o plano gratuito?", a: "Não. Registas com email ou Google e tens acesso imediato a 10 créditos gratuitos." },
    { q: "Qual a diferença entre Starter e Pro?", a: "Volume de créditos (150 vs 500/mês) e nível de suporte. Ambos têm acesso total ao Character Engine, Veo 3.1 e todos os templates." },
  ];

  return (
    <div style={{ backgroundColor: C.bg, color: C.text, fontFamily: "'Libre Franklin', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Libre+Franklin:wght@300;400;500&display=swap');
        .display { font-family: 'Cormorant Garamond', Georgia, serif; }
        ::selection { background: rgba(201,169,110,0.25); }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <motion.nav
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          borderBottom: `1px solid ${scrolled ? C.border : "transparent"}`,
          backgroundColor: scrolled ? "rgba(8,8,8,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(24px)" : "none",
          transition: "all 0.4s ease",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/logo.svg" alt="SavvyOwl" style={{ height: 36 }} />
            <span style={{ fontSize: 11, letterSpacing: "0.2em", color: C.text, fontWeight: 500 }}>SAVVYOWL</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
            {[["#features", "FEATURES"], ["#how", "COMO FUNCIONA"], ["#pricing", "PREÇOS"], ["#faq", "FAQ"]].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 10, letterSpacing: "2px", color: C.textMuted, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = C.text)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
              >{label}</a>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link to="/login" className="hidden md:inline" style={{ fontSize: 11, color: C.textMuted, textDecoration: "none", letterSpacing: "1px", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
            >ENTRAR</Link>
            <Link to="/register" style={{ fontSize: 10, letterSpacing: "2px", padding: "10px 20px", backgroundColor: C.gold, color: C.bg, textDecoration: "none", fontWeight: 500, transition: "opacity 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >COMEÇAR GRÁTIS</Link>
            <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 8 }}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ backgroundColor: "rgba(8,8,8,0.98)", borderTop: `1px solid ${C.border}`, padding: "16px 24px 24px" }}>
              {[["#features", "FEATURES"], ["#how", "COMO FUNCIONA"], ["#pricing", "PREÇOS"], ["#faq", "FAQ"]].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "14px 0", fontSize: 11, letterSpacing: "2px", color: C.textMuted, textDecoration: "none", borderBottom: `1px solid ${C.border}` }}>{label}</a>
              ))}
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "14px 0", fontSize: 11, letterSpacing: "2px", color: C.textMuted, textDecoration: "none" }}>ENTRAR</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {/* Background grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`, backgroundSize: "80px 80px", opacity: 0.4 }} />
        {/* Gradient orb */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: `radial-gradient(ellipse, rgba(201,169,110,0.08) 0%, transparent 70%)`, pointerEvents: "none" }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: "relative", zIndex: 1, textAlign: "center", padding: "120px 24px 60px", maxWidth: 960, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
            <Tag>PLATAFORMA DE CONTEÚDO UGC COM IA</Tag>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.15, ease }}
            className="display"
            style={{ fontSize: "clamp(52px, 10vw, 108px)", lineHeight: 1.0, margin: "32px 0 24px", letterSpacing: "-0.03em", fontWeight: 400 }}
          >
            O teu personagem.<br />
            <span style={{ color: C.gold, fontStyle: "italic" }}>Sempre consistente.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease }}
            style={{ fontSize: 16, color: C.textMuted, maxWidth: 520, margin: "0 auto 48px", lineHeight: 1.7, fontWeight: 300 }}
          >
            Cria imagens e vídeos UGC autênticos com o teu influencer virtual — o mesmo rosto, em cada cena, sem estúdio, sem câmara.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.45, ease }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}
          >
            <Link to="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", backgroundColor: C.gold, color: C.bg, textDecoration: "none", fontSize: 11, letterSpacing: "2px", fontWeight: 500, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.goldLight; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.gold; }}
            >
              CRIAR GRATUITAMENTE <ArrowRight size={14} />
            </Link>
            <a href="#features" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", color: C.textMuted, textDecoration: "none", fontSize: 11, letterSpacing: "2px", border: `1px solid ${C.border}`, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}
            >
              VER COMO FUNCIONA
            </a>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.8 }}
            style={{ marginTop: 48, fontSize: 10, letterSpacing: "3px", color: C.textFaint }}
          >
            USADO POR CRIADORES EM PORTUGAL, BRASIL E ANGOLA
          </motion.p>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}
          style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)" }}
        >
          <ChevronDown size={20} style={{ color: C.textFaint }} />
        </motion.div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, backgroundColor: C.surface }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div style={{ padding: "32px 24px", textAlign: "center", borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
                <p className="display" style={{ fontSize: 36, fontWeight: 400, color: C.gold, letterSpacing: "-0.02em", marginBottom: 4 }}>{s.value}</p>
                <p style={{ fontSize: 10, letterSpacing: "2px", color: C.textMuted }}>{s.label.toUpperCase()}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <Reveal>
            <Tag>O PROBLEMA</Tag>
            <h2 className="display" style={{ fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.1, margin: "24px 0", fontWeight: 400 }}>
              Conteúdo UGC<br />
              <span style={{ color: C.gold, fontStyle: "italic" }}>que não engana ninguém.</span>
            </h2>
            <p style={{ color: C.textMuted, lineHeight: 1.8, fontWeight: 300, fontSize: 15 }}>
              Tens ferramentas de IA. Generates imagens. Mas os teus vídeos parecem feitos por robô, o teu personagem muda de cara em cada cena, e demoras horas a montar tudo.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {[
                { n: "01", title: "Personagem inconsistente", desc: "Cada geração cria um rosto diferente. Os seguidores não se identificam com ninguém." },
                { n: "02", title: "Vídeos com estética IA", desc: "Perfeito demais para parecer real. Plataformas e utilizadores detetam e ignoram." },
                { n: "03", title: "Workflow fragmentado", desc: "Saltas entre 4-5 ferramentas diferentes. Horas gastas, resultado medíocre." },
              ].map(item => (
                <div key={item.n} style={{ backgroundColor: C.surface, padding: "28px 32px", borderLeft: `2px solid ${C.border}` }}>
                  <span style={{ fontSize: 10, color: C.gold, letterSpacing: "2px" }}>{item.n}</span>
                  <p style={{ fontSize: 15, fontWeight: 500, margin: "8px 0 4px", color: C.text }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: C.textMuted, fontWeight: 300 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SOLUTION DIVIDER ────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", padding: "60px 24px", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, backgroundColor: C.surface }}>
        <Reveal>
          <p className="display" style={{ fontSize: "clamp(24px, 4vw, 48px)", fontStyle: "italic", color: C.gold, fontWeight: 400 }}>
            "A solução não é mais ferramentas.<br />É a ferramenta certa."
          </p>
        </Reveal>
      </div>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal>
            <div style={{ marginBottom: 80 }}>
              <Tag>FUNCIONALIDADES</Tag>
              <h2 className="display" style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.1, margin: "24px 0 0", fontWeight: 400 }}>
                Tudo o que precisas.<br />
                <span style={{ color: C.gold, fontStyle: "italic" }}>Num só lugar.</span>
              </h2>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 1 }}>
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div style={{ backgroundColor: C.surface, padding: "40px 36px", borderBottom: `1px solid ${C.border}`, height: "100%", transition: "background 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.surfaceHover)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.surface)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <f.icon size={20} style={{ color: C.gold }} />
                    <span style={{ fontSize: 9, letterSpacing: "2px", color: C.gold, border: `1px solid ${C.borderGold}`, padding: "3px 8px" }}>{f.tag}</span>
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 500, marginBottom: 12, letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="how" style={{ padding: "120px 24px", backgroundColor: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 80 }}>
              <Tag>COMO FUNCIONA</Tag>
              <h2 className="display" style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.1, margin: "24px 0 0", fontWeight: 400 }}>
                Três passos.<br />
                <span style={{ color: C.gold, fontStyle: "italic" }}>Zero fricção.</span>
              </h2>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
            {[
              { n: "01", title: "Cria o teu Personagem", desc: "Define o visual do teu influencer virtual. O Character Engine gera o identity lock — um perfil de consistência visual que bloqueia a aparência em todos os conteúdos." },
              { n: "02", title: "Escolhe um Template", desc: "Seleciona entre 10 templates profissionais: Viral Pipeline, Dark Channel, UGC Scene, Viral Modeling. Preenches os campos e a SavvyOwl constrói o pipeline completo." },
              { n: "03", title: "Gera e Publica", desc: "Imagens com Imagen 3, vídeos com Veo 3.1 — todos com o teu personagem. Descarrega, publica. O ciclo repete-se em minutos, não horas." },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 0.12}>
                <div style={{ padding: "48px 36px" }}>
                  <span className="display" style={{ fontSize: 72, fontWeight: 400, color: C.borderGold, letterSpacing: "-0.04em", lineHeight: 1 }}>{step.n}</span>
                  <h3 style={{ fontSize: 20, fontWeight: 500, margin: "24px 0 12px", letterSpacing: "-0.01em" }}>{step.title}</h3>
                  <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.8, fontWeight: 300 }}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF / QUOTE ────────────────────────────────────────────── */}
      <section style={{ padding: "120px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <Reveal>
            <GoldLine className="mx-auto mb-12" />
            <p className="display" style={{ fontSize: "clamp(28px, 4vw, 52px)", lineHeight: 1.3, fontWeight: 400, fontStyle: "italic", marginBottom: 32 }}>
              "Finalmente uma plataforma que entende que UGC não é sobre perfeição — é sobre <span style={{ color: C.gold }}>autenticidade consistente.</span>"
            </p>
            <p style={{ fontSize: 11, letterSpacing: "3px", color: C.textMuted }}>CRIADORES DE CONTEÚDO EM PORTUGAL, BRASIL E ANGOLA</p>
            <GoldLine className="mx-auto mt-12" />
          </Reveal>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "120px 24px", backgroundColor: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 80 }}>
              <Tag>PREÇOS</Tag>
              <h2 className="display" style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.1, margin: "24px 0 12px", fontWeight: 400 }}>
                Investe no teu<br />
                <span style={{ color: C.gold, fontStyle: "italic" }}>crescimento.</span>
              </h2>
              <p style={{ color: C.textMuted, fontSize: 14, fontWeight: 300 }}>Sem contratos. Cancela quando quiseres. 10 créditos gratuitos para começar.</p>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
            {plans.map((plan, i) => (
              <Reveal key={plan.key} delay={i * 0.1}>
                <div style={{ backgroundColor: plan.primary ? C.bg : C.surfaceHover, padding: "48px 36px", position: "relative", borderTop: plan.primary ? `2px solid ${C.gold}` : `2px solid transparent`, display: "flex", flexDirection: "column", height: "100%" }}>
                  {plan.primary && (
                    <span style={{ position: "absolute", top: -1, right: 24, fontSize: 9, letterSpacing: "2px", backgroundColor: C.gold, color: C.bg, padding: "4px 12px" }}>POPULAR</span>
                  )}
                  <p style={{ fontSize: 10, letterSpacing: "3px", color: C.textMuted, marginBottom: 16 }}>{plan.name.toUpperCase()}</p>
                  <div style={{ marginBottom: 8 }}>
                    <span className="display" style={{ fontSize: 52, fontWeight: 400, letterSpacing: "-0.03em" }}>{plan.price}</span>
                    <span style={{ fontSize: 14, color: C.textMuted }}>{plan.period}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 36, fontWeight: 300 }}>{plan.sub}</p>
                  <ul style={{ listStyle: "none", margin: "0 0 40px", padding: 0, flex: 1 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, fontSize: 13, color: C.textMuted }}>
                        <Check size={13} style={{ color: C.gold, marginTop: 2, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={plan.action} disabled={loadingPlan === plan.key}
                    style={{ width: "100%", padding: "14px", fontSize: 11, letterSpacing: "2px", cursor: "pointer", border: "none", transition: "all 0.2s", backgroundColor: plan.primary ? C.gold : "transparent", color: plan.primary ? C.bg : C.text, border: plan.primary ? "none" : `1px solid ${C.border}`, opacity: loadingPlan === plan.key ? 0.6 : 1 }}
                    onMouseEnter={e => { if (!plan.primary) e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                    onMouseLeave={e => { if (!plan.primary) e.currentTarget.style.borderColor = C.border; }}
                  >
                    {loadingPlan === plan.key ? "..." : plan.cta}
                  </button>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <Link to="/pricing" style={{ fontSize: 11, color: C.textMuted, textDecoration: "none", letterSpacing: "2px", display: "inline-flex", alignItems: "center", gap: 8, transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = C.gold)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
              >
                VER PACKS DE CRÉDITOS AVULSO <ArrowRight size={12} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: "120px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Reveal>
            <div style={{ marginBottom: 64 }}>
              <Tag>FAQ</Tag>
              <h2 className="display" style={{ fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.1, margin: "24px 0 0", fontWeight: 400 }}>
                Tens dúvidas?<br />
                <span style={{ color: C.gold, fontStyle: "italic" }}>Temos respostas.</span>
              </h2>
            </div>
          </Reveal>

          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.04}>
                <div style={{ borderBottom: `1px solid ${C.border}` }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: "100%", background: "none", border: "none", padding: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left", gap: 16 }}
                  >
                    <span style={{ fontSize: 15, color: C.text, fontWeight: 400 }}>{faq.q}</span>
                    <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={16} style={{ color: C.gold, flexShrink: 0 }} />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                        <p style={{ paddingBottom: 24, fontSize: 14, color: C.textMuted, lineHeight: 1.8, fontWeight: 300 }}>{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 24px", textAlign: "center", backgroundColor: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Reveal>
            <GoldLine className="mx-auto mb-16" />
            <h2 className="display" style={{ fontSize: "clamp(40px, 7vw, 88px)", lineHeight: 1.05, fontWeight: 400, marginBottom: 24, letterSpacing: "-0.03em" }}>
              O teu próximo vídeo<br />
              <span style={{ color: C.gold, fontStyle: "italic" }}>começa aqui.</span>
            </h2>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 48, fontWeight: 300 }}>
              10 créditos gratuitos. Sem cartão de crédito. Cancela quando quiseres.
            </p>
            <Link to="/register" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 40px", backgroundColor: C.gold, color: C.bg, textDecoration: "none", fontSize: 11, letterSpacing: "2px", fontWeight: 500, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.goldLight; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.gold; }}
            >
              CRIAR CONTA GRÁTIS <ArrowRight size={14} />
            </Link>
            <GoldLine className="mx-auto mt-16" />
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ padding: "40px 24px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.svg" alt="SavvyOwl" style={{ height: 28 }} />
            <span style={{ fontSize: 10, letterSpacing: "2px", color: C.textFaint }}>SAVVYOWL</span>
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            {[["#features", "Features"], ["#pricing", "Preços"], ["/pricing", "Planos"], ["/login", "Entrar"]].map(([href, label]) => (
              <a key={label} href={href} style={{ fontSize: 10, letterSpacing: "2px", color: C.textFaint, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = C.textMuted)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textFaint)}
              >{label.toUpperCase()}</a>
            ))}
          </div>
          <p style={{ fontSize: 10, letterSpacing: "2px", color: C.textFaint }}>© 2026 SAVVYOWL</p>
        </div>
      </footer>
    </div>
  );
}
