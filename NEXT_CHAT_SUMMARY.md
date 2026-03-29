# RESUMO PARA PRÓXIMO CHAT — SavvyOwl (29/03/2026)

## REGRA OBRIGATÓRIA ANTES DE QUALQUER COISA
```bash
git clone https://GH_TOKEN_SEE_ANDERSON@github.com/AndersonTeodoro-hub/SavvyOwl.git
cd SavvyOwl
git log --oneline -5
cat NEXT_CHAT_SUMMARY.md
```
Não escreves código sem ter o repo clonado. Não usas PATCH na Management API com imports externos — dá BOOT_ERROR.

---

## ESTADO REAL (confirmado ao vivo 29/03/2026)

### Edge Functions — todas a funcionar ✅ (todas com verify_jwt=false)
| Função | Status | Notas |
|--------|--------|-------|
| chat | ✅ 200 | não tocar — deployada via CLI original |
| character-engine | ✅ 200 | RE-DEPLOYED via Management API (skin_texture + ref image pipeline) |
| generate-image | ✅ 200 | Aceita referenceImageUrl para img2img consistency |
| generate-video | ✅ 200 | Wan 2.6 + Veo3, modelo auto-selecionado por duração |
| generate-voice | ✅ 200 | |
| stripe-checkout | ✅ 200 | |
| stripe-webhook | ✅ (400 OPTIONS = correcto) | |
| youtube-trending | ✅ 200 | |
| optimize | ✅ 200 | |
| delete-account | ✅ 200 | |
| google-auth | ✅ 200 | |

### CRÍTICO: verify_jwt
- **TODAS as 11 funções têm verify_jwt=false** — desativado via Management API PATCH
- Razão: Supabase Auth gera JWTs ES256 (novo formato), mas o gateway edge functions com verify_jwt=true só aceita HS256 → causa 401 "Invalid JWT"
- Cada função que precisa de auth faz validação interna via `/auth/v1/user`
- Se alguma função nova for deployada, SEMPRE fazer PATCH para verify_jwt=false

### Regra crítica de deploy
- Funções com `Deno.serve()` + `fetch` nativo → funcionam (todas)
- `chat` e `character-engine` foram originalmente deployadas via CLI mas character-engine foi RE-DEPLOYED via Management API (DELETE+POST) nesta sessão
- **Nunca usar PATCH com body** — corrompe a função. Se falhar, DELETE + POST fresh
- **PATCH só para verify_jwt**: `PATCH /functions/{slug}` com `{"verify_jwt": false}`

---

## O QUE FOI FEITO NESTA SESSÃO (29/03/2026)

### ✅ Fix 401 Loop — Causa Raiz Real
- **Problema**: Supabase Auth gera JWTs com algoritmo ES256, edge function gateway com verify_jwt=true rejeita com "Invalid JWT"
- **Solução**: Desativado verify_jwt em TODAS as 11 functions via Management API PATCH
- **Confirmado**: character-engine responde HTTP 200 com token real

### ✅ Credit Packs na SettingsPage
- 3 packs (S/M/L) com botões de compra directa no dashboard
- Pack S: €4.99 / 50 créditos | Pack M: €12.99 / 150 créditos | Pack L: €29.99 / 400 créditos
- Usa stripe-checkout com action "buy-credits"

### ✅ Skin Texture System (Age-Coherent)
- Novo campo `skin_texture` no `CharacterFace` type
- Character Engine expansion prompt com 5 age brackets (18-24, 25-34, 35-44, 45-54, 55+)
- Cada bracket define: pore density, texture zones, fine lines, sun damage, elasticity
- Injetado no identity block para todas as gerações
- Negative prompt reforçado com anti-smooth-skin terms
- Testado: personagem 28 anos gera "T-zone pores, early nasolabial hints, under-eye texture"

### ✅ Reference Frame Pipeline (Fase 1)
- **Character Engine LOCK** agora auto-gera imagem de referência canónica via Gemini
- Imagem armazenada em Supabase Storage bucket `character-references` (público)
- URL salvo em `characters.reference_image_url` (nova coluna)
- **generate-image**: aceita `referenceImageUrl`, envia ao Gemini como visual anchor (img2img)
- **generate-video**: aceita `referenceImageUrl`, passa ao fal.ai como image_url
- **CharacterContext**: carrega e propaga `referenceImageUrl` para todos os componentes
- **Testado end-to-end**: expand → lock → imagem gerada → stored → HTTP 200 acessível

### ✅ Wan 2.6 Video Models
- 7 modelos no backend: Veo3 (fast/standard), Wan 2.6 (T2V/I2V/R2V, standard/flash), Kling
- Créditos dinâmicos por modelo (5-15)
- Frontend simplificado: utilizador escolhe apenas **8s** ou **15s**
  - 8s → Veo3 Fast (10 créditos)
  - 15s sem ref → Wan 2.6 T2V Flash (5 créditos)
  - 15s com ref → Wan 2.6 R2V Flash (7 créditos)

### ✅ Branding Cleanup
- Removidas TODAS as referências a AI backends do frontend: Veo3, Wan, Gemini, fal.ai, Midjourney, DALL-E, Leonardo AI, Flux, Runway, HeyGen, Sora, Nano Banana, Kling, NanoBanana
- Tudo é "SavvyOwl" para o utilizador
- Nomes internos mantidos no código (não visíveis ao user)

### ✅ Vercel Duplicate Project
- Identificado `ai-maestro-4jnd` como duplicado (consome build minutes em dobro)
- Anderson instruído a eliminar via Settings → Delete Project
- Manter apenas `ai-maestro` (domínio savvyowl.app)

### ✅ fal.ai Créditos
- Anderson carregou $20 em fal.ai/dashboard/billing
- Saldo confirmado: $20.00

---

## O QUE FALTA (por ordem de prioridade)

### 🔴 Canal Dark Pipeline Pro
- Pipeline wizard passo-a-passo: Tema → Títulos → Roteiro → Personagem → Cenário → Cenas → Gerar/Exportar
- Em discussão: formato (página dedicada vs template no chat)
- Precisa de decisão do Anderson antes de implementar

### 🟡 Testar fluxo completo em produção
- Registo → 10 créditos → gerar imagem → crédito descontado → confirmado
- Character: expand → lock (ref image auto-generated) → gerar imagem com ref → consistência visual
- Vídeo: gerar 8s e 15s, confirmar que ambos funcionam

### 🟡 Fase 2 — Multi-angle Reference Pack
- Gerar 3-4 ângulos canónicos do personagem (frontal, perfil, três-quartos, corpo)
- Sistema escolhe ângulo adequado por tipo de cena

### 🟡 Fase 3 — Consistency Scoring
- Comparar imagem gerada com referência via Gemini Vision
- Auto-regenerar se semelhança for baixa

### 🟠 Onboarding flow
- Guia de primeiros passos após registo

---

## INFRA

### Supabase
- Project ID: `kumnrldlzttsrgjlsspa`
- URL: `https://kumnrldlzttsrgjlsspa.supabase.co`
- Região: EU West (Ireland)
- Storage: buckets `chat-images` (private), `character-references` (public)
- DB: `characters.reference_image_url` column adicionada

### Git
- Repo: `https://github.com/AndersonTeodoro-hub/SavvyOwl`
- Branch: main
- Último commit: `04a710f` — brand: remove all AI backend names

### Live App
- URL: `https://savvyowl.app`
- Deploy: Vercel auto-deploy no push para main
- Projeto Vercel: `ai-maestro` (eliminar `ai-maestro-4jnd`)

### Tokens (Anderson fornece no início de cada sessão)
- GitHub, Supabase Management API token
- APIs (Google, Anthropic, Stripe, fal.ai) nos secrets do Supabase

### Key Management API patterns
- Function deploy: DELETE then POST to `https://api.supabase.com/v1/projects/{project}/functions`
- verify_jwt patch: PATCH same endpoint with `{"verify_jwt": false}`
- Schema changes: POST to `https://api.supabase.com/v1/projects/{project}/database/query`
- Storage: bucket `character-references` (public)
- JWT for OAuth users: POST `/auth/v1/admin/generate_link` → curl action_link → extract access_token
