const VENUES = [
  { name: 'binance', url: 'https://api.binance.com/api/v3/ticker/price?symbol={symbol}USDT', fee: 0.001 },
  { name: 'kraken', url: 'https://api.kraken.com/0/public/Ticker?pair={kraken}', fee: 0.0026 },
  { name: 'okx', url: 'https://www.okx.com/api/v5/market/ticker?instId={symbol}-USDT', fee: 0.0010 }
];

const ASSETS = [
  { symbol: 'BTC', kraken: 'XBTUSDT' },
  { symbol: 'ETH', kraken: 'ETHUSDT' },
  { symbol: 'SOL', kraken: 'SOLUSDT' }
];

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

async function quote(venue, asset) {
  const data = await getJson(venue.url.replace('{symbol}', asset.symbol).replace('{kraken}', asset.kraken));
  if (venue.name === 'binance') return Number(data.price);
  if (venue.name === 'okx') return Number(data.data?.[0]?.last);
  const key = Object.keys(data.result || {})[0];
  const last = data.result?.[key]?.c?.[0];
  return Number(last);
}

export async function scanMarkets({ minNetSpreadPct = 0.35 } = {}) {
  const rows = [];
  for (const asset of ASSETS) {
    const quotes = [];
    for (const venue of VENUES) {
      try {
        const price = await quote(venue, asset);
        if (Number.isFinite(price) && price > 0) quotes.push({ venue: venue.name, price, fee: venue.fee });
      } catch (error) {
        quotes.push({ venue: venue.name, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const good = quotes.filter(x => Number.isFinite(x.price));
    if (good.length < 2) {
      rows.push({ asset: asset.symbol, quotes, executable: false, reason: 'insufficient public quotes' });
      continue;
    }
    const buy = [...good].sort((a,b)=>a.price-b.price)[0];
    const sell = [...good].sort((a,b)=>b.price-a.price)[0];
    const gross = (sell.price / buy.price - 1) * 100;
    const net = gross - ((buy.fee + sell.fee) * 100);
    rows.push({
      asset: asset.symbol,
      buy_venue: buy.venue,
      sell_venue: sell.venue,
      buy_price: Number(buy.price.toFixed(8)),
      sell_price: Number(sell.price.toFixed(8)),
      gross_spread_pct: Number(gross.toFixed(4)),
      estimated_net_spread_pct: Number(net.toFixed(4)),
      executable: buy.venue !== sell.venue && net >= minNetSpreadPct,
      reason: buy.venue === sell.venue ? 'same venue' : net >= minNetSpreadPct ? 'paper opportunity only' : 'spread below safety threshold'
    });
  }
  return {
    generated_at: new Date().toISOString(),
    mode: 'read_only_market_scan',
    disclaimer: 'Quotes are public snapshots. No order is placed and profitability is not guaranteed.',
    min_net_spread_pct: minNetSpreadPct,
    opportunities: rows
  };
}
