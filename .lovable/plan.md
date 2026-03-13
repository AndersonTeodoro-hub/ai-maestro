

## Plan: Update Landing Navbar Logo Styling

### Changes in `src/pages/Landing.tsx` (lines 76-83)

Update the logo and text styling in the navbar:

```tsx
<div className="flex items-center">
  <img src="/logo.svg" alt="SavvyOwl" className="h-[44px] w-auto" style={{ marginRight: "8px" }} />
  <span
    className="text-xs font-medium hidden sm:inline"
    style={{ letterSpacing: "0.15em", color: "#F0F6FF" }}
  >
    SAVVYOWL
  </span>
</div>
```

Key changes:
- Logo height: `h-9 w-9` → `h-[44px] w-auto` (44px, preserve aspect ratio)
- Gap: replace `gap-3` with explicit `marginRight: 8px` on img
- Text color: `text-[#f5f0e8]` → `color: #F0F6FF`
- Letter spacing: `4px` → `0.15em`
- No background on img element (none currently, stays clean)

