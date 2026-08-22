DO $$ BEGIN
  CREATE TABLE public.deleted_log_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    original_id UUID NOT NULL,
    card_id UUID NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    descriptions TEXT[] DEFAULT '{}',
    source_date TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW()
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.deleted_log_entries ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own deleted entries" ON public.deleted_log_entries FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own deleted entries" ON public.deleted_log_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own deleted entries" ON public.deleted_log_entries FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX idx_deleted_entries_user_id ON public.deleted_log_entries(user_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX idx_deleted_entries_original_id ON public.deleted_log_entries(original_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
