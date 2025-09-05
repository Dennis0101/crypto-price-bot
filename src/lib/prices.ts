import axios from 'axios';
import WebSocket from 'ws';

type Quote = 'USDT' | 'KRW' | 'USD';
type TickerKey = `${string}:${Quote}`;

const binanceWsUrl = 'wss://stream.binance.com:9443/ws';
const priceCache = new Map<TickerKey, { price: number; ts: number; src: string }>();

// ---- Binance 실시간 구독 (USDT) ----
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
    if (this.connected) {
      // 기존 연결에 스트림 추가(RESTFUL 방식은 없음) → 재연결로 통합 구독
      this.ws?.close();
    }
    const url = `wss://stream.binance.com:9443/stream?streams=${[...this.streams].join('/')}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      // console.log('[Binance] connected');
    });

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      // 단일/복수 스트림 공용 처리
      const payload = msg.data ?? msg;
      const s = (payload.s ?? payload?.data?.s)?.toLowerCase(); // BTCUSDT
      const p = parseFloat(payload.p ?? payload?.data?.p ?? '0');
      if (!s || !p) return;
      if (!s.endsWith('usdt')) return;

      const base = s.replace('usdt', '').toUpperCase();
      priceCache.set(`${base}:USDT`, { price: p, ts: Date.now(), src: 'binance-ws' });
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.reconnectTimer && clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 1500);
    });

    this.ws.on('error', () => {
      try { this.ws?.close(); } catch {}
    });
  }
}

const binance = new BinanceSocket();

// ---- REST Fallbacks ----
// Binance REST: USDT
async function fetchBinanceUSDT(base: string) {
  const symbol = `${base.toUpperCase()}USDT`;
  const { data } = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const price = parseFloat(data.price);
  priceCache.set(`${base.toUpperCase()}:USDT`, { price, ts: Date.now(), src: 'binance-rest' });
  return price;
}

// Upbit REST: KRW
async function fetchUpbitKRW(base: string) {
  const market = `KRW-${base.toUpperCase()}`;
  const { data } = await axios.get(`https://api.upbit.com/v1/ticker?markets=${market}`, {
    headers: { Accept: 'application/json' },
  });
  const price = data[0]?.trade_price;
  priceCache.set(`${base.toUpperCase()}:KRW`, { price, ts: Date.now(), src: 'upbit-rest' });
  return price;
}

// USD 환산(간단): USDT≈USD 가정. 정밀 필요시 외부 환율 API 추가.
async function ensureUSD(base: string) {
  // USDT 가격 있으면 그대로 사용
  const usdt = priceCache.get(`${base.toUpperCase()}:USDT`);
  if (usdt) {
    priceCache.set(`${base.toUpperCase()}:USD`, { price: usdt.price, ts: Date.now(), src: 'derived-usd' });
    return usdt.price;
  }
  // 없으면 한 번 REST
  const p = await fetchBinanceUSDT(base);
  priceCache.set(`${base.toUpperCase()}:USD`, { price: p, ts: Date.now(), src: 'derived-usd' });
  return p;
}

export async function getPrice(baseRaw: string, quote: Quote) {
  const base = baseRaw.toUpperCase();
  const key: TickerKey = `${base}:${quote}`;
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.ts < 7_000) return cached.price;

  if (quote === 'USDT') {
    // 실시간 보장 위해 ws 구독 + REST 1회 보강
    binance.addSymbol(base);
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
