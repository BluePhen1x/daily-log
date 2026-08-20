DO $$ BEGIN
  CREATE POLICY "Users can update own entries" ON public.log_entries FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
