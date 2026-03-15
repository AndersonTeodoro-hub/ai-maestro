

## Diagnóstico

O erro `missing OAuth secret` persiste porque o código actual usa `supabase.auth.signInWithOAuth` directamente — isto exige que o Google provider esteja configurado com Client ID/Secret no runtime de autenticação. Apesar de teres configurado na UI, as credenciais não estão a propagar para o runtime.

**Solução**: O projecto já tem o módulo `@lovable.dev/cloud-auth-js` em `src/integrations/lovable/index.ts` — o sistema gerido que trata do Google OAuth automaticamente sem precisar de secrets configurados. Basta voltar a usar `lovable.auth.signInWithOAuth` em vez de `supabase.auth.signInWithOAuth`.

## Alterações

### `src/pages/Login.tsx`
- Adicionar import: `import { lovable } from "@/integrations/lovable/index"`
- Substituir o `onClick` do botão Google:
```typescript
const { error } = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: "https://savvyowl.app/dashboard",
});
if (error) toast.error(error.message);
```

### `src/pages/Register.tsx`
- Adicionar import: `import { lovable } from "@/integrations/lovable/index"`
- Substituir o `onClick` do botão Google:
```typescript
const { error } = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: planParam === 'pro'
    ? "https://savvyowl.app/register?plan=pro"
    : "https://savvyowl.app/dashboard",
});
if (error) toast.error(error.message);
```

### Porquê funciona
O SDK gerido (`lovable.auth`) usa um broker OAuth próprio que já tem credenciais Google configuradas — não depende do provider Google estar activo no runtime de autenticação do backend. Após o OAuth completar, o SDK chama `supabase.auth.setSession()` para criar a sessão localmente.

