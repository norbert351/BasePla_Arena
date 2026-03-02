import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http, keccak256, toHex, concat, stringToBytes, type Hex } from "https://esm.sh/viem@2.45.1";
import { base } from "https://esm.sh/viem@2.45.1/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_L2_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as `0x${string}`;

function namehash(name: string): Hex {
  let node = new Uint8Array(32).fill(0);
  if (name === "") return `0x${Array.from(node).map(b => b.toString(16).padStart(2, "0")).join("")}` as Hex;
  
  const labels = name.split(".").reverse();
  for (const label of labels) {
    const labelHash = keccak256(toHex(stringToBytes(label)));
    const nodeHex = `0x${Array.from(node).map(b => b.toString(16).padStart(2, "0")).join("")}` as Hex;
    const combined = concat([nodeHex, labelHash]);
    const hash = keccak256(combined);
    node = new Uint8Array(hash.slice(2).match(/.{2}/g)!.map(b => parseInt(b, 16)));
  }
  
  return `0x${Array.from(node).map(b => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

async function resolveBasename(address: string): Promise<string | null> {
  try {
    const client = createPublicClient({ chain: base, transport: http() });
    const reverseName = `${address.slice(2).toLowerCase()}.addr.reverse`;
    const reverseNode = namehash(reverseName);
    const nameCallData = `0x691f3431${reverseNode.slice(2)}` as Hex;
    
    const nameResult = await client.call({
      to: BASE_L2_RESOLVER,
      data: nameCallData,
    }).catch(() => ({ data: null }));
    
    if (nameResult.data && nameResult.data !== "0x") {
      const data = nameResult.data.slice(2);
      if (data.length >= 128) {
        const offset = parseInt(data.slice(0, 64), 16) * 2;
        const length = parseInt(data.slice(offset, offset + 64), 16);
        const nameHex = data.slice(offset + 64, offset + 64 + length * 2);
        const bytes = nameHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16));
        const fullName = new TextDecoder().decode(new Uint8Array(bytes));
        return fullName.replace(/\.base\.eth$/i, '');
      }
    }
    return null;
  } catch (e) {
    console.error("Resolution failed for", address, e);
    return null;
  }
}

/** Look up Farcaster profile by verified wallet address using Searchcaster */
async function lookupFarcasterByWallet(address: string): Promise<{
  fid: number | null;
  displayName: string | null;
  pfpUrl: string | null;
  username: string | null;
}> {
  try {
    // Try Searchcaster API (public, no key needed)
    const res = await fetch(
      `https://searchcaster.xyz/api/profiles?connected_address=${address.toLowerCase()}`
    );
    if (res.ok) {
      const profiles = await res.json();
      if (profiles && profiles.length > 0) {
        const p = profiles[0];
        return {
          fid: p.body?.id || null,
          displayName: p.body?.displayName || p.body?.username || null,
          pfpUrl: p.body?.avatarUrl || null,
          username: p.body?.username || null,
        };
      }
    }
  } catch (e) {
    console.error("Searchcaster lookup failed for", address, e);
  }

  try {
    // Fallback: try Farcaster hub directly
    const res = await fetch(
      `https://hub.pinata.cloud/v1/verificationsByAddress?address=${address.toLowerCase()}`
    );
    if (res.ok) {
      const data = await res.json();
      const messages = data.messages || [];
      if (messages.length > 0) {
        const fid = messages[0]?.data?.fid;
        if (fid) {
          // Get user data from hub
          const userRes = await fetch(
            `https://hub.pinata.cloud/v1/userDataByFid?fid=${fid}`
          );
          if (userRes.ok) {
            const userData = await userRes.json();
            const userMessages = userData.messages || [];
            let displayName: string | null = null;
            let pfpUrl: string | null = null;
            let username: string | null = null;

            for (const msg of userMessages) {
              const type = msg?.data?.userDataBody?.type;
              const value = msg?.data?.userDataBody?.value;
              if (type === "USER_DATA_TYPE_DISPLAY" || type === 2) displayName = value;
              if (type === "USER_DATA_TYPE_PFP" || type === 1) pfpUrl = value;
              if (type === "USER_DATA_TYPE_USERNAME" || type === 6) username = value;
            }

            return { fid, displayName, pfpUrl, username };
          }
        }
      }
    }
  } catch (e) {
    console.error("Hub lookup failed for", address, e);
  }

  return { fid: null, displayName: null, pfpUrl: null, username: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all players missing profile data
    const { data: players, error } = await supabase
      .from("players")
      .select("id, wallet_address, display_name, fid, pfp_url");

    if (error) throw error;

    const results: any[] = [];

    for (const player of players || []) {
      const updates: Record<string, any> = {};

      // Try basename resolution if no display_name
      if (!player.display_name) {
        const basename = await resolveBasename(player.wallet_address);
        if (basename) updates.display_name = basename;
      }

      // Try Farcaster lookup if no fid
      if (!player.fid) {
        const fc = await lookupFarcasterByWallet(player.wallet_address);
        if (fc.fid) updates.fid = fc.fid;
        if (fc.pfpUrl) updates.pfp_url = fc.pfpUrl;
        if (fc.displayName && !updates.display_name && !player.display_name) {
          updates.display_name = fc.displayName;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("players")
          .update(updates)
          .eq("id", player.id);

        results.push({
          wallet: player.wallet_address,
          updates,
          updated: !updateError,
        });
      } else {
        results.push({
          wallet: player.wallet_address,
          updates: {},
          updated: false,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_players: players?.length || 0,
        resolved: results.filter(r => Object.keys(r.updates).length > 0).length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
