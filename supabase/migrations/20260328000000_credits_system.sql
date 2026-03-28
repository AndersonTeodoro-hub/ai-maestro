-- Credits system migration

-- Add credits columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS credits_total_purchased INTEGER NOT NULL DEFAULT 0;

-- Credit transactions audit table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'spend', 'refund', 'bonus')),
  description TEXT,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Give existing users 10 free credits if they have 0
UPDATE public.profiles SET credits_balance = 10 WHERE credits_balance = 0;
