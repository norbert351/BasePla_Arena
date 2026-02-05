-- Add tx_hash and token_type columns for transaction verification
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS tx_hash text UNIQUE;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS token_type text;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can create game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can update game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Game sessions viewable by everyone" ON public.game_sessions;

-- Create new restrictive policies
-- Only allow SELECT (for leaderboard purposes) - hide fee_paid from public
CREATE POLICY "Public can view game scores"
ON public.game_sessions
FOR SELECT
USING (true);

-- Disable INSERT from client - must go through edge function
CREATE POLICY "No direct insert allowed"
ON public.game_sessions
FOR INSERT
WITH CHECK (false);

-- Disable UPDATE from client - must go through edge function  
CREATE POLICY "No direct update allowed"
ON public.game_sessions
FOR UPDATE
USING (false);

-- Also fix players table RLS
DROP POLICY IF EXISTS "Players can insert their own record" ON public.players;
DROP POLICY IF EXISTS "Players can update their own record" ON public.players;

-- Restrict player inserts and updates via edge functions
CREATE POLICY "No direct player insert"
ON public.players
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct player update"
ON public.players
FOR UPDATE
USING (false);

-- Fix leaderboard table RLS
DROP POLICY IF EXISTS "Anyone can insert leaderboard" ON public.leaderboard;
DROP POLICY IF EXISTS "Anyone can update leaderboard" ON public.leaderboard;

CREATE POLICY "No direct leaderboard insert"
ON public.leaderboard
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct leaderboard update"
ON public.leaderboard
FOR UPDATE
USING (false);

-- Fix reward_distributions table RLS  
DROP POLICY IF EXISTS "Anyone can insert reward distributions" ON public.reward_distributions;

CREATE POLICY "No direct reward insert"
ON public.reward_distributions
FOR INSERT
WITH CHECK (false);

-- Fix weekly_rewards table RLS
DROP POLICY IF EXISTS "Anyone can insert weekly rewards" ON public.weekly_rewards;

CREATE POLICY "No direct weekly rewards insert"
ON public.weekly_rewards
FOR INSERT
WITH CHECK (false);