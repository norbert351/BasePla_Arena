import { createPublicClient, http, type Address, type Hex, keccak256, toHex, concat, stringToBytes } from 'viem';
import { base } from 'viem/chains';

// Base L2 Resolver contract address
const BASE_L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD' as Address;

export interface BaseProfile {
  name: string | null;
  avatar: string | null;
  address: string;
}

const getPublicClient = () => {
  return createPublicClient({
    chain: base,
    transport: http(),
  });
};

/**
 * Simple namehash implementation for reverse lookup
 */
const namehash = (name: string): Hex => {
  let node = new Uint8Array(32).fill(0);
  
  if (name === '') return `0x${Buffer.from(node).toString('hex')}` as Hex;
  
  const labels = name.split('.').reverse();
  
  for (const label of labels) {
    const labelHash = keccak256(toHex(stringToBytes(label)));
    const combined = concat([`0x${Buffer.from(node).toString('hex')}` as Hex, labelHash]);
    node = new Uint8Array(Buffer.from(keccak256(combined).slice(2), 'hex'));
  }
  
  return `0x${Buffer.from(node).toString('hex')}` as Hex;
};

/**
 * Resolve a Base address to its Basename profile
 */
export const resolveBasename = async (address: string): Promise<BaseProfile> => {
  try {
    const client = getPublicClient();
    
    // Create reverse node for address lookup
    const reverseName = `${address.slice(2).toLowerCase()}.addr.reverse`;
    const reverseNode = namehash(reverseName);
    
    // Function selector for name(bytes32) = 0x691f3431
    const nameCallData = `0x691f3431${reverseNode.slice(2)}` as Hex;
    
    // Try to get the name from the resolver
    const nameResult = await client.call({
      to: BASE_L2_RESOLVER,
      data: nameCallData,
    }).catch(() => ({ data: null }));

    let name: string | null = null;
    let avatar: string | null = null;
    
    if (nameResult.data && nameResult.data !== '0x') {
      try {
        // Decode the string from ABI encoding
        const data = nameResult.data.slice(2);
        if (data.length >= 128) {
          const offset = parseInt(data.slice(0, 64), 16) * 2;
          const length = parseInt(data.slice(offset, offset + 64), 16);
          const nameHex = data.slice(offset + 64, offset + 64 + length * 2);
          name = Buffer.from(nameHex, 'hex').toString('utf8');
        }
      } catch (e) {
        console.error('Failed to decode name:', e);
      }
    }

    return {
      name: name || null,
      avatar: avatar,
      address,
    };
  } catch (error) {
    console.error('Failed to resolve Basename:', error);
    return {
      name: null,
      avatar: null,
      address,
    };
  }
};

/**
 * Get the Base profile URL for a given address or basename
 */
export const getBaseProfileUrl = (addressOrName: string): string => {
  // If it's a basename (ends with .base.eth or similar), use it directly
  if (addressOrName.includes('.')) {
    return `https://www.base.org/name/${addressOrName}`;
  }
  // Otherwise use the address
  return `https://basescan.org/address/${addressOrName}`;
};

/**
 * Shorten a basename for display
 */
export const shortenBasename = (name: string): string => {
  if (name.length <= 20) return name;
  return `${name.slice(0, 12)}...${name.slice(-6)}`;
};
