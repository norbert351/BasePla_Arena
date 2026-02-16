import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Award, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBaseProfileUrl, resolveBasename, getAvatarColor, getInitials } from '@/lib/basename';
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

interface ResolvedProfile {
  name: string;
  avatar: string | null;
}

export const Leaderboard = () => {
  const [resolvedProfiles, setResolvedProfiles] = useState<Record<string, ResolvedProfile>>({});

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

  // Resolve Base profiles (name + avatar) for all wallets
  useEffect(() => {
    if (entries.length === 0) return;
    
    const resolveProfiles = async () => {
      const newResolved: Record<string, ResolvedProfile> = {};
      
      await Promise.all(
        entries.map(async (entry) => {
          // Skip if already resolved
          if (resolvedProfiles[entry.wallet]) return;
          
          try {
            const profile = await resolveBasename(entry.wallet);
            if (profile.name) {
              newResolved[entry.wallet] = {
                name: profile.name,
                avatar: profile.avatar,
              };
            }
          } catch {
            // Silently fail for individual resolutions
          }
        })
      );
      
      if (Object.keys(newResolved).length > 0) {
        setResolvedProfiles(prev => ({ ...prev, ...newResolved }));
      }
    };
    
    resolveProfiles();
  }, [entries]);

  const shortenWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-accent" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Award className="h-5 w-5 text-primary" />;
    return <span className="w-5 text-center text-sm font-medium text-muted-foreground">{rank}</span>;
  };

  const getDisplayName = (entry: LeaderboardEntry): string => {
    const resolved = resolvedProfiles[entry.wallet];
    if (resolved?.name) return resolved.name;
    return entry.displayName.replace(/\.base\.eth$/i, '');
  };

  const getAvatar = (entry: LeaderboardEntry): { url: string | null; color: string; initials: string } => {
    const resolved = resolvedProfiles[entry.wallet];
    const name = getDisplayName(entry);
    return {
      url: resolved?.avatar || null,
      color: getAvatarColor(entry.wallet),
      initials: getInitials(name),
    };
  };

  const openProfile = (entry: LeaderboardEntry) => {
    const name = getDisplayName(entry);
    const profileUrl = getBaseProfileUrl(name.startsWith('0x') ? entry.wallet : name);
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
            {entries.map((entry) => {
              const avatar = getAvatar(entry);
              const displayName = getDisplayName(entry);
              
              return (
                <button
                  key={entry.wallet}
                  onClick={() => openProfile(entry)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg transition-colors group text-left',
                    entry.rank <= 3
                      ? 'bg-primary/10 border border-primary/30 hover:bg-primary/20'
                      : 'bg-secondary/50 hover:bg-secondary/80'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {getRankDisplay(entry.rank)}
                    
                    {/* Avatar */}
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: avatar.url ? 'transparent' : avatar.color }}
                    >
                      {avatar.url ? (
                        <img
                          src={avatar.url}
                          alt={displayName}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.style.backgroundColor = avatar.color;
                            (e.target as HTMLImageElement).parentElement!.textContent = avatar.initials;
                          }}
                        />
                      ) : (
                        avatar.initials
                      )}
                    </div>

                    {/* Name & wallet */}
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm flex items-center gap-1 truncate">
                        {displayName}
                        {entry.isCreator && (
                          <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded-full shrink-0">👑</span>
                        )}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {shortenWallet(entry.wallet)}
                      </span>
                    </div>
                  </div>
                  <span className={cn(
                    'font-bold tabular-nums shrink-0 ml-2',
                    entry.rank <= 3 && 'text-accent'
                  )}>
                    {entry.score.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
