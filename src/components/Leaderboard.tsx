import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Award, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBaseProfileUrl, resolveBasename } from '@/lib/basename';
import { useState, useEffect } from 'react';

// Creator wallets to display with badge
const CREATOR_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
  '0xf79f164e634b76815b80b60a85e1258eb21d631c',
].map(addr => addr.toLowerCase());

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  wallet: string;
  score: number;
  isTopTwenty: boolean;
  isCreator: boolean;
}

export const Leaderboard = () => {
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
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

      const sorted = Array.from(playerScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((entry, index) => ({
          rank: index + 1,
          wallet: entry.wallet,
          displayName: entry.displayName,
          score: entry.score,
          isTopTwenty: index < 20,
          isCreator: CREATOR_WALLETS.includes(entry.wallet.toLowerCase()),
        }));

      return sorted;
    },
  });

  // Resolve Base usernames (basenames) for all wallets
  useEffect(() => {
    if (entries.length === 0) return;
    
    const resolveNames = async () => {
      const newResolved: Record<string, string> = {};
      
      await Promise.all(
        entries.map(async (entry) => {
          // Skip if already has a basename-style display name
          if (entry.displayName.includes('.base.eth') || entry.displayName.includes('.')) return;
          
          try {
            const profile = await resolveBasename(entry.wallet);
            if (profile.name) {
              newResolved[entry.wallet] = profile.name;
            }
          } catch {
            // Silently fail for individual resolutions
          }
        })
      );
      
      if (Object.keys(newResolved).length > 0) {
        setResolvedNames(prev => ({ ...prev, ...newResolved }));
      }
    };
    
    resolveNames();
  }, [entries]);

  const shortenWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-accent" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Award className="h-5 w-5 text-primary" />;
    return <span className="w-5 text-center text-muted-foreground">{rank}</span>;
  };

  const openProfile = (entry: LeaderboardEntry) => {
    const profileUrl = getBaseProfileUrl(entry.displayName.includes('.') ? entry.displayName : entry.wallet);
    window.open(profileUrl, '_blank');
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
              <button
                key={entry.wallet}
                onClick={() => openProfile(entry)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg transition-colors group text-left',
                  entry.isTopTwenty
                    ? 'bg-primary/10 border border-primary/30 hover:bg-primary/20'
                    : 'bg-secondary/50 hover:bg-secondary/80'
                )}
              >
                <div className="flex items-center gap-3">
                  {getRankIcon(entry.rank)}
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm flex items-center gap-1">
                      {(resolvedNames[entry.wallet] || entry.displayName).replace(/\.base\.eth$/i, '')}
                      {entry.isCreator && (
                        <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">👑 Creator</span>
                      )}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
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
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
