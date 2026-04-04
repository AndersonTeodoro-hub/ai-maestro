# SavvyOwl — Especificação Completa do Projecto

> Última actualização: 04/04/2026
> Este ficheiro é a fonte de verdade para a estrutura do projecto. Qualquer alteração no código deve respeitar esta spec. Quando corriges um componente, NÃO alteres outros componentes listados aqui sem autorização.

---

## 1. ARQUITECTURA GERAL

```
Frontend (React/TypeScript + Vite)  →  Vercel (auto-deploy on push)
     ↓
Supabase Edge Functions (11)        →  Supabase (deploy via Management API)
     ↓
Serviços externos: fal.ai, ElevenLabs, Google Gemini, Anthropic Claude, Stripe
```

**Repo:** `https://github.com/AndersonTeodoro-hub/SavvyOwl`
**Domínio:** `savvyowl.app`
**Supabase Project:** `kumnrldlzttsrgjlsspa` (EU West Ireland)

---

## 2. ROTAS / PÁGINAS

| Rota | Ficheiro | Descrição | Autenticação |
|------|----------|-----------|-------------|
| `/` | `Landing.tsx` | Landing page pública com pricing e features | Não |
| `/pricing` | `Pricing.tsx` | Página de planos e preços | Não |
| `/login` | `Login.tsx` | Login com email/password + Google OAuth | Não |
| `/register` | `Register.tsx` | Registo de nova conta | Não |
| `/dashboard` | Redireciona para `/dashboard/chat` | — | Sim |
| `/dashboard/home` | `DashboardHome.tsx` | Painel inicial com stats rápidos | Sim |
| `/dashboard/chat` | `Chat.tsx` | Chat AI + StructuredTemplates (Viral Pipeline) | Sim |
| `/dashboard/prompts` | `Prompts.tsx` | Biblioteca de prompts guardados | Sim |
| `/dashboard/analytics` | `Analytics.tsx` | Estatísticas de uso e custos | Sim |
| `/dashboard/characters` | `CharactersPage.tsx` | Character Engine (criar/editar/lock personagens) | Sim |
| `/dashboard/dark-pipeline` | `DarkPipelinePage.tsx` | Dark Pipeline Pro (vídeos dark sem UGC) | Sim |
| `/dashboard/dubbing` | `DubbingPage.tsx` | AI Dubbing — Kling Motion Control Pro | Sim |
| `/dashboard/settings` | `SettingsPage.tsx` | Definições, API keys, plano, créditos | Sim |
| `*` | `NotFound.tsx` | Página 404 | Não |

---

## 3. CONTEXTOS GLOBAIS

### 3.1 AuthContext (`src/contexts/AuthContext.tsx`)
**Provê:** `user`, `session`, `profile`, `loading`, `signOut`, `refreshProfile`
**Profile contém:** `id`, `full_name`, `plan`, `monthly_budget_eur`, `content_preference`, `onboarding_completed`, `language`, `credits_balance`, `credits_total_purchased`
**Comportamentos:**
- Detecta tokens OAuth no URL hash (Google redirect)
- Carrega profile do Supabase ao login
- Aplica idioma do profile (PT/EN/FR/ES)
- `refreshProfile()` — recarrega dados do profile (usado após compras/gastos)

### 3.2 CharacterContext (`src/contexts/CharacterContext.tsx`)
**Provê:** `characters`, `activeCharacter`, `identityBlock`, `wanT2VBlock`, `negativePrompt`, `activeCharacterName`, `referenceImageUrl`, `selectCharacter`, `clearCharacter`, `refreshCharacters`, `loading`
**Comportamentos:**
- Carrega personagens locked do utilizador ao mount
- `selectCharacter(id)` — activa um personagem
- `identityBlock` — gerado por `buildCharacterIdentityBlock()` (formato campos, para Veo3)
- `wanT2VBlock` — gerado por `buildWanT2VIdentity()` (prosa densa, para Wan 2.6)
- `negativePrompt` — gerado por `buildNegativePrompt()`
- Se `activeCharacter` é null após reload, o pipeline re-seleciona via `pipeline.characterId`

---

## 4. HOOKS CUSTOM

| Hook | Ficheiro | O que faz |
|------|----------|-----------|
| `useAuth` | `AuthContext.tsx` | Acede ao contexto de autenticação |
| `useCharacter` | `CharacterContext.tsx` | Acede ao Character Engine |
| `useCharacterEngine` | `hooks/useCharacterEngine.ts` | Operações CRUD de personagens (expand, refine, lock, unlock, delete) |
| `useElevenLabsKey` | `hooks/useElevenLabsKey.ts` | Lê API key + voice ID do ElevenLabs do localStorage |
| `useGoogleApiKey` | `hooks/useGoogleApiKey.ts` | Lê API key do Google do localStorage |
| `useMobile` | `hooks/use-mobile.tsx` | Detecta se é mobile |
| `useToast` | `hooks/use-toast.ts` | Sistema de toasts |

---

## 5. COMPONENTES PRINCIPAIS

### 5.1 StructuredTemplates (`src/components/StructuredTemplates.tsx`) — 2119 linhas
**Localização:** Renderizado dentro de `Chat.tsx`
**Função:** Motor principal do Vídeo Viral Pipeline (8 etapas) + templates auxiliares

#### Pipeline de 8 etapas (VP_STEPS):
| Etapa | Key | Comportamento |
|-------|-----|--------------|
| 1. Tema | `theme` | Input texto livre do nicho/tema |
| 2. Título | `title` | Gera 5 títulos via `callChat`, utilizador escolhe 1. Selector de palavras (30/60/120/300/500) |
| 3. Config | `config` | Duração por cena (8s Seedance / 15s Wan), número de cenas, formato (9:16/16:9/1:1), custo estimado + saldo |
| 4. Roteiro | `script` | Gera roteiro completo via `callChat` com número de palavras seleccionado |
| 5. Personagem | `character` | Lista personagens locked, selector, botão criar novo (navega para `/dashboard/characters`) |
| 6. Narração | `narration` | Gera narração inteira com ElevenLabs (voz personagem) ou Gemini TTS. Player + download MP3 |
| 7. Cenas | `scenes` | Gera cenas via Claude Sonnet (mode: deep quando há personagem). Cada cena tem DESC + DIALOGUE + PROMPT. Áudios por cena gerados em background. Botões copiar prompt |
| 8. Gerar | `generate` | Gerar vídeo por cena. Seedance 1.5 Pro (12 créd, 8s, lip-sync nativo) como motor principal. Veo3 continua disponível como alternativa no edge function. Badge de status por cena |

#### Templates auxiliares (dentro do chat):
| ID | Nome | Campos |
|----|------|--------|
| `ugc-influencer` | Criar Influencer UGC | niche, gender, age, style, setting, platform, tool |
| `caption-pro` | Copy / Legenda Pro | platform, topic, audience, tone, goal |
| `video-script` | Script de Vídeo / Reels | platform, duration, topic, style, audience |
| `content-calendar` | Calendário de Conteúdo | platform, niche, period, goal |
| `ebook` | Criar eBook / Lead Magnet | topic, audience, pages, goal |
| `ai-video` | Vídeo IA | (campos de vídeo) |
| `scene-generator` | Gerador de Cenas | (campos de cena) |
| `dark-channel` | Dark Channel | (navega para dark-pipeline) |
| `viral-video-pipeline` | Vídeo Viral Pipeline | (abre o pipeline de 8 etapas) |
| `viral-modeling` | Modelar Vídeo Viral | nicho, plataforma, duração, estilo, idioma, total cenas |

#### Funções handler:
- `handleNewPipeline()` — reset do pipeline
- `handleGenerateTitles()` — gera 5 títulos
- `handleGenerateScript()` — gera roteiro
- `handleGenerateVoice()` — gera narração inteira
- `handleGenerateScenes_SG()` — gera cenas (scene generator)
- `handleGenerateScenes_VM()` — gera cenas (viral modeling)
- `handleGenerateScenes()` — gera cenas (viral pipeline)
- `handleGenerateVideo(sceneIndex)` — gera vídeo + lip-sync
- `handleSelectCharacter(charId, charName)` — selecciona personagem
- `handleExportPrompts()` — copia todos os prompts
- `handleViralVideoSelect(vid)` — selecciona vídeo viral para modelar

### 5.2 DarkPipelinePage (`src/pages/DarkPipelinePage.tsx`) — 2121 linhas
**Rota:** `/dashboard/dark-pipeline`
**Função:** Pipeline para vídeos dark/cinematográficos sem UGC
**Motor:** Wan 2.6 T2V (15s, 8 créd) + R2V (10s com personagem, 8 créd)
**Extras:** Style profiles (Supabase), niche selector com categorias predefinidas, niche-specific prompts

#### Steps: theme → title → script → character → scenes → generate
#### Funções handler:
- `callChat(message, token, characterBlock?, mode?)` — chama edge function `chat`
- `handleNewProject()` — reset
- `handleGenerateTitles()` — gera 5 títulos
- `handleGenerateScript()` — gera roteiro (respeitando wordCount)
- `handleGenerateVoice()` — gera narração
- `handleGenerateScenes()` — gera cenas com Claude Sonnet se tem personagem
- `handleGenerateVideo(sceneIndex)` — gera vídeo + lip-sync automático
- `handleExportPrompts()` — copia prompts
- `handleSelectCharacter(charId, charName)` — selecciona personagem

#### Modelo de dados (PipelineState):
```typescript
interface PipelineState {
  theme: string;
  titles: string[];
  selectedTitle: string;
  wordCount: number;
  script: string;
  characterId: string | null;
  characterName: string | null;
  characterVoiceId: string | null;
  referenceImageUrl: string | null;
  sceneDuration: 8 | 15;
  sceneCount: number;
  scenes: SceneData[];
  aspectRatio: string;
}

interface SceneData {
  index: number;
  prompt: string;
  description: string;
  narrationText?: string;
  dialogueText?: string;
  audioUrl?: string;
  videoUrl?: string;
  lipsyncVideoUrl?: string;
  generating?: boolean;
  error?: string;
}
```

### 5.3 CharactersPage (`src/pages/CharactersPage.tsx`) — 856 linhas
**Rota:** `/dashboard/characters`
**Função:** Criar, expandir, refinar, lock/unlock personagens UGC

#### Funções handler:
- `handleExpand()` — cria personagem via Claude (character-engine expand)
- `handleRefine(adjustment)` — refina personagem com texto
- `handleLock()` — bloqueia personagem (gera reference image automática)
- `handleUnlock()` — desbloqueia para edição
- `handleDelete()` — apaga personagem
- `handleGenerateReferenceImage()` — gera imagem de referência via Gemini
- `handleSaveVoiceId()` — guarda ElevenLabs voice ID no DB
- `handleUseInChat()` — activa personagem e navega para chat
- `handleCopy()` — copia identity block

#### Secções da UI:
- Lista de personagens (esquerda)
- Detalhes do personagem seleccionado (direita)
- Preview do expanded JSON (face, hair, body, wardrobe, etc.)
- Reference image preview + download
- Voice ID input (ElevenLabs)
- Prompt blocks (NanoBanana, Veo3, Negative)
- Histórico de acções

### 5.4 Chat (`src/pages/Chat.tsx`) — 634 linhas
**Rota:** `/dashboard/chat`
**Função:** Chat AI com streaming SSE + StructuredTemplates

#### Funções handler:
- `handleSend(overrideInput?)` — envia mensagem ao chat (SSE stream)
- `handleImageSelect(e)` — upload de imagem para chat com visão
- `handleCopyMessage(text, index)` — copia mensagem
- `handleCopyBlock(text)` — copia bloco de código
- `handleKeyDown(e)` — Enter para enviar, Shift+Enter nova linha

#### Componentes internos:
- `ChatSidebar` — histórico de conversas
- `StructuredTemplates` — templates + pipelines
- Selector de modo: Owl Flash (Gemini), Owl Pro (Claude Sonnet), Owl Creator, Owl 2.0
- Badge de personagem activo no footer

### 5.5 SettingsPage (`src/pages/SettingsPage.tsx`) — 614 linhas
**Rota:** `/dashboard/settings`
**Função:** Configurações do utilizador

#### Secções:
- **Perfil:** nome, idioma, preferência de conteúdo
- **Créditos:** saldo, botão comprar packs
- **API Keys:** ElevenLabs key + voice ID, Google API key
- **Plano:** upgrade/downgrade via Stripe
- **Budget:** limite mensal de gastos
- **Conta:** apagar conta

#### Funções handler:
- `handleSaveApiKeys()` — salva keys no localStorage
- `handleRemoveApiKey()` — remove keys
- `handleSaveProfile()` — salva nome/idioma/preferência no DB
- `handleSaveBudget()` — salva budget no DB
- `handleDeleteAccount()` — apaga conta via edge function
- `handleUpgrade(plan)` — checkout Stripe
- `handleBuyPack(pack)` — compra pack de créditos
- `handleManageSubscription()` — portal Stripe

### 5.6 DubbingPage (`src/pages/DubbingPage.tsx`) — 669 linhas
**Rota:** `/dashboard/dubbing`
**Função:** AI Dubbing com Kling 3.0 Motion Control Pro

#### Steps: upload vídeo → seleccionar personagem → voice cloning (create-voice via fal.ai) → gerar vídeo com motion control (30 créd)
#### Funções handler:
- `handleUpload()` — upload de vídeo
- `handleSelectCharacter()` — selecciona personagem
- `handleGenerateVoice()` — voice cloning (create-voice via fal.ai)
- `handleGenerateDubbing()` — gera vídeo com motion control
- `handleNewProject()` — reset do projecto

### 5.7 Landing (`src/pages/Landing.tsx`) — 525 linhas
**Rota:** `/`
**Função:** Página pública com hero, features, pricing, footer
**i18n:** Completo (4 idiomas: en, pt, fr, es). LanguageSelector na nav. Rebranding: zero nomes de modelos IA visíveis ao utilizador.

### 5.8 Pricing (`src/pages/Pricing.tsx`) — 226 linhas
**Rota:** `/pricing`
**Função:** Página de planos com checkout Stripe
**i18n:** Completo (4 idiomas: en, pt, fr, es). LanguageSelector na nav.
**Planos:** Free €0/10cr, Starter €29.99/60cr, Pro €59.99/180cr (POPULAR), Studio €119.99/500cr
**Packs avulso:** S €4.99/50cr, M €12.99/150cr, L €29.99/400cr

### 5.9 Analytics (`src/pages/Analytics.tsx`) — 272 linhas
**Rota:** `/dashboard/analytics`
**Função:** Gráficos de uso, custos por modelo, histórico

### 5.10 Prompts (`src/pages/Prompts.tsx`) — 265 linhas
**Rota:** `/dashboard/prompts`
**Função:** Biblioteca de prompts guardados pelo utilizador

---

## 6. COMPONENTES AUXILIARES

| Componente | Ficheiro | Função |
|------------|----------|--------|
| `DashboardSidebar` | `DashboardSidebar.tsx` | Menu lateral do dashboard (Painel, Chat, Prompts, Análises, Characters, Dark Pipeline, Definições) |
| `ChatSidebar` | `ChatSidebar.tsx` | Histórico de conversas no chat |
| `CharacterSelector` | `CharacterSelector.tsx` | Dropdown de selecção de personagem |
| `GenerateImageButton` | `GenerateImageButton.tsx` | Botão para gerar imagem via Gemini |
| `GenerateVideoButton` | `GenerateVideoButton.tsx` | Botão para gerar vídeo (standalone, fora do pipeline) |
| `GenerateVoiceButton` | `GenerateVoiceButton.tsx` | Botão para gerar voz (standalone) |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Catch de erros React com fallback UI |
| `InstallPrompt` | `InstallPrompt.tsx` | Prompt PWA para instalação |
| `OnboardingModal` | `OnboardingModal.tsx` | Modal de boas-vindas primeiro login |
| `LanguageSelector` | `LanguageSelector.tsx` | Selector de idioma (presente em DashboardLayout, Chat, Landing.tsx e Pricing.tsx) |
| `MobileBottomNav` | `MobileBottomNav.tsx` | Navegação inferior mobile |
| `NavLink` | `NavLink.tsx` | Link de navegação activo |
| `ThemeToggle` | `ThemeToggle.tsx` | Toggle dark/light mode |

---

## 7. CHARACTER ENGINE (`src/lib/character-engine/`)

| Ficheiro | Funções exportadas | Descrição |
|----------|-------------------|-----------|
| `generation.ts` | `buildCharacterIdentityBlock(char)` | Gera identity block formato campos (Veo3/geral) |
| | `buildWanT2VIdentity(char)` | Gera prosa densa para Wan 2.6 T2V |
| | `buildNanoBananaPrompt(char, options?)` | Prompt para geração de imagem |
| | `buildVeo3Prompt(char, scene, options?)` | Prompt completo para Veo3 |
| | `buildNegativePrompt(char)` | Negative prompt UGC |
| | `generateAllPrompts(char, scene, flow)` | Gera todos os prompts de uma vez |
| `expansion.ts` | Lógica de expansão de personagem | Parse do JSON do Claude |
| `character-engine.ts` | Classe `CharacterEngine` | CRUD de personagens via edge function |
| `refinement.ts` | Lógica de refinamento | Ajustes ao personagem |

---

## 8. EDGE FUNCTIONS (Supabase)

| Slug | Ficheiro | Acções | Deploy |
|------|----------|--------|--------|
| `chat` | `chat/index.ts` | Stream SSE (Gemini/Claude), 4 modos (quick/deep/creator/opus), injection de characterBlock no system prompt | CLI (NÃO redeployar via API — tem imports esm.sh) |
| `character-engine` | `character-engine/index.ts` | expand, refine, lock (gera ref image), unlock, list, delete | Management API |
| `generate-video` | `generate-video/index.ts` | submit (fal.ai queue), poll, lipsync (Sync Lipsync 2.0 Pro) | Management API |
| `generate-image` | `generate-image/index.ts` | Gera imagem via Google Gemini | Management API |
| `generate-voice` | `generate-voice/index.ts` | Gera áudio via ElevenLabs (BYOK) ou Gemini TTS | Management API |
| `stripe-checkout` | `stripe-checkout/index.ts` | Cria sessão Stripe checkout | Management API |
| `stripe-webhook` | `stripe-webhook/index.ts` | Processa eventos Stripe (pagamentos, subscriptions) | Management API |
| `delete-account` | `delete-account/index.ts` | Apaga conta do utilizador | Management API |
| `google-auth` | `google-auth/index.ts` | OAuth Google | Management API |
| `optimize` | `optimize/index.ts` | Optimização de conteúdo | Management API |
| `youtube-trending` | `youtube-trending/index.ts` | Tendências YouTube | Management API |

### Deploy pattern: DELETE + POST + PATCH `{"verify_jwt": false}`
### REGRA: NÃO redeployar `chat` via Management API

---

## 9. MODELOS DE VÍDEO (fal.ai)

| Key | Endpoint | Créditos | Uso |
|-----|----------|----------|-----|
| `seedance-t2v` | `fal-ai/seedance/1.5-pro/text-to-video` | 12 | T2V 8s (Viral Pipeline principal) |
| `seedance-i2v` | `fal-ai/seedance/1.5-pro/image-to-video` | 12 | I2V 8s com ref image (Viral Pipeline principal) |
| `veo3-fast` | `fal-ai/veo3/fast` | 15 | T2V 8s (alternativa no edge function) |
| `veo3-fast-i2v` | `fal-ai/veo3/fast/image-to-video` | 15 | I2V 8s (alternativa no edge function) |
| `wan26-t2v-flash` | `wan/v2.6/text-to-video` | 8 | T2V 15s (Dark Pipeline) |
| `wan26-i2v-flash` | `wan/v2.6/image-to-video` | 8 | I2V 15s |
| `wan26-r2v-flash` | `wan/v2.6/reference-to-video/flash` | 8 | R2V 10s com personagem (Dark Pipeline) |
| `kling-motion-standard` | `fal-ai/kling-video/v3/motion-control/standard` | 20 | Kling Motion Standard |
| `kling-motion-pro` | `fal-ai/kling-video/v3/motion-control/pro` | 30 | Kling Motion Control Pro (Dubbing) |
| `kling` | `fal-ai/kling-video/v2.1/pro` | 10 | Alternativa budget |
| Lip-sync | `fal-ai/sync-lipsync/v2/pro` | 3 | Sync Lipsync 2.0 Pro |

### Lógica de selecção:
- **Viral Pipeline 8s + referenceImageUrl** → `seedance-i2v`
- **Viral Pipeline 8s sem referenceImageUrl** → `seedance-t2v`
- **Dark Pipeline 15s** → `wan26-t2v-flash`
- **Dark Pipeline 10s com personagem** → `wan26-r2v-flash`
- **Dubbing** → `kling-motion-pro`
- **Personagem + narração** → lip-sync automático
- Veo3 mantém-se disponível no edge function como alternativa

---

## 10. BASE DE DADOS (Supabase)

| Tabela | Campos principais | RLS |
|--------|-------------------|-----|
| `profiles` | id, full_name, plan, credits_balance, credits_total_purchased, monthly_budget_eur, language, onboarding_completed | ✅ auth.uid() = id |
| `characters` | id, user_id, original_input, expanded (JSON), status, reference_image_url, elevenlabs_voice_id, locked_at, history | ✅ user_id |
| `conversations` | id, user_id, title, created_at | ✅ user_id |
| `messages` | id, conversation_id, role, content, model_used, cost_eur, image_url | ✅ via conversation.user_id |
| `prompts` | id, user_id, title, content, category | ✅ user_id |
| `projects` | id, user_id, name, data | ✅ user_id |
| `usage_logs` | id, user_id, mode, model, tokens_input, tokens_output, cost_eur | ✅ SELECT only |
| `credit_transactions` | id, user_id, amount, type, description | ✅ SELECT only |
| `model_registry` | id, slug, name, provider, config | ✅ SELECT only (service role write) |

### Storage Buckets:
- `character-references` — imagens de referência + narrations por cena
- `chat-images` — imagens do chat

---

## 11. INTEGRAÇÕES EXTERNAS

| Serviço | Uso | Chave |
|---------|-----|-------|
| fal.ai | Vídeo (Seedance, Veo3, Wan 2.6, Kling) + Lip-sync + Imagem (Flux 2 Pro via generate-image engine:"flux") | `FAL_API_KEY` (Supabase secret) |
| Anthropic Claude | Character expansion, roteiro, cenas (Sonnet/Opus) | `ANTHROPIC_API_KEY` (Supabase secret) |
| Google Gemini | Chat (Flash), TTS, imagem de referência | `GOOGLE_API_KEY` (Supabase secret) |
| ElevenLabs | Voz personalizada (BYOK — chave do utilizador) | localStorage do utilizador |
| Stripe | Pagamentos (checkout, webhook, portal) | `STRIPE_SECRET_KEY` (Supabase secret) |

---

## 12. localStorage KEYS

| Key | Dados | Usado por |
|-----|-------|-----------|
| `savvyowl_dark_pipeline` | step, pipeline, narrationStorageUrl, audioDuration | DarkPipelinePage |
| `savvyowl_tts_voice` | { id, name } da voz TTS seleccionada | DarkPipelinePage |
| `savvyowl-theme` | "dark" / "light" | ThemeProvider |
| `savvyowl-language` | "pt" / "en" / "auto" | i18n |
| `savvyowl-elevenlabs-key` | API key ElevenLabs | useElevenLabsKey |
| `savvyowl-elevenlabs-voice-id` | Voice ID ElevenLabs | useElevenLabsKey |
| `savvyowl-elevenlabs-voice-name` | Nome da voz | useElevenLabsKey |
| `savvyowl-google-key` | API key Google | useGoogleApiKey |

---

## 13. FLUXO DE GERAÇÃO DE VÍDEO (com lip-sync)

```
1. Utilizador define tema → títulos → roteiro
2. Selecciona personagem (Character Engine)
3. Gera narração inteira (ElevenLabs)
4. Gera cenas (Claude Sonnet divide roteiro em DIALOGUE + PROMPT)
5. Áudios por cena gerados em background (ElevenLabs, upload a Supabase Storage)
6. Para cada cena, utilizador clica "Gerar":
   a) Submit ao fal.ai (Seedance 1.5 Pro como motor principal, lip-sync nativo)
   b) Poll até COMPLETED → videoUrl
   c) Se audioUrl existe → submit lip-sync (Sync Lipsync 2.0 Pro)
   d) Poll lip-sync até COMPLETED → lipsyncVideoUrl
   e) Cena final = lipsyncVideoUrl (vídeo com movimentos naturais + voz ElevenLabs)
7. Utilizador faz download de cada cena e junta no CapCut
```

---

## 14. REGRAS DE OURO

1. **NUNCA escrever chaves/tokens em ficheiros do repositório**
2. **NUNCA redeployar a edge function `chat` via Management API** (tem imports esm.sh)
3. **Deploy de edge functions:** sempre DELETE + POST + PATCH verify_jwt=false
4. **Antes de alterar um componente, verificar nesta spec o que ele faz e o que depende dele**
5. **Testar com `npx tsc --noEmit` antes de fazer push**
6. **`identityBlock` depende de `activeCharacter`** — pode ser null após reload (re-selecção automática via useEffect)
7. **Smart identity prepend:** verificar se prompt já contém "FIXED CHARACTER" antes de adicionar
8. **Créditos são deduzidos ANTES de chamar o fal.ai** — se falhar, auto-refund (implementado)
9. **Texto visível ao utilizador NUNCA menciona nomes de modelos IA** (Seedance, Kling, Wan, Veo3, Flux). Usar nomes genéricos (motor de vídeo, motor de dublagem).

---

## 15. i18n — INTERNACIONALIZAÇÃO

**Idiomas suportados:** en, pt, fr, es
**Config:** `src/i18n/index.ts`
**Locales:** `src/i18n/locales/*.json` (um ficheiro por idioma)
**Componente:** `LanguageSelector` — presente em DashboardLayout, Chat, Landing.tsx, Pricing.tsx
**Fallback:** `en`
**Detecção:** localStorage (`savvyowl-language`) > `navigator.language`

---

## 16. PRICING & STRIPE

### Planos:
| Plano | Preço/mês | Créditos/mês |
|-------|-----------|-------------|
| Free | €0 | 10 |
| Starter | €29.99 | 60 |
| Pro | €59.99 | 180 |
| Studio | €119.99 | 500 |

### Packs avulso:
| Pack | Preço | Créditos |
|------|-------|----------|
| S | €4.99 | 50 |
| M | €12.99 | 150 |
| L | €29.99 | 400 |

### Implementação:
- Price IDs do Stripe estão definidos em `SUBSCRIPTION_PRICES` dentro de `stripe-checkout` edge function (NÃO listar aqui)
- `PLAN_CREDITS` no `stripe-webhook` define créditos por plano
- **NOTA:** Actualmente `stripe-webhook` tem starter=150 e pro=500 — ERRADO, precisa ser corrigido para starter=60, pro=180, e adicionar studio=500
