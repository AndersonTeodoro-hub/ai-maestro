

## PromptOS — AI Cockpit for Non-Technical Users

### Tech Adjustments
- React + Vite + Tailwind (not Next.js) — same result, Lovable's stack
- Lovable AI Gateway instead of OpenAI (Quick → gemini-3-flash-preview, Deep Think → gemini-2.5-pro, ContentCreator → gemini-3-flash-preview + system prompt)
- Lovable Cloud (Supabase) for auth, database, edge functions
- Stripe via Lovable's native integration (enabled separately)

### Design System
- Dark mode theme: background #0F172A, cards #1E293B, text #F1F5F9, primary #3A86FF, accent #10B981
- Inter font, clean consumer SaaS aesthetic (Notion/Linear vibe)
- All UI in shadcn/ui components

### Pages & Features

**1. Landing Page (/)**
- Hero with headline, subheadline, CTA → /register
- 3 benefit cards (Smart routing, Prompt Library, Cost Dashboard)
- Pricing section (Free / Starter €19 / Pro €49)
- Footer

**2. Auth (/login, /register)**
- Email/password + Google OAuth via Supabase Auth
- Redirect to /dashboard after auth
- Profiles table created on signup via trigger

**3. Onboarding (post-first-login modal)**
- 3-step welcome: name → content type preference → starter prompts intro

**4. Dashboard Layout**
- Sidebar navigation (Dashboard, Chat, Prompt Library, Analytics, Settings)
- Collapsible sidebar with icons

**5. Dashboard Home (/dashboard)**
- Welcome card with user name + time-of-day greeting
- 4 stat cards (monthly spend €, requests, tokens saved, money saved vs ChatGPT)
- Recent activity feed (last 5 interactions)
- Quick "New Chat" action

**6. Chat (/dashboard/chat)**
- Conversation list sidebar + full chat area
- Mode selector: Quick ⚡ / Deep Think 🧠 / ContentCreator AI ✍️
- Streaming AI responses via edge function → Lovable AI Gateway
- Cost badge on each AI message (model + €cost)
- Messages persisted to Supabase

**7. Prompt Library (/dashboard/prompts)**
- Grid of prompt cards with title, category tag, usage count
- Create/edit modal with {variable} highlighting
- 6 pre-loaded ContentCreator starter prompts
- "Use" button → variable fill modal → opens Chat with filled prompt

**8. Analytics (/dashboard/analytics)**
- Date range selector
- 4 metric cards
- Bar chart (daily spend) + Pie chart (usage by mode) via Recharts
- Request history table (last 20)

**9. Settings (/dashboard/settings)**
- Profile editing (name, email)
- Subscription plan badge + upgrade button
- Monthly budget limit with 80% warning
- Danger zone: delete account

### Database (Supabase)
- **profiles**: id, full_name, plan, monthly_budget_eur, content_preference, created_at
- **conversations**: id, user_id, title, mode, created_at
- **messages**: id, conversation_id, role, content, model_used, cost_eur, created_at
- **prompts**: id, user_id, title, category, content, use_count, created_at
- **usage_logs**: id, user_id, tokens_input, tokens_output, cost_eur, model, mode, created_at
- RLS policies on all tables (users access own data only)

### Edge Function: AI Chat
- Receives messages + mode, applies smart routing to correct model
- ContentCreator mode injects specialized system prompt
- Streams response via SSE
- Calculates cost from token usage, logs to usage_logs
- Checks plan limits before processing, returns upgrade prompt if exceeded

### Plan Limits (enforced server-side)
- Free: 20 req/mo, Quick only, 3 saved prompts
- Starter: 300 req/mo, all modes, unlimited prompts
- Pro: 1500 req/mo, all modes, unlimited prompts
- Over-limit modal with upgrade CTA

### UX Rules
- Never show "tokens" — always € amounts
- Animated thinking indicator on AI calls
- Empty states with helpful CTAs
- Mobile responsive (especially chat)
- Friendly error messages only
- Costs always in EUR

### Stripe (enabled separately)
- 3 subscription plans matching Free/Starter/Pro
- Webhook to update user plan in profiles table

### Implementation Order
1. Design system + landing page
2. Auth + profiles + onboarding
3. Dashboard layout + sidebar
4. Chat with AI integration (edge function + streaming)
5. Prompt Library with starter prompts
6. Analytics with charts
7. Settings + budget limits
8. Stripe subscriptions (enabled as next step)

