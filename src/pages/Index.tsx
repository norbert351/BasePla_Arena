import { useState, useCallback } from 'react';
import { use2048 } from '@/hooks/use2048';
import { GameBoard } from '@/components/game/GameBoard';
import { ScoreBox } from '@/components/game/ScoreBox';
import { WalletConnect } from '@/components/game/WalletConnect';
import { GameOverModal } from '@/components/game/GameOverModal';
import { PaymentModal, PaymentToken } from '@/components/game/PaymentModal';
import { Leaderboard } from '@/components/Leaderboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { sendETHPayment, sendUSDCPayment } from '@/lib/blockchain';
import { RotateCcw, Gamepad2, Trophy, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { Address } from 'viem';

const GAME_FEE_ETH = '0.001';
const GAME_FEE_USDC = '2.50';

// Creator wallet addresses that can access admin
const ADMIN_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
].map(addr => addr.toLowerCase());

const Index = () => {
  const {
    grid,
    score,
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
  const [balanceETH, setBalanceETH] = useState('0');
  const [balanceUSDC, setBalanceUSDC] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPaidForSession, setHasPaidForSession] = useState(false);

  const isAdmin = walletAddress && ADMIN_WALLETS.includes(walletAddress.toLowerCase());

  const handleBalanceUpdate = useCallback((ethBal: string, usdcBal: string) => {
    setBalanceETH(ethBal);
    setBalanceUSDC(usdcBal);
  }, []);

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
    setBalanceETH('0');
    setBalanceUSDC('0');
    setHasPaidForSession(false);
  }, []);

  const startNewGame = useCallback(async (token: PaymentToken) => {
    if (!playerId || !walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    try {
      // Send actual blockchain payment
      const feeAmount = token === 'ETH' ? GAME_FEE_ETH : GAME_FEE_USDC;
      
      toast.info(`Sending ${feeAmount} ${token}... Please confirm in your wallet.`);
      
      if (token === 'ETH') {
        await sendETHPayment(walletAddress as Address, GAME_FEE_ETH);
      } else {
        await sendUSDCPayment(walletAddress as Address, GAME_FEE_USDC);
      }

      // Create game session after successful payment
      const { data: session, error } = await supabase
        .from('game_sessions')
        .insert({
          player_id: playerId,
          fee_paid: parseFloat(feeAmount),
        })
        .select('id')
        .single();

      if (error) throw error;

      setSessionId(session.id);
      setHasPaidForSession(true);
      resetGame();
      setShowPayment(false);
      toast.success(`Payment confirmed! Good luck!`);
    } catch (error: any) {
      console.error('Failed to start game:', error);
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        toast.error('Transaction cancelled');
      } else {
        toast.error(error.message || 'Failed to process payment');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [playerId, walletAddress, resetGame]);

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
      setHasPaidForSession(false);
    }
  }, [sessionId, score]);

  // Trigger save on game over
  if ((gameOver || won) && sessionId) {
    handleGameEnd();
  }

  // Check if user needs to pay to play
  const needsPayment = walletAddress && !hasPaidForSession && !gameOver && !won;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30">
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
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary/80 backdrop-blur-sm">
              <TabsTrigger value="game" className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                <span className="hidden sm:inline">Game</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                {isAdmin ? <Shield className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
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
                        onBalanceUpdate={handleBalanceUpdate}
                      />
                    </>
                  ) : (
                    <WalletConnect
                      onConnect={handleWalletConnect}
                      onDisconnect={handleWalletDisconnect}
                      onBalanceUpdate={handleBalanceUpdate}
                    />
                  )}
                </div>
              </div>

              {/* Info Banner */}
              <div className="gradient-primary rounded-lg p-4 text-center text-primary-foreground">
                <p className="text-sm font-medium">
                  💰 Pay {GAME_FEE_ETH} ETH or {GAME_FEE_USDC} USDC per game • Top 20 monthly players share 60% of fees!
                </p>
              </div>

              {/* Payment Required Overlay */}
              {needsPayment && (
                <div className="relative">
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                    <Lock className="h-12 w-12 text-primary mb-4" />
                    <p className="text-lg font-semibold mb-4">Pay to Play</p>
                    <Button
                      onClick={() => setShowPayment(true)}
                      className="gradient-gold text-accent-foreground"
                    >
                      Pay Entry Fee
                    </Button>
                  </div>
                  <div className="opacity-30 pointer-events-none">
                    <GameBoard grid={grid} onMove={move} />
                  </div>
                </div>
              )}

              {/* Game Board - Only show when paid */}
              {(!needsPayment || !walletAddress) && (
                <GameBoard grid={grid} onMove={move} />
              )}

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
              {isAdmin ? (
                <AdminDashboard />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Lock className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Admin Access Required</h3>
                  <p className="text-muted-foreground max-w-md">
                    This section is restricted to authorized creators only. 
                    Please connect with an admin wallet to access the dashboard.
                  </p>
                </div>
              )}
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
        feeETH={GAME_FEE_ETH}
        feeUSDC={GAME_FEE_USDC}
        balanceETH={balanceETH}
        balanceUSDC={balanceUSDC}
        isLoading={isProcessing}
      />
    </div>
  );
};

export default Index;
