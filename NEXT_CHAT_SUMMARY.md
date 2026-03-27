# RESUMO PARA PRÓXIMO CHAT - SavvyOwl (27/03/2026)

## ESTADO: CHARACTER ENGINE INTEGRADO — A AGUARDAR TESTE DO ANDERSON

### ARQUITECTURA DO PIPELINE DE CONSISTÊNCIA

```
CharacterContext (global)
    ├── CharacterSelector (dropdown no chat)
    ├── Chat.tsx (envia characterBlock ao backend)
    ├── StructuredTemplates (injeta identity block nos 6 templates de cena)
    ├── GenerateImageButton (injeta identity + negative no prompt do Nano Banana)
    └── GenerateVideoButton (injeta identity no prompt do Veo3)
            │
            ▼
    Edge function chat/index.ts
    (5 regras críticas no system prompt para a IA usar identity block)
            │
            ▼
    Nano Banana / Veo3 (recebem prompt com identity lock completo)
```

### FICHEIROS MODIFICADOS
1. `src/contexts/CharacterContext.tsx` — NOVO: contexto React global
2. `src/App.tsx` — CharacterProvider envolvendo rotas
3. `src/components/CharacterSelector.tsx` — reescrito (sem props, usa contexto)
4. `src/components/GenerateImageButton.tsx` — buildFinalPrompt() injeta identity + negative
5. `src/components/GenerateVideoButton.tsx` — injeta identity automaticamente
6. `src/components/StructuredTemplates.tsx` — 6 templates com injeção automática
7. `src/pages/Chat.tsx` — migrado para useCharacter()
8. `supabase/functions/chat/index.ts` — 5 regras de identity lock no system prompt

### TEMPLATES COM IDENTITY LOCK AUTOMÁTICO
- scene-generator, dark-channel, viral-pipeline, viral-modeling, veo3-video, ugc-influencer
- Todos removeram: campo manual "character", "PROMPT NEGATIVO" separado, "BLOCO DE CONSISTÊNCIA" separado
- Banner verde quando personagem ativo, banner amarelo quando sem personagem

### O QUE PRECISA SER TESTADO
1. Criar personagem → expandir → lock
2. No chat, selecionar personagem no dropdown
3. Usar template de cena → verificar banner verde
4. Gerar conteúdo → verificar que code blocks incluem identity block + negative juntos
5. Clicar "Gerar Imagem" num code block → verificar consistência visual
6. Testar SEM personagem → verificar que tudo funciona normalmente

### O QUE FUNCIONA
- ✅ Chat (4 modos: Quick/Deep/Creator/Opus)
- ✅ Gemini Flash (fallback Anthropic quando Google 403)
- ✅ Nano Banana — COM identity lock automático
- ✅ Gemini TTS
- ✅ 10 templates estruturados — COM identity lock automático
- ✅ Viral video modeling — COM identity lock automático
- ✅ Character Engine backend (expand, refine, lock, unlock)
- ✅ Character Engine UI (CharactersPage)
- ✅ CharacterContext global
- ✅ Login email + Google OAuth
- ✅ Sidebar com Characters

### O QUE NÃO FUNCIONA / FALTA
- ⚠️ Google API Key dá 403 do servidor (fallback Anthropic ativo)
- ⚠️ Stripe não testado end-to-end
- ⚠️ Onboarding flow não existe
- ⚠️ Imagem de referência do CharactersPage ainda não usada como ref frame no Veo3 (img2vid)

### SUPABASE
- Project ID: kumnrldlzttsrgjlsspa
- URL: https://kumnrldlzttsrgjlsspa.supabase.co
- 11 edge functions deployed (chat atualizada)

### GIT
- Repo: https://github.com/AndersonTeodoro-hub/SavvyOwl
- Branch: main
- Último commit: fix templates separate negative/consistency blocks
