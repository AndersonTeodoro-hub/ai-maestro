

## Integrate Optimization Engine into Chat Edge Function

### Overview
Modify `supabase/functions/chat/index.ts` to inline the optimize logic (classify + rewrite) before sending to the AI gateway. Add 4 new columns to the `messages` table. Fallback to current behavior on any optimization failure.

### Database Migration
Add columns to `messages`:
```sql
ALTER TABLE public.messages
  ADD COLUMN optimized_content text,
  ADD COLUMN model_recommended text,
  ADD COLUMN task_type text,
  ADD COLUMN optimization_savings_eur numeric;
```

### Chat Function Changes (`supabase/functions/chat/index.ts`)

**New inline functions** (copied from optimize):
- `callAI(apiKey, systemPrompt, userContent)` — non-streaming call to flash model
- `classifyAndOptimize(apiKey, userMessage, context, userPlan)` — runs classification + prompt optimization, returns `{ optimizedPrompt, classification, savingsEur }` or `null` on failure

**Modified flow:**
1. After auth/plan checks, extract the last user message content from `messages` array
2. Call `classifyAndOptimize()` wrapped in try/catch with a timeout — on failure return `null` (fallback)
3. If optimization succeeded:
   - Query `model_registry` for `gateway_model_string` matching `classification.recommended_model`
   - Replace the last user message content with `optimizedPrompt`
   - Use the resolved gateway model string
4. If optimization failed (null):
   - Use `MODEL_MAP[mode]` as before (current fallback)
   - Use original prompt as-is
5. Remove the free-plan mode restriction (engine handles routing now)
6. Keep creator system prompt logic: if `mode === "creator"`, prepend creator system prompt regardless
7. In the stream post-processing, use model costs from registry (or fallback to hardcoded)
8. Save to `usage_logs` with the actual model used
9. After stream completes, also insert/update the assistant message in `messages` with new fields: `optimized_content`, `model_recommended`, `task_type`, `optimization_savings_eur`
10. Metadata SSE event includes optimization info

**Key details:**
- The `mode` parameter is still accepted and stored but NOT used for model routing
- Creator system prompt still applied when `mode === "creator"`
- Optimization has a 10s timeout to avoid blocking the chat
- All optimization errors are caught silently — chat always works

### Files Changed
1. **`supabase/functions/chat/index.ts`** — Rewritten with optimization integration
2. **New migration** — 4 nullable columns on `messages`

### No Other Changes
- `optimize` edge function untouched
- No frontend changes
- No other tables modified

