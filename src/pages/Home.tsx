import { Link } from 'react-router-dom';
import { Gamepad2, Trophy, User, Shield, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WalletConnect } from '@/components/game/WalletConnect';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import baseplayLogo from '@/assets/baseplay-logo.png';

// Preload game pages when user lands on homepage
const preloadGames = () => {
  import('../pages/Play2048');
  import('../pages/PlayTetris');
};


const CREATOR_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
  '0xf79f164e634b76815b80b60a85e1258eb21d631c',
].map(addr => addr.toLowerCase());

const games = [
  {
    id: '2048',
    title: '2048',
    description: 'Slide tiles, merge numbers, reach 2048!',
    emoji: '🔢',
    path: '/play/2048',
    gradient: 'from-primary to-blue-400',
  },
  {
    id: 'tetris',
    title: 'Tetris',
    description: 'Stack blocks, clear lines, score big!',
    emoji: '🧱',
    path: '/play/tetris',
    gradient: 'from-purple-500 to-pink-500',
  },
];

const Home = () => {
  const { isConnected, address } = useAccount();
  const isAdmin = isConnected && address && CREATOR_WALLETS.includes(address.toLowerCase());
  const [menuOpen, setMenuOpen] = useState(false);

  // Preload game chunks after homepage renders
  useEffect(() => {
    const timer = setTimeout(preloadGames, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30">
      {/* Header */}
      <header className="py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={baseplayLogo} alt="BasePlay Arena" className="h-10 w-10" width={40} height={40} />
            <div className="hidden sm:block">
              <h1 className="text-xl font-black gradient-title leading-tight">BasePlay Arena</h1>
              <p className="text-[10px] text-muted-foreground">Play & Compete on Base</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-2">
            {isConnected && (
              <Link to="/profile">
                <Button variant="ghost" size="sm">
                  <User className="h-4 w-4 mr-1" /> Profile
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin">
                <Button variant="ghost" size="sm">
                  <Shield className="h-4 w-4 mr-1" /> Admin
                </Button>
              </Link>
            )}
            <WalletConnect onConnect={() => {}} onDisconnect={() => {}} />
          </div>

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-2">
            <WalletConnect onConnect={() => {}} onDisconnect={() => {}} />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden mt-3 max-w-4xl mx-auto flex flex-col gap-1 bg-card rounded-lg border border-border p-2">
            {isConnected && (
              <Link to="/profile" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <User className="h-4 w-4 mr-2" /> Profile
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" /> Admin
                </Button>
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black gradient-title mb-4">
            Play. Compete. Win.
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8">
            Pay $0.99 per session. Top players share the reward pool. All on Base.
          </p>
        </div>
      </section>

      {/* Game Cards */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          {games.map((game) => (
            <Link
              key={game.id}
              to={game.path}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-xl hover:scale-[1.02] hover:border-primary/50"
            >
              <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${game.gradient}`} />
              <div className="relative">
                <span className="text-5xl mb-4 block">{game.emoji}</span>
                <h3 className="text-2xl font-bold mb-2">{game.title}</h3>
                <p className="text-muted-foreground mb-4">{game.description}</p>
                <div className="flex items-center gap-2 text-sm text-primary font-semibold">
                  <Gamepad2 className="h-4 w-4" />
                  Play Now — $0.99/session
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Links */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-4">
          <Link to="/leaderboard/2048">
            <Button variant="outline" className="gap-2">
              <Trophy className="h-4 w-4" /> 2048 Leaderboard
            </Button>
          </Link>
          <Link to="/leaderboard/tetris">
            <Button variant="outline" className="gap-2">
              <Trophy className="h-4 w-4" /> Tetris Leaderboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-border/50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            Built by{' '}
            <a href="https://x.com/Zubby_crypt" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
              @Zubby_crypt
            </a>
            {' '}• BasePlay Arena
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
