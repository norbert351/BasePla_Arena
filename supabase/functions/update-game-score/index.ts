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

    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedScore = parseInt(score);
    if (isNaN(parsedScore) || parsedScore < 0) {
      return new Response(
        JSON.stringify({ error: "Invalid score value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the session
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id, player_id, is_active, score, game_type")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      console.error("Session lookup error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify wallet ownership via players table
    const { data: player } = await supabase
      .from("players")
      .select("wallet_address")
      .eq("id", session.player_id)
      .single();

    const sessionWallet = player?.wallet_address?.toLowerCase();
    if (sessionWallet !== wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - wallet does not match session owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shouldSaveToLeaderboard = Boolean(save_to_leaderboard || end_game);

    if (!session.is_active && !shouldSaveToLeaderboard) {
      return new Response(
        JSON.stringify({ error: "Session is no longer active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If session is already ended, only allow leaderboard save with existing score
    const effectiveScore = !session.is_active ? session.score : parsedScore;

    if (session.is_active) {
      if (parsedScore < session.score) {
        return new Response(
          JSON.stringify({ error: "Score cannot decrease" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Different max score increase for different games
      const maxScoreIncrease = session.game_type === 'tetris' ? 50000 : session.game_type === 'typing' ? 10000 : 8192;
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
    }

    // Save to leaderboard — compare against ALL-TIME high score (no week filter)
    if (shouldSaveToLeaderboard) {
      const now = new Date();
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

      // Check ALL-TIME best for this player (across all weeks)
      const { data: allTimeBest } = await supabase
        .from("leaderboard")
        .select("id, high_score")
        .eq("player_id", session.player_id)
        .eq("game_type", session.game_type)
        .order("high_score", { ascending: false })
        .limit(1)
        .single();

      // Only save if this score is higher than all-time best (or no entry exists)
      if (!allTimeBest || effectiveScore > allTimeBest.high_score) {
        // Check if there's an entry for this week
        const { data: weekEntry } = await supabase
          .from("leaderboard")
          .select("id")
          .eq("player_id", session.player_id)
          .eq("week_start", weekStartStr)
          .eq("game_type", session.game_type)
          .single();

        if (weekEntry) {
          const { error: leaderboardUpdateError } = await supabase
            .from("leaderboard")
            .update({ high_score: effectiveScore, updated_at: now.toISOString() })
            .eq("id", weekEntry.id);

          if (leaderboardUpdateError) {
            console.error("Leaderboard update error:", leaderboardUpdateError);
            return new Response(
              JSON.stringify({ error: "Failed to update leaderboard" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          const { error: leaderboardInsertError } = await supabase
            .from("leaderboard")
            .insert({
              player_id: session.player_id,
              high_score: effectiveScore,
              week_start: weekStartStr,
              week_end: weekEndStr,
              game_type: session.game_type,
            });

          if (leaderboardInsertError) {
            console.error("Leaderboard insert error:", leaderboardInsertError);
            return new Response(
              JSON.stringify({ error: "Failed to save leaderboard score" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, score: effectiveScore, saved_to_leaderboard: shouldSaveToLeaderboard }),
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
