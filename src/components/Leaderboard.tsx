import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Award, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarColor, getInitials } from '@/lib/basename';
import { LeaderboardEntry } from './leaderboard/LeaderboardEntry';

// Creator wallets to display with badge
const CREATOR_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
  '0xf79f164e634b76815b80b60a85e1258eb21d631c',
].map(addr => addr.toLowerCase());

export interface LeaderboardPlayer {
  rank: number;
  displayName: string;
  wallet: string;
  score: number;
  isCreator: boolean;
  fid: number | null;
  pfpUrl: string | null;
}

export const Leaderboard = () => {
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select(`
          high_score,
          player_id,
          players!inner(wallet_address, display_name, fid, pfp_url)
        `)
        .eq('game_type', '2048')
        .order('high_score', { ascending: false })
        .limit(100);

      if (error) throw error;

      const playerScores = new Map<string, {
        wallet: string;
        displayName: string;
        score: number;
        fid: number | null;
        pfpUrl: string | null;
      }>();
      
      data?.forEach((entry: any) => {
        const wallet = entry.players.wallet_address;
        const displayName = entry.players.display_name;
        const fid = entry.players.fid;
        const pfpUrl = entry.players.pfp_url;
        const existing = playerScores.get(wallet);
        if (!existing || entry.high_score > existing.score) {
          playerScores.set(wallet, { 
            wallet, 
            displayName: displayName || shortenWallet(wallet),
            score: entry.high_score,
            fid: fid || null,
            pfpUrl: pfpUrl || null,
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
          isCreator: CREATOR_WALLETS.includes(entry.wallet.toLowerCase()),
          fid: entry.fid,
          pfpUrl: entry.pfpUrl,
        }));

      return sorted;
    },
  });

  // Realtime: refresh whenever the leaderboard table changes
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-home-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => {
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const shortenWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
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

        {/* Column headers */}
        <div className="flex items-center justify-between px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <div className="flex items-center gap-3">
            <span className="w-5 text-center">#</span>
            <span>Player</span>
          </div>
          <span>Score</span>
        </div>

        {entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No scores yet. Be the first to play!
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {entries.map((entry) => (
              <LeaderboardEntry key={entry.wallet} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
