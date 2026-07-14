-- Supabase schema for storing user sources
-- Run this on your Supabase Postgres database (using psql or the Supabase SQL editor)

-- Enable pgcrypto for gen_random_uuid() (may already be enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: public.sources
CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text,
  data jsonb,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sources_user_id_idx ON public.sources (user_id);

-- Optional: row level security so each authenticated user can only access their own rows
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users to manage their own sources
CREATE POLICY "Users can manage their sources" ON public.sources
  FOR ALL
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

-- Note: Supabase Auth exposes auth.uid() when JWTs are configured.
-- If you plan to insert rows from server-side code using a service_role key,
-- make sure to bypass RLS in that context or use secure functions.
-- supabase is currently in dev. Might not work for now.
