import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, X, Loader2, ExternalLink, Eye, ThumbsUp, Play, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCharacter } from "@/contexts/CharacterContext";

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
  const { identityBlock, negativePrompt, activeCharacterName } = useCharacter();
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [viralVideos, setViralVideos] = useState<any[]>([]);
  const [viralLoading, setViralLoading] = useState(false);
  const [viralStep, setViralStep] = useState<"form" | "videos" | "selected">("form");
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const isPT = i18n.language?.startsWith("pt");

  // When viral video is selected, build and send the prompt
  const handleViralVideoSelect = (vid: any) => {
    try {
      const v = fieldValues;
      const hasChar = !!identityBlock;

      // Bloco de instrução de personagem (se houver)
      const charSection = hasChar ? (isPT
        ? `\n\n## 3. IMAGEM (${v.imageTool})
O personagem já está definido via Identity Lock. USA EXACTAMENTE o identity block abaixo em cada prompt — NÃO inventes descrição nova:

\`\`\`
${identityBlock}

[prompt da cena aqui: enquadramento, pose, iluminação, fundo, expressão]

Negative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime"}
\`\`\`

NOTA: O negative prompt vai DENTRO do mesmo bloco de código, não separado.`
        : `\n\n## 3. IMAGE (${v.imageTool})
Character is already defined via Identity Lock. Use EXACTLY the identity block below in every prompt — do NOT invent a new description:

\`\`\`
${identityBlock}

[scene prompt here: framing, pose, lighting, background, expression]

Negative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime"}
\`\`\`

NOTE: The negative prompt goes INSIDE the same code block, not separate.`)
        : "";

      const prompt = isPT
      ? `${hasChar ? `═══ PERSONAGEM ATIVO — IDENTITY LOCK ═══\n${identityBlock}\n═══ FIM IDENTITY LOCK ═══\n\n` : ""}Modela este vídeo viral para eu recriar com ${v.imageTool} + ${v.videoTool} + CapCut.

VÍDEO: "${vid.title}" | ${vid.channel} | ${formatNumber(vid.views)} views | ${vid.duration} | ${vid.url}
CONTEXTO: ${v.niche} | Público: ${v.audience} ${v.brand ? `| Marca: ${v.brand}` : ""} | Idioma: ${v.videoLang}

ENTREGA EXACTAMENTE NESTA ORDEM E FORMATO:

## 1. ANÁLISE
Máximo 4 linhas. Porque viralizou, técnica, emoção.

## 2. IDEIA DA MODELAGEM
Máximo 4 linhas. Como vou adaptar este vídeo ao meu contexto, qual a mensagem, diferencial.
${hasChar ? charSection : `
## 3. IMAGEM (${v.imageTool})
Descrição do personagem em 2 linhas, depois:

Prompt ${v.imageTool} dentro de bloco de código (entre \`\`\`):
\`\`\`
[prompt completo em inglês aqui]

Negative: [negative prompt aqui]
\`\`\`
`}

## 4. CENAS ${v.videoTool}
Calcula quantas cenas de 8 segundos são necessárias.
Para CADA cena:

**CENA [N] — [título]**

Prompt ${v.videoTool} dentro de bloco de código:
\`\`\`
${hasChar ? "[identity block do personagem] + " : ""}[prompt completo em inglês, com ação, câmera, iluminação, expressão, cenário, diálogo entre aspas no idioma ${v.videoLang}. Maximizar 8 segundos.]${hasChar ? `\n\nNegative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look"}` : ""}
\`\`\`

Texto na tela: [overlay curto, máx 5 palavras]

## 5. MONTAGEM CAPCUT
3 linhas máximo: ordem das cenas, transições, música.

REGRAS ABSOLUTAS:
- Cada prompt OBRIGATORIAMENTE dentro de bloco de código (\`\`\`) para o utilizador poder copiar com um clique
- Prompts de imagem e vídeo SEMPRE em inglês
- Diálogos/falas no idioma: ${v.videoLang}
- ZERO explicações desnecessárias — só o que é preciso para executar
- Cada cena ${v.videoTool} usa o MÁXIMO dos 8 segundos
- Cena 1 = HOOK | Última cena = CTA
${hasChar ? "- CADA prompt (imagem e vídeo) DEVE começar com o identity block COMPLETO do personagem\n- O negative prompt vai DENTRO do bloco de código, NÃO como bloco separado" : ""}`
      : `${hasChar ? `═══ ACTIVE CHARACTER — IDENTITY LOCK ═══\n${identityBlock}\n═══ END IDENTITY LOCK ═══\n\n` : ""}Model this viral video for me to recreate with ${v.imageTool} + ${v.videoTool} + CapCut.

VIDEO: "${vid.title}" | ${vid.channel} | ${formatNumber(vid.views)} views | ${vid.duration} | ${vid.url}
CONTEXT: ${v.niche} | Audience: ${v.audience} ${v.brand ? `| Brand: ${v.brand}` : ""} | Language: ${v.videoLang}

DELIVER EXACTLY IN THIS ORDER AND FORMAT:

## 1. ANALYSIS
Max 4 lines. Why it went viral, technique, emotion.

## 2. MODELING IDEA
Max 4 lines. How to adapt to my context, message, differentiator.
${hasChar ? charSection : `
## 3. IMAGE (${v.imageTool})
Character description in 2 lines, then:

${v.imageTool} prompt inside code block:
\`\`\`
[complete prompt in English]

Negative: [negative prompt]
\`\`\`
`}

## 4. SCENES ${v.videoTool}
Calculate how many 8-second scenes needed.
For EACH scene:

**SCENE [N] — [title]**

${v.videoTool} prompt inside code block:
\`\`\`
${hasChar ? "[character identity block] + " : ""}[complete prompt in English, action, camera, lighting, expression, setting, dialogue in ${v.videoLang}. Maximize 8 seconds.]${hasChar ? `\n\nNegative: ${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look"}` : ""}
\`\`\`

Text on screen: [short overlay, max 5 words]

## 5. CAPCUT ASSEMBLY
3 lines max: scene order, transitions, music.

ABSOLUTE RULES:
- Every prompt MUST be inside a code block
- Image and video prompts ALWAYS in English
- Dialogue/speech in: ${v.videoLang}
- ZERO unnecessary explanations
- Each ${v.videoTool} scene uses MAXIMUM 8 seconds
- Scene 1 = HOOK | Last scene = CTA
${hasChar ? "- EVERY prompt (image and video) MUST start with the FULL character identity block\n- Negative prompt goes INSIDE the code block, NOT as a separate block" : ""}`;

    onSend(prompt);
    resetViralFlow();
    } catch (e) {
      console.error("Error building viral prompt:", e);
      toast.error(isPT ? "Erro ao modelar vídeo. Tenta novamente." : "Error modeling video. Try again.");
      resetViralFlow();
    }
  };

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
        { key: "tool", label: isPT ? "Ferramenta" : "Tool", type: "select", options: ["SavvyOwl"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um prompt profissional ultra-detalhado para gerar a imagem de um influencer UGC no ${v.tool || "SavvyOwl Image"}.

Detalhes do personagem:
- Nicho: ${v.niche}
- Género: ${v.gender}
- Idade: ${v.age}
- Estilo visual: ${v.style}
- Cenário: ${v.setting}
- Plataforma principal: ${v.platform}

Preciso de:
1. PROMPT PRINCIPAL completo e pronto a colar na ferramenta (com negative prompt na última linha do mesmo bloco de código, formato "Negative: ...")
2. VERSÃO CURTA para ferramentas com limite de caracteres
3. PARÂMETROS TÉCNICOS (proporção, ângulo, iluminação)
4. 2 VARIAÇÕES com cenários ou moods diferentes (cada uma completa e autónoma, com negative dentro do mesmo bloco)
5. PRÓXIMOS PASSOS: como usar esta imagem como referência para criar vídeo na SavvyOwl

REGRA: O negative prompt vai SEMPRE como última linha dentro do bloco de código do prompt principal. NUNCA como bloco de código separado.

O prompt deve ser para estilo UGC — parecer autêntico, gravado com telemóvel, natural e não comercial.`
        : `Create an ultra-detailed professional prompt to generate a UGC influencer image in ${v.tool || "SavvyOwl Image"}.

Character details:
- Niche: ${v.niche}
- Gender: ${v.gender}
- Age: ${v.age}
- Visual style: ${v.style}
- Setting: ${v.setting}
- Main platform: ${v.platform}

I need:
1. MAIN PROMPT complete and ready to paste (with negative prompt as last line inside the same code block, format "Negative: ...")
2. SHORT VERSION for character-limited tools
3. TECHNICAL PARAMETERS (ratio, angle, lighting)
4. 2 VARIATIONS with different settings/moods (each complete and standalone, with negative inside same block)
5. NEXT STEPS: how to use this image as reference for video in SavvyOwl

RULE: The negative prompt ALWAYS goes as the last line inside the main prompt code block. NEVER as a separate code block.

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
      id: "ai-video",
      emoji: "🎥",
      label: isPT ? "Prompt Vídeo IA" : "AI Video Prompt",
      description: isPT ? "Prompt para gerar vídeo com IA" : "Prompt to generate AI video",
      fields: [
        { key: "tool", label: isPT ? "Ferramenta" : "Tool", type: "select", options: ["SavvyOwl Video 8s", "SavvyOwl Video 15s"], placeholder: "" },
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
1. PROMPT PRINCIPAL detalhado com descrição de movimento, câmera, iluminação, ação (com negative prompt como última linha dentro do mesmo bloco de código)
2. VERSÃO CURTA
3. 2 VARIAÇÕES com ângulos ou moods diferentes
4. NOTAS DE DIREÇÃO: o que ajustar se o primeiro resultado não ficar perfeito

REGRA: O negative prompt vai SEMPRE dentro do bloco de código do prompt principal (linha "Negative: ..."). NUNCA como bloco separado.`
        : `Create a professional prompt to generate video in ${v.tool}.

Concept: ${v.concept}
Duration: ${v.duration}
Style: ${v.style}
Aspect ratio: ${v.aspect}

I need:
1. Detailed MAIN PROMPT with movement, camera, lighting, action description (with negative prompt as last line inside the same code block)
2. SHORT VERSION
3. 2 VARIATIONS with different angles or moods
4. DIRECTION NOTES: what to adjust if first result isn't perfect

RULE: The negative prompt ALWAYS goes inside the main prompt code block (line "Negative: ..."). NEVER as a separate block.`,
    },
    {
      id: "scene-generator",
      emoji: "🎞️",
      label: isPT ? "Gerador de Cenas (Vídeo Longo)" : "Scene Generator (Long Video)",
      description: isPT ? "Cenas prontas para vídeo IA, CapCut, etc." : "Ready scenes for AI video, CapCut, etc.",
      fields: [
        { key: "tool", label: isPT ? "Ferramenta de vídeo" : "Video tool", type: "select", options: ["SavvyOwl Video 8s", "SavvyOwl Video 15s", "CapCut AI"], placeholder: "" },
        { key: "scenes", label: isPT ? "Nº de cenas" : "Number of scenes", type: "select", options: ["3", "4", "5", "6", "8", "10", "12", "15"], placeholder: "" },
        { key: "maxDuration", label: isPT ? "Duração máx. por cena" : "Max duration per scene", type: "select", options: ["5s", "8s", "10s", "15s", "30s"], placeholder: "" },
        { key: "videoType", label: isPT ? "Tipo de vídeo" : "Video type", type: "select", options: isPT ? ["Influencer UGC", "Vídeo Dark / Narração", "Review de produto", "Tutorial passo a passo", "Storytelling emocional", "Antes e Depois", "Vlog / Day in my life"] : ["UGC Influencer", "Dark Video / Narration", "Product Review", "Step-by-step Tutorial", "Emotional Storytelling", "Before & After", "Vlog / Day in my life"], placeholder: "" },
        { key: "objective", label: isPT ? "Objetivo do vídeo" : "Video objective", placeholder: isPT ? "ex: vender um curso de marketing, apresentar produto de skincare, motivar audiência" : "e.g., sell a marketing course, present skincare product, motivate audience" },
        { key: "voiceover", label: isPT ? "Narração / Voz" : "Narration / Voice", type: "select", options: isPT ? ["Com voz off (narração)", "Personagem a falar", "Sem voz (só música + texto)", "Voz off + texto na tela"] : ["Voiceover (narration)", "Character speaking", "No voice (music + text only)", "Voiceover + text on screen"], placeholder: "" },
        { key: "aspect", label: isPT ? "Proporção" : "Aspect ratio", type: "select", options: ["9:16 (Reels/TikTok)", "16:9 (YouTube)", "1:1 (Feed)"], placeholder: "" },
        { key: "music", label: isPT ? "Estilo de música" : "Music style", placeholder: isPT ? "ex: motivacional épica, lo-fi relaxante, trending TikTok, dramática" : "e.g., epic motivational, lo-fi relaxing, trending TikTok, dramatic" },
      ],
      buildPrompt: (v) => isPT
        ? `Cria um roteiro completo de ${v.scenes} cenas para ${v.tool}, pronto para gerar cena a cena.

BRIEFING DO VÍDEO:
- Tipo: ${v.videoType}
- Objetivo: ${v.objective}
- Nº de cenas: ${v.scenes}
- Duração máxima por cena: ${v.maxDuration}
- Proporção: ${v.aspect}
- Narração: ${v.voiceover}
- Música: ${v.music}

REGRAS OBRIGATÓRIAS:
1. Cada cena deve usar o MÁXIMO da duração disponível (${v.maxDuration}) — nunca gerar cenas curtas
2. A CENA 1 é o HOOK — tem de captar atenção imediatamente
3. A ÚLTIMA CENA é o CTA — chamada para ação clara
4. Cada cena deve ter CONTINUIDADE com a anterior (transição lógica)

PARA CADA CENA entrega:
- CENA [N] — Título descritivo
- PROMPT ${v.tool}: prompt completo dentro de bloco de código, incluindo: ação/movimento, enquadramento de câmera, iluminação, expressão do personagem, cenário, o que acontece do início ao fim da cena. O negative prompt vai NO FINAL do mesmo bloco de código (linha "Negative: ...")
- NARRAÇÃO/VOZ: texto exacto da fala ou narração (com timing)
- TEXTO NA TELA: overlays, legendas, títulos (com posição e estilo)
- MÚSICA: direção sonora para esta cena
- DURAÇÃO: ${v.maxDuration}
- TRANSIÇÃO PARA PRÓXIMA CENA: como conectar

NO FINAL inclui:
- SEQUÊNCIA DE MONTAGEM: ordem das cenas e como montar o vídeo final
- DICAS DE PÓS-PRODUÇÃO: como juntar as cenas no CapCut/editor
- DURAÇÃO TOTAL ESTIMADA do vídeo final`
        : `Create a complete script of ${v.scenes} scenes for ${v.tool}, ready to generate scene by scene.

VIDEO BRIEF:
- Type: ${v.videoType}
- Objective: ${v.objective}
- Number of scenes: ${v.scenes}
- Max duration per scene: ${v.maxDuration}
- Aspect ratio: ${v.aspect}
- Narration: ${v.voiceover}
- Music: ${v.music}

MANDATORY RULES:
1. Each scene must use the MAXIMUM available duration (${v.maxDuration}) — never generate short scenes
2. SCENE 1 is the HOOK — must grab attention immediately
3. LAST SCENE is the CTA — clear call to action
4. Each scene must have CONTINUITY with the previous one (logical transition)

FOR EACH SCENE deliver:
- SCENE [N] — Descriptive title
- ${v.tool} PROMPT: complete prompt inside a code block, including: action/movement, camera framing, lighting, character expression, setting, what happens from start to end. Negative prompt goes at the END of the same code block (line "Negative: ...")
- NARRATION/VOICE: exact speech or narration text (with timing)
- TEXT ON SCREEN: overlays, captions, titles (with position and style)
- MUSIC: sound direction for this scene
- DURATION: ${v.maxDuration}
- TRANSITION TO NEXT SCENE: how to connect

AT THE END include:
- EDITING SEQUENCE: scene order and how to assemble the final video
- POST-PRODUCTION TIPS: how to join scenes in CapCut/editor
- ESTIMATED TOTAL DURATION of final video`,
    },
    {
      id: "dark-channel",
      emoji: "🌑",
      label: isPT ? "Canal Dark (Pipeline Pro)" : "Dark Channel (Pro Pipeline)",
      description: isPT ? "Pipeline: Titulo -> Roteiro -> Cenas VEO3" : "Pipeline: Title -> Script -> VEO3 Scenes",
      fields: [
        { key: "step", label: isPT ? "Qual etapa?" : "Which step?", type: "select", options: isPT ? ["1 - Gerar Titulos", "2 - Criar Roteiro", "3 - Gerar Cenas VEO3"] : ["1 - Generate Titles", "2 - Create Script", "3 - Generate VEO3 Scenes"], placeholder: "" },
        { key: "topic", label: isPT ? "Tema" : "Topic", placeholder: isPT ? "ex: A Peste Negra, O Colapso de Roma" : "e.g., The Black Plague, Fall of Rome" },
        { key: "words", label: isPT ? "Palavras do roteiro (etapa 2)" : "Script words (step 2)", type: "select", options: ["800", "1200", "1800", "2500", "3500", "5000"], placeholder: "" },
        { key: "scenes", label: isPT ? "Total de cenas (etapa 3)" : "Total scenes (step 3)", type: "select", options: ["10", "15", "20", "25", "30", "40", "50"], placeholder: "" },
      ],
      buildPrompt: (v) => {
        const step = v.step?.charAt(0) || "1";
        if (step === "1") {
          return isPT
            ? `Voce agora atua como Designer de Conceitos Narrativos para YouTube focado em historias atemporais com alto poder de retencao. Seu trabalho e desenvolver propostas de videos longos (10-25 min) construidos inteiramente com sequencias cinematograficas geradas por IA. Nao considere gravacoes reais.

Principios: Temas atemporais (civilizacoes antigas, eventos historicos, fenomenos inexplicaveis, exploracoes extremas, tecnologias esquecidas, fraudes historicas, sociedades ocultas). Evite noticias recentes ou figuras publicas modernas. Cada proposta deve permitir divisao em micro-cenas visuais (5-10s cada). Titulos com curiosidade profunda.

Crie 12 propostas${v.topic ? " relacionadas ao tema: " + v.topic : ""}. Cada proposta: Nome do video / Gatilho psicologico principal / Direcao visual sugerida / Transformacao prometida ao espectador. Sem listas numeradas. Ao final escreva: Selecione um dos titulos e utilize no proximo comando.`
            : `You are a Narrative Concept Designer for YouTube, timeless stories with high retention. Develop 12 proposals for long videos (10-25 min) built with AI cinematic sequences.${v.topic ? " Topic: " + v.topic : ""} Each: Video name / Main psychological trigger / Visual direction / Transformation promised. No numbered lists. End with: Select one title for the next command.`;
        }
        if (step === "2") {
          return isPT
            ? `Palavras do roteiro: ${v.words || "1800"}. Tema: ${v.topic || "[COLE O TITULO ESCOLHIDO]"}

Voce e um roteirista de documentarios historicos imersivos, estilo YouTube cinematografico. Escreva o roteiro completo com linguagem rica, fluida e cinematografica.

ESTRUTURA OBRIGATORIA (nesta ordem exata):
1. Abertura Impactante (Hook) - Comece no caos. Frases curtas visuais emocionais. Termine com grande pergunta.
2. Revelacao do Evento - O que aconteceu e por que e extraordinario.
3. Quebra de Expectativa - Auge antes da queda. Contraste forte.
4. Contexto do Mundo - Sociedade, economia, comercio. Como o sucesso preparou a catastrofe.
5. Origem do Evento - Local distante, invisivel, incompreendido. Riqueza sensorial.
6. Ponto de Contato - Momento exato em que atinge a civilizacao.
7. Propagacao - Disseminacao progressiva. Velocidade, impotencia.
8. Reacao Humana - Crencas equivocadas, ciencia limitada.
9. Colapso Social - Quebra de lacos, abandono, histeria.
10. Radicalizacao - Extremismo, perseguicoes. Tom serio.
11. Impacto Rural - Vilas abandonadas, colheitas perdidas.
12. Recuo - Nao vitoria, esgotamento.
13. Mundo Pos-Evento - Transformacao permanente.
14. Fechamento - Paralelos modernos. Pergunta inquietante.
15. Assinatura - CTA suave.

REGRAS: Sem listas. Sem emojis. Narrativa cinematografica. Respeitar ${v.words || "1800"} palavras.`
            : `Script words: ${v.words || "1800"}. Topic: ${v.topic || "[PASTE CHOSEN TITLE]"}
Immersive historical documentary screenwriter. Write complete script, rich cinematic language.
Structure: 1.Hook 2.Revelation 3.Expectation break 4.World context 5.Origin 6.Contact point 7.Propagation 8.Human reaction 9.Social collapse 10.Radicalization 11.Rural impact 12.Recession 13.Post-event 14.Reflective closing 15.Signature CTA. No lists, no emojis, cinematic tone. Respect ${v.words || "1800"} words.`;
        }
        return isPT
          ? `Total de cenas: ${v.scenes || "20"}. Roteiro: [COLE O ROTEIRO DA ETAPA 2 AQUI]

Voce e um diretor de cinema historico e storyboarder para documentarios imersivos com VEO 3.

OBJETIVO: Selecionar cenas necessarias, evitar redundancia, progressao emocional, facilitar sincronizacao. Pipeline profissional.

SELECAO: Cada cena = ponto-chave do roteiro, funciona sem narracao, unica acao, 6-8 segundos.

PADRAO VISUAL (OBRIGATORIO): Realismo historico cinematografico. Pessoas comuns imperfeitas. Roupas e arquitetura corretas. Iluminacao natural (velas, ceu nublado). Paleta terrosa dessaturada. Atmosfera densa. ZERO elementos modernos. ZERO texto na imagem.

ANIMACAO VEO 3: Movimento sutil (respiracao, gestos, tecidos, fumaca, chamas). Camera estatica ou push-in lento. Nunca brusco. Uma acao por cena.

FORMATO - Blocos de 5 cenas. Para cada:

Cena X - [Titulo]
Trecho do roteiro: [copia exata]
Por que existe: [1 linha]

Prompt VEO 3 (em bloco de codigo):
\`\`\`
[Prompt em ingles tecnico cinematografico. Ambiente, personagens, acao, iluminacao, clima, camera, movimento. Sem modernismos. Sem texto na imagem.]
\`\`\`

Da Cena 2 em diante incluir: "Maintain the same visual style, lighting, realism level, historical accuracy and cinematic tone as previous scenes."

Apos 5 cenas PARE. Aguarde: "Continue com o proximo bloco."`
          : `Total scenes: ${v.scenes || "20"}. Script: [PASTE STEP 2 SCRIPT HERE]
Historical cinema director + storyboarder for VEO 3 immersive docs.
Deliver in blocks of 5. Each scene: Title, script excerpt, why it exists, VEO 3 prompt in code block (English, cinematic, historical realism, no modern elements, no text). From scene 2: add consistency line. After 5 scenes STOP, wait for "Continue."`;
      },
    },
    {
      id: "viral-pipeline",
      emoji: "🚀",
      label: isPT ? "Viral Pipeline Pro (Reels/TikTok)" : "Viral Pipeline Pro (Reels/TikTok)",
      description: isPT ? "Pipeline: Conceito -> Roteiro -> Cenas VEO3" : "Pipeline: Concept -> Script -> VEO3 Scenes",
      fields: [
        { key: "step", label: isPT ? "Qual etapa?" : "Which step?", type: "select", options: isPT ? ["1 - Gerar Conceitos Virais", "2 - Criar Roteiro", "3 - Gerar Cenas VEO3"] : ["1 - Generate Viral Concepts", "2 - Create Script", "3 - Generate VEO3 Scenes"], placeholder: "" },
        { key: "niche", label: isPT ? "Nicho" : "Niche", placeholder: isPT ? "ex: fitness, beleza, finanças, humor, motivacao" : "e.g., fitness, beauty, finance, humor, motivation" },
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["TikTok", "Instagram Reels", "YouTube Shorts"], placeholder: "" },
        { key: "duration", label: isPT ? "Duracao (etapa 2)" : "Duration (step 2)", type: "select", options: ["15s", "30s", "45s", "60s"], placeholder: "" },
        { key: "style", label: isPT ? "Estilo" : "Style", type: "select", options: isPT ? ["UGC / Talking head", "POV Storytelling", "Dark motivacional", "Tutorial rapido", "Antes e Depois", "Humor / Trend", "Review / Unboxing"] : ["UGC / Talking head", "POV Storytelling", "Dark motivational", "Quick tutorial", "Before & After", "Humor / Trend", "Review / Unboxing"], placeholder: "" },
        { key: "videoLang", label: isPT ? "Idioma do video" : "Video language", type: "select", options: isPT ? ["Portugues (BR)", "Portugues (PT)", "Ingles", "Espanhol"] : ["Portuguese (BR)", "Portuguese (PT)", "English", "Spanish"], placeholder: "" },
        { key: "scenes", label: isPT ? "Total de cenas (etapa 3)" : "Total scenes (step 3)", type: "select", options: ["2", "3", "4", "5", "6", "8"], placeholder: "" },
      ],
      buildPrompt: (v) => {
        const step = v.step?.charAt(0) || "1";
        if (step === "1") {
          return isPT
            ? `Voce e um estrategista de conteudo viral especializado em ${v.platform} no nicho de ${v.niche}, estilo ${v.style}.

Crie exatamente 5 conceitos de videos curtos para ${v.platform}. Duraçao: ${v.duration || "30s"}.

Para cada conceito entregue EXATAMENTE neste formato:

**CONCEITO [N]: [TITULO com emojis]**
- HOOK: "[frase exata dos primeiros 1-3 segundos]"
- FORMATO: [nome do formato viral]
- GATILHO: [mecanismo psicológico]
- POTENCIAL: [Alto/Médio + 1 linha do porquê]

REGRAS:
- Exatamente 5 conceitos, não mais
- Todos produzíveis com VEO3 (IA), sem rosto real
- Otimizados para ${v.platform} (9:16)
- Hooks que PARAM o scroll — concretos, não genéricos

No final escreva exatamente: "Responde com o número (1-5) do conceito que queres desenvolver e eu crio o roteiro completo + cenas VEO3 automaticamente."`
            : `Viral content strategist for ${v.platform}, niche: ${v.niche}, style: ${v.style}.

Create exactly 5 short video concepts for ${v.platform}. Duration: ${v.duration || "30s"}.

Format each as:
**CONCEPT [N]: [TITLE with emojis]**
- HOOK: "[exact first 1-3 second phrase]"
- FORMAT: [viral format name]
- TRIGGER: [psychological mechanism]
- POTENTIAL: [High/Medium + 1 line why]

Rules: Exactly 5 concepts. All VEO3 producible, no real face, 9:16. Scroll-stopping hooks.

End with: "Reply with the number (1-5) of the concept you want and I'll create the full script + VEO3 scenes automatically."`;
        }
        if (step === "2") {
          return isPT
            ? `Plataforma: ${v.platform} | Duracao: ${v.duration || "30s"} | Estilo: ${v.style} | Nicho: ${v.niche} | Idioma: ${v.videoLang} | Cenas: ${v.scenes || "4"}

IMPORTANTE: O utilizador vai selecionar um conceito da lista anterior OU colar um conceito. Desenvolve o PIPELINE COMPLETO de uma vez:

## PARTE 1 — ROTEIRO (${v.duration || "30s"})

Para cada momento do video:
**[TEMPO]** (ex: 0-3s)
- VISUAL: Descrição da cena
- FALA (${v.videoLang}): Texto exato da narração
- TEXTO NA TELA: Overlay curto (max 5 palavras)
- SOM: Direção sonora

Regras: Hook em 0-3s OBRIGATÓRIO. CTA nos últimos 3s. Ritmo dinâmico. 9:16 vertical.

## PARTE 2 — CENAS VEO3 (${v.scenes || "4"} cenas de 8 segundos)

Para CADA cena:

**CENA [N] — [Titulo]**

Prompt VEO3 em bloco de código:
\`\`\`
[Prompt COMPLETO em inglês: personagem, ação dos 8 segundos, câmera, iluminação, cenário, expressão. Diálogo entre aspas em ${v.videoLang}. Formato 9:16.]
\`\`\`

Texto na tela: [overlay em ${v.videoLang}]

Da Cena 2 em diante: "Maintain same character, lighting, color palette and visual tone as Scene 1."

## PARTE 3 — FINALIZAÇÃO
- MONTAGEM CAPCUT: ordem, transições, música (3 linhas)
- HASHTAGS: 10 hashtags de nicho
- MELHOR HORÁRIO: para publicar em ${v.platform}
- LEGENDA DO POST: pronta a copiar

REGRAS ABSOLUTAS:
- Cada prompt VEO3 dentro de bloco de código (\`\`\`)
- Prompts em inglês, falas em ${v.videoLang}
- ZERO explicações extras — só o que é preciso para executar
- Entregar tudo de uma vez (roteiro + cenas + finalização)`
            : `Platform: ${v.platform} | Duration: ${v.duration || "30s"} | Style: ${v.style} | Niche: ${v.niche} | Language: ${v.videoLang} | Scenes: ${v.scenes || "4"}

The user will select a concept or paste one. Develop the COMPLETE PIPELINE at once:

## PART 1 — SCRIPT (${v.duration || "30s"})
For each moment: **[TIME]** → VISUAL / SPEECH (${v.videoLang}) / TEXT ON SCREEN / SOUND. Hook 0-3s mandatory, CTA last 3s.

## PART 2 — VEO3 SCENES (${v.scenes || "4"} scenes, 8 seconds each)
Each scene: title, VEO3 prompt in code block (English, full 8s action, camera, lighting, dialogue in ${v.videoLang} in quotes). From scene 2: add consistency line.

## PART 3 — FINALIZATION
CapCut assembly (3 lines), 10 hashtags, best posting time, post caption ready to copy.

Rules: All VEO3 prompts in code blocks. Prompts English, speech ${v.videoLang}. ZERO extra explanations. Deliver everything at once.`;
        }
        return isPT
          ? `Total de cenas: ${v.scenes || "4"} | Idioma: ${v.videoLang} | Plataforma: ${v.platform}

O utilizador vai colar o roteiro. Transforma em ${v.scenes || "4"} cenas de 8 segundos para VEO3.

Para CADA cena:

**CENA [N] — [Titulo]**

Prompt VEO3 em bloco de código:
\`\`\`
[Prompt em inglês: personagem, ação completa dos 8 segundos, câmera, iluminação, cenário, expressão. Diálogo entre aspas em ${v.videoLang}. 9:16.]
\`\`\`

Texto na tela: [overlay em ${v.videoLang}, max 5 palavras]

Da Cena 2: "Maintain same character appearance, lighting style, color palette and visual tone as Scene 1."

Após todas as cenas:
- MONTAGEM CAPCUT (3 linhas): ordem, transições, música
- Estilo: ${v.style}, autenticidade, 9:16
- Cena 1 = HOOK | Última = CTA
- Cada cena USA OS 8 SEGUNDOS COMPLETOS`
          : `Scenes: ${v.scenes || "4"} | Language: ${v.videoLang} | Platform: ${v.platform}

Transform the pasted script into ${v.scenes || "4"} VEO3 scenes (8s each). Each: title + VEO3 prompt in code block (English, 8s action, camera, lighting, dialogue in ${v.videoLang}). Scene 1=HOOK, last=CTA. After all: CapCut assembly 3 lines. Style: ${v.style}, 9:16.`;
      },
    },
    {
      id: "viral-modeling",
      emoji: "🔥",
      label: isPT ? "Modelar Vídeo Viral" : "Model Viral Video",
      description: isPT ? "Encontra vídeos virais e adapta para ti" : "Find viral videos and adapt for you",
      fields: [
        { key: "niche", label: isPT ? "Nicho" : "Niche", placeholder: isPT ? "ex: fitness, marketing digital, beleza, finanças, culinária" : "e.g., fitness, digital marketing, beauty, finance, cooking" },
        { key: "platform", label: isPT ? "Plataforma" : "Platform", type: "select", options: ["TikTok", "Instagram Reels", "YouTube Shorts", "YouTube"], placeholder: "" },
        { key: "audience", label: isPT ? "Teu público-alvo" : "Your target audience", placeholder: isPT ? "ex: mulheres 25-40 interessadas em skincare" : "e.g., women 25-40 interested in skincare" },
        { key: "brand", label: isPT ? "Teu produto/marca (opcional)" : "Your product/brand (optional)", placeholder: isPT ? "ex: curso online de marketing, loja de roupa, app de meditação" : "e.g., online marketing course, clothing store, meditation app" },
        { key: "imageTool", label: isPT ? "Ferramenta de imagem" : "Image tool", type: "select", options: ["SavvyOwl"], placeholder: "" },
        { key: "videoTool", label: isPT ? "Ferramenta de vídeo" : "Video tool", type: "select", options: ["SavvyOwl Video 8s", "SavvyOwl Video 15s"], placeholder: "" },
        { key: "videoLang", label: isPT ? "Idioma do vídeo" : "Video language", type: "select", options: isPT ? ["Português (BR)", "Português (PT)", "Inglês", "Espanhol"] : ["Portuguese (BR)", "Portuguese (PT)", "English", "Spanish"], placeholder: "" },
      ],
      buildPrompt: (v) => isPT
        ? `Quero modelar vídeos virais do nicho de ${v.niche} no ${v.platform}.

O MEU CONTEXTO:
- Público-alvo: ${v.audience}
${v.brand ? `- Produto/Marca: ${v.brand}` : ""}
- Ferramentas disponíveis: ${v.imageTool} + ${v.videoTool} + CapCut

PASSO 1 — TENDÊNCIAS VIRAIS:
Identifica os 10 formatos/padrões de vídeo que estão a viralizar AGORA no nicho de ${v.niche} no ${v.platform}. Para cada um:
- NOME DO FORMATO (ex: "POV storytelling", "Before/After reveal", "3 things nobody told you")
- DESCRIÇÃO: como funciona este formato (estrutura, duração, estilo)
- POR QUE VIRALIZA: qual mecanismo psicológico usa (curiosidade, polêmica, identificação, etc.)
- EXEMPLO: descreve um vídeo concreto neste formato que estaria a viralizar
- LINK DE REFERÊNCIA: se possível, indica como encontrar exemplos reais (termos de pesquisa exatos para encontrar no ${v.platform})
- ESTIMATIVA DE VIEWS: potencial de visualizações para este formato

PASSO 2 — ADAPTAÇÃO:
Para os 3 formatos com maior potencial, cria a MODELAGEM COMPLETA adaptada ao meu contexto:

Para cada formato:
- ROTEIRO COMPLETO cena a cena adaptado ao meu nicho/produto
- HOOK dos primeiros 1-3 segundos
- SCRIPT/NARRAÇÃO completo
- TEXTO NA TELA frame a frame
- DIREÇÃO DE MÚSICA/SOM
- HASHTAGS específicas para este formato
- MELHOR HORÁRIO para publicar
- COMO PRODUZIR com as minhas ferramentas (${v.imageTool} + ${v.videoTool} + CapCut): passo a passo técnico
- FERRAMENTAS MAIS ECONÓMICAS para cada etapa da produção

PASSO 3 — PLANO DE EXECUÇÃO:
- Qual dos 3 formatos fazer PRIMEIRO (e porquê)
- Calendário de publicação para a próxima semana usando estes formatos
- Como testar e iterar baseado nos resultados`
        : `I want to model viral videos from the ${v.niche} niche on ${v.platform}.

MY CONTEXT:
- Target audience: ${v.audience}
${v.brand ? `- Product/Brand: ${v.brand}` : ""}
- Available tools: ${v.imageTool} + ${v.videoTool} + CapCut

STEP 1 — VIRAL TRENDS:
Identify the 10 video formats/patterns going viral RIGHT NOW in the ${v.niche} niche on ${v.platform}. For each:
- FORMAT NAME (e.g., "POV storytelling", "Before/After reveal", "3 things nobody told you")
- DESCRIPTION: how this format works (structure, duration, style)
- WHY IT GOES VIRAL: psychological mechanism (curiosity, controversy, relatability, etc.)
- EXAMPLE: describe a concrete viral video in this format
- REFERENCE LINK: if possible, indicate exact search terms to find examples on ${v.platform}
- ESTIMATED VIEWS: potential for this format

STEP 2 — ADAPTATION:
For the 3 formats with highest potential, create COMPLETE MODELING adapted to my context:

For each format:
- COMPLETE SCRIPT scene by scene adapted to my niche/product
- HOOK for first 1-3 seconds
- Full SCRIPT/NARRATION
- TEXT ON SCREEN frame by frame
- MUSIC/SOUND direction
- Specific HASHTAGS for this format
- BEST TIME to post
- HOW TO PRODUCE with my tools (${v.imageTool} + ${v.videoTool} + CapCut): technical step-by-step
- MOST AFFORDABLE TOOLS for each production step

STEP 3 — EXECUTION PLAN:
- Which of the 3 formats to do FIRST (and why)
- Publishing calendar for next week using these formats
- How to test and iterate based on results`,
    },
  ];

  // Templates que geram cenas/prompts de imagem/vídeo e precisam de identity lock
  const isSceneTemplate = (id: string) => [
    "scene-generator", "dark-channel", "viral-pipeline", "viral-modeling",
    "ai-video", "ugc-influencer"
  ].includes(id);

  const handleSubmitTemplate = async () => {
    if (!activeTemplate) return;

    // Special flow for viral modeling — search YouTube first
    if (activeTemplate.id === "viral-modeling" && viralStep === "form") {
      setViralLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-trending`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              niche: fieldValues.niche,
              platform: fieldValues.platform,
              maxResults: 10,
            }),
          }
        );

        const data = await resp.json();
        if (data.videos && data.videos.length > 0) {
          setViralVideos(data.videos);
          setViralStep("videos");
        } else {
          toast.error(isPT ? "Nenhum vídeo viral encontrado. Tenta outro nicho." : "No viral videos found. Try another niche.");
        }
      } catch (e) {
        toast.error(isPT ? "Erro ao buscar vídeos. Tenta novamente." : "Error fetching videos. Try again.");
      } finally {
        setViralLoading(false);
      }
      return;
    }

    // Normal flow for other templates
    let prompt = activeTemplate.buildPrompt(fieldValues);

    // === CHARACTER ENGINE INJECTION ===
    // Se há personagem ativo, injeta identity block + negative prompt no prompt final
    // Isto garante que a IA gere prompts com consistência visual
    if (identityBlock && isSceneTemplate(activeTemplate.id)) {
      const charInstruction = isPT
        ? `\n\n═══ PERSONAGEM ATIVO — IDENTITY LOCK ═══
O personagem abaixo é OBRIGATÓRIO em todas as cenas. Cada prompt de imagem/vídeo que gerares DEVE incluir este bloco de identidade COMPLETO no início. NÃO inventes descrições — usa EXACTAMENTE este bloco:

${identityBlock}

NEGATIVE PROMPT (incluir em TODOS os prompts de imagem):
${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime, no cartoon"}

REGRA: O negative prompt vai JUNTO do prompt principal (não como bloco separado). Formato:
\`\`\`
[identity block + prompt da cena]

Negative: [negative prompt]
\`\`\`
═══ FIM IDENTITY LOCK ═══`
        : `\n\n═══ ACTIVE CHARACTER — IDENTITY LOCK ═══
The character below is MANDATORY in all scenes. Every image/video prompt you generate MUST include this identity block in FULL at the beginning. Do NOT invent descriptions — use EXACTLY this block:

${identityBlock}

NEGATIVE PROMPT (include in ALL image prompts):
${negativePrompt || "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime, no cartoon"}

RULE: The negative prompt goes TOGETHER with the main prompt (not as a separate block). Format:
\`\`\`
[identity block + scene prompt]

Negative: [negative prompt]
\`\`\`
═══ END IDENTITY LOCK ═══`;

      prompt = charInstruction + "\n\n" + prompt;
    }

    onSend(prompt);
    setActiveTemplate(null);
    setFieldValues({});
  };

  const resetViralFlow = () => {
    setActiveTemplate(null);
    setFieldValues({});
    setViralVideos([]);
    setViralStep("form");
    setSelectedVideo(null);
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  };

  // Template selection view
  if (!activeTemplate) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-2xl">
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
  // Special view: viral video selection
  if (activeTemplate?.id === "viral-modeling" && viralStep === "videos" && viralVideos.length > 0) {
    return (
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <h3 className="text-sm font-semibold text-foreground">
              {isPT ? `${viralVideos.length} vídeos virais encontrados` : `${viralVideos.length} viral videos found`}
            </h3>
          </div>
          <button
            onClick={resetViralFlow}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {isPT ? "Escolhe um vídeo para a SavvyOwl modelar e adaptar ao teu contexto:" : "Pick a video for SavvyOwl to model and adapt to your context:"}
        </p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {viralVideos.map((vid: any) => (
            <button
              key={vid.id}
              onClick={() => handleViralVideoSelect(vid)}
              className="w-full flex gap-3 p-3 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/30 transition-all text-left group"
            >
              <img
                src={vid.thumbnail}
                alt={vid.title}
                className="w-24 h-16 object-cover rounded-lg shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground group-hover:text-primary line-clamp-2 leading-snug mb-1">
                  {vid.title}
                </p>
                <p className="text-[10px] text-muted-foreground mb-1">{vid.channel}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{formatNumber(vid.views)}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="h-2.5 w-2.5" />{formatNumber(vid.likes)}</span>
                  <span className="flex items-center gap-1"><Play className="h-2.5 w-2.5" />{vid.duration}</span>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-primary mt-1" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{activeTemplate.emoji}</span>
          <h3 className="text-sm font-semibold text-foreground">{activeTemplate.label}</h3>
        </div>
        <button
          onClick={() => { resetViralFlow(); }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Character Engine Banner — mostra quando há personagem ativo em templates de cena */}
        {activeCharacterName && activeTemplate && isSceneTemplate(activeTemplate.id) && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-green-500/30 bg-green-500/5">
            <Lock className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                {isPT ? "Personagem ativo" : "Active character"}: {activeCharacterName}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isPT
                  ? "Identity block + negative prompt serão injetados automaticamente em cada prompt gerado"
                  : "Identity block + negative prompt will be auto-injected into every generated prompt"}
              </p>
            </div>
          </div>
        )}

        {/* Aviso quando NÃO há personagem em templates de cena */}
        {!activeCharacterName && activeTemplate && isSceneTemplate(activeTemplate.id) && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <Users className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">
                {isPT
                  ? "Nenhum personagem selecionado. As cenas serão geradas sem identity lock. Seleciona um personagem no seletor acima para consistência visual."
                  : "No character selected. Scenes will be generated without identity lock. Select a character above for visual consistency."}
              </p>
            </div>
          </div>
        )}

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
        disabled={disabled || viralLoading}
        className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
        size="sm"
      >
        {viralLoading ? (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{isPT ? "A buscar vídeos virais..." : "Searching viral videos..."}</>
        ) : activeTemplate?.id === "viral-modeling" ? (
          <><ChevronRight className="h-4 w-4 mr-1.5" />{isPT ? "Buscar vídeos virais" : "Search viral videos"}</>
        ) : (
          <><ChevronRight className="h-4 w-4 mr-1.5" />{isPT ? "Gerar conteúdo" : "Generate content"}</>
        )}
      </Button>
    </div>
  );
}
