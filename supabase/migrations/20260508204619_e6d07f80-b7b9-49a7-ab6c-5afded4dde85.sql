ALTER TABLE public.leaderboard
ADD COLUMN IF NOT EXISTS game_type text;

UPDATE public.leaderboard l
SET game_type = gs.game_type
FROM public.game_sessions gs
WHERE gs.player_id = l.player_id
  AND gs.score = l.high_score
  AND l.game_type IS NULL;

UPDATE public.leaderboard
SET game_type = '2048'
WHERE game_type IS NULL;

ALTER TABLE public.leaderboard
ALTER COLUMN game_type SET NOT NULL;

ALTER TABLE public.leaderboard
ADD CONSTRAINT leaderboard_game_type_check
CHECK (game_type IN ('2048', 'tetris', 'typing'));

DROP INDEX IF EXISTS leaderboard_player_id_week_start_idx;
DROP INDEX IF EXISTS leaderboard_player_id_week_start_game_type_idx;

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_player_id_week_start_game_type_idx
ON public.leaderboard (player_id, week_start, game_type);