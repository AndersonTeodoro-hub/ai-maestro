

## Três Correções: Favicon + OG Image + Tema Warm Dark

### 1. Favicon — Usar a logo oficial da coruja

O `public/favicon.svg` actual NÃO é a logo oficial — é uma coruja azul genérica. A logo oficial que enviaste anteriormente (`savvyowl-logo-transparent.svg`) precisa de ser copiada para `public/favicon.svg`, substituindo o ficheiro actual.

**Acção:** Copiar `user-uploads://savvyowl-logo-transparent.svg` → `public/favicon.svg` (o `index.html` já aponta para `/favicon.svg`).

O `apple-touch-icon.png` e `logo-192.png` já existem. Se quiseres actualizá-los com a nova logo, precisas fornecer versões PNG.

### 2. OG Image

O `index.html` já tem as meta tags correctas com URL absoluto (`https://savvyowl.app/og-image.png`), dimensões 1200x630, og:title e og:description. O ficheiro `public/og-image.png` existe.

**Acção:** Criar um novo `public/og-image.svg` com fundo `#1a1814`, logo da coruja centrada, "SavvyOwl" e subtítulo "The smart way to use AI" em gold/creme. Actualizar `index.html` para apontar para a versão SVG (nota: algumas redes sociais não suportam SVG — manter o PNG existente como fallback, ou idealmente gerar o PNG externamente).

### 3. Tema Warm Dark — Paleta completa

Substituir TODAS as CSS custom properties do dark mode (`:root` em `src/index.css`) pela paleta warm:

| Token | Actual (azul frio) | Novo (warm dark) | Hex equivalente |
|---|---|---|---|
| `--background` | `222 50% 5%` | `30 14% 10%` | #1e1b16 |
| `--foreground` | `214 60% 97%` | `36 33% 94%` | #f5f0e8 |
| `--card` | `215 40% 7%` | `30 12% 14%` | #272320 |
| `--primary` | `217 100% 61%` (azul) | `38 40% 60%` | #c9a96e (gold) |
| `--primary-foreground` | `222 50% 5%` | `30 14% 10%` | #1e1b16 |
| `--secondary` | `216 30% 12%` | `30 10% 16%` | #2d2a25 |
| `--muted` | `216 30% 12%` | `30 10% 16%` | #2d2a25 |
| `--muted-foreground` | `215 25% 63%` | `36 33% 50%` | rgba(f5f0e8,0.5) |
| `--accent` | `160 100% 48%` | `38 40% 60%` | #c9a96e (gold) |
| `--border` | `213 35% 18%` | `36 33% 12%` | ~rgba(f5f0e8,0.08) |
| `--ring` | `217 100% 61%` | `38 40% 60%` | gold |
| `--sidebar-background` | `215 40% 7%` | `30 14% 9%` | #1a1814 |
| `--surface-1` | `215 40% 7%` | `30 12% 14%` | #272320 |
| `--surface-2` | `218 25% 12%` | `30 10% 16%` | #2d2a25 |

**Ficheiros afectados:**
- `src/index.css` — actualizar `:root` (dark mode variables)
- Utility classes: `.glow-primary` e `.gradient-text` — actualizar de azul para gold
- `.glass` — actualizar de `rgba(13,17,23,0.6)` para `rgba(30,27,22,0.6)`

**Componentes com hardcoded colors no Chat:**
- `src/pages/Chat.tsx` linha 462: pills activas usam `bg-primary` (vai mudar automaticamente para gold via CSS variable)
- `src/pages/Chat.tsx` linhas 358, 429: `border-primary` (muda automaticamente)
- Nenhuma alteração manual necessária nos componentes — tudo via CSS variables

**O modo light NÃO muda.** Fica como está.

### Resumo de ficheiros a editar
1. `public/favicon.svg` — substituir pela logo oficial (copy do upload)
2. `src/index.css` — reescrever `:root` com paleta warm + actualizar utilities
3. `index.html` — sem alterações (já está correcto)

