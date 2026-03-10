

## Complete Landing Page Redesign — Zuvelle-Inspired Premium Aesthetic

### Overview
Full rewrite of `Landing.tsx` with a warm, editorial luxury design. New color palette (warm blacks/creams/gold), serif typography (Cormorant Garamond + Libre Franklin), zero border-radius, grain texture, and 10 alternating dark/light sections with animated demos. Replace all existing `landing.*` translation keys with new structure.

### Files Changed
Only `src/pages/Landing.tsx` and the 4 translation JSON files.

### Landing.tsx — Complete Rewrite

**Google Fonts**: Import Cormorant Garamond (400,500,600,700,italic) and Libre Franklin (300,400,500,600) via `<link>` tags in JSX.

**Color system** (inline Tailwind arbitrary values, NOT changing CSS variables — keeps dashboard untouched):
- Dark sections: `bg-[#1a1814]`, cards `bg-[#221f1a]`, text `text-[#f5f0e8]`, muted `text-[#f5f0e8]/40`, borders `border-[#f5f0e8]/[0.07]`, accent `text-[#c9a96e]`
- Light sections: `bg-[#f5f0e8]`, cards `bg-[#ece5d9]`, text `text-[#1a1814]`, muted `text-[#1a1814]/45`

**Grain texture**: CSS pseudo-element using SVG feTurbulence filter at 0.02 opacity on main container.

**10 Sections** (alternating dark/light):

1. **Navbar** (fixed, dark, blur on scroll via useState+useEffect): Logo circle with gold border + "P" italic + "PROMPTOS" uppercase. Links: Produto, Preços. Right: LanguageSelector, ThemeToggle, Entrar ghost, Começar outline gold.

2. **Hero** (dark): Badge pill "O SISTEMA OPERATIVO DA TUA IA". Headline in Cormorant Garamond ~72px: "Tu crias." (white) + "A IA optimiza tudo." (gold italic). Subtitle in Libre Franklin 300. Single CTA outline gold. Centered, max-w-[680px] headline, max-w-[520px] subtitle. Staggered fade-up animations.

3. **Optimize Demo** (dark): Animated loop (useEffect+useState) showing before/after prompt optimization. Original prompt in italic card → strikethrough → arrow → optimized prompt in gold-bordered card. 4 stat boxes below. 8-second loop cycle.

4. **All Your AIs** (light): Tab interface (Texto, Imagem, Vídeo, Áudio) with border-bottom tabs. Each tab shows grid of AI tool cards (GPT-4o, Claude, etc.) with name in Cormorant italic + tag in Libre Franklin muted. 1px gap grid.

5. **Routing Demo** (dark): Animated loop showing prompt → tags fade-in → 4 model comparison bars animating width → winner result with cost comparison. Gold accent on winner.

6. **For Who** (light): 3 cards in 1px-gap grid. Criadores, Influenciadores, Agências. Diamond/circle markers. Names in Cormorant 22px italic.

7. **Features** (dark): 4 numbered features (01-04) in editorial list. Number in Cormorant italic gold, 64px column + 1fr content. Border-top between items.

8. **Pricing** (light): 2 cards (Essencial €0, Profissional €12). Pro card has gold top border + "Popular" badge. Prices in Cormorant 48px. Gold checks for Pro, muted for Free.

9. **CTA Final** (dark): Gold divider, headline with gold italic accent, outline gold button.

10. **Footer** (dark): "PromptOS · Lisboa, 2026" at 11px, tracking 2px, opacity 12%.

**Animations**: framer-motion for staggered hero fade-ups, whileInView on all sections, useEffect loops for optimize/routing demos.

### Translation Files — Replace `landing` object

All 4 files get their `landing` object completely replaced with new nested structure:

```
landing.nav.product / pricing / login / cta
landing.hero.badge / h1a / h1b / subtitle / cta
landing.optimize.badge / title_a / title_b / subtitle / prompt_before / prompt_after / stat1-4 labels+values
landing.tools.badge / title_a / title_b / subtitle / tab names / tool names+tags
landing.routing.badge / header / prompt / tags / model names+percentages / result labels
landing.why.badge / title_a / title_b / cards (3x title+desc)
landing.features.badge / 4x (label / title_a / title_b / desc)
landing.pricing.badge / title_a / title_b / plan names+prices+features
landing.cta_final.title_a / title_b / cta
landing.footer.text
```

Full translations in PT (primary), EN, FR, ES for all ~120 keys.

### Key Technical Notes
- All landing-specific colors use Tailwind arbitrary values (`bg-[#1a1814]`) so dashboard/other pages remain unchanged
- Google Fonts loaded via `<link>` tags inside the component (Helmet-free)
- Font families applied via inline `style={{ fontFamily: ... }}` or Tailwind arbitrary `font-[...]`
- Demo animations use `useEffect` + `useState` with `setInterval`/`setTimeout` for looping
- Scroll-triggered navbar background uses `useEffect` + scroll listener
- `border-radius: 0` on all elements via `rounded-none` class
- Responsive: mobile stacks to single column, reduced font sizes, smaller padding

