# RESUMO PARA PRÓXIMO CHAT - SavvyOwl (24/03/2026)

## PROBLEMAS ACTUAIS (URGENTES)

### 1. Lovable destruiu system prompts do chat
O commit `ef2a46e` (Lovable "remove Lovable dependency") simplificou 
drasticamente os system prompts na edge function `chat/index.ts`.
- Removeu detalhes sobre workflow image→video→edit
- Removeu profundidade dos prompts de creator  
- Removeu especificações de ferramentas
- **ACÇÃO**: Restaurar system prompts completos de antes do commit do Lovable

### 2. Botão copiar não aparece nos code blocks
O botão tem `opacity-0 group-hover/code:opacity-100` que pode ser 
invisível em mobile/touch. Precisa de ser sempre visível ou ter fallback.
- Ficheiro: `src/pages/Chat.tsx` linha ~406-412
- **ACÇÃO**: Tornar botão copiar sempre visível (remover opacity-0)

### 3. Tela branca ao modelar vídeo viral
Provavelmente um runtime error no JavaScript. O build compila sem erros
mas pode crashar no browser. Possíveis causas:
- youtube-trending retorna erro silencioso
- Algum campo undefined no template
- **ACÇÃO**: Adicionar error boundary ou try-catch no componente

### 4. Geração de cenas não aparece
Pode estar relacionado com o ponto 1 (system prompts simplificados)
que perderam as instruções de gerar cenas em code blocks.
- **ACÇÃO**: Restaurar system prompts resolve isto

## BILLING GOOGLE (RESOLVIDO?)
Anderson disse que criou conta billing. Verificar se as edge functions
agora funcionam com a nova key.
- GOOGLE_API_KEY no Supabase secrets
- YOUTUBE_API_KEY no Supabase secrets

## FICHEIROS-CHAVE
- `/home/claude/SavvyOwl/supabase/functions/chat/index.ts` - ALTERADO pelo Lovable, precisa restaurar
- `/home/claude/SavvyOwl/src/pages/Chat.tsx` - botão copiar
- `/home/claude/SavvyOwl/src/components/StructuredTemplates.tsx` - 10 templates
- `/home/claude/SavvyOwl/src/pages/Landing.tsx` - landing redesenhada (OK)
- `/home/claude/SavvyOwl/src/pages/SettingsPage.tsx` - settings com ElevenLabs (OK)

## O QUE FUNCIONA
- Landing page nova (Features, Tutorial, Security, FAQ)
- Login/Registo persistente
- 10 templates estruturados (código OK, mas prompts do chat foram simplificados)
- Sidebar collapsible
- Analytics sem "gemini"
- Referral program
- ElevenLabs integration (BYOK)
- Gemini TTS integration (precisa billing)
- Veo3 integration (precisa billing)
- Nano Banana integration (precisa billing)

## EDGE FUNCTIONS PARA DEPLOY
chat, youtube-trending, generate-image, generate-video, generate-voice

## GIT
Repo: https://github.com/AndersonTeodoro-hub/SavvyOwl
Branch: main
Último commit nosso: 9f31269
Commits do Lovable depois: ef2a46e, 7f10d3e

## ACÇÃO IMEDIATA NO PRÓXIMO CHAT
1. Restaurar system prompts do chat (reverter alterações do Lovable)
2. Tornar botão copiar visível em mobile
3. Investigar tela branca no viral modeling
4. Testar geração de imagem/vídeo/voz com billing activo
5. Deploy de todas as edge functions
