

## Three Final Fixes: Neutral Dark Mode, Sidebar Layout, Delete Button

### 1. Neutral Dark Mode Colors (`src/index.css`)

Replace warm brown HSL values with neutral grays matching the requested hex codes:

| Element | Hex | HSL |
|---------|-----|-----|
| Sidebar / input bar / surface-1 | #191919 | 0 0% 10% |
| Chat area / background | #212121 | 0 0% 13% |
| User messages / card | #2f2f2f | 0 0% 18% |
| AI messages / surface-2 | #212121 | 0 0% 13% |
| Text / foreground | #ececec | 0 0% 93% |
| Muted text | rgba(255,255,255,0.5) | 0 0% 50% |
| Border | #2a2a2a | 0 0% 16% |
| Primary (gold) | stays #c9a96e | 38 40% 60% |

Update `:root` variables. Keep `.light` class untouched. Update `--secondary`, `--muted`, `--popover`, `--card-foreground`, `--sidebar-*` to match neutral gray scheme. Update `.glass` utility to use neutral rgba.

### 2. Sidebar Layout (`src/components/ChatSidebar.tsx` + `src/pages/Chat.tsx`)

- Change sidebar width from `w-[280px]` to `w-[260px]` in Chat.tsx (desktop sidebar container and mobile Sheet)
- New Chat button: reduce text size, use `text-xs`, ensure no truncation at 260px
- Style New Chat button with explicit gold: `bg-[#c9a96e] text-[#191919] hover:bg-[#b8984f]` instead of default primary glow
- Conversation action buttons: already inside `group` container. Keep structure but ensure proper alignment with `ml-auto`

### 3. Delete Button Fix (`src/components/ChatSidebar.tsx`)

The current structure has the conversation text as a `<button>` and action icons in a sibling `<div>`. The hover works on the parent `group` div, but the action div uses conditional opacity that can cause race conditions.

Fix: Restructure each conversation row so the entire row is a single `group relative` container. The action buttons sit inside it, always within the hover zone. Add `e.stopPropagation()` on both move and delete handlers. Simplify opacity logic: always `opacity-0 group-hover:opacity-100` with a `pointer-events-auto` to ensure clickability.

```text
┌─────────────────────────────────┐
│ [group div - hover target]      │
│  ┌──────────────────┬────────┐  │
│  │ conversation     │ 🔀 🗑️ │  │
│  │ title (truncate) │actions │  │
│  └──────────────────┴────────┘  │
└─────────────────────────────────┘
```

### Files to change
- `src/index.css` — neutral gray CSS variables
- `src/components/ChatSidebar.tsx` — sidebar layout, button styling, delete button structure
- `src/pages/Chat.tsx` — sidebar width 260px, update border colors to use `rgba(255,255,255,0.06)` instead of warm tones, AI message bg to match background (no card)

