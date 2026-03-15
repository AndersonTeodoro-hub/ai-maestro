

## Fix: redirect_uri_mismatch no Google OAuth

### Causa raiz
A linha `new URL(req.url).origin` dentro da Edge Function **não retorna** `https://hxgwzqtmpqjqhesuolfd.supabase.co`. O runtime do Deno resolve para um URL interno (localhost ou domínio interno), resultando num `redirect_uri` errado enviado ao Google.

### Alteração

**`supabase/functions/google-auth/index.ts`**

Substituir a derivação dinâmica do projectUrl por `SUPABASE_URL` (que é automaticamente disponível nas Edge Functions):

```typescript
// ANTES (linha 33-34):
const projectUrl = new URL(req.url).origin;

// DEPOIS:
const projectUrl = Deno.env.get("SUPABASE_URL")!;
```

Isto faz com que o `callbackUrl` passe a ser:
`https://hxgwzqtmpqjqhesuolfd.supabase.co/functions/v1/google-auth?action=callback`

Que é exactamente o que está (ou deve estar) configurado no Google Cloud Console.

A mesma variável `projectUrl` é usada mais abaixo para criar o Supabase Admin client e para o verify endpoint — ambos também precisam do URL correcto, portanto esta correcção resolve tudo de uma vez.

### Após deploy
Testar o fluxo completo: Login → Google consent → callback → dashboard.

