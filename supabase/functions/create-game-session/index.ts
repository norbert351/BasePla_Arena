import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http, keccak256, toHex, concat, stringToBytes, type Hex } from "https://esm.sh/viem@2.45.1";
import { base } from "https://esm.sh/viem@2.45.1/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Creator wallets that can use the reduced verification (sign-in) fee
const CREATOR_WALLETS = new Set([
  "0xadf983e3d07d6abf344e1923f1d2164d8dffd816",
  "0xf79f164e634b76815b80b60a85e1258eb21d631c",
].map((a) => a.toLowerCase()));

const BASE_L2_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as `0x${string}`;

// Resolve basename on-chain via Base L2 Resolver
async function resolveBasenameOnChain(address: string): Promise<string | null> {
  try {
    const client = createPublicClient({ chain: base, transport: http() });
    
    // Create namehash for reverse lookup
    const reverseName = `${address.slice(2).toLowerCase()}.addr.reverse`;
    let node = new Uint8Array(32).fill(0);
    const labels = reverseName.split('.').reverse();
    
    for (const label of labels) {
      const labelHash = keccak256(toHex(stringToBytes(label)));
      const nodeHex = `0x${Array.from(node).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex;
      const combined = concat([nodeHex, labelHash]);
      const hash = keccak256(combined);
      node = new Uint8Array(hash.slice(2).match(/.{2}/g)!.map(b => parseInt(b, 16)));
    }
    
    const reverseNode = `0x${Array.from(node).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex;
    const nameCallData = `0x691f3431${reverseNode.slice(2)}` as Hex;
    
    const nameResult = await client.call({
      to: BASE_L2_RESOLVER,
      data: nameCallData,
    }).catch(() => ({ data: null }));
    
    if (nameResult.data && nameResult.data !== '0x') {
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
    console.error("Basename resolution failed:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { wallet_address, tx_hash, token_type, fee_amount, is_creator } = await req.json();

    if (!wallet_address || !tx_hash || !token_type || !fee_amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate tx_hash format
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!txHashRegex.test(tx_hash)) {
      return new Response(
        JSON.stringify({ error: "Invalid transaction hash format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate token type
    if (!["ETH", "USDC"].includes(token_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid token type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isCreatorRequested = Boolean(is_creator);
    const walletLower = wallet_address.toLowerCase();
    const isCreatorWallet = CREATOR_WALLETS.has(walletLower);

    // Prevent users from claiming creator pricing with a non-creator wallet
    if (isCreatorRequested && !isCreatorWallet) {
      return new Response(
        JSON.stringify({ error: "Unauthorized creator wallet" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Creator sign-in must be ETH
    if (isCreatorRequested && token_type !== "ETH") {
      return new Response(
        JSON.stringify({ error: "Creator verification must be paid in ETH" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate fee amount matches expected values
    const expectedFees = isCreatorRequested
      ? { ETH: 0.0001, USDC: 1.49 }
      : { ETH: 0.0005, USDC: 1.49 };

    const parsedFee = parseFloat(fee_amount);
    if (Number.isNaN(parsedFee) || parsedFee <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid fee amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (parsedFee < expectedFees[token_type as keyof typeof expectedFees]) {
      return new Response(
        JSON.stringify({ error: "Insufficient fee amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if tx_hash has already been used (prevent replay attacks)
    const { data: existingSession } = await supabase
      .from("game_sessions")
      .select("id")
      .eq("tx_hash", tx_hash)
      .single();

    if (existingSession) {
      return new Response(
        JSON.stringify({ error: "Transaction hash already used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create player
    let playerId: string;
    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id")
      .eq("wallet_address", wallet_address.toLowerCase())
      .single();

    if (existingPlayer) {
      playerId = existingPlayer.id;
      
      // Try to update display_name with basename if not already set
      const { data: playerData } = await supabase
        .from("players")
        .select("display_name")
        .eq("id", playerId)
        .single();
      
      if (playerData && !playerData.display_name) {
        const basename = await resolveBasenameOnChain(walletLower);
        if (basename) {
          await supabase
            .from("players")
            .update({ display_name: basename })
            .eq("id", playerId);
        }
      }
    } else {
      // Resolve basename before creating player
      const basename = await resolveBasenameOnChain(walletLower);
      
      const { data: newPlayer, error: insertError } = await supabase
        .from("players")
        .insert({ 
          wallet_address: wallet_address.toLowerCase(),
          display_name: basename || null,
        })
        .select("id")
        .single();

      if (insertError || !newPlayer) {
        return new Response(
          JSON.stringify({ error: "Failed to create player" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      playerId = newPlayer.id;
    }

    // Create game session with tx_hash for verification
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert({
        player_id: playerId,
        fee_paid: parsedFee,
        tx_hash: tx_hash,
        token_type: token_type,
        is_active: true,
        score: 0
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create game session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        session_id: session.id,
        player_id: playerId 
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
