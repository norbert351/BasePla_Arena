import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Award, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  wallet: string;
  score: number;
  isTopTwenty: boolean;
}

export const Leaderboard = () => {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      // Get top 50 scores from game sessions with player display names
      const { data, error } = await supabase
        .from('game_sessions')
        .select(`
          score,
          player_id,
          players!inner(wallet_address, display_name)
        `)
        .order('score', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Group by player and get highest score
      const playerScores = new Map<string, { wallet: string; displayName: string; score: number }>();
      
      data?.forEach((session: any) => {
        const wallet = session.players.wallet_address;
        const displayName = session.players.display_name;
        const existing = playerScores.get(wallet);
        if (!existing || session.score > existing.score) {
          playerScores.set(wallet, { 
            wallet, 
            displayName: displayName || shortenWallet(wallet),
            score: session.score 
          });
        }
      });

      // Convert to array and sort
      const sorted = Array.from(playerScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map((entry, index) => ({
          rank: index + 1,
          wallet: entry.wallet,
          displayName: entry.displayName,
          score: entry.score,
          isTopTwenty: index < 20,
        }));

      return sorted;
    },
  });

  const shortenWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-accent" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Award className="h-5 w-5 text-primary" />;
    return <span className="w-5 text-center text-muted-foreground">{rank}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card rounded-xl p-4 border border-border shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            Leaderboard
          </h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
            Top 20 win 60% fees monthly
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No scores yet. Be the first to play!
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.wallet}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg transition-colors',
                  entry.isTopTwenty
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-secondary/50'
                )}
              >
                <div className="flex items-center gap-3">
                  {getRankIcon(entry.rank)}
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">
                      {entry.displayName}
                    </span>
                    {entry.displayName !== shortenWallet(entry.wallet) && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {shortenWallet(entry.wallet)}
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn(
                  'font-bold',
                  entry.isTopTwenty && 'text-accent'
                )}>
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
