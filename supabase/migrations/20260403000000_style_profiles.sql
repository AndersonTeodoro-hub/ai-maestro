-- Style Profiles: visual style presets per niche for consistent video generation
CREATE TABLE IF NOT EXISTS public.style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  name TEXT NOT NULL,
  visual_description TEXT NOT NULL,
  color_palette TEXT,
  atmosphere TEXT,
  scene_types TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own style profiles"
  ON public.style_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own style profiles"
  ON public.style_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own style profiles"
  ON public.style_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own style profiles"
  ON public.style_profiles FOR DELETE
  USING (auth.uid() = user_id);
