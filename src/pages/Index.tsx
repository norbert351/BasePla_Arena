import { useState, useCallback, useEffect, useRef } from 'react';
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
import logo2048 from '@/assets/logo-2048.png';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// USDC is always $1.49. ETH is fetched at runtime via the eth-price edge function.
const GAME_FEE_USDC = '1.49';
const CREATOR_FEE_ETH = '0.0001'; // $0.10 for creators (sign-only verification)

// Creator wallet addresses that can access admin AND pay reduced fee
const CREATOR_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
  '0xf79f164e634b76815b80b60a85e1258eb21d631c',
].map(addr => addr.toLowerCase());

const isCreatorWallet = (address: string | null) => 
  address && CREATOR_WALLETS.includes(address.toLowerCase());

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
  const [dynamicEthFee, setDynamicEthFee] = useState<string | null>(null);
  const [ethPriceUsd, setEthPriceUsd] = useState<number | null>(null);

  const isAdmin = isCreatorWallet(walletAddress);
  const isCreator = isCreatorWallet(walletAddress);

  // Fetch dynamic ETH price (once on mount)
  useEffect(() => {
    const fetchEthFee = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/eth-price`);
        if (res.ok) {
          const data = await res.json();
          if (data.fee_eth) {
            setDynamicEthFee(data.fee_eth);
            setEthPriceUsd(data.eth_price_usd ?? null);
          }
        }
      } catch {
        setDynamicEthFee('0.00050000');
      }
    };
    fetchEthFee();
  }, []);

  const handleBalanceUpdate = useCallback((ethBal: string, usdcBal: string) => {
    setBalanceETH(ethBal);
    setBalanceUSDC(usdcBal);
  }, []);

  const handleWalletConnect = useCallback(async (address: string) => {
    setWalletAddress(address);
    
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('wallet_address', address.toLowerCase())
      .single();

    if (existingPlayer) {
      setPlayerId(existingPlayer.id);
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
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    try {
      const isCreatorPayment = isCreator;
      const feeAmount = isCreatorPayment
        ? CREATOR_FEE_ETH
        : token === 'ETH'
        ? dynamicEthFee ?? '0.00050000'
        : GAME_FEE_USDC;
      const paymentToken = isCreatorPayment ? 'ETH' : token;
      
      toast.info(isCreatorPayment 
        ? `Creator verification: Sending ${feeAmount} ETH... Please sign in your wallet.`
        : `Sending ${feeAmount} ${paymentToken}... Please confirm in your wallet.`
      );
      
      let txHash: string;
      if (paymentToken === 'ETH') {
        txHash = await sendETHPayment(walletAddress as Address, feeAmount);
      } else {
        txHash = await sendUSDCPayment(walletAddress as Address, feeAmount);
      }

      toast.info('Payment confirmed! Creating game session...');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-game-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          tx_hash: txHash,
          token_type: paymentToken,
          fee_amount: feeAmount,
          is_creator: isCreatorPayment,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create game session');
      }

      setSessionId(result.session_id);
      setPlayerId(result.player_id);
      setHasPaidForSession(true);
      resetGame();
      setShowPayment(false);
      toast.success(isCreatorPayment ? 'Creator verified! Game started!' : 'Game started! Good luck!');
    } catch (error: any) {
      console.error('Failed to start game:', error);
      const msg = String(error?.message || '').toLowerCase();

      if (msg.includes('reconnect your wallet') || msg.includes('account changed')) {
        toast.error('Wallet account changed — please disconnect and reconnect, then try again.');
      } else if (msg.includes('rejected') || msg.includes('denied') || msg.includes('not been authorized') || msg.includes('not authorized')) {
        toast.error('Transaction cancelled or not authorized');
      } else {
        toast.error(error.message || 'Failed to process payment');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [walletAddress, isCreator, dynamicEthFee, resetGame]);

  const handlePlayAgain = useCallback(() => {
    if (walletAddress && playerId) {
      setShowPayment(true);
    } else {
      resetGame();
    }
  }, [walletAddress, playerId, resetGame]);

  const prevScoreRef = useRef(score);
  
  const handleGameEnd = useCallback(async () => {
    if (sessionId && walletAddress && score > 0) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/update-game-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            wallet_address: walletAddress,
            score: score,
            end_game: true,
          }),
        });
      } catch (error) {
        console.error('Failed to save score:', error);
      }
      setHasPaidForSession(false);
    }
  }, [sessionId, walletAddress, score]);

  useEffect(() => {
    if (sessionId && walletAddress && hasPaidForSession && score > prevScoreRef.current + 500) {
      prevScoreRef.current = score;
      fetch(`${SUPABASE_URL}/functions/v1/update-game-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          wallet_address: walletAddress,
          score: score,
          end_game: false,
        }),
      }).catch(console.error);
    }
  }, [sessionId, walletAddress, hasPaidForSession, score]);

  useEffect(() => {
    if ((gameOver || won) && sessionId) {
      handleGameEnd();
    }
  }, [gameOver, won, sessionId, handleGameEnd]);

  const needsWalletConnection = !walletAddress;
  const needsPayment = walletAddress && !hasPaidForSession && !gameOver && !won;
  const isPlayBlocked = needsWalletConnection || needsPayment;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <img src={logo2048} alt="2048 on BASE" className="h-16 w-16 rounded-xl" />
            <h1 className="text-5xl md:text-7xl font-black gradient-title drop-shadow-lg">
              2048
            </h1>
          </div>
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

              <div className="gradient-primary rounded-lg p-4 text-center text-primary-foreground">
                <p className="text-sm font-medium">
                  💰 Pay ${GAME_FEE_USDC} per session (ETH or USDC) • Top 20 monthly players share 60% of fees!
                </p>
              </div>

              <div className="relative">
                {isPlayBlocked && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center rounded-xl">
                    <Lock className="h-12 w-12 text-primary mb-4" />
                    {needsWalletConnection ? (
                      <>
                        <p className="text-lg font-semibold mb-2">Connect Wallet to Play</p>
                        <p className="text-sm text-muted-foreground mb-4">Connect your Base wallet to start playing</p>
                        <WalletConnect
                          onConnect={handleWalletConnect}
                          onDisconnect={handleWalletDisconnect}
                          onBalanceUpdate={handleBalanceUpdate}
                        />
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold mb-2">Pay to Play</p>
                        <p className="text-sm text-muted-foreground mb-4">Unlock the game with ${GAME_FEE_USDC}</p>
                        <Button
                          onClick={() => setShowPayment(true)}
                          className="gradient-gold text-accent-foreground"
                        >
                          Pay Entry Fee
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <GameBoard grid={grid} onMove={move} disabled={!!isPlayBlocked} />
              </div>

              <p className="text-center text-muted-foreground text-sm">
                Use arrow keys or swipe to move tiles. Combine matching numbers to reach 2048!
              </p>

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

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-border/50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            Built by{' '}
            <a
              href="https://x.com/Zubby_crypt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              @Zubby_crypt
            </a>
            {' '}• Follow for updates
          </p>
        </div>
      </footer>

      {/* Modals */}
      <GameOverModal
        isOpen={gameOver || (won && !gameOver)}
        score={score}
        won={won}
        onPlayAgain={handlePlayAgain}
        onClose={handlePlayAgain}
      />

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onPay={startNewGame}
        feeETH={isCreator ? CREATOR_FEE_ETH : dynamicEthFee ?? '0.00050000'}
        feeUSDC={GAME_FEE_USDC}
        balanceETH={balanceETH}
        balanceUSDC={balanceUSDC}
        isLoading={isProcessing}
        isCreator={isCreator}
        ethPriceUsd={ethPriceUsd ?? undefined}
      />
    </div>
  );
};

export default Index;
