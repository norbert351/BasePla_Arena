import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Gamepad2, Coins, Trophy, Loader2 } from 'lucide-react';

export const AdminDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [playersRes, sessionsRes] = await Promise.all([
        supabase.from('players').select('id, wallet_address, created_at'),
        supabase.from('game_sessions').select('id, score, fee_paid, started_at'),
      ]);

      const players = playersRes.data || [];
      const sessions = sessionsRes.data || [];

      const totalFees = sessions.reduce(
        (sum, s) => sum + parseFloat(s.fee_paid?.toString() || '0'),
        0
      );

      const highestScore = Math.max(...sessions.map(s => s.score || 0), 0);

      return {
        totalPlayers: players.length,
        totalGames: sessions.length,
        totalFees: totalFees.toFixed(6),
        highestScore,
        recentPlayers: players.slice(-10).reverse(),
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold gradient-title">Admin Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalPlayers || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Total Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.totalGames || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Total Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">{stats?.totalFees} ETH</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              High Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.highestScore?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Recent Players (Wallets)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentPlayers?.length === 0 ? (
            <p className="text-muted-foreground">No players yet</p>
          ) : (
            <div className="space-y-2">
              {stats?.recentPlayers?.map((player: any) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <span className="font-mono text-sm">{player.wallet_address}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(player.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
