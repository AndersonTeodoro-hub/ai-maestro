

## Add Light/Dark Mode Toggle

### Approach
Use `next-themes` (already installed) for theme management with a class-based strategy. Default to light mode.

### Changes

**1. `src/index.css`** — Update `:root` to be light mode colors, keep `.dark` as current dark colors
- `:root` (light): background `210 40% 98%`, card `0 0% 100%`, text `222 47% 11%`, border `214 32% 91%`, muted `210 40% 96%`, sidebar light variants
- `.dark` stays as-is (current dark navy theme)
- Add `transition-colors duration-300` to `*` base layer

**2. `src/App.tsx`** — Wrap with `ThemeProvider` from `next-themes` with `defaultTheme="light"`, `attribute="class"`, `storageKey="promptos-theme"`

**3. `src/components/ThemeToggle.tsx`** — New component
- Sun/Moon icon button using `useTheme()` from `next-themes`
- Toggles between light and dark

**4. `src/layouts/DashboardLayout.tsx`** — Add `ThemeToggle` next to `LanguageSelector` in header

**5. `src/pages/Landing.tsx`** — Add `ThemeToggle` next to `LanguageSelector` in nav

**6. `src/pages/Login.tsx` + `src/pages/Register.tsx`** — Add `ThemeToggle` to top-right corner

