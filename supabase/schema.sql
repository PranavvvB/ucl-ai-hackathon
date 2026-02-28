-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. STORAGE: Create the "videos" bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload their own files
CREATE POLICY "Users can upload own videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policy: anyone can view public videos
CREATE POLICY "Public read videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Storage policy: users can delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);


-- 2. DATABASE: Create the lift_sessions table
CREATE TABLE IF NOT EXISTS public.lift_sessions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lift_type   TEXT NOT NULL CHECK (lift_type IN ('squat', 'bench-press', 'deadlift')),
  video_url   TEXT NOT NULL,
  score       INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  pros        TEXT[] NOT NULL DEFAULT '{}',
  corrections TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.lift_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own sessions
CREATE POLICY "Users see own sessions"
ON public.lift_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: users can only insert their own sessions
CREATE POLICY "Users insert own sessions"
ON public.lift_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: users can delete their own sessions
CREATE POLICY "Users delete own sessions"
ON public.lift_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS lift_sessions_user_id_idx
ON public.lift_sessions (user_id, created_at DESC);
