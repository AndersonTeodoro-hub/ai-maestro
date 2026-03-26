# RESUMO PARA PRÓXIMO CHAT - SavvyOwl (26/03/2026)

## PROBLEMA PRIORITÁRIO — PIPELINE DE CONSISTÊNCIA

O Character Engine existe mas NÃO está integrado nos templates de geração.
Resultado: cada cena gera uma pessoa completamente diferente. O negative prompt
aparece separado do prompt principal com botão "Gerar Imagem" próprio (errado).

### O QUE PRECISA SER FEITO (URGENTE):
1. Templates de cenas (Scene Generator, Viral Pipeline, Dark Channel) devem 
   OBRIGAR seleção de personagem locked ANTES de gerar
2. O identity block do personagem deve ser INJETADO automaticamente em cada 
   prompt VEO3/Nano Banana gerado pela IA
3. Negative prompt deve vir JUNTO do prompt principal (não como bloco separado 
   com botão de gerar imagem próprio)
4. Os botões "Gerar Imagem" e "Gerar Vídeo" nos code blocks devem incluir 
   automaticamente o identity block do personagem ativo
5. A imagem de referência gerada na CharactersPage deve poder ser usada como 
   reference frame no Veo3

### FLUXO CORRETO (a implementar):
1. Utilizador cria personagem → expande → aprova → LOCK
2. Ao usar qualquer template de geração, o personagem locked é selecionado
3. A IA recebe o identity block no system prompt 
4. TODOS os prompts gerados incluem o identity block automaticamente
5. O botão "Gerar Imagem" injeta identity block + negative prompt juntos
6. O botão "Gerar Vídeo" injeta identity block + referência de imagem

### FICHEIROS A MODIFICAR:
- src/components/StructuredTemplates.tsx — templates precisam de seletor de personagem
- src/components/GenerateImageButton.tsx — precisa receber identity block + negative
- src/components/GenerateVideoButton.tsx — precisa receber identity block + ref image
- src/pages/Chat.tsx — o characterBlock já é passado ao chat, mas não aos botões
- supabase/functions/chat/index.ts — system prompt já injeta character, mas os 
  prompts dos templates ainda pedem negative separado

## ESTADO ATUAL — O QUE FUNCIONA
- ✅ Chat (4 modos: Quick/Deep/Creator/Opus)
- ✅ Gemini Flash (via fallback Anthropic quando Google 403)
- ✅ Nano Banana (geração de imagem)
- ✅ Gemini TTS (geração de voz)
- ✅ 10 templates estruturados
- ✅ Viral video modeling (YouTube search)
- ✅ Character Engine backend (expand, refine, lock, unlock)
- ✅ Character Engine UI (CharactersPage)
- ✅ CharacterSelector no Chat (injeta identity no system prompt)
- ✅ Error boundaries + Sentry infrastructure
- ✅ Login email + Google OAuth
- ✅ Sidebar com Characters

## O QUE NÃO FUNCIONA BEM
- ❌ Consistência visual entre cenas (Character Engine não integrado nos templates)
- ❌ Negative prompt separado do prompt principal nos code blocks
- ❌ Google API Key dá 403 do servidor (funciona do PC do Anderson)
  - Key: AIzaSyDODIsozzGbDhMRqeFx4MwaTfe0IrcNUV0
  - Fallback para Anthropic está ativo
- ⚠️ Stripe não testado end-to-end
- ⚠️ Onboarding flow não existe

## SUPABASE
- Project ID: kumnrldlzttsrgjlsspa
- URL: https://kumnrldlzttsrgjlsspa.supabase.co
- 11 edge functions deployed
- Tabelas: profiles, conversations, messages, prompts, usage_logs, projects, 
  model_registry, characters

## GIT
- Repo: https://github.com/AndersonTeodoro-hub/SavvyOwl
- Branch: main
