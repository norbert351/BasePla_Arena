ALTER TABLE public.game_sessions
ADD CONSTRAINT fk_game_sessions_player
FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;