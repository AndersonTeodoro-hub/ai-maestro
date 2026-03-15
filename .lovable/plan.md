
Objetivo: resolver definitivamente o erro 400 `Unsupported provider: missing OAuth secret` no login Google.

Diagnóstico confirmado (já verificado):
1. Código atual está correto para OAuth direto:
   - `src/pages/Login.tsx` usa `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://savvyowl.app/dashboard' } })`.
   - `src/pages/Register.tsx` idem com `redirectTo` condicional para `plan=pro`.
2. Logs de autenticação continuam a mostrar:
   - `GET /authorize` → `400 Unsupported provider: missing OAuth secret`.
3. Query pedida executada:
   - `SELECT * FROM auth.flow_state;` retornou `[]` (vazio).
4. `auth.flow_state` não é tabela de configuração de provider; é estado temporário de fluxo OAuth.
5. Não há sinais de login Google concluído:
   - `auth.identities` só tem `provider = email` (nenhum `google`).

O que falta para funcionar:
- O provider Google não está ativo no runtime de autenticação (ou a configuração BYOK não propagou corretamente), apesar de estar marcado na UI.

Plano de execução:
1. Reaplicar configuração do Google provider na UI (forçar refresh de config):
   - Em Authentication Settings → Google:
     - desligar “Your own credentials” e salvar;
     - ligar novamente “Your own credentials”;
     - colar Client ID e Client Secret novamente;
     - salvar.
2. Validar URLs de redirect/allowlist no backend:
   - garantir `https://savvyowl.app` e `https://savvyowl.app/dashboard` permitidos para redirecionamento.
3. Confirmar propagação:
   - testar novo clique em “Entrar com Google”;
   - verificar logs `/authorize` (não pode mais aparecer `missing OAuth secret`).
4. Se continuar a falhar:
   - trocar temporariamente para credenciais geridas automaticamente (managed) para restabelecer login imediato;
   - abrir incidente de plataforma com evidências: timestamps + `request_id` dos logs `/authorize`.
5. Segurança:
   - como o Client Secret foi exposto no chat, rotacionar esse secret no Google Cloud após estabilizar o login.

Detalhe técnico importante:
- Não existe caminho SQL confiável para “ativar provider Google” no auth runtime via `auth.flow_state`.
- Esse tipo de configuração é de serviço de autenticação (control plane), não de dados de aplicação; por isso o ajuste correto é via Authentication Settings (e, em caso de falha de propagação, suporte de plataforma), não por SQL de tabela de estado.
