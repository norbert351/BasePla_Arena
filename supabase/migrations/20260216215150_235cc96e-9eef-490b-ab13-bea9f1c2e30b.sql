
-- Add fid and pfp_url columns to players table for Farcaster/Base profile data
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS fid bigint;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pfp_url text;

-- Create index on fid for leaderboard lookups
CREATE INDEX IF NOT EXISTS idx_players_fid ON public.players (fid) WHERE fid IS NOT NULL;
