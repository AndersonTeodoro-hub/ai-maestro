

## Google OAuth via Edge Function Custom

### Problema
O `lovable.auth.signInWithOAuth` dá 404 (broker não disponível) e o `supabase.auth.signInWithOAuth` dá 400 (provider não configurado no runtime). A solução é uma edge function custom que faz o fluxo OAuth completo.

### Ficheiros a criar/alterar

**1. `supabase/functions/google-auth/index.ts`** (novo)
- Dois fluxos via query param `action`:
  - `action=login` (default): Gera `state` (contém `redirect_uri` original + nonce CSRF), redireciona para Google consent screen com `GOOGLE_CLIENT_ID`
  - `action=callback`: Recebe `?code=...&state=...`, troca code por tokens via Google token endpoint usando `GOOGLE_CLIENT_SECRET`, obtém userinfo (email, nome), usa Supabase Admin API (`SUPABASE_SERVICE_ROLE_KEY`) para criar/encontrar user e gerar session, redireciona para frontend com `access_token` e `refresh_token` no URL hash
- O `state` parameter codifica o `redirect_uri` original (para suportar `/register?plan=pro`)
- Secrets usados: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`

**2. `supabase/config.toml`** - Adicionar:
```toml
[functions.google-auth]
verify_jwt = false
```

**3. `src/pages/Login.tsx`**
- Remover import do `lovable`
- Botão Google redireciona para edge function:
```typescript
window.location.href = `https://hxgwzqtmpqjqhesuolfd.supabase.co/functions/v1/google-auth?redirect_uri=${encodeURIComponent("https://savvyowl.app/dashboard")}`;
```

**4. `src/pages/Register.tsx`**
- Igual, com redirect_uri condicional para `plan=pro`:
```typescript
const redirectUri = planParam === 'pro' 
  ? "https://savvyowl.app/register?plan=pro" 
  : "https://savvyowl.app/dashboard";
window.location.href = `https://hxgwzqtmpqjqhesuolfd.supabase.co/functions/v1/google-auth?redirect_uri=${encodeURIComponent(redirectUri)}`;
```

**5. `src/contexts/AuthContext.tsx`**
- No `useEffect` inicial, antes do `getSession()`, detectar tokens no URL hash (`#access_token=...&refresh_token=...`)
- Se encontrar, chamar `supabase.auth.setSession({ access_token, refresh_token })` e limpar o hash
- Isto garante que a sessão é estabelecida antes de qualquer redirect

**6. `src/App.tsx`**
- Adicionar rota `/auth/callback` que renderiza um componente simples de loading (para o caso do redirect do Google cair nessa rota)

### Secrets necessários
- `GOOGLE_CLIENT_ID` - tu vais adicionar via Secrets
- `GOOGLE_CLIENT_SECRET` - tu vais adicionar via Secrets
- `SUPABASE_SERVICE_ROLE_KEY` - já existe

### Fluxo completo
```text
Browser → Edge Function (redirect to Google)
Google → Edge Function (callback with code)
Edge Function → Google (exchange code for tokens)
Edge Function → Google (get user info)
Edge Function → Supabase Admin (create/signin user)
Edge Function → Browser (redirect with session tokens in hash)
Browser → AuthContext (detect hash, setSession, navigate)
```

### Segurança
- Client ID e Secret apenas no servidor (edge function)
- CSRF via state parameter com nonce
- Tokens no URL hash (não ficam em server logs)
- state codifica redirect_uri para preservar contexto (plan=pro)

