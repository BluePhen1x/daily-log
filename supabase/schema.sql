DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own cards" ON public.log_cards;
  DROP POLICY IF EXISTS "Users can create own cards" ON public.log_cards;
  DROP POLICY IF EXISTS "Users can update own cards" ON public.log_cards;
  DROP POLICY IF EXISTS "Users can delete own cards" ON public.log_cards;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own entries" ON public.log_entries;
  DROP POLICY IF EXISTS "Users can create own entries" ON public.log_entries;
  DROP POLICY IF EXISTS "Users can delete own entries" ON public.log_entries;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.log_entries CASCADE;
DROP TABLE IF EXISTS public.log_cards CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.log_cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  card_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'DHS',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.log_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id UUID REFERENCES public.log_cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  descriptions TEXT[] DEFAULT '{}',
  source_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own cards" ON public.log_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cards" ON public.log_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON public.log_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON public.log_cards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own entries" ON public.log_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own entries" ON public.log_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON public.log_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entries" ON public.log_entries FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX idx_log_cards_user_id ON public.log_cards(user_id);
CREATE INDEX idx_log_entries_card_id ON public.log_entries(card_id);
CREATE INDEX idx_log_entries_user_id ON public.log_entries(user_id);
