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
        return new TextDecoder().decode(new Uint8Array(bytes));
      }
    }
    return null;
  } catch (e) {
    console.error("Resolution failed for", address, e);
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

    // Get all players without a display_name
    const { data: players, error } = await supabase
      .from("players")
      .select("id, wallet_address, display_name")
      .is("display_name", null);

    if (error) throw error;

    const results: { wallet: string; name: string | null; updated: boolean }[] = [];

    for (const player of players || []) {
      const basename = await resolveBasename(player.wallet_address);
      
      if (basename) {
        const { error: updateError } = await supabase
          .from("players")
          .update({ display_name: basename })
          .eq("id", player.id);

        results.push({
          wallet: player.wallet_address,
          name: basename,
          updated: !updateError,
        });
      } else {
        results.push({
          wallet: player.wallet_address,
          name: null,
          updated: false,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_players: players?.length || 0,
        resolved: results.filter(r => r.name).length,
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
