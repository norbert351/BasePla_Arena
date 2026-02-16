import { createPublicClient, http, type Address, type Hex, keccak256, toHex, concat, stringToBytes, hexToBytes, bytesToHex } from 'viem';
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
 * Simple namehash implementation for reverse lookup (browser-compatible)
 */
const namehash = (name: string): Hex => {
  let node = new Uint8Array(32).fill(0);
  
  if (name === '') return bytesToHex(node);
  
  const labels = name.split('.').reverse();
  
  for (const label of labels) {
    const labelHash = keccak256(toHex(stringToBytes(label)));
    const nodeHex = bytesToHex(node);
    const combined = concat([nodeHex, labelHash]);
    const hashBytes = hexToBytes(keccak256(combined));
    node = new Uint8Array(hashBytes);
  }
  
  return bytesToHex(node);
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
          // Browser-compatible hex to string conversion
          const bytes = new Uint8Array(
            nameHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))
          );
          name = new TextDecoder().decode(bytes);
        }
      } catch (e) {
        console.error('Failed to decode name:', e);
      }
    }

    // Try to resolve avatar text record if we have a name
    if (name) {
      try {
        const fullName = name.endsWith('.base.eth') ? name : `${name}.base.eth`;
        const nameNode = namehash(fullName);
        
        // text(bytes32 node, string key) selector = 0x59d1d43c
        // Encode: node (32 bytes) + offset to string (32 bytes) + string length (32 bytes) + string data
        const keyBytes = new TextEncoder().encode('avatar');
        const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const keyPadded = keyHex.padEnd(64, '0');
        
        const textCallData = `0x59d1d43c${nameNode.slice(2)}${'0000000000000000000000000000000000000000000000000000000000000040'}${'000000000000000000000000000000000000000000000000000000000000000' + keyBytes.length.toString(16)}${keyPadded}` as Hex;
        
        const avatarResult = await client.call({
          to: BASE_L2_RESOLVER,
          data: textCallData,
        }).catch(() => ({ data: null }));
        
        if (avatarResult.data && avatarResult.data !== '0x' && avatarResult.data.length > 130) {
          const adata = avatarResult.data.slice(2);
          const aoffset = parseInt(adata.slice(0, 64), 16) * 2;
          const alength = parseInt(adata.slice(aoffset, aoffset + 64), 16);
          if (alength > 0) {
            const avatarHex = adata.slice(aoffset + 64, aoffset + 64 + alength * 2);
            const avatarBytes = new Uint8Array(
              avatarHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))
            );
            avatar = new TextDecoder().decode(avatarBytes);
          }
        }
      } catch {
        // Avatar resolution is optional
      }
    }

    return {
      name: name ? name.replace(/\.base\.eth$/i, '') : null,
      avatar,
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
 * Get the Base app profile URL for a given basename or address
 */
export const getBaseProfileUrl = (addressOrName: string): string => {
  // Link to Base app profile page
  const cleanName = addressOrName.replace(/\.base\.eth$/i, '');
  if (cleanName.includes('.') || !cleanName.startsWith('0x')) {
    return `https://www.base.org/name/${cleanName}`;
  }
  return `https://basescan.org/address/${addressOrName}`;
};

/**
 * Generate a deterministic color from a wallet address for avatar fallback
 */
export const getAvatarColor = (address: string): string => {
  const hash = address.slice(2, 8);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, 65%, 55%)`;
};

/**
 * Get initials from a display name
 */
export const getInitials = (name: string): string => {
  if (name.startsWith('0x')) return name.slice(2, 4).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

/**
 * Shorten a basename for display
 */
export const shortenBasename = (name: string): string => {
  if (name.length <= 20) return name;
  return `${name.slice(0, 12)}...${name.slice(-6)}`;
};
