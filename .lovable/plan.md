

## Plano: 3 Correcções Definitivas

### Problema raiz
O screenshot é do site de produção (`savvyowl.app`), não do preview do Lovable. As mudanças no código ainda não foram redeployadas. Mas há bugs reais no código que devem ser corrigidos antes de fazer redeploy.

### 1. Botão "Novo Chat" cortado (`src/components/ChatSidebar.tsx`)
**Causa**: O `Button` do shadcn aplica `overflow: hidden` internamente. Com `Plus` icon + texto traduzido, o texto é cortado.
**Fix**: Adicionar `whitespace-nowrap overflow-visible` ao botão, ou usar um label mais curto. Também remover o `mr-1.5` do ícone e usar `gap` no flex interno.

### 2. Botão apagar SEMPRE visível (`src/components/ChatSidebar.tsx`)
**Causa**: `opacity-0 group-hover:opacity-100` falha em touch e é instável em hover rápido.
**Fix**: Remover completamente a lógica de opacity. O botão de apagar fica **sempre visível** com ícone pequeno (14px) e cor subtil (`text-muted-foreground`), que fica vermelho no hover. O botão de mover mantém-se em hover-only (é secundário).

Estrutura final de cada conversa:
```text
┌──────────────────────────────────┐
│ 💬 título da conversa...   🗑️  │
│     (truncate)        (sempre)  │
└──────────────────────────────────┘
```

### 3. Confirmar cores neutras estão correctas (`src/index.css`)
As variáveis CSS JÁ estão com cinza neutro no código. Não há nada a mudar aqui. O problema é que o deploy para `savvyowl.app` não foi feito após as mudanças.

### Ficheiros a alterar
- `src/components/ChatSidebar.tsx` — botão novo chat + botão apagar sempre visível

### Nota importante
Após as correções, será necessário fazer **redeploy** (publish) para que as mudanças apareçam em `savvyowl.app`. No preview do Lovable, as mudanças são visíveis imediatamente.

