import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Creator wallets that can use the reduced verification (sign-in) fee
const CREATOR_WALLETS = new Set([
  "0xadf983e3d07d6abf344e1923f1d2164d8dffd816",
  "0xf79f164e634b76815b80b60a85e1258eb21d631c",
].map((a) => a.toLowerCase()));

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
    } else {
      const { data: newPlayer, error: insertError } = await supabase
        .from("players")
        .insert({ wallet_address: wallet_address.toLowerCase() })
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
