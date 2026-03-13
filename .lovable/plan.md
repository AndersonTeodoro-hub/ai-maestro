

## Plano de Execução: Resolver 7 problemas pendentes (item 7 mantido como está)

### 1. Traduções — `manageSubscription` + Chat optimization + Onboarding step 3
Adicionar nos 4 locales (`en.json`, `pt.json`, `fr.json`, `es.json`):

**settings:**
- `manageSubscription`: EN "Manage Subscription" / PT "Gerir Subscrição" / FR "Gérer l'Abonnement" / ES "Gestionar Suscripción"

**chat (novas chaves):**
- `optimizedBy`, `modelUsed`, `taskType`, `estimatedSavings`, `viewOptimizedPrompt`

**onboarding (novas chaves):**
- `starterPrompt1` a `starterPrompt6` (os 6 prompts do step 3 traduzidos)

### 2. Chat.tsx — substituir hardcoded strings (linhas 217-245)
Substituir "Optimizado pelo PromptOS", "Modelo usado", "Tipo de tarefa", "Poupança estimada", "Ver prompt otimizado" por `t("chat.xxx")`.

### 3. OnboardingModal.tsx — substituir step 3 hardcoded (linhas 77-82)
Substituir os 6 textos ingleses por `t("onboarding.starterPromptX")`.

### 4. chat-stream.ts — usar JWT do utilizador
Adicionar parâmetro `accessToken` à função `streamChat`. Usar `Authorization: Bearer ${accessToken}` em vez de `VITE_SUPABASE_PUBLISHABLE_KEY`. Adicionar header `apikey` com a anon key para que o gateway aceite o request.

No `Chat.tsx`, obter `session.access_token` via `supabase.auth.getSession()` e passá-lo ao `streamChat`.

### 5. Delete Account — edge function real
Criar `supabase/functions/delete-account/index.ts`:
- Validar JWT, extrair user_id
- Eliminar dados das tabelas: messages, conversations, prompts, usage_logs, profiles
- Chamar `supabase.auth.admin.deleteUser(userId)`
- Retornar sucesso

Registar em `supabase/config.toml`: `[functions.delete-account]` com `verify_jwt = false`.

Atualizar `SettingsPage.tsx` `handleDeleteAccount`: invocar a edge function, depois signOut.

### 6. Stripe checkout — corrigir URLs
Em `stripe-checkout/index.ts`:
- Linha 67: `/settings?checkout=success` → `/dashboard/settings?checkout=success`
- Linha 68: `/settings?checkout=cancel` → `/dashboard/settings?checkout=cancel`
- Linha 91: `/settings` → `/dashboard/settings`

### 7. Google Fonts — mover para index.html
Remover as linhas 56-61 de `Landing.tsx` (os `<link>` de Google Fonts).
Adicionar os mesmos `<link>` no `<head>` de `index.html`.

### Ficheiros alterados
| Ficheiro | Tipo |
|----------|------|
| `src/i18n/locales/en.json` | +11 chaves |
| `src/i18n/locales/pt.json` | +11 chaves |
| `src/i18n/locales/fr.json` | +11 chaves |
| `src/i18n/locales/es.json` | +11 chaves |
| `src/pages/Chat.tsx` | i18n + accessToken |
| `src/components/OnboardingModal.tsx` | i18n step 3 |
| `src/lib/chat-stream.ts` | aceitar accessToken |
| `src/pages/SettingsPage.tsx` | delete account real |
| `supabase/functions/delete-account/index.ts` | novo |
| `supabase/functions/stripe-checkout/index.ts` | corrigir URLs |
| `supabase/config.toml` | registar delete-account |
| `index.html` | Google Fonts no head |
| `src/pages/Landing.tsx` | remover font links do JSX |

### Item 7 (cores hardcoded) — mantido como está, conforme solicitado.

