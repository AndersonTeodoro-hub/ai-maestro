# SavvyOwl — Estado do Projeto (29/03/2026 Final)

## PROBLEMAS CRÍTICOS POR RESOLVER

### 1. Character Engine NÃO está a ser usado na geração de vídeo
- O personagem (Pastor Gabriel Mendonça) foi criado e expandido no Character Engine
- Tem reference_image_url guardado no DB
- MAS o generate-video NÃO envia a identidade do personagem no prompt
- O Wan 2.6 T2V gera pessoas aleatórias que não se parecem com o pastor criado
- **Fix necessário:** O prompt enviado ao fal.ai precisa incluir a descrição completa do personagem (do expanded JSON) + a reference image

### 2. Vídeo gerado em inglês (prompt está em inglês)
- O roteiro é em português do Brasil
- Mas os prompts de cena gerados pelo Claude são em inglês
- O Wan 2.6 interpreta o prompt em inglês e gera áudio/texto em inglês
- **Fix necessário:** Os prompts de cena devem ser em português OU desactivar áudio nativo do Wan 2.6

### 3. Cenário não corresponde ao prompt
- Os prompts de cena descrevem cenários específicos mas o vídeo gerado não corresponde
- Prompts de cena são muito curtos/genéricos — precisam de ser mais detalhados

### 4. Formato do vídeo pode não corresponder ao selecionado
- Precisa de verificar se aspect_ratio está a ser passado correctamente ao fal.ai

### 5. Cena 2 mostra "7 créditos" quando T2V devia ser 5
- A lógica de custo pode estar errada — verificar modelo selecionado

## O QUE FUNCIONA (CONFIRMADO)

### Geração de vídeo — submit+poll architecture
- **CONFIRMADO**: O submit+poll funciona. Teste real gerou vídeo em 70 segundos
- URL de teste: https://v3b.fal.media/files/b/0a9427fa/9UBfl94DFECDy31Bd2c47_dxqK85bK.mp4
- **ROOT CAUSE do problema anterior**: O URL de polling estava errado
  - Código usava: `queue.fal.run/{model}/requests/{id}/status` → HTTP 405
  - Correcto: usar `status_url` e `response_url` retornados pelo fal.ai no submit
- Edge function `generate-video` agora retorna `statusUrl` e `responseUrl` no submit
- Frontend (DarkPipelinePage + GenerateVideoButton) faz polling com esses URLs

### Narração com ElevenLabs
- Character voice ID é detectado quando personagem é selecionado
- Narração gerada com a voz do personagem (ElevenLabs)
- Duração do áudio capturada → scene count auto-calculado

### Estado persiste com F5
- Pipeline state guardado em localStorage
- Botão "Novo Projeto" para limpar

### Voice prompt generator
- Gera prompt limpo para ElevenLabs Voice Design (<500 chars)
- Instruções separadas do prompt
- URL corrigido: elevenlabs.io/app/voice-design

## STACK TÉCNICA

- **Frontend**: React/TypeScript + Vite, Vercel (savvyowl.app), auto-deploy on push
- **Backend**: Supabase project `kumnrldlzttsrgjlsspa` (EU West Ireland)
- **AI Video**: fal.ai — Wan 2.6 T2V (`wan/v2.6/text-to-video`), Veo3 Fast (`fal-ai/veo3/fast`)
- **AI Image**: Google Gemini
- **AI Voice**: ElevenLabs (user API key) + Google TTS (built-in)
- **AI Text**: Anthropic Claude (character expansion, script, scene prompts)
- **Payments**: Stripe live (Starter €14.99/mo, Pro €34.99/mo, Packs S/M/L)
- **Repo**: https://github.com/AndersonTeodoro-hub/SavvyOwl

## CREDENCIAIS E TOKENS

- **Supabase Project**: kumnrldlzttsrgjlsspa
- **Supabase Management API**: sbp_57db5a474a9a9f6a462dd4e144ab8a61e02751fa
- **Anderson User ID**: 2652f4ca-8413-4ce9-bfed-07c0be76b987 (anderson.lteodoro1@gmail.com, plan: starter)
- **Test User**: 620cddf1-bb09-4e65-a469-c1630853453c (andersonteodoroddn@gmail.com, plan: free)
- **fal.ai key**: stored in Supabase secrets as FAL_API_KEY (69 chars, starts with f43e5187)
- **Créditos Anderson**: 150 (restaurados após testes falhados)

## EDGE FUNCTIONS (11 total, all verify_jwt=false)

Deployed via Management API (DELETE+POST pattern):
- generate-video (submit+poll architecture)
- generate-image
- generate-voice
- character-engine (deployed via CLI originally, re-deployed via API)
- chat (CLI deployed — DO NOT redeploy via API, has esm.sh imports)
- stripe-checkout
- stripe-webhook
- check-limits
- check-subscription
- get-credits
- init-credits

## CHAVE DE DECISÕES

- **Lip-sync desativado**: Áudio inteiro de 2-5min não pode ser enviado a cenas de 15s. Precisa de audio splitting (FFmpeg) por cena. Desactivado por agora — users juntam no CapCut
- **T2V vs I2V vs R2V**: Usando T2V (sem referência) por enquanto. I2V precisa de image_url (singular). R2V precisa de video_urls + image_urls (arrays) + "Character1" no prompt
- **Wan 2.6 endpoints**: T2V e I2V NÃO têm variante /flash. Só R2V tem /flash
- **Polling URLs**: Usar status_url e response_url do submit response do fal.ai (não construir manualmente)

## PRÓXIMOS PASSOS PRIORITÁRIOS

1. **CRÍTICO**: Injectar identidade do personagem nos prompts de cena — sem isto o Character Engine é inútil
2. **CRÍTICO**: Prompts de cena em português (ou desactivar áudio nativo do Wan 2.6)
3. **IMPORTANTE**: Testar I2V com reference image para consistência visual
4. **IMPORTANTE**: Melhorar qualidade dos prompts de cena (mais detalhados, cinematográficos)
5. **FUTURO**: Audio splitting para lip-sync por cena
6. **FUTURO**: Remotion para montagem final automática

## PADRÕES TÉCNICOS

- Edge function deploy: DELETE + POST to Management API
- verify_jwt: PATCH separately with {"verify_jwt": false}
- Auth pattern: Use `user` from AuthContext, not getSession()
- Datacenter IP blocking: Vertex AI with Service Account resolves Google API 403s
- Diagnosis before solutions: Anderson requires confirmed working before deploying
- Never write credentials into repo files
