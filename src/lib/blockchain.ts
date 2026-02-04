import { createPublicClient, createWalletClient, custom, http, parseEther, parseUnits, formatEther, formatUnits, type Address, type Hex } from 'viem';
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
  
  // Use raw ethereum request for better compatibility
  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: fromAddress,
      to: FEE_COLLECTION_ADDRESS,
      value: `0x${parseEther(amount).toString(16)}`,
    }],
  });
  
  // Wait for confirmation
  const publicClient = getPublicClient();
  await publicClient.waitForTransactionReceipt({ hash: txHash[0] as Hex || txHash as unknown as Hex });
  
  return (txHash[0] || txHash) as Hex;
};

export const sendUSDCPayment = async (fromAddress: Address, amount: string): Promise<Hex> => {
  if (!window.ethereum) throw new Error('No wallet found');
  
  // USDC has 6 decimals
  const amountInUnits = parseUnits(amount, 6);
  
  // Encode the transfer function call
  const transferData = `0xa9059cbb000000000000000000000000${FEE_COLLECTION_ADDRESS.slice(2)}${amountInUnits.toString(16).padStart(64, '0')}` as Hex;
  
  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: fromAddress,
      to: USDC_ADDRESS,
      data: transferData,
    }],
  });
  
  // Wait for confirmation
  const publicClient = getPublicClient();
  await publicClient.waitForTransactionReceipt({ hash: txHash[0] as Hex || txHash as unknown as Hex });
  
  return (txHash[0] || txHash) as Hex;
};

export const switchToBaseNetwork = async (): Promise<void> => {
  if (!window.ethereum) throw new Error('No wallet found');
  
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }], // Base mainnet chain ID
    });
  } catch (error: any) {
    // If the chain is not added, add it
    if (error.code === 4902) {
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
    } else {
      throw error;
    }
  }
};

export { FEE_COLLECTION_ADDRESS, USDC_ADDRESS };
