
O screenshot ajuda e tens razão: a app mostrada não bate com o que eu te disse. Vejo dois problemas reais no código atual.

**O que a imagem prova**
1. O contraste entre sidebar e área do chat continua fraco demais.
2. O botão de apagar não está visível no estado normal da conversa, por isso na prática “não existe” para quem usa a interface.

**Do I know what the issue is?**
Sim.

**Problema exato**
- Em `src/components/ChatSidebar.tsx`, as ações da conversa (`move` e `delete`) estão com `opacity-0 group-hover:opacity-100`, então só aparecem no hover. Isso explica porque no screenshot não há ícone nenhum.
- Em `src/pages/Chat.tsx`, a área principal do chat não tem um fundo explícito forte o suficiente e a separação visual depende demasiado das variáveis globais. O resultado é uma diferença quase imperceptível entre sidebar, corpo do chat e barra inferior.

**Plano de correção**
1. **Tornar o botão de apagar realmente visível**
   - Ficheiro: `src/components/ChatSidebar.tsx`
   - Manter o `group`, mas mudar o comportamento:
     - conversa ativa: mostrar sempre ações
     - conversa em hover: mostrar ações
     - mobile/touch: mostrar sempre ações
   - Garantir área clicável mínima de 32x32 e manter tudo dentro do mesmo container da conversa.
   - Se necessário, mostrar só o ícone de apagar de forma permanente e deixar “mover” em hover.

2. **Forçar o contraste do layout do chat**
   - Ficheiro: `src/pages/Chat.tsx`
   - Aplicar fundos explícitos:
     - sidebar: `#1a1814`
     - área principal: `#211e19`
     - mensagens user: `#2a2520`
     - mensagens IA: `#1e1b16`
     - barra inferior: `#1a1814`
   - Adicionar separação visual mais clara:
     - `border-l`/`border-r` subtis
     - talvez `shadow` leve na barra inferior e/ou sidebar
   - Não depender só do `body`/tokens globais para esta página.

3. **Ajustar os pills dos modos para bater com o pedido**
   - Ficheiro: `src/pages/Chat.tsx`
   - Inativos: `rgba(245,240,232,0.05)`
   - Ativo: `#c9a96e` com texto escuro
   - Garantir que o estado locked não anula o contraste.

4. **Rever os tokens globais sem mexer no modo claro**
   - Ficheiro: `src/index.css`
   - Confirmar que o dark mode continua com a paleta warm dark.
   - Se os componentes do chat estiverem a herdar estilos globais que achatam o contraste, manter os tokens, mas priorizar classes explícitas no chat.

5. **Validação visual**
   - Confirmar no `/dashboard/chat`:
     - sidebar claramente mais escura que o corpo
     - barra inferior separada do conteúdo
     - botão de apagar visível e clicável sem desaparecer
     - modo claro intacto

**Ficheiros a alterar**
- `src/components/ChatSidebar.tsx`
- `src/pages/Chat.tsx`
- `src/index.css`

**Resultado esperado**
- O chat passa a ter 3 camadas visuais claras: sidebar escura, área de mensagens um pouco mais clara, barra inferior novamente mais escura.
- O botão de apagar deixa de depender exclusivamente de hover invisível e passa a estar acessível de forma óbvia.
