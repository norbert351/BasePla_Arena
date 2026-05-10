import { createPublicClient, createWalletClient, custom, http, parseEther, parseUnits, formatEther, formatUnits, type Address, type Hex } from 'viem';
import { getConnections, sendTransaction } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi';
import { base } from 'viem/chains';

// Base mainnet USDC contract address
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;
const FEE_COLLECTION_ADDRESS = '0xadf983e3d07d6abf344e1923f1d2164d8dffd816' as Address;

// ERC20 ABI for USDC transfers
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const getPublicClient = () => {
  return createPublicClient({
    chain: base,
    transport: http(),
  });
};

export const getWalletClient = () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet found');
  }
  return createWalletClient({
    chain: base,
    transport: custom(window.ethereum),
  });
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const getEip1193Provider = (): Eip1193Provider => {
  if (typeof window === 'undefined' || !(window as any).ethereum?.request) {
    throw new Error('No wallet found');
  }
  return (window as any).ethereum as Eip1193Provider;
};

/**
 * Ensure the dapp is authorized for the currently selected wallet account.
 * In some in-app wallets (e.g. embedded browsers), localStorage can get out of sync
 * with the wallet’s active account, producing “not authorized” errors.
 */
const ensureAuthorizedAccount = async (expected?: Address): Promise<Address> => {
  const provider = getEip1193Provider();

  let accounts = (await provider.request({ method: 'eth_accounts' })) as unknown;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    accounts = (await provider.request({ method: 'eth_requestAccounts' })) as unknown;
  }

  const active = Array.isArray(accounts) && typeof accounts[0] === 'string' ? (accounts[0] as string) : null;
  if (!active) {
    throw new Error('Wallet not connected');
  }

  if (expected && active.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('Wallet account changed. Please reconnect your wallet.');
  }

  return active as Address;
};

export const getETHBalance = async (address: Address): Promise<string> => {
  try {
    const client = getPublicClient();
    const balance = await client.getBalance({ address });
    return formatEther(balance);
  } catch (error) {
    console.error('Failed to get ETH balance:', error);
    return '0';
  }
};

export const getUSDCBalance = async (address: Address): Promise<string> => {
  try {
    const client = getPublicClient();
    // Use a raw call to avoid type issues
    const data = await client.call({
      to: USDC_ADDRESS,
      data: `0x70a08231000000000000000000000000${address.slice(2)}` as Hex, // balanceOf(address)
    });
    if (data.data) {
      const balance = BigInt(data.data);
      return formatUnits(balance, 6); // USDC has 6 decimals
    }
    return '0';
  } catch (error) {
    console.error('Failed to get USDC balance:', error);
    return '0';
  }
};

export const sendETHPayment = async (fromAddress: Address, amount: string): Promise<Hex> => {
  if (!window.ethereum) throw new Error('No wallet found');

  // Ensure the wallet is on Base and that the selected account is authorized.
  await switchToBaseNetwork();
  const from = await ensureAuthorizedAccount(fromAddress);

  try {
    const connector = getConnections(wagmiConfig).find(
      (connection) => connection.accounts.some((account) => account.toLowerCase() === from.toLowerCase())
    )?.connector;

    const txHash = await sendTransaction(wagmiConfig, {
      account: from,
      chainId: base.id,
      connector,
      to: FEE_COLLECTION_ADDRESS,
      value: parseEther(amount),
    });

    if (typeof txHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      // Prevent viem from calling RPC methods with an invalid hash (e.g. "0")
      throw new Error('Transaction was cancelled or did not return a valid hash');
    }

    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: txHash as Hex });

    return txHash as Hex;
  } catch (error: any) {
    // Normalize common wallet rejection errors
    if (error?.code === 4001) {
      throw new Error('User rejected the transaction');
    }
    throw error;
  }
};

export const sendUSDCPayment = async (fromAddress: Address, amount: string): Promise<Hex> => {
  if (!window.ethereum) throw new Error('No wallet found');

  // Ensure the wallet is on Base and that the selected account is authorized.
  await switchToBaseNetwork();
  const from = await ensureAuthorizedAccount(fromAddress);

  // USDC has 6 decimals
  const amountInUnits = parseUnits(amount, 6);

  // Encode the transfer function call
  const transferData = `0xa9059cbb000000000000000000000000${FEE_COLLECTION_ADDRESS.slice(2)}${amountInUnits
    .toString(16)
    .padStart(64, '0')}` as Hex;

  try {
    const connector = getConnections(wagmiConfig).find(
      (connection) => connection.accounts.some((account) => account.toLowerCase() === from.toLowerCase())
    )?.connector;

    const txHash = await sendTransaction(wagmiConfig, {
      account: from,
      chainId: base.id,
      connector,
      to: USDC_ADDRESS,
      data: transferData,
    });

    if (typeof txHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new Error('Transaction was cancelled or did not return a valid hash');
    }

    const publicClient = getPublicClient();
    await publicClient.waitForTransactionReceipt({ hash: txHash as Hex });

    return txHash as Hex;
  } catch (error: any) {
    if (error?.code === 4001) {
      throw new Error('User rejected the transaction');
    }
    throw error;
  }
};

export const switchToBaseNetwork = async (): Promise<void> => {
  if (!window.ethereum) throw new Error('No wallet found');

  // Check current chain first — many smart wallets (Coinbase Smart Wallet) are
  // permanently on Base and reject `wallet_switchEthereumChain` calls.
  try {
    const currentChainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
    if (typeof currentChainId === 'string' && currentChainId.toLowerCase() === '0x2105') {
      return; // Already on Base
    }
  } catch {
    // If we can't read the chain, fall through and try to switch.
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }],
    });
  } catch (error: any) {
    if (error?.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
      } catch (addErr) {
        console.warn('Failed to add Base network, continuing anyway:', addErr);
      }
      return;
    }
    // User rejected — surface that
    if (error?.code === 4001) {
      throw new Error('User rejected network switch');
    }
    // Some wallets (Coinbase Smart Wallet) don't support switching — they're already on Base.
    // Don't block the payment flow.
    console.warn('Network switch unsupported, continuing:', error?.message || error);
  }
};

export { FEE_COLLECTION_ADDRESS, USDC_ADDRESS };

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: any[]) => void) => void;
      removeListener?: (event: string, listener: (...args: any[]) => void) => void;
    };
  }
}
