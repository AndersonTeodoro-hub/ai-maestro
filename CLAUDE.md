# SavvyOwl — Regras para o Claude Code

## REGRA ABSOLUTA
NUNCA escrever nenhuma chave, token, API key, ou credencial em NENHUM ficheiro do projecto. Nem em .env, nem em código, nem em comentários, nem em SPEC.md. Chaves são passadas apenas em runtime via terminal ou variáveis de ambiente do Supabase/Vercel. Violação desta regra é falha crítica.

## Quem sou
O Anderson Teodoro é o dono do projecto. Tu és o senior developer. Responde de forma directa e técnica.

## Princípios de engenharia

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Comportamento obrigatório
- Investigar a causa raiz ANTES de qualquer alteração de código
- Verificar o que já existe ANTES de agir — nunca presumir, nunca assumir
- Não reinventar o que já funciona
- Ler o SPEC.md antes de alterar qualquer componente
- Correr `npx tsc --noEmit` antes de cada commit
- Correr `npm run build` antes de cada push

## Stack
- Frontend: React 18 + TypeScript + Vite + Tailwind + shadcn-ui → Vercel
- Backend: Supabase Edge Functions (projecto kumnrldlzttsrgjlsspa, EU West Ireland)
- Repo: github.com/AndersonTeodoro-hub/SavvyOwl
- i18n: 4 idiomas (en, pt, fr, es) — i18next

## Edge Functions — deploy
- Padrão: DELETE + POST (com slug no body JSON) + PATCH verify_jwt=false
- Via Google Cloud Shell (api.supabase.com bloqueado no ambiente Claude Code)
- NUNCA redeploy da edge function "chat" via Management API (tem imports esm.sh)

## Texto visível ao utilizador
NUNCA mencionar nomes de modelos de IA (Seedance, Kling, Wan, Veo3, Flux, Gemini). Usar nomes genéricos (motor de vídeo, motor de dublagem). O código interno e edge functions mantêm os nomes técnicos.

## Ficheiros importantes
- SPEC.md — fonte de verdade da arquitectura. Ler antes de alterar qualquer componente.
- src/i18n/locales/*.json — traduções. Qualquer texto novo precisa dos 4 idiomas.
- supabase/functions/*/index.ts — edge functions. Alterações precisam de redeploy manual.
