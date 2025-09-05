// src/lib/prices.ts
import axios from 'axios';
import WebSocket from 'ws';

type Quote = 'USDT' | 'KRW' | 'USD';
type TickerKey = `${string}:${Quote}`;

const priceCache = new Map<TickerKey, { price: number; ts: number; src: string }>();

// ==============================
// Binance 실시간(WebSocket) + REST
// ==============================
class BinanceSocket {
  private ws?: WebSocket;
  private streams = new Set<string>(); // e.g., btcusdt@trade
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;

  addSymbol(symbol: string) {
    const stream = `${symbol.toLowerCase()}usdt@trade`;
    if (this.streams.has(stream)) return;
    this.streams.add(stream);
    this.connect();
  }

  private connect() {
    // 새 스트림을 반영하려면 재연결
    if (this.connected) this.ws?.close();

    const url = `wss://stream.binance.com:9443/stream?streams=${[...this.streams].join('/')}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      // console.log('[Binance] WS connected');
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const payload = msg.data ?? msg;
        const s = (payload.s ?? payload?.data?.s)?.toLowerCase(); // BTCUSDT
        const p = parseFloat(payload.p ?? payload?.data?.p ?? '0');
        if (!s || !p) return;
        if (!s.endsWith('usdt')) return;
        const base = s.replace('usdt', '').toUpperCase();
        priceCache.set(`${base}:USDT`, { price: p, ts: Date.now(), src: 'binance-ws' });
      } catch { /* ignore malformed */ }
    });

    this.ws.on('close', () => {
      this.connected = false;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 1500);
    });

    this.ws.on('error', () => {
      try { this.ws?.close(); } catch {}
    });
  }
}
const binance = new BinanceSocket();

// Binance REST: USDT
async function fetchBinanceUSDT(base: string) {
  const symbol = `${base.toUpperCase()}USDT`;
  const { data } = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
    headers: { Accept: 'application/json' },
    timeout: 5000,
  });
  const price = parseFloat(data.price);
  if (!Number.isFinite(price)) throw new Error('invalid price');
  priceCache.set(`${base.toUpperCase()}:USDT`, { price, ts: Date.now(), src: 'binance-rest' });
  return price;
}

// ==============================
// Upbit REST: KRW
// ==============================
async function fetchUpbitKRW(base: string) {
  const market = `KRW-${base.toUpperCase()}`;
  const { data } = await axios.get(`https://api.upbit.com/v1/ticker?markets=${market}`, {
    headers: { Accept: 'application/json' },
    timeout: 5000,
  });
  const price = data?.[0]?.trade_price;
  if (!Number.isFinite(price)) throw new Error('invalid price');
  priceCache.set(`${base.toUpperCase()}:KRW`, { price, ts: Date.now(), src: 'upbit-rest' });
  return price;
}

// ==============================
// USD 파생 (USDT≈USD 가정)
// ==============================
async function ensureUSD(base: string) {
  const usdt = priceCache.get(`${base.toUpperCase()}:USDT`);
  if (usdt) {
    priceCache.set(`${base.toUpperCase()}:USD`, { price: usdt.price, ts: Date.now(), src: 'derived-usd' });
    return usdt.price;
  }
  const p = await fetchBinanceUSDT(base);
  priceCache.set(`${base.toUpperCase()}:USD`, { price: p, ts: Date.now(), src: 'derived-usd' });
  return p;
}

// ==============================
// 퍼블릭 API 로 가격 조회 (캐시 7s)
// ==============================
export async function getPrice(baseRaw: string, quote: Quote) {
  const base = baseRaw.toUpperCase();
  const key: TickerKey = `${base}:${quote}`;
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.ts < 7_000) return cached.price;

  if (quote === 'USDT') {
    binance.addSymbol(base); // WS 구독
    try { return await fetchBinanceUSDT(base); }
    catch { if (cached) return cached.price; throw new Error('Binance price fetch failed'); }
  }

  if (quote === 'KRW') {
    try { return await fetchUpbitKRW(base); }
    catch { if (cached) return cached.price; throw new Error('Upbit price fetch failed'); }
  }

  if (quote === 'USD') {
    try { return await ensureUSD(base); }
    catch { if (cached) return cached.price; throw new Error('USD price fetch failed'); }
  }

  throw new Error('Unsupported quote');
}

export function getCached(base: string, quote: Quote) {
  return priceCache.get(`${base.toUpperCase()}:${quote}`);
}

// ==============================
// USD/KRW 환율 + 김치 프리미엄
// ==============================

// 5분 캐시
const fxCache = new Map<string, { rate: number; ts: number }>();

async function fetchUsdKrw(): Promise<number> {
  const cached = fxCache.get('USD:KRW');
  if (cached && Date.now() - cached.ts < 5 * 60_000) return cached.rate;

  const key = process.env.FX_API_KEY; // Railway Variables에 넣어둔 키(ExchangeRate-API v6)
  try {
    if (key) {
      const { data } = await axios.get(`https://v6.exchangerate-api.com/v6/${key}/latest/USD`, {
        headers: { Accept: 'application/json' },
        timeout: 5000,
      });
      const rate = data?.conversion_rates?.KRW;
      if (!Number.isFinite(rate)) throw new Error('missing KRW in conversion_rates');
      fxCache.set('USD:KRW', { rate, ts: Date.now() });
      return rate;
    } else {
      // 키가 없으면 대안 공개 API
      const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', {
        headers: { Accept: 'application/json' },
        timeout: 5000,
      });
      const rate = data?.rates?.KRW;
      if (!Number.isFinite(rate)) throw new Error('missing KRW in rates');
      fxCache.set('USD:KRW', { rate, ts: Date.now() });
      return rate;
    }
  } catch {
    throw new Error('USD/KRW 환율 조회 실패');
  }
}

// KRW(업비트) / [ USDT(바이낸스) * USDKRW ] - 1
export async function getKimchi(baseRaw: string) {
  const base = baseRaw.toUpperCase();

  const [krw, usdt, usdkrw] = await Promise.all([
    getPrice(base, 'KRW'),
    // Binance REST 실패 시 캐시 폴백
    getPrice(base, 'USDT').catch(() => {
      const c = getCached(base, 'USDT');
      if (!c) throw new Error('Binance USDT price unavailable');
      return c.price;
    }),
    fetchUsdKrw(),
  ]);

  const premium = krw / (usdt * usdkrw) - 1; // 0.036 = 3.6%

  return {
    base, krw, usdt, usdkrw, premium,
    ts: Date.now(),
    src: { krw: 'upbit-rest', usdt: 'binance', fx: 'exchangerate-api' }
  };
}
