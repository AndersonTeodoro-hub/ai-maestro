# SavvyOwl - Checklist de Testes (Utilizador Real)

## FLUXO 1: Primeiro Contacto (Landing → Registo)
- [ ] Landing carrega sem erros (savvyowl.app)
- [ ] Navbar funciona: Features, Como Funciona, Preços, FAQ
- [ ] FAQ abre/fecha correctamente
- [ ] Mobile menu funciona
- [ ] Botão "Experimenta grátis" vai para /register
- [ ] Registo com email funciona
- [ ] Registo com Google funciona
- [ ] Redirect para /dashboard/chat após login
- [ ] Login persistente (fechar browser e voltar)

## FLUXO 2: Chat Básico
- [ ] Chat carrega sem erros
- [ ] Escrever mensagem e receber resposta (Owl Flash)
- [ ] Trocar para Owl Pro e testar
- [ ] Trocar para Owl Creator e testar
- [ ] Criar nova conversa
- [ ] Apagar conversa
- [ ] Sidebar collapse/expand funciona
- [ ] Copiar resposta funciona

## FLUXO 3: Templates (10 templates)
- [ ] 1. Criar Influencer UGC - campos carregam, resposta vem
- [ ] 2. Copy/Legenda Pro - campos carregam, resposta vem
- [ ] 3. Script de Vídeo/Reels - campos carregam, resposta vem
- [ ] 4. Calendário de Conteúdo - campos carregam, resposta vem
- [ ] 5. Criar eBook/Lead Magnet - campos carregam, resposta vem
- [ ] 6. Prompt Vídeo IA - campos carregam, resposta vem
- [ ] 7. Gerador de Cenas - campos carregam, resposta vem
- [ ] 8. Canal Dark Pipeline - 3 passos funcionam
- [ ] 9. Viral Pipeline Pro - 3 passos funcionam
- [ ] 10. Modelar Vídeo Viral - busca videos do YouTube

## FLUXO 4: Modelar Vídeo Viral
- [ ] Preencher nicho e clicar "Buscar vídeos virais"
- [ ] Lista de vídeos reais aparece com thumbnails
- [ ] Clicar num vídeo gera modelagem completa
- [ ] Prompts de imagem em code blocks (com botão copiar)
- [ ] Prompts de vídeo em code blocks
- [ ] Instruções CapCut aparecem

## FLUXO 5: Geração de Imagem (BYOK)
- [ ] Sem API key: botão aparece mas dá mensagem clara
- [ ] Com API key: gerar imagem funciona
- [ ] Imagem aparece inline
- [ ] Download funciona
- [ ] "Gerar outra" funciona
- [ ] BLOQUEADO: Precisa de billing Google activo

## FLUXO 6: Geração de Vídeo (BYOK)
- [ ] Sem API key: botão não aparece
- [ ] Com API key: opções de aspect ratio aparecem
- [ ] Geração mostra progresso
- [ ] Vídeo toca inline
- [ ] Download funciona
- [ ] BLOQUEADO: Precisa de billing Google activo

## FLUXO 7: Geração de Voz
- [ ] Botão "Gerar Narração" aparece em code blocks
- [ ] Dropdown de vozes funciona (7 vozes Gemini)
- [ ] Voz selecionada fica guardada
- [ ] Áudio toca inline
- [ ] Download MP3 funciona
- [ ] BLOQUEADO: Precisa de billing Google activo (Gemini TTS)
- [ ] Com ElevenLabs BYOK: funciona independentemente

## FLUXO 8: Definições
- [ ] Perfil: nome editável
- [ ] Subscrição: mostra plano actual
- [ ] Programa de Referência: link copiável
- [ ] API Keys: Google API key guardada no browser
- [ ] ElevenLabs: key guardada, vozes carregam
- [ ] Danger Zone: apagar conta funciona

## FLUXO 9: Analytics
- [ ] Mostra modos Owl (sem "gemini" visível)
- [ ] Gráfico pizza funciona
- [ ] Tabela de uso funciona

## FLUXO 10: Biblioteca de Prompts
- [ ] Carrega sem erros
- [ ] Prompts guardados aparecem

## BLOQUEADORES ACTUAIS
1. Billing Google: imagens, vídeos, e voz Gemini TTS não funcionam
   sem billing activo no projecto Google Cloud
2. Solução: cada utilizador traz a sua API key com billing (BYOK)
3. ElevenLabs para voz funciona independentemente do Google billing

## PRIORIDADE DE CORRECÇÃO
1. Resolver billing Google (permite testar 80% das features)
2. Testar fluxo completo de template → imagem → vídeo → voz
3. Corrigir bugs encontrados nos testes
4. Polir UX baseado no feedback
