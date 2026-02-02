import { useState, useCallback } from 'react';
import { use2048 } from '@/hooks/use2048';
import { GameBoard } from '@/components/game/GameBoard';
import { ScoreBox } from '@/components/game/ScoreBox';
import { WalletConnect } from '@/components/game/WalletConnect';
import { GameOverModal } from '@/components/game/GameOverModal';
import { PaymentModal } from '@/components/game/PaymentModal';
import { Leaderboard } from '@/components/Leaderboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { RotateCcw, Gamepad2, Trophy, Shield } from 'lucide-react';
import { toast } from 'sonner';

const GAME_FEE = '0.001';

const Index = () => {
  const {
    grid,
    score,
    bestScore,
    gameOver,
    won,
    moveCount,
    move,
    resetGame,
  } = use2048();

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [balance] = useState('0.1'); // Simulated balance
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWalletConnect = useCallback(async (address: string) => {
    setWalletAddress(address);
    
    // Check if player exists or create new
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('wallet_address', address)
      .single();

    if (existingPlayer) {
      setPlayerId(existingPlayer.id);
    } else {
      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ wallet_address: address })
        .select('id')
        .single();

      if (!error && newPlayer) {
        setPlayerId(newPlayer.id);
      }
    }
  }, []);

  const handleWalletDisconnect = useCallback(() => {
    setWalletAddress(null);
    setPlayerId(null);
    setSessionId(null);
  }, []);

  const startNewGame = useCallback(async () => {
    if (!playerId) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate payment (in real app, this would be a blockchain transaction)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create game session
      const { data: session, error } = await supabase
        .from('game_sessions')
        .insert({
          player_id: playerId,
          fee_paid: parseFloat(GAME_FEE),
        })
        .select('id')
        .single();

      if (error) throw error;

      setSessionId(session.id);
      resetGame();
      setShowPayment(false);
      toast.success('Game started! Good luck!');
    } catch (error) {
      console.error('Failed to start game:', error);
      toast.error('Failed to start game');
    } finally {
      setIsProcessing(false);
    }
  }, [playerId, resetGame]);

  const handlePlayAgain = useCallback(() => {
    if (walletAddress && playerId) {
      setShowPayment(true);
    } else {
      resetGame();
    }
  }, [walletAddress, playerId, resetGame]);

  // Save score when game ends
  const handleGameEnd = useCallback(async () => {
    if (sessionId && score > 0) {
      await supabase
        .from('game_sessions')
        .update({
          score,
          ended_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', sessionId);
    }
  }, [sessionId, score]);

  // Trigger save on game over
  if ((gameOver || won) && sessionId) {
    handleGameEnd();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-black gradient-title drop-shadow-lg">
            2048
          </h1>
          <p className="text-lg font-semibold text-primary mt-1">
            on BASE
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="game" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary">
              <TabsTrigger value="game" className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                <span className="hidden sm:inline">Game</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="game" className="space-y-6 animate-slide-up">
              {/* Game Controls */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <ScoreBox label="Score" score={score} />
                <div className="flex flex-col items-center gap-3">
                  {walletAddress ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setShowPayment(true)}
                        className="gradient-primary text-primary-foreground border-none hover:opacity-90"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        New Game
                      </Button>
                      <WalletConnect
                        onConnect={handleWalletConnect}
                        onDisconnect={handleWalletDisconnect}
                      />
                    </>
                  ) : (
                    <WalletConnect
                      onConnect={handleWalletConnect}
                      onDisconnect={handleWalletDisconnect}
                    />
                  )}
                </div>
              </div>

              {/* Info Banner */}
              <div className="gradient-primary rounded-lg p-4 text-center text-primary-foreground">
                <p className="text-sm font-medium">
                  💰 Pay {GAME_FEE} ETH per game • Top 10 weekly players share 50% of fees!
                </p>
              </div>

              {/* Game Board */}
              <GameBoard grid={grid} onMove={move} />

              {/* Instructions */}
              <p className="text-center text-muted-foreground text-sm">
                Use arrow keys or swipe to move tiles. Combine matching numbers to reach 2048!
              </p>

              {/* Moves counter */}
              {moveCount > 0 && (
                <p className="text-center text-muted-foreground text-xs">
                  Moves: {moveCount}
                </p>
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="animate-slide-up">
              <Leaderboard />
            </TabsContent>

            <TabsContent value="admin" className="animate-slide-up">
              <AdminDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Modals */}
      <GameOverModal
        isOpen={gameOver || (won && !gameOver)}
        score={score}
        won={won}
        onPlayAgain={handlePlayAgain}
      />

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onPay={startNewGame}
        fee={GAME_FEE}
        balance={balance}
        isLoading={isProcessing}
      />
    </div>
  );
};

export default Index;
