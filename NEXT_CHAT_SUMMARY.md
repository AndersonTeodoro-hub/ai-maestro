# RESUMO PARA PRÓXIMO CHAT - SavvyOwl (28/03/2026)

## ESTADO: CREDITS + VERTEX AI PIPELINE IMPLEMENTADOS — A AGUARDAR SA JSON DO GCP

---

### O QUE FOI FEITO NESTA SESSÃO

#### ✅ Sistema de Créditos (Prioridade 2 — COMPLETO)
- DB: `credits_balance INTEGER DEFAULT 10` e `credits_total_purchased` adicionados à tabela `profiles`
- Tabela `credit_transactions` criada (audit trail de todas as movimentações)
- Utilizadores existentes receberam 10 créditos gratuitos
- Custos: **1 crédito = imagem**, **10 créditos = vídeo**
- Stripe webhook atualizado para top-up automático em:
  - `checkout.session.completed` → plano subscription ou credit pack
  - `invoice.paid` (billing_reason=subscription_cycle) → renovação mensal
  - `customer.subscription.updated` → mudança de plano
  - `customer.subscription.deleted` → downgrade para free (10 créditos)
- Plan credits: Free=10, Starter=200, Pro=1000
- `Profile` type no AuthContext atualizado com `credits_balance` e `credits_total_purchased`
- SettingsPage: card "Créditos SavvyOwl" com saldo, custos, e CTA de upgrade

#### ✅ Vertex AI Pipeline (Prioridade 1 — CODE READY, aguarda SA JSON)
- `generate-image`: JWT SA → Vertex Imagen 3 (`imagen-3.0-generate-002`) com fallback Gemini
- `generate-video`: JWT SA → Vertex Veo3 (`veo-3.0-generate-preview`) com fallback Gemini (user key)
- Autenticação: Service Account JSON → JWT → OAuth2 token exchange implementado
- `VERTEX_PROJECT_ID` secret: fallback para `gen-lang-client-0464073001`
- Quando `VERTEX_SERVICE_ACCOUNT_JSON` não está presente → usa Gemini server key

#### ✅ UI Buttons Atualizados
- `GenerateImageButton`: mostra créditos restantes, erro `insufficient_credits`, CTA para Settings
- `GenerateVideoButton`: idem + suporta geração sem user API key (via Vertex quando SA presente)

#### ✅ Deployments
- Commit `07d7a15` no GitHub (Vercel auto-deploya)
- 3 edge functions re-deployadas via Management API: `generate-image`, `generate-video`, `stripe-webhook`

---

### ❗ O QUE FALTA PARA FECHAR PRIORIDADE 1

**Precisa do Service Account JSON do GCP:**
1. console.cloud.google.com → projeto "Default Gemini Project" (gen-lang-client-0464073001)
2. IAM & Admin → Service Accounts → "Create Service Account"
   - Nome: `savvyowl-vertex`
   - Role: **Vertex AI User** + **AI Platform Developer**
3. Keys → Add Key → JSON → download
4. Colar o JSON no próximo chat → Claude faz `supabase secrets set VERTEX_SERVICE_ACCOUNT_JSON`

**Também falta:**
- `STRIPE_WEBHOOK_SECRET` no Supabase secrets (necessário para webhook funcionar)
  - Obtém em: Stripe Dashboard → Developers → Webhooks → endpoint → Signing secret
  - Endpoint URL: `https://kumnrldlzttsrgjlsspa.supabase.co/functions/v1/stripe-webhook`

---

### O QUE FUNCIONA (confirmado deployado)
- ✅ Chat (4 modos: Quick/Deep/Creator/Opus)
- ✅ Gemini Flash (fallback Anthropic quando Google 403)
- ✅ Character Engine backend + UI
- ✅ CharacterContext global (identity lock nos 6 templates + botões)
- ✅ Sistema de créditos (DB + edge functions + UI)
- ✅ Stripe checkout + webhook (falta STRIPE_WEBHOOK_SECRET para validar assinaturas)
- ✅ Login email + Google OAuth
- ⚠️ Vertex AI: código pronto, aguarda VERTEX_SERVICE_ACCOUNT_JSON no Supabase

### O QUE NÃO FUNCIONA / FALTA
- ❌ VERTEX_SERVICE_ACCOUNT_JSON não está nos secrets → imagens/vídeos ainda usam Gemini server key (com risco de 403)
- ❌ STRIPE_WEBHOOK_SECRET não está nos secrets → webhook falha na validação de assinatura
- ⚠️ Onboarding flow não existe
- ⚠️ img2vid com imagem de referência do Character ainda não implementado

---

### SUPABASE
- Project ID: kumnrldlzttsrgjlsspa
- URL: https://kumnrldlzttsrgjlsspa.supabase.co
- 11 edge functions deployed

### GIT
- Repo: https://github.com/AndersonTeodoro-hub/SavvyOwl
- Branch: main
- Último commit: 07d7a15 feat: credits system + Vertex AI pipeline
