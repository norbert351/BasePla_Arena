import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WalletConnect } from '@/components/game/WalletConnect';
import { ArrowLeft, User, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import baseplayLogo from '@/assets/baseplay-logo.png';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const Profile = () => {
  const { address, isConnected } = useAccount();
  const [username, setUsername] = useState('');
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ totalGames: 0, best2048: 0, bestTetris: 0 });

  useEffect(() => {
    if (!address) return;
    setIsLoading(true);
    const fetchProfile = async () => {
      const { data: player } = await supabase
        .from('players')
        .select('username, display_name')
        .eq('wallet_address', address.toLowerCase())
        .single();

      if (player) {
        setCurrentUsername(player.username || null);
        setUsername(player.username || '');
      }

      // Fetch stats
      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('score, game_type')
        .eq('player_id', (await supabase.from('players').select('id').eq('wallet_address', address.toLowerCase()).single()).data?.id || '')
        .order('score', { ascending: false });

      if (sessions) {
        const s2048 = sessions.filter((s: any) => (s as any).game_type === '2048' || !(s as any).game_type);
        const sTetris = sessions.filter((s: any) => (s as any).game_type === 'tetris');
        setStats({
          totalGames: sessions.length,
          best2048: s2048.length > 0 ? Math.max(...s2048.map(s => s.score)) : 0,
          bestTetris: sTetris.length > 0 ? Math.max(...sTetris.map(s => s.score)) : 0,
        });
      }
      setIsLoading(false);
    };
    fetchProfile();
  }, [address]);

  const handleSave = async () => {
    if (!address || !username.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address, username: username.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update');
      setCurrentUsername(username.trim());
      toast.success('Username updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally { setIsSaving(false); }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30 flex flex-col items-center justify-center px-4">
        <User className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-4">Connect Wallet to View Profile</h2>
        <WalletConnect onConnect={() => {}} onDisconnect={() => {}} />
        <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">← Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30 px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <img src={baseplayLogo} alt="BasePlay" className="h-8 w-8" width={32} height={32} />
          </Link>
          <h1 className="text-2xl font-bold ml-2">Profile</h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* Wallet */}
            <div className="bg-card rounded-xl p-4 border border-border">
              <label className="text-sm text-muted-foreground">Wallet</label>
              <p className="font-mono text-sm truncate">{address}</p>
            </div>

            {/* Username */}
            <div className="bg-card rounded-xl p-4 border border-border space-y-3">
              <label className="text-sm text-muted-foreground">Username</label>
              <div className="flex gap-2">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  maxLength={20}
                  className="flex-1"
                />
                <Button onClick={handleSave} disabled={isSaving || !username.trim() || username.trim() === currentUsername} className="gradient-primary text-primary-foreground">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
              {currentUsername && <p className="text-xs text-muted-foreground">Current: {currentUsername}</p>}
            </div>

            {/* Stats */}
            <div className="bg-card rounded-xl p-4 border border-border">
              <h3 className="font-semibold mb-3">Your Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{stats.totalGames}</p>
                  <p className="text-xs text-muted-foreground">Games</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">{stats.best2048.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Best 2048</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">{stats.bestTetris.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Best Tetris</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
