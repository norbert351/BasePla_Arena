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

    const { session_id, wallet_address, score, end_game, save_to_leaderboard } = await req.json();

    if (!session_id || !wallet_address || score === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate score is a non-negative integer
    const parsedScore = parseInt(score);
    if (isNaN(parsedScore) || parsedScore < 0) {
      return new Response(
        JSON.stringify({ error: "Invalid score value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the session and verify ownership
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select(`
        id,
        player_id,
        is_active,
        score,
        players!inner (
          wallet_address
        )
      `)
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the wallet address matches the session owner
    const sessionWallet = (session.players as any).wallet_address?.toLowerCase();
    if (sessionWallet !== wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - wallet does not match session owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if session is still active
    if (!session.is_active) {
      return new Response(
        JSON.stringify({ error: "Session is no longer active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate score progression (score can only increase, prevents manipulation)
    if (parsedScore < session.score) {
      return new Response(
        JSON.stringify({ error: "Score cannot decrease" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit score increase per update (prevent unrealistic jumps)
    // Max 2048 * 4 = 8192 points per move (getting 2048 tile)
    const maxScoreIncrease = 8192;
    if (parsedScore - session.score > maxScoreIncrease) {
      console.warn(`Suspicious score increase: ${session.score} -> ${parsedScore} for session ${session_id}`);
      return new Response(
        JSON.stringify({ error: "Invalid score increase" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session
    const updateData: any = { score: parsedScore };
    if (end_game) {
      updateData.is_active = false;
      updateData.ended_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("game_sessions")
      .update(updateData)
      .eq("id", session_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update score" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If save_to_leaderboard is requested, upsert into leaderboard (only if higher)
    if (save_to_leaderboard && end_game) {
      const now = new Date();
      // Calculate current week boundaries (Monday to Sunday)
      const dayOfWeek = now.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() + mondayOffset);
      weekStart.setUTCHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Check existing leaderboard entry for this player & week
      const { data: existing } = await supabase
        .from("leaderboard")
        .select("id, high_score")
        .eq("player_id", session.player_id)
        .eq("week_start", weekStartStr)
        .single();

      if (existing) {
        // Only update if new score is higher
        if (parsedScore > existing.high_score) {
          await supabase
            .from("leaderboard")
            .update({ high_score: parsedScore, updated_at: now.toISOString() })
            .eq("id", existing.id);
        }
      } else {
        await supabase
          .from("leaderboard")
          .insert({
            player_id: session.player_id,
            high_score: parsedScore,
            week_start: weekStartStr,
            week_end: weekEndStr,
          });
      }
    }

    return new Response(
      JSON.stringify({ success: true, score: parsedScore }),
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
