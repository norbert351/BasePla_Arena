import { Trophy, Medal, Award, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarColor, getInitials, getBaseProfileUrl } from '@/lib/basename';
import type { LeaderboardPlayer } from '../Leaderboard';

interface LeaderboardEntryProps {
  entry: LeaderboardPlayer;
}

const shortenWallet = (wallet: string) => `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

const getRankDisplay = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5 text-accent" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
  if (rank === 3) return <Award className="h-5 w-5 text-primary" />;
  return <span className="w-5 text-center text-sm font-medium text-muted-foreground">{rank}</span>;
};

export const LeaderboardEntry = ({ entry }: LeaderboardEntryProps) => {
  const displayName = entry.displayName.replace(/\.base\.eth$/i, '');
  const avatarColor = getAvatarColor(entry.wallet);
  const initials = getInitials(displayName);

  const handleClick = () => {
    // Open Base profile in browser
    const profileUrl = getBaseProfileUrl(displayName.startsWith('0x') ? entry.wallet : displayName);
    window.open(profileUrl, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center justify-between p-3 rounded-lg transition-colors group text-left',
        entry.rank <= 3
          ? 'bg-primary/10 border border-primary/30 hover:bg-primary/20'
          : 'bg-secondary/50 hover:bg-secondary/80'
      )}
    >
      <div className="flex items-center gap-3">
        {getRankDisplay(entry.rank)}
        
        {/* Avatar - use pfpUrl from Farcaster/Base context if available */}
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
          style={{ backgroundColor: entry.pfpUrl ? 'transparent' : avatarColor }}
        >
          {entry.pfpUrl ? (
            <img
              src={entry.pfpUrl}
              alt={displayName}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.style.backgroundColor = avatarColor;
                (e.target as HTMLImageElement).parentElement!.textContent = initials;
              }}
            />
          ) : (
            initials
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
};
