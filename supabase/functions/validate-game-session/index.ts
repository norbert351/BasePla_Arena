import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { wallet_address, game_type } = await req.json();

    if (!wallet_address || !game_type) {
      return new Response(
        JSON.stringify({ error: "Missing wallet_address or game_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the player
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("wallet_address", wallet_address.toLowerCase())
      .single();

    if (!player) {
      return new Response(
        JSON.stringify({ valid: false, session_id: null, player_id: null, reason: "No player found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for an active, paid session for this game type
    const { data: session } = await supabase
      .from("game_sessions")
      .select("id, is_active, fee_paid, tx_hash")
      .eq("player_id", player.id)
      .eq("game_type", game_type)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ valid: false, session_id: null, player_id: player.id, reason: "No active session" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Must have a tx_hash (payment verified)
    if (!session.tx_hash) {
      return new Response(
        JSON.stringify({ valid: false, session_id: null, player_id: player.id, reason: "Session not paid" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true, session_id: session.id, player_id: player.id, reason: null }),
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
