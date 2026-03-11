

## Add Optimization Card to Chat Messages

### Overview
Add a collapsible optimization info card below each assistant message that has `optimized_content`. Uses Collapsible from Radix (already installed) and Sparkles icon from Lucide.

### Changes

**`src/pages/Chat.tsx`** only:

1. **Extend message type** — add `optimized_content`, `model_recommended`, `task_type`, `optimization_savings_eur` to the state type and the select query (line 53-54).

2. **Add optimization card** — after the existing model/cost badge (lines 205-211), render a collapsible card when `msg.optimized_content` is present:
   - Collapsed: single row with Sparkles icon + "Optimizado pelo PromptOS" + model name, clickable to expand
   - Expanded: shows model used, task type, estimated savings, and a "Ver prompt otimizado" button that toggles the optimized prompt text in a gray background block
   - Styled with `bg-accent/5 border border-border/50 rounded-lg text-xs`

3. **Imports** — add `Sparkles`, `ChevronDown` from lucide-react; `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from radix.

### No other files changed

