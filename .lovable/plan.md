

## Plano: Responsividade do Chat + Favicon/OG

### 1. Chat (`src/pages/Chat.tsx`) — Reestruturar layout

**Layout actual:** Mode selector e input estão juntos na mesma barra, empilhados em mobile. O input não ocupa a largura total.

**Novo layout (de cima para baixo):**

```text
┌─────────────────────────────────┐
│ [☰] Mobile top bar  [+ New]    │
├─────────────────────────────────┤
│                                 │
│   Mensagens (flex-1,            │
│   overflow-y-auto)              │
│                                 │
├─────────────────────────────────┤
│ [Quick] [Deep] [Creator] [Opus] │  ← pills horizontais, scroll em mobile
├─────────────────────────────────┤
│ [📎] [ Input flex-1        ] [➤]│  ← barra fixa, border-top
└─────────────────────────────────┘
```

**Alterações concretas (linhas 442-533):**

- Separar mode pills do bloco de input — ficam acima, numa row com `overflow-x-auto`, sem o wrapper `bg-surface-1 rounded-xl border`
- Pills: `px-2.5 py-1 text-xs` em mobile, `px-3 py-1.5` em desktop
- Image preview move para dentro da barra de input (acima do row de input)
- Barra de input: `border-t border-border p-4 bg-background` (mobile: `px-3`)
- Input: remover o `max-w-3xl mx-auto` wrapper, usar `flex-1 min-h-[48px]` com `text-[15px] px-4 py-3`
- Input + botão imagem + botão enviar numa única row flex

### 2. Favicon (`index.html`)

- Trocar o favicon inline (letra "S") por `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` que aponta para o logo da coruja já existente em `public/favicon.svg`
- Manter `apple-touch-icon` a apontar para `/apple-touch-icon.png` (já existe)

### 3. OG Image (`index.html`)

- Alterar `og:image` e `twitter:image` para URL absoluto: `https://savvyowl.app/og-image.png`
- Adicionar `og:image:width` (1200) e `og:image:height` (630)
- O ficheiro `public/og-image.png` já existe — se precisar de ser recriado com o design descrito (fundo #1a1814, coruja, texto), será necessário fornecer a imagem ou gerá-la externamente (não é possível gerar PNG dentro do projecto)
- Title e og:title/og:description já estão correctos no index.html

### Nota sobre OG image PNG
Não é possível gerar um ficheiro PNG programaticamente dentro do projecto. O `public/og-image.png` existente será usado. Se quiseres uma imagem diferente, podes criar um SVG estático (`public/og-image.svg`) com o design descrito e referenciar esse, mas redes sociais preferem PNG/JPG. Recomendo criar o PNG externamente (Figma, Canva) e fazer upload.

