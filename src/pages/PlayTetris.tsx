import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTetris } from '@/hooks/useTetris';
import { TetrisBoard } from '@/components/game/TetrisBoard';
import { ScoreBox } from '@/components/game/ScoreBox';
import { WalletConnect } from '@/components/game/WalletConnect';
import { GameOverModal } from '@/components/game/GameOverModal';
import { PaymentModal, PaymentToken } from '@/components/game/PaymentModal';
import { ExitGameModal } from '@/components/game/ExitGameModal';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { sendETHPayment, sendUSDCPayment } from '@/lib/blockchain';
import { RotateCcw, Lock, ArrowLeft, Trophy, Pause, Play, ChevronsDown, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import type { Address } from 'viem';
import baseplayLogo from '@/assets/baseplay-logo.png';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const GAME_FEE_USDC = '0.99';
const CREATOR_FEE_ETH = '0.0001';

const CREATOR_WALLETS = [
  '0xadf983e3d07d6abf344e1923f1d2164d8dffd816',
  '0xf79f164e634b76815b80b60a85e1258eb21d631c',
].map(addr => addr.toLowerCase());

const isCreatorWallet = (address: string | null) =>
  address && CREATOR_WALLETS.includes(address.toLowerCase());

const PlayTetris = () => {
  const { board, score, level, lines, gameOver, isPaused, softDropping, moveDown, moveHorizontal, rotatePiece, hardDrop, resetGame, togglePause, setSoftDropping, setFrozen } = useTetris();
  const navigate = useNavigate();

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
  const [scoreSaved, setScoreSaved] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const isCreator = isCreatorWallet(walletAddress);
  const isGameActive = hasPaidForSession && !gameOver && sessionId;

  // Keep board frozen until paid
  useEffect(() => {
    setFrozen(!hasPaidForSession);
  }, [hasPaidForSession, setFrozen]);

  useEffect(() => {
    const fetchEthFee = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/eth-price`);
        if (res.ok) {
          const data = await res.json();
          if (data.fee_eth) { setDynamicEthFee(data.fee_eth); setEthPriceUsd(data.eth_price_usd ?? null); }
        }
      } catch { setDynamicEthFee('0.00040000'); }
    };
    fetchEthFee();
  }, []);

  const handleBalanceUpdate = useCallback((ethBal: string, usdcBal: string) => { setBalanceETH(ethBal); setBalanceUSDC(usdcBal); }, []);

  const handleWalletConnect = useCallback(async (address: string) => {
    setWalletAddress(address);
    const { data } = await supabase.from('players').select('id').eq('wallet_address', address.toLowerCase()).single();
    if (data) setPlayerId(data.id);
  }, []);

  const handleWalletDisconnect = useCallback(() => {
    setWalletAddress(null); setPlayerId(null); setSessionId(null);
    setBalanceETH('0'); setBalanceUSDC('0'); setHasPaidForSession(false);
  }, []);

  const startNewGame = useCallback(async (token: PaymentToken) => {
    if (!walletAddress) { toast.error('Connect wallet first'); return; }
    setIsProcessing(true);
    try {
      const isCreatorPayment = isCreator;
      const feeAmount = isCreatorPayment ? CREATOR_FEE_ETH : token === 'ETH' ? dynamicEthFee ?? '0.00040000' : GAME_FEE_USDC;
      const paymentToken = isCreatorPayment ? 'ETH' : token;

      let txHash: string;
      if (paymentToken === 'ETH') txHash = await sendETHPayment(walletAddress as Address, feeAmount);
      else txHash = await sendUSDCPayment(walletAddress as Address, feeAmount);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-game-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddress, tx_hash: txHash, token_type: paymentToken, fee_amount: feeAmount, is_creator: isCreatorPayment, game_type: 'tetris' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setSessionId(result.session_id); setPlayerId(result.player_id);
      setHasPaidForSession(true); setScoreSaved(false); resetGame(); setShowPayment(false);
      toast.success('Game started!');
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
    } finally { setIsProcessing(false); }
  }, [walletAddress, isCreator, dynamicEthFee, resetGame]);

  const handlePlayAgain = useCallback(() => {
    setScoreSaved(false);
    setHasPaidForSession(false);
    setSessionId(null);
    if (walletAddress && playerId) setShowPayment(true);
    else resetGame();
  }, [walletAddress, playerId, resetGame]);

  const endSession = useCallback(async (saveScore: boolean) => {
    if (sessionId && walletAddress && score >= 0) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/update-game-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, wallet_address: walletAddress, score, end_game: true, save_to_leaderboard: saveScore }),
        });
      } catch (e) { console.error(e); }
    }
    setHasPaidForSession(false);
    setSessionId(null);
  }, [sessionId, walletAddress, score]);

  const handleSaveScore = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !walletAddress) return false;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-game-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, wallet_address: walletAddress, score, end_game: true, save_to_leaderboard: true }),
      });
      if (res.ok) {
        setScoreSaved(true);
        setHasPaidForSession(false);
        toast.success('Score saved to leaderboard!');
        return true;
      }
    } catch (e) { console.error(e); }
    toast.error('Failed to save score');
    return false;
  }, [sessionId, walletAddress, score]);

  // Auto end session on game over
  useEffect(() => {
    if (gameOver && sessionId && walletAddress) {
      fetch(`${SUPABASE_URL}/functions/v1/update-game-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, wallet_address: walletAddress, score, end_game: true }),
      }).catch(console.error);
    }
  }, [gameOver, sessionId, walletAddress, score]);

  // Handle back button click - show exit modal if game active
  const handleBackClick = useCallback((e: React.MouseEvent) => {
    if (isGameActive) {
      e.preventDefault();
      togglePause(); // pause game
      setShowExitModal(true);
    }
  }, [isGameActive, togglePause]);

  const handleExitCancel = useCallback(() => {
    setShowExitModal(false);
    if (isPaused) togglePause(); // resume
  }, [isPaused, togglePause]);

  const handleSaveAndExit = useCallback(async () => {
    await endSession(true);
    setShowExitModal(false);
    toast.success('Score saved!');
    navigate('/');
  }, [endSession, navigate]);

  const handleExitWithoutSaving = useCallback(async () => {
    await endSession(false);
    setShowExitModal(false);
    navigate('/');
  }, [endSession, navigate]);

  // Browser back button / beforeunload
  useEffect(() => {
    if (!isGameActive) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGameActive]);

  const needsWalletConnection = !walletAddress;
  const needsPayment = walletAddress && !hasPaidForSession;
  const isPlayBlocked = needsWalletConnection || !!needsPayment;
  const showControls = walletAddress && hasPaidForSession && !gameOver;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500/20 via-background to-secondary/30">
      <header className="py-3 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" onClick={handleBackClick} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <img src={baseplayLogo} alt="BasePlay" className="h-7 w-7" width={28} height={28} />
          </Link>
          <h1 className="text-2xl font-black" style={{ background: 'linear-gradient(135deg, hsl(280,65%,55%), hsl(330,80%,55%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tetris</h1>
          <div className="flex items-center gap-1">
            <Link to="/leaderboard/tetris"><Button variant="ghost" size="sm"><Trophy className="h-4 w-4" /></Button></Link>
            <WalletConnect onConnect={handleWalletConnect} onDisconnect={handleWalletDisconnect} onBalanceUpdate={handleBalanceUpdate} />
          </div>
        </div>
      </header>

      <main className="px-3 pb-3">
        <div className="max-w-sm mx-auto space-y-2">
          <div className="flex items-center justify-between gap-2">
            <ScoreBox label="Score" score={score} />
            <ScoreBox label="Level" score={level} />
            <ScoreBox label="Lines" score={lines} />
          </div>

          <div className="flex justify-center gap-2">
            {showControls && (
              <Button variant="outline" size="sm" onClick={togglePause}>
                {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            )}
            {walletAddress && hasPaidForSession && (
              <Button variant="outline" size="sm" onClick={() => setShowPayment(true)} className="gradient-primary text-primary-foreground border-none">
                <RotateCcw className="mr-1 h-4 w-4" /> New Game
              </Button>
            )}
          </div>

          <div className="relative">
            {isPlayBlocked && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center rounded-xl">
                <Lock className="h-12 w-12 text-primary mb-4" />
                {needsWalletConnection ? (
                  <>
                    <p className="text-lg font-semibold mb-2">Connect Wallet to Play</p>
                    <WalletConnect onConnect={handleWalletConnect} onDisconnect={handleWalletDisconnect} onBalanceUpdate={handleBalanceUpdate} />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold mb-2">Pay to Play</p>
                    <Button onClick={() => setShowPayment(true)} className="gradient-gold text-accent-foreground">Pay $0.99</Button>
                  </>
                )}
              </div>
            )}
            <TetrisBoard board={board} disabled={!!isPlayBlocked}
              onMoveLeft={() => moveHorizontal(-1)} onMoveRight={() => moveHorizontal(1)}
              onMoveDown={moveDown} onRotate={rotatePiece} onHardDrop={hardDrop}
            />
          </div>

          {showControls && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" className="flex-1 max-w-[140px]" onClick={hardDrop}>
                <ChevronsDown className="h-4 w-4 mr-1" /> Hard Drop
              </Button>
              <Button
                variant={softDropping ? "default" : "outline"}
                size="sm"
                className={`flex-1 max-w-[140px] ${softDropping ? 'gradient-primary text-primary-foreground border-none' : ''}`}
                onClick={() => setSoftDropping(!softDropping)}
              >
                <ArrowDown className="h-4 w-4 mr-1" /> {softDropping ? 'Fast ●' : 'Speed Up'}
              </Button>
            </div>
          )}

          <p className="text-center text-muted-foreground text-xs">
            Tap to rotate • Swipe to move • Swipe down to drop
          </p>
        </div>
      </main>

      <GameOverModal isOpen={gameOver} score={score} won={false} onPlayAgain={handlePlayAgain} onClose={handlePlayAgain} onSaveScore={sessionId ? handleSaveScore : undefined} scoreSaved={scoreSaved} />
      <PaymentModal isOpen={showPayment} onClose={() => setShowPayment(false)} onPay={startNewGame}
        feeETH={isCreator ? CREATOR_FEE_ETH : dynamicEthFee ?? '0.00040000'} feeUSDC={GAME_FEE_USDC}
        balanceETH={balanceETH} balanceUSDC={balanceUSDC} isLoading={isProcessing}
        isCreator={isCreator} ethPriceUsd={ethPriceUsd ?? undefined}
      />
      <ExitGameModal
        isOpen={showExitModal}
        score={score}
        onCancel={handleExitCancel}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
      />
    </div>
  );
};

export default PlayTetris;
