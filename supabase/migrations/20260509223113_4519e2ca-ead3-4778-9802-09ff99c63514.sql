-- Add tracking column to prevent duplicate leaderboard submissions per session
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS leaderboard_submitted boolean NOT NULL DEFAULT false;

-- Atomic cumulative leaderboard increment function
CREATE OR REPLACE FUNCTION public.increment_leaderboard_score(
  p_player_id uuid,
  p_game_type text,
  p_score integer,
  p_week_start date,
  p_week_end date
)
RETURNS TABLE(previous_score integer, new_total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  existing_score integer;
  updated_score integer;
BEGIN
  SELECT id, high_score INTO existing_id, existing_score
  FROM public.leaderboard
  WHERE player_id = p_player_id AND game_type = p_game_type
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF existing_id IS NOT NULL THEN
    updated_score := COALESCE(existing_score, 0) + p_score;
    UPDATE public.leaderboard
    SET high_score = updated_score, updated_at = now()
    WHERE id = existing_id;
    RETURN QUERY SELECT COALESCE(existing_score, 0), updated_score;
  ELSE
    INSERT INTO public.leaderboard (player_id, game_type, high_score, week_start, week_end)
    VALUES (p_player_id, p_game_type, p_score, p_week_start, p_week_end);
    RETURN QUERY SELECT 0, p_score;
  END IF;
END;
$$;