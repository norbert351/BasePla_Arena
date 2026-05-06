import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LeaderboardEntry } from '@/components/leaderboard/LeaderboardEntry';
import { Trophy, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import baseplayLogo from '@/assets/baseplay-logo.png';

const CREATOR_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
  '0xf79f164e634b76815b80b60a85e1258eb21d631c',
].map(addr => addr.toLowerCase());

const shortenWallet = (wallet: string) => `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

const LeaderboardPage = () => {
  const { gameType = '2048' } = useParams<{ gameType: string }>();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', gameType],
    queryFn: async () => {
      // We need to filter by game_type but types may not reflect new column yet
      // Use raw query approach
      const { data, error } = await (supabase
        .from('game_sessions')
        .select(`score, player_id, players!inner(wallet_address, display_name, username, fid, pfp_url)`) as any)
        .eq('game_type', gameType)
        .order('score', { ascending: false })
        .limit(100);

      if (error) throw error;

      const playerScores = new Map<string, { wallet: string; displayName: string; score: number; fid: number | null; pfpUrl: string | null }>();
      data?.forEach((session: any) => {
        const wallet = session.players.wallet_address;
        const displayName = session.players.username || session.players.display_name || shortenWallet(wallet);
        const existing = playerScores.get(wallet);
        if (!existing || session.score > existing.score) {
          playerScores.set(wallet, {
            wallet, displayName, score: session.score,
            fid: session.players.fid || null, pfpUrl: session.players.pfp_url || null,
          });
        }
      });

      return Array.from(playerScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((entry, index) => ({
          rank: index + 1, wallet: entry.wallet, displayName: entry.displayName,
          score: entry.score, isCreator: CREATOR_WALLETS.includes(entry.wallet.toLowerCase()),
          fid: entry.fid, pfpUrl: entry.pfpUrl,
        }));
    },
  });

  const title = gameType === 'tetris' ? 'Tetris' : gameType === 'typing' ? 'Speed Typing' : '2048';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <img src={baseplayLogo} alt="BasePlay" className="h-8 w-8" width={32} height={32} />
          </Link>
          <Link to={`/play/${gameType}`}>
            <Button variant="outline" size="sm">Play {title}</Button>
          </Link>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              {title} Leaderboard
            </h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">Top 20</span>
          </div>

          <div className="flex items-center justify-between px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div className="flex items-center gap-3"><span className="w-5 text-center">#</span><span>Player</span></div>
            <span>Score</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No scores yet. Be the first to play!</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {entries.map((entry) => <LeaderboardEntry key={entry.wallet} entry={entry} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
