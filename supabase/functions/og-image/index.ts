// Dynamic OG image generator for 2048 on BASE

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a simple SVG-based OG image for 2048 game
// This creates a dynamic embed preview for Base Mini Apps
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const score = url.searchParams.get('score') || '0';
    const username = url.searchParams.get('username') || 'Player';
    
    // Create SVG for OG image (1200x630 for 3:2 ratio)
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1f2e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0f1319;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f7c036;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#eab308;stop-opacity:1" />
          </linearGradient>
          <linearGradient id="blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0052ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Background -->
        <rect width="1200" height="630" fill="url(#bg)"/>
        
        <!-- Game grid preview -->
        <g transform="translate(80, 100)">
          ${generateGridTiles()}
        </g>
        
        <!-- Title and branding -->
        <text x="700" y="180" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="url(#gold)">2048</text>
        <text x="700" y="240" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="url(#blue)">on BASE</text>
        
        <!-- Score display if provided -->
        ${parseInt(score) > 0 ? `
          <rect x="700" y="280" width="400" height="100" rx="16" fill="rgba(255,255,255,0.1)"/>
          <text x="720" y="320" font-family="Arial, sans-serif" font-size="24" fill="#9ca3af">${username}'s Score</text>
          <text x="720" y="360" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="url(#gold)">${parseInt(score).toLocaleString()}</text>
        ` : `
          <rect x="700" y="280" width="400" height="100" rx="16" fill="rgba(255,255,255,0.1)"/>
          <text x="720" y="330" font-family="Arial, sans-serif" font-size="28" fill="#9ca3af">Combine tiles to reach</text>
          <text x="720" y="365" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="url(#gold)">2048!</text>
        `}
        
        <!-- CTA -->
        <rect x="700" y="420" width="300" height="60" rx="12" fill="url(#gold)"/>
        <text x="850" y="460" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#1a1f2e" text-anchor="middle">Play Now</text>
        
        <!-- Footer -->
        <text x="700" y="560" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">Top 20 players share 60% of fees monthly</text>
        <text x="700" y="590" font-family="Arial, sans-serif" font-size="16" fill="#4b5563">Built on Base • Pay with ETH or USDC</text>
      </svg>
    `;

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate image' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Generate sample 2048 grid tiles for visual appeal
function generateGridTiles(): string {
  const tiles = [
    { value: 2, x: 0, y: 0 },
    { value: 4, x: 1, y: 0 },
    { value: 8, x: 2, y: 1 },
    { value: 16, x: 3, y: 0 },
    { value: 32, x: 0, y: 2 },
    { value: 64, x: 1, y: 1 },
    { value: 128, x: 2, y: 2 },
    { value: 256, x: 3, y: 2 },
    { value: 512, x: 0, y: 3 },
    { value: 1024, x: 2, y: 3 },
    { value: 2048, x: 3, y: 3 },
  ];

  const tileSize = 100;
  const gap = 10;
  
  const getColor = (value: number) => {
    const colors: Record<number, string> = {
      2: '#eee4da',
      4: '#ede0c8',
      8: '#f2b179',
      16: '#f59563',
      32: '#f67c5f',
      64: '#f65e3b',
      128: '#edcf72',
      256: '#edcc61',
      512: '#edc850',
      1024: '#edc53f',
      2048: '#edc22e',
    };
    return colors[value] || '#3c3a32';
  };

  const getTextColor = (value: number) => {
    return value <= 4 ? '#776e65' : '#f9f6f2';
  };

  const getFontSize = (value: number) => {
    if (value < 100) return 40;
    if (value < 1000) return 32;
    return 24;
  };

  let result = '';
  
  // Draw empty grid
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * (tileSize + gap);
      const y = row * (tileSize + gap);
      result += `<rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" rx="8" fill="rgba(238,228,218,0.35)"/>`;
    }
  }

  // Draw tiles
  for (const tile of tiles) {
    const x = tile.x * (tileSize + gap);
    const y = tile.y * (tileSize + gap);
    result += `
      <rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" rx="8" fill="${getColor(tile.value)}"/>
      <text x="${x + tileSize/2}" y="${y + tileSize/2 + getFontSize(tile.value)/3}" 
        font-family="Arial, sans-serif" font-size="${getFontSize(tile.value)}" font-weight="bold" 
        fill="${getTextColor(tile.value)}" text-anchor="middle">${tile.value}</text>
    `;
  }

  return result;
}
