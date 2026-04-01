// Edge function to fetch the current ETH/USD price
// Uses CoinGecko free API (no key required for public endpoints with rate-limit).
// Caches the price for 60 seconds to avoid hammering the API.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedPrice: { usd: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function fetchEthPrice(): Promise<number> {
  const now = Date.now();
  if (cachedPrice && now - cachedPrice.fetchedAt < CACHE_TTL_MS) {
    return cachedPrice.usd;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) {
      console.error("CoinGecko API error:", res.status);
      throw new Error("CoinGecko request failed");
    }
    const data = await res.json();
    const usd = data?.ethereum?.usd;
    if (typeof usd !== "number" || usd <= 0) {
      throw new Error("Invalid price returned");
    }
    cachedPrice = { usd, fetchedAt: now };
    return usd;
  } catch (err) {
    // Fallback to cached price if available (even stale) or default to $2500 for safety
    if (cachedPrice) {
      console.warn("Using stale cached ETH price");
      return cachedPrice.usd;
    }
    console.warn("Returning fallback ETH price");
    return 2500;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ethUsd = await fetchEthPrice();

    // Target fee in USD ($0.99)
    const targetUsd = 0.99;

    // Calculate ETH amount required to meet targetUsd
    const ethAmount = targetUsd / ethUsd;

    // Round to 8 decimals for display
    const ethRounded = Math.ceil(ethAmount * 1e8) / 1e8;

    return new Response(
      JSON.stringify({
        eth_price_usd: ethUsd,
        target_usd: targetUsd,
        fee_eth: ethRounded.toFixed(8),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
