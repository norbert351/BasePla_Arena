
-- Add game_type column to game_sessions (default '2048' for existing data)
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS game_type text NOT NULL DEFAULT '2048';

-- Add username column to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS username text;

-- Add unique constraint on username (allow null but unique when set)
CREATE UNIQUE INDEX IF NOT EXISTS players_username_unique ON public.players (username) WHERE username IS NOT NULL;
