import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Sanity caps per game (max points achievable in a single ~30s-5min session)
const MAX_SESSION_SCORE: Record<string, number> = {
  "2048": 200000,
  tetris: 500000,
  typing: 5000,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { session_id, wallet_address, score, end_game } = await req.json();

    if (!session_id || !wallet_address || score === undefined) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return json({ error: "Invalid wallet address format" }, 400);
    }

    const parsedScore = parseInt(String(score), 10);
    if (isNaN(parsedScore) || parsedScore < 0) {
      return json({ error: "Invalid score value" }, 400);
    }

    // Load session
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id, player_id, is_active, score, game_type, tx_hash, leaderboard_submitted")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      console.error("[update-game-score] session lookup failed", sessionError);
      return json({ error: "Session not found" }, 404);
    }

    // Verify wallet ownership
    const { data: player } = await supabase
      .from("players")
      .select("wallet_address")
      .eq("id", session.player_id)
      .single();

    if (!player || player.wallet_address?.toLowerCase() !== wallet_address.toLowerCase()) {
      return json({ error: "Unauthorized - wallet does not match session owner" }, 403);
    }

    // Require a paid session (tx_hash must exist)
    if (!session.tx_hash) {
      return json({ error: "Session payment not verified" }, 403);
    }

    // Sanity cap
    const cap = MAX_SESSION_SCORE[session.game_type] ?? 100000;
    if (parsedScore > cap) {
      console.warn("[update-game-score] score exceeds cap", {
        session_id, game_type: session.game_type, score: parsedScore, cap,
      });
      return json({ error: "Score exceeds maximum allowed" }, 400);
    }

    // === Mid-game progress update (no leaderboard write) ===
    if (!end_game) {
      if (!session.is_active) return json({ error: "Session is no longer active" }, 400);
      if (parsedScore < session.score) return json({ error: "Score cannot decrease" }, 400);
      const { error: upErr } = await supabase
        .from("game_sessions")
        .update({ score: parsedScore })
        .eq("id", session_id);
      if (upErr) {
        console.error("[update-game-score] progress update failed", upErr);
        return json({ error: "Failed to update score" }, 500);
      }
      return json({ success: true, score: parsedScore, saved_to_leaderboard: false });
    }

    // === End-game: submit cumulative leaderboard score ===
    // Block duplicate submissions for same session
    if (session.leaderboard_submitted) {
      console.warn("[update-game-score] duplicate submission blocked", { session_id });
      return json({ error: "Score already submitted for this session" }, 409);
    }

    const sessionScore = Math.max(parsedScore, session.score ?? 0);

    // Atomically close the session AND mark leaderboard_submitted to prevent races
    const { data: closed, error: closeErr } = await supabase
      .from("game_sessions")
      .update({
        score: sessionScore,
        is_active: false,
        ended_at: new Date().toISOString(),
        leaderboard_submitted: true,
      })
      .eq("id", session_id)
      .eq("leaderboard_submitted", false)
      .select("id")
      .single();

    if (closeErr || !closed) {
      console.warn("[update-game-score] could not lock session for submission", closeErr);
      return json({ error: "Score already submitted for this session" }, 409);
    }

    // Compute current week range
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    // Atomic cumulative update via DB function
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "increment_leaderboard_score",
      {
        p_player_id: session.player_id,
        p_game_type: session.game_type,
        p_score: sessionScore,
        p_week_start: weekStartStr,
        p_week_end: weekEndStr,
      },
    );

    if (rpcErr) {
      console.error("[update-game-score] cumulative update failed", rpcErr);
      // roll back the submitted flag so user can retry
      await supabase
        .from("game_sessions")
        .update({ leaderboard_submitted: false })
        .eq("id", session_id);
      return json({ error: "Failed to save score" }, 500);
    }

    const previous = rpcData?.[0]?.previous_score ?? 0;
    const newTotal = rpcData?.[0]?.new_total ?? sessionScore;

    console.info("[update-game-score] leaderboard updated", {
      wallet_address: wallet_address.toLowerCase(),
      session_id,
      tx_hash: session.tx_hash,
      game_type: session.game_type,
      session_score: sessionScore,
      previous_total: previous,
      new_total: newTotal,
    });

    return json({
      success: true,
      score: sessionScore,
      previous_total: previous,
      new_total: newTotal,
      saved_to_leaderboard: true,
    });
  } catch (error) {
    console.error("[update-game-score] error", error);
    return json({ error: "Internal server error" }, 500);
  }
});
