import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TemplateField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "select";
  options?: string[];
};

type Template = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  fields: TemplateField[];
  buildPrompt: (values: Record<string, string>) => string;
};

type Props = {
  onSend: (prompt: string) => void;
  disabled?: boolean;
};

export function StructuredTemplates({ onSend, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const isPT = i18n.language?.startsWith("pt");

  const templates: Template[] = [
    {
      id: "ugc-influencer",
      emoji: "🎭",
      label: isPT ? "Criar Influencer UGC" : "Create UGC Influencer",
      description: isPT ? "Prompt profissional para gerar imagem de influencer" : "Professional prompt to generate influencer image",
      fields: [
        { key: "niche", label: isPT ? "Nicho" : "Niche", placeholder: isPT ? "ex: fitness, beleza, oração, finanças" : "e.g., fitness, beauty, prayer, finance" },
        { key: "gender", label: isPT ? "Género" : "Gender", type: "select", options: isPT ? ["Homem", "Mulher"] : ["Male", "Female"], placeholder: "" },
        { key: "age", label: isPT ? "Idade aprox." : "Approx. age", placeholder: isPT ? "ex: 30-35 anos" : "e.g., 30-35 years" },
        { key: "style", label: isPT ? "Estilo visual" : "Visual style", placeholder: isPT ? "ex: elegante minimalista, casual urbano" : "e.g., minimalist elegant, urban casual" },
        { key: "setting", label: isPT ? "Cenário" : "Setting", placeholder: isPT ? "ex: escritório em casa, estúdio, café" : "e.g., home office, studio, café" },
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram Reels", "TikTok", "YouTube Shorts", "LinkedIn"], placeholder: "" },
        { key: "tool", label: isPT ? "Ferramenta" : "Tool", type: "select", options: ["Nano Banana", "Midjourney", "DALL-E", "Leonardo AI", "Flux"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um prompt profissional ultra-detalhado para gerar a imagem de um influencer UGC no ${v.tool || "Nano Banana"}.

Detalhes do personagem:
- Nicho: ${v.niche}
- Género: ${v.gender}
- Idade: ${v.age}
- Estilo visual: ${v.style}
- Cenário: ${v.setting}
- Plataforma principal: ${v.platform}

Preciso de:
1. PROMPT PRINCIPAL completo e pronto a colar na ferramenta
2. PROMPT NEGATIVO detalhado e específico
3. VERSÃO CURTA para ferramentas com limite de caracteres
4. BLOCO DE CONSISTÊNCIA do personagem para reutilizar em futuras gerações
5. PARÂMETROS TÉCNICOS (proporção, ângulo, iluminação)
6. 2 VARIAÇÕES com cenários ou moods diferentes (cada uma completa e autónoma)
7. PRÓXIMOS PASSOS: como usar esta imagem como referência para criar vídeo (Veo3, HeyGen, etc.)

O prompt deve ser para estilo UGC — parecer autêntico, gravado com telemóvel, natural e não comercial.`
        : `Create an ultra-detailed professional prompt to generate a UGC influencer image in ${v.tool || "Nano Banana"}.

Character details:
- Niche: ${v.niche}
- Gender: ${v.gender}
- Age: ${v.age}
- Visual style: ${v.style}
- Setting: ${v.setting}
- Main platform: ${v.platform}

I need:
1. MAIN PROMPT complete and ready to paste
2. Detailed NEGATIVE PROMPT
3. SHORT VERSION for character-limited tools
4. CHARACTER CONSISTENCY BLOCK for reuse
5. TECHNICAL PARAMETERS (ratio, angle, lighting)
6. 2 VARIATIONS with different settings/moods (each complete and standalone)
7. NEXT STEPS: how to use this image as reference for video (Veo3, HeyGen, etc.)

The prompt must be UGC style — authentic, smartphone-like, natural, not commercial.`,
    },
    {
      id: "caption-pro",
      emoji: "✍️",
      label: isPT ? "Copy / Legenda Pro" : "Pro Caption / Copy",
      description: isPT ? "Legenda profissional para qualquer plataforma" : "Professional caption for any platform",
      fields: [
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram", "LinkedIn", "TikTok", "Twitter/X", "Facebook"], placeholder: "" },
        { key: "topic", label: isPT ? "Tema / Produto" : "Topic / Product", placeholder: isPT ? "ex: lançamento de curso online" : "e.g., online course launch" },
        { key: "audience", label: isPT ? "Público-alvo" : "Target audience", placeholder: isPT ? "ex: empreendedores 25-40 anos" : "e.g., entrepreneurs 25-40" },
        { key: "tone", label: isPT ? "Tom" : "Tone", type: "select", options: isPT ? ["Profissional", "Casual", "Inspirador", "Urgente", "Humorístico", "Educativo"] : ["Professional", "Casual", "Inspiring", "Urgent", "Humorous", "Educational"], placeholder: "" },
        { key: "goal", label: isPT ? "Objetivo" : "Goal", type: "select", options: isPT ? ["Engagement", "Venda", "Awareness", "Tráfego", "Leads"] : ["Engagement", "Sales", "Awareness", "Traffic", "Leads"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria uma legenda profissional para ${v.platform}.

Tema: ${v.topic}
Público-alvo: ${v.audience}
Tom: ${v.tone}
Objetivo: ${v.goal}

Preciso de:
- 3 variações de HOOK (primeira linha que para o scroll)
- Corpo da legenda formatado nativamente para ${v.platform}
- CTA específico e forte (não genérico)
- 5 hashtags de nicho (se aplicável à plataforma)
- Melhor horário para publicar
- Sugestão de formato complementar (ex: se é copy, sugere o Reels que combina)`
        : `Create a professional caption for ${v.platform}.

Topic: ${v.topic}
Target audience: ${v.audience}
Tone: ${v.tone}
Goal: ${v.goal}

I need:
- 3 HOOK variations (first line that stops the scroll)
- Caption body formatted natively for ${v.platform}
- Specific, strong CTA (not generic)
- 5 niche hashtags (if applicable)
- Best posting time
- Complementary format suggestion (e.g., matching Reels idea)`,
    },
    {
      id: "video-script",
      emoji: "🎬",
      label: isPT ? "Script de Vídeo / Reels" : "Video / Reels Script",
      description: isPT ? "Roteiro cena a cena pronto para gravar" : "Scene-by-scene script ready to record",
      fields: [
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram Reels", "TikTok", "YouTube Shorts", "YouTube"], placeholder: "" },
        { key: "duration", label: isPT ? "Duração" : "Duration", type: "select", options: ["15s", "30s", "60s", "3-5min", "10min+"], placeholder: "" },
        { key: "topic", label: isPT ? "Tema" : "Topic", placeholder: isPT ? "ex: 5 dicas de produtividade" : "e.g., 5 productivity tips" },
        { key: "style", label: isPT ? "Estilo" : "Style", type: "select", options: isPT ? ["UGC / Talking head", "Tutorial", "Storytelling", "Tendência / Trend", "Antes e Depois", "Review"] : ["UGC / Talking head", "Tutorial", "Storytelling", "Trend", "Before & After", "Review"], placeholder: "" },
        { key: "audience", label: isPT ? "Público-alvo" : "Target audience", placeholder: isPT ? "ex: mulheres 20-35 interessadas em skincare" : "e.g., women 20-35 interested in skincare" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um roteiro completo para ${v.platform} de ${v.duration}.

Tema: ${v.topic}
Estilo: ${v.style}
Público: ${v.audience}

Formato cena a cena:
Para cada cena inclui:
- VISUAL: o que aparece no ecrã
- ÁUDIO: texto da voz off / fala
- TEXTO NA TELA: overlays e legendas
- DURAÇÃO: tempo de cada cena
- TRANSIÇÃO: como passa para a cena seguinte

Regras:
- Hook nos primeiros 1-3 segundos (obrigatório)
- CTA nos últimos 3 segundos
- Direção de som/música
- Se for UGC, incluir notas de autenticidade (enquadramento smartphone, luz natural)`
        : `Create a complete script for ${v.platform}, ${v.duration} long.

Topic: ${v.topic}
Style: ${v.style}
Audience: ${v.audience}

Scene-by-scene format:
For each scene include:
- VISUAL: what appears on screen
- AUDIO: voiceover / speech text
- TEXT ON SCREEN: overlays and captions
- DURATION: time per scene
- TRANSITION: how to move to next scene

Rules:
- Hook in first 1-3 seconds (mandatory)
- CTA in last 3 seconds
- Sound/music direction
- If UGC, include authenticity notes (smartphone framing, natural light)`,
    },
    {
      id: "content-calendar",
      emoji: "📅",
      label: isPT ? "Calendário de Conteúdo" : "Content Calendar",
      description: isPT ? "Plano semanal ou mensal completo" : "Complete weekly or monthly plan",
      fields: [
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["Instagram", "TikTok", "LinkedIn", "Multi-plataforma"], placeholder: "" },
        { key: "niche", label: isPT ? "Nicho" : "Niche", placeholder: isPT ? "ex: marketing digital, fitness, moda" : "e.g., digital marketing, fitness, fashion" },
        { key: "period", label: isPT ? "Período" : "Period", type: "select", options: isPT ? ["1 semana (seg-sex)", "2 semanas", "1 mês"] : ["1 week (Mon-Fri)", "2 weeks", "1 month"], placeholder: "" },
        { key: "goal", label: isPT ? "Objetivo principal" : "Main goal", type: "select", options: isPT ? ["Crescer seguidores", "Gerar vendas", "Aumentar engagement", "Lançamento de produto"] : ["Grow followers", "Drive sales", "Boost engagement", "Product launch"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um calendário de conteúdo para ${v.platform} no nicho de ${v.niche}.

Período: ${v.period}
Objetivo principal: ${v.goal}

Para cada dia inclui:
- Formato (Reels, carrossel, post, Stories, Live)
- Tema específico
- Hook (primeira linha / primeiros 3 segundos)
- Objetivo do post (awareness, engagement, conversão)
- Melhor horário para publicar
- Pilares de conteúdo variados

Mistura tipos de conteúdo para variedade. Inclui pelo menos 40% de Reels/vídeo.`
        : `Create a content calendar for ${v.platform} in the ${v.niche} niche.

Period: ${v.period}
Main goal: ${v.goal}

For each day include:
- Format (Reels, carousel, post, Stories, Live)
- Specific topic
- Hook (first line / first 3 seconds)
- Post goal (awareness, engagement, conversion)
- Best posting time
- Varied content pillars

Mix content types for variety. Include at least 40% Reels/video.`,
    },
    {
      id: "ebook",
      emoji: "📚",
      label: isPT ? "Criar eBook / Lead Magnet" : "Create eBook / Lead Magnet",
      description: isPT ? "Estrutura completa de eBook ou material rico" : "Complete eBook or lead magnet structure",
      fields: [
        { key: "topic", label: isPT ? "Tema" : "Topic", placeholder: isPT ? "ex: Como criar conteúdo que vende" : "e.g., How to create content that sells" },
        { key: "audience", label: isPT ? "Público-alvo" : "Target audience", placeholder: isPT ? "ex: donos de pequenos negócios" : "e.g., small business owners" },
        { key: "pages", label: isPT ? "Nº de páginas" : "Number of pages", type: "select", options: ["5-10", "10-20", "20-30", "30-50"], placeholder: "" },
        { key: "goal", label: isPT ? "Objetivo" : "Goal", type: "select", options: isPT ? ["Captar leads", "Vender produto", "Educar audiência", "Posicionar autoridade"] : ["Capture leads", "Sell product", "Educate audience", "Position authority"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria a estrutura completa de um eBook / Lead Magnet.

Tema: ${v.topic}
Público-alvo: ${v.audience}
Tamanho: ${v.pages} páginas
Objetivo: ${v.goal}

Preciso de:
1. TÍTULO principal + 3 alternativas
2. SUBTÍTULO que complementa
3. ESTRUTURA DE CAPÍTULOS com título e resumo de cada um
4. INTRODUÇÃO escrita (pronta a usar)
5. CONTEÚDO do primeiro capítulo completo (como exemplo)
6. CTA final e página de conversão
7. SUGESTÕES de design (cores, estilo visual, tipo de imagens)
8. COPY para landing page de download
9. SEQUÊNCIA de 3 emails para entregar o eBook e nurturar o lead`
        : `Create the complete structure of an eBook / Lead Magnet.

Topic: ${v.topic}
Target audience: ${v.audience}
Size: ${v.pages} pages
Goal: ${v.goal}

I need:
1. MAIN TITLE + 3 alternatives
2. SUBTITLE
3. CHAPTER STRUCTURE with title and summary for each
4. Written INTRODUCTION (ready to use)
5. First chapter CONTENT complete (as example)
6. Final CTA and conversion page
7. DESIGN SUGGESTIONS (colors, visual style, image types)
8. COPY for download landing page
9. 3-EMAIL SEQUENCE to deliver and nurture the lead`,
    },
    {
      id: "veo3-video",
      emoji: "🎥",
      label: isPT ? "Prompt Vídeo IA (Veo3/Sora)" : "AI Video Prompt (Veo3/Sora)",
      description: isPT ? "Prompt para gerar vídeo com IA" : "Prompt to generate AI video",
      fields: [
        { key: "tool", label: isPT ? "Ferramenta" : "Tool", type: "select", options: ["Veo3", "Sora", "Runway", "Kling", "HeyGen"], placeholder: "" },
        { key: "concept", label: isPT ? "Conceito do vídeo" : "Video concept", placeholder: isPT ? "ex: influencer apresentando produto de skincare" : "e.g., influencer presenting skincare product" },
        { key: "duration", label: isPT ? "Duração" : "Duration", type: "select", options: ["5s", "10s", "15s", "30s"], placeholder: "" },
        { key: "style", label: isPT ? "Estilo" : "Style", type: "select", options: isPT ? ["UGC realista", "Cinematográfico", "Animação", "Produto em destaque", "Lifestyle"] : ["Realistic UGC", "Cinematic", "Animation", "Product showcase", "Lifestyle"], placeholder: "" },
        { key: "aspect", label: isPT ? "Proporção" : "Aspect ratio", type: "select", options: ["9:16 (Reels/TikTok)", "16:9 (YouTube)", "1:1 (Feed)"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um prompt profissional para gerar vídeo no ${v.tool}.

Conceito: ${v.concept}
Duração: ${v.duration}
Estilo: ${v.style}
Proporção: ${v.aspect}

Preciso de:
1. PROMPT PRINCIPAL detalhado com descrição de movimento, câmera, iluminação, ação
2. PROMPT NEGATIVO
3. VERSÃO CURTA
4. 2 VARIAÇÕES com ângulos ou moods diferentes
5. NOTAS DE DIREÇÃO: o que ajustar se o primeiro resultado não ficar perfeito
6. Se for para personagem: BLOCO DE CONSISTÊNCIA para manter aparência entre gerações`
        : `Create a professional prompt to generate video in ${v.tool}.

Concept: ${v.concept}
Duration: ${v.duration}
Style: ${v.style}
Aspect ratio: ${v.aspect}

I need:
1. Detailed MAIN PROMPT with movement, camera, lighting, action description
2. NEGATIVE PROMPT
3. SHORT VERSION
4. 2 VARIATIONS with different angles or moods
5. DIRECTION NOTES: what to adjust if first result isn't perfect
6. If character-based: CONSISTENCY BLOCK to maintain appearance across generations`,
    },
  ];

  const handleSubmitTemplate = () => {
    if (!activeTemplate) return;
    const prompt = activeTemplate.buildPrompt(fieldValues);
    onSend(prompt);
    setActiveTemplate(null);
    setFieldValues({});
  };

  // Template selection view
  if (!activeTemplate) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => { setActiveTemplate(tpl); setFieldValues({}); }}
            disabled={disabled}
            className="flex items-start gap-2.5 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-border transition-all text-left group"
          >
            <span className="text-base mt-0.5">{tpl.emoji}</span>
            <div>
              <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground block leading-snug">
                {tpl.label}
              </span>
              <span className="text-[10px] text-muted-foreground/60 leading-tight block mt-0.5">
                {tpl.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Template form view
  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{activeTemplate.emoji}</span>
          <h3 className="text-sm font-semibold text-foreground">{activeTemplate.label}</h3>
        </div>
        <button
          onClick={() => { setActiveTemplate(null); setFieldValues({}); }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {activeTemplate.fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {field.label}
            </label>
            {field.type === "select" ? (
              <div className="flex flex-wrap gap-1.5">
                {field.options?.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setFieldValues((prev) => ({ ...prev, [field.key]: opt }))}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                      fieldValues[field.key] === opt
                        ? "bg-foreground text-background"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={fieldValues[field.key] || ""}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-colors"
              />
            )}
          </div>
        ))}
      </div>

      <Button
        onClick={handleSubmitTemplate}
        disabled={disabled}
        className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
        size="sm"
      >
        <ChevronRight className="h-4 w-4 mr-1.5" />
        {isPT ? "Gerar conteúdo" : "Generate content"}
      </Button>
    </div>
  );
}
