CREATE TABLE public.model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text UNIQUE NOT NULL,
  display_name text,
  provider text,
  gateway_model_string text,
  cost_per_1k_input numeric,
  cost_per_1k_output numeric,
  max_tokens integer,
  strengths text[],
  speed_tier text,
  quality_tier text,
  is_active boolean DEFAULT true,
  min_plan text DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);