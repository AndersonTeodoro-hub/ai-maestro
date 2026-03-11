

## Replace Fake Stats with Real Optimization Data

### DashboardHome (`src/pages/DashboardHome.tsx`)

1. **Add a second query** to fetch messages with optimization data for the current month:
   - Query `messages` table joined through `conversations` (user's conversations this month)
   - First fetch user's conversation IDs, then fetch messages with `optimization_savings_eur`, `model_recommended`, `task_type`

2. **Replace fake calculations**:
   - Remove `tokensSaved = ... * 0.15` and `moneySaved = totalSpend * 0.4`
   - `moneySaved` = sum of `optimization_savings_eur` from messages
   - Remove the duplicate "Money Saved" card (currently cards 3 and 4 show the same thing)

3. **New "Efficiency" card** replacing the old tokens card:
   - Count messages where `model_recommended = "gemini-flash"` vs `"gemini-pro"`
   - Display as percentage: "82% economic model" (or "—" if no data)
   - Use `Zap` icon from lucide

4. **Final 4 cards**: Month Spend, Requests, Optimisation Savings (real), Efficiency %

### Analytics (`src/pages/Analytics.tsx`)

1. **Replace `moneySaved = totalSpend * 0.4`** with real sum from messages' `optimization_savings_eur` (same approach: fetch conversations then messages for the range)

2. **New section: Daily Savings chart** — bar chart showing daily `optimization_savings_eur` sum, placed alongside existing charts in the grid

3. **New section: Top Task Types table** — group messages by `task_type`, count occurrences, show top 5 in a simple table

### i18n keys to add (en.json + pt.json + fr.json + es.json)
- `dashboard.efficiency`, `analytics.dailySavings`, `analytics.topTaskTypes`, `analytics.taskType`, `analytics.count`, `analytics.optimizationSavings`

### Files changed
- `src/pages/DashboardHome.tsx`
- `src/pages/Analytics.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/pt.json`
- `src/i18n/locales/fr.json`
- `src/i18n/locales/es.json`

No edge function or database changes.

