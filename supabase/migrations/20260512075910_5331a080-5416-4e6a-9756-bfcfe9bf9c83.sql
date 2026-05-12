ALTER TABLE public.leaderboard REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;