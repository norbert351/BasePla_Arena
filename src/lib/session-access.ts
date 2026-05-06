import type { Address } from 'viem';
import { getETHBalance, getUSDCBalance } from '@/lib/blockchain';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export type GameType = '2048' | 'tetris' | 'typing';
export type SessionPaymentToken = 'ETH' | 'USDC';

export interface WalletBalanceSnapshot {
  ethBalance: string;
  usdcBalance: string;
}

export interface SessionValidationResult {
  valid: boolean;
  session_id: string | null;
  player_id: string | null;
  reason: string | null;
}

export const refreshWalletBalances = async (walletAddress: string): Promise<WalletBalanceSnapshot> => {
  const [ethBalance, usdcBalance] = await Promise.all([
    getETHBalance(walletAddress as Address),
    getUSDCBalance(walletAddress as Address),
  ]);

  return { ethBalance, usdcBalance };
};

export const hasSufficientBalance = (
  token: SessionPaymentToken,
  requiredFee: string,
  balances: WalletBalanceSnapshot,
) => {
  const availableBalance = token === 'ETH' ? balances.ethBalance : balances.usdcBalance;
  return parseFloat(availableBalance) >= parseFloat(requiredFee);
};

export const validateActiveGameSession = async (
  walletAddress: string,
  gameType: GameType,
): Promise<SessionValidationResult> => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-game-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: walletAddress,
      game_type: gameType,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to validate game session');
  }

  return result as SessionValidationResult;
};