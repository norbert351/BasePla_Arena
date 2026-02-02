-- Create table for players with wallet addresses
CREATE TABLE public.players (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for game sessions
CREATE TABLE public.game_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    fee_paid DECIMAL(18, 8) NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create table for weekly leaderboard snapshots
CREATE TABLE public.leaderboard (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    high_score INTEGER NOT NULL DEFAULT 0,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for tracking weekly rewards
CREATE TABLE public.weekly_rewards (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_fees_collected DECIMAL(18, 8) NOT NULL DEFAULT 0,
    reward_pool DECIMAL(18, 8) NOT NULL DEFAULT 0,
    distributed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for reward distributions
CREATE TABLE public.reward_distributions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    weekly_reward_id UUID NOT NULL REFERENCES public.weekly_rewards(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    amount DECIMAL(18, 8) NOT NULL,
    wallet_address TEXT NOT NULL,
    distributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_distributions ENABLE ROW LEVEL SECURITY;

-- Players: anyone can read, players can only update their own
CREATE POLICY "Players are viewable by everyone" ON public.players FOR SELECT USING (true);
CREATE POLICY "Players can insert their own record" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update their own record" ON public.players FOR UPDATE USING (true);

-- Game sessions: players can view their own, public can view for leaderboard
CREATE POLICY "Game sessions viewable by everyone" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create game sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game sessions" ON public.game_sessions FOR UPDATE USING (true);

-- Leaderboard: public read access
CREATE POLICY "Leaderboard is viewable by everyone" ON public.leaderboard FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leaderboard" ON public.leaderboard FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leaderboard" ON public.leaderboard FOR UPDATE USING (true);

-- Weekly rewards: public read access
CREATE POLICY "Weekly rewards viewable by everyone" ON public.weekly_rewards FOR SELECT USING (true);
CREATE POLICY "Anyone can insert weekly rewards" ON public.weekly_rewards FOR INSERT WITH CHECK (true);

-- Reward distributions: public read access
CREATE POLICY "Reward distributions viewable by everyone" ON public.reward_distributions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reward distributions" ON public.reward_distributions FOR INSERT WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON public.players
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leaderboard_updated_at
    BEFORE UPDATE ON public.leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster leaderboard queries
CREATE INDEX idx_game_sessions_score ON public.game_sessions(score DESC);
CREATE INDEX idx_game_sessions_player ON public.game_sessions(player_id);
CREATE INDEX idx_leaderboard_week ON public.leaderboard(week_start, week_end);
CREATE INDEX idx_leaderboard_score ON public.leaderboard(high_score DESC);