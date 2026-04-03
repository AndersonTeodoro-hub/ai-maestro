import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, ArrowRight, Coins, Zap, Video, Image } from "lucide-react";
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
    if (!user || !session) {
      navigate("/register");
      return;
    }
    setLoading(plan || pack || "");
    try {
      const body = plan
        ? { action: "create-checkout", plan }
        : { action: "buy-credits", pack };
      const { data, error } = await supabase.functions.invoke("stripe-checkout", { body });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro no checkout");
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      key: "free",
      label: "GRATUITO",
      price: "€0",
      subtitle: "Para experimentar sem compromisso",
      features: ["10 créditos gratuitos", "Até 10 imagens", "Todos os templates", "Character Engine (1 personagem)", "Histórico de conversas"],
      cta: "COMEÇAR GRÁTIS",
      onClick: () => navigate("/register"),
      highlight: false,
    },
    {
      key: "starter",
      label: "STARTER",
      price: "€14,99",
      subtitle: "Para criadores individuais",
      features: ["150 créditos/mês", "150 imagens ou 15 vídeos", "Character Engine ilimitado", "Todos os 10 templates", "Vídeo UGC com Veo 3.1", "Suporte prioritário"],
      cta: "COMEÇAR AGORA",
      onClick: () => handleCheckout("create-checkout", "starter"),
      highlight: true,
    },
    {
      key: "pro",
      label: "PRO",
      price: "€34,99",
      subtitle: "Para equipas e criadores profissionais",
      features: ["500 créditos/mês", "500 imagens ou 50 vídeos", "Character Engine ilimitado", "Todos os templates + acesso antecipado", "Vídeo UGC com Veo 3.1 Fast", "Suporte dedicado"],
      cta: "COMEÇAR AGORA",
      onClick: () => handleCheckout("create-checkout", "pro"),
      highlight: false,
    },
  ];

  const packs = [
    { key: "pack_s", name: "Pack S", price: "€4,99", credits: "50 créditos", desc: "50 imagens ou 5 vídeos", icon: Image },
    { key: "pack_m", name: "Pack M", price: "€12,99", credits: "150 créditos", desc: "150 imagens ou 15 vídeos", icon: Zap },
    { key: "pack_l", name: "Pack L", price: "€29,99", credits: "400 créditos", desc: "400 imagens ou 40 vídeos", icon: Video },
  ];

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
            <Link to="/login" className="text-xs" style={{ color: `${light}60`, letterSpacing: "1px" }}>ENTRAR</Link>
            <Link to="/register" className="text-xs px-4 py-2" style={{ backgroundColor: gold, color: dark, letterSpacing: "1px" }}>REGISTAR</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ backgroundColor: dark, color: light }} className="py-20 px-4 text-center">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <div className="inline-block px-4 py-1.5 mb-6 text-[10px]" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "4px" }}>PREÇOS</div>
          <h1 className="text-4xl md:text-6xl mb-4" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
            Investe no teu <span style={{ color: gold, fontStyle: "italic" }}>crescimento.</span>
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: `${light}60`, fontWeight: 300 }}>
            Sem contratos. Cancela quando quiseres. Começa grátis com 10 créditos.
          </p>
        </motion.div>
      </section>

      {/* CREDIT EXPLAINER */}
      <section style={{ backgroundColor: `${dark}f5` }} className="py-8 px-4">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4" style={{ color: gold }} />
            <span className="text-xs" style={{ color: `${light}70`, letterSpacing: "1px" }}>1 CRÉDITO = 1 IMAGEM</span>
          </div>
          <div className="hidden sm:block w-px h-6" style={{ backgroundColor: `${light}15` }} />
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4" style={{ color: gold }} />
            <span className="text-xs" style={{ color: `${light}70`, letterSpacing: "1px" }}>10 CRÉDITOS = 1 VÍDEO 8S</span>
          </div>
          <div className="hidden sm:block w-px h-6" style={{ backgroundColor: `${light}15` }} />
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" style={{ color: gold }} />
            <span className="text-xs" style={{ color: `${light}70`, letterSpacing: "1px" }}>CRÉDITOS RENOVAM MENSALMENTE</span>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="py-20 px-4" style={{ backgroundColor: light }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px" style={{ backgroundColor: `${dark}15` }}>
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
                  <span className="absolute top-4 right-4 text-[9px] px-2 py-0.5" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "2px" }}>POPULAR</span>
                )}
                <p className="text-[10px] mb-1" style={{ letterSpacing: "3px", color: plan.highlight ? `${light}50` : `${dark}50` }}>{plan.label}</p>
                <p className="text-5xl mb-1" style={{ fontFamily: FONT_DISPLAY, color: plan.highlight ? light : dark }}>
                  {plan.price}<span className="text-lg" style={{ color: plan.highlight ? `${light}40` : `${dark}40` }}>/mês</span>
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
            <div className="inline-block px-4 py-1.5 mb-6 text-[10px]" style={{ border: `1px solid ${gold}`, color: gold, letterSpacing: "4px" }}>PACKS AVULSO</div>
            <h2 className="text-3xl md:text-4xl mb-3" style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
              Precisas de mais <span style={{ color: gold, fontStyle: "italic" }}>créditos?</span>
            </h2>
            <p className="text-sm" style={{ color: `${light}50`, fontWeight: 300 }}>Compra créditos sem subscrição. Sem expiração. Acumulam com o teu plano.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-px" style={{ backgroundColor: `${light}0d` }}>
            {packs.map((pack, i) => (
              <motion.div
                key={pack.key}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="p-8 flex flex-col"
                style={{ backgroundColor: "#221f1a" }}
              >
                <pack.icon className="h-5 w-5 mb-4" style={{ color: gold }} />
                <p className="text-[10px] mb-1" style={{ letterSpacing: "3px", color: `${light}40` }}>{pack.name}</p>
                <p className="text-4xl mb-1" style={{ fontFamily: FONT_DISPLAY }}>{pack.price}</p>
                <p className="text-sm mb-1" style={{ color: gold }}>{pack.credits}</p>
                <p className="text-xs mb-8 flex-1" style={{ color: `${light}40`, fontWeight: 300 }}>{pack.desc}</p>
                <button
                  onClick={() => handleCheckout("buy-credits", undefined, pack.key)}
                  disabled={loading === pack.key}
                  className="w-full text-xs py-3 transition-all hover:opacity-90"
                  style={{
                    border: `1px solid ${gold}`,
                    color: gold,
                    letterSpacing: "1px",
                    opacity: loading === pack.key ? 0.6 : 1,
                  }}
                >
                  {loading === pack.key ? "..." : "COMPRAR"}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ PREÇOS */}
      <section className="py-20 px-4" style={{ backgroundColor: light }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl mb-10 text-center" style={{ fontFamily: FONT_DISPLAY, color: dark }}>Perguntas frequentes</h2>
          {[
            { q: "Os créditos expiram?", a: "Os créditos mensais do plano renovam a cada ciclo. Os créditos de packs avulso nunca expiram e acumulam com os do plano." },
            { q: "Posso cancelar quando quiser?", a: "Sim. Cancelas a qualquer momento e continues a ter acesso até ao fim do período pago." },
            { q: "Os packs acumulam com o plano?", a: "Sim. Se tens 50 créditos do plano e compras um Pack S, ficás com 100 créditos no total." },
            { q: "O que acontece se ficar sem créditos?", a: "Podes comprar um pack avulso ou aguardar a renovação mensal. As conversas de texto continuam sem limite." },
          ].map((item, i) => (
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
          Começa hoje. <span style={{ color: gold, fontStyle: "italic" }}>Grátis.</span>
        </h2>
        <p className="text-sm mb-10" style={{ color: `${light}50`, fontWeight: 300 }}>10 créditos gratuitos. Sem cartão de crédito.</p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 text-xs px-8 py-4 transition-all hover:opacity-90"
          style={{ backgroundColor: gold, color: dark, letterSpacing: "1px" }}
        >
          CRIAR CONTA GRÁTIS <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="py-6 px-4 text-center" style={{ backgroundColor: dark, borderTop: `1px solid ${light}0d` }}>
        <p className="text-[11px]" style={{ color: `${light}20`, letterSpacing: "2px" }}>© 2026 SAVVYOWL — TODOS OS DIREITOS RESERVADOS</p>
      </footer>
    </div>
  );
}
