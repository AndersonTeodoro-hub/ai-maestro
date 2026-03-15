

## Dark Mode Contrast Fix — Chat Page

The current CSS variables produce backgrounds that are too similar. The fix applies the exact hex values requested, mapped to HSL for the CSS variable system, plus direct color overrides in Chat.tsx and ChatSidebar.tsx.

### Hex → HSL Mapping

| Element | Hex | HSL |
|---------|-----|-----|
| Sidebar bg | #1a1814 | 30 12% 9% |
| Chat area bg | #211e19 | 30 13% 11% |
| User message bubble | #2a2520 | 24 14% 15% |
| AI message bubble | #1e1b16 | 30 14% 10% |
| Input bar bg | #1a1814 | 30 12% 9% |
| Mode pill inactive | rgba(245,240,232,0.05) | — |
| Mode pill active | #c9a96e gold | already `--primary` |
| Text | #f5f0e8 | 36 33% 94% (already `--foreground`) |
| Muted text | rgba(245,240,232,0.4) | — |

### Changes

**1. `src/index.css`** — Update dark mode CSS variables:
- `--background`: `30 13% 11%` (chat area, was `30 14% 10%`)
- `--sidebar-background`: `30 12% 9%` (sidebar, stays same)
- `--surface-1`: `30 12% 9%` (used by sidebar bg)
- `--surface-2`: `30 14% 10%` (AI messages, was `30 10% 16%`)
- `--card`: `24 14% 15%` (user messages/cards)
- `--border`: `36 8% 14%` (slightly more visible)
- `--muted-foreground`: `36 15% 44%` (closer to 40% opacity feel)
- `--secondary`: `24 14% 15%` (match card)

**2. `src/pages/Chat.tsx`** — Apply specific colors:
- Chat area wrapper: `bg-background` (already, now correct via variable)
- User message bubbles: change from `bg-border` to `bg-card`
- AI message bubbles: change from `bg-[hsl(var(--surface-2))]` to explicit `bg-[#1e1b16] dark:bg-[#1e1b16]` or use surface-2 (now updated)
- Bottom input bar: replace `bg-background` with `bg-[hsl(var(--surface-1))]` and add `border-t border-[rgba(245,240,232,0.06)]`
- Mode pills inactive: `bg-[rgba(245,240,232,0.05)]` with `border-transparent`
- Input field bg: use surface-1 tone

**3. `src/components/ChatSidebar.tsx`** — Already uses `bg-[hsl(var(--surface-1))]` which maps to sidebar color. No change needed.

All changes are CSS-level. Light mode values untouched.

