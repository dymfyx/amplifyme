import type {
  BookLevel,
  Instrument,
  NewsItem,
  OrderRow,
  Pnl,
  Position,
  QuoteRow,
  Rfq,
  ScoreCard,
  TradeRow,
} from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100

export const instruments: Instrument[] = [
  { symbol: 'TSCO', name: 'Tesco plc', last: 317.91, changePct: 1.83, changeAbs: 5.71 },
  { symbol: 'NFLX', name: 'Netflix', last: 537.53, changePct: 9.14, changeAbs: 45.01 },
  { symbol: 'TSLA', name: 'Tesla', last: 197.12, changePct: 0.37, changeAbs: 0.73 },
  { symbol: 'AZN', name: 'AstraZeneca', last: 802.99, changePct: -10.51, changeAbs: -94.35 },
  { symbol: 'DUOL', name: 'Duolingo', last: 281.37, changePct: 14.12, changeAbs: 34.83 },
]

export const positions: Position[] = [
  {
    symbol: 'AZN',
    netQty: 0,
    avgPrice: 0,
    value: 0,
    unrealised: 0,
    realised: 155376,
    netPnl: 155376,
  },
  {
    symbol: 'TSLA',
    netQty: 1200,
    avgPrice: 196.8,
    value: 236544,
    unrealised: 384,
    realised: 0,
    netPnl: 384,
  },
  {
    symbol: 'DUOL',
    netQty: -500,
    avgPrice: 280.1,
    value: -140050,
    unrealised: -635,
    realised: 9410,
    netPnl: 8775,
  },
]

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0)

const commissionTotal = 4015

export const pnl: Pnl = (() => {
  const realised = sum(positions.map((p) => p.realised))
  const unrealised = sum(positions.map((p) => p.unrealised))
  const netExposure = sum(positions.map((p) => p.value))
  return {
    realised,
    unrealised,
    netExposure,
    commission: commissionTotal,
    total: realised + unrealised - commissionTotal,
  }
})()

export const orders: OrderRow[] = [
  {
    id: 'ORD-1042',
    time: '10:31:04',
    symbol: 'DUOL',
    side: 'SELL',
    qty: 500,
    price: 285,
    status: 'WORKING',
  },
  {
    id: 'ORD-1043',
    time: '10:33:41',
    symbol: 'TSLA',
    side: 'BUY',
    qty: 200,
    price: 196.4,
    status: 'WORKING',
  },
  {
    id: 'ORD-1039',
    time: '10:12:18',
    symbol: 'AZN',
    side: 'SELL',
    qty: 1000,
    price: 797.4,
    status: 'FILLED',
  },
]

export const trades: TradeRow[] = [
  { id: 'TRD-8841', time: '10:28:52', symbol: 'TSLA', side: 'BUY', qty: 1200, price: 196.8, fee: 312 },
  { id: 'TRD-8838', time: '10:24:07', symbol: 'DUOL', side: 'SELL', qty: 500, price: 280.1, fee: 168.5 },
  { id: 'TRD-8830', time: '10:18:33', symbol: 'AZN', side: 'SELL', qty: 1000, price: 797.4, fee: 640 },
]

export const news: NewsItem[] = [
  {
    id: 'N1',
    time: '09:32',
    tag: 'MACRO',
    kind: 'macro',
    impact: 3,
    headline: 'Fed cuts rates to 0% and relaunches quantitative easing',
  },
  {
    id: 'N2',
    time: '09:35',
    tag: 'NOTE',
    kind: 'note',
    impact: 2,
    headline: 'Investment banks: make sure you manage market risk across the exchange',
  },
  {
    id: 'N3',
    time: '09:41',
    tag: 'TSLA',
    kind: 'equity',
    impact: 3,
    headline: 'Tesla CFO announces investment in self-driving AI with a fully self-driving beta',
  },
  {
    id: 'N4',
    time: '09:44',
    tag: 'DUOL',
    kind: 'equity',
    impact: 2,
    headline: 'Duolingo faces scrutiny in France over language certification standards',
  },
  {
    id: 'N5',
    time: '09:47',
    tag: 'MACRO',
    kind: 'macro',
    impact: 3,
    headline: 'US Central Bank to decide rates in 1 minute — a cut to 1% is expected',
  },
  {
    id: 'N6',
    time: '10:05',
    tag: 'NOTE',
    kind: 'note',
    impact: 1,
    headline: 'Investment banks: provide fast and competitive quotes for your clients',
  },
  {
    id: 'N7',
    time: '10:08',
    tag: 'NOTE',
    kind: 'note',
    impact: 1,
    headline: 'Risk: keep net exposure inside the desk limits, the session is being scored',
  },
  {
    id: 'N8',
    time: '10:12',
    tag: 'DUOL',
    kind: 'equity',
    impact: 3,
    headline: 'Duolingo extends its French certification review, shares whipsaw on the headline',
  },
  {
    id: 'N9',
    time: '10:19',
    tag: 'MACRO',
    kind: 'macro',
    impact: 2,
    headline: 'Bond yields spike as the market digests the emergency rate cut',
  },
  {
    id: 'N10',
    time: '10:26',
    tag: 'TSLA',
    kind: 'equity',
    impact: 2,
    headline: 'Tesla deliveries beat consensus, guidance left unchanged',
  },
]

export const rfqs: Rfq[] = [
  {
    id: 'RFQ-221',
    time: '10:31',
    client: 'AM-39',
    side: 'SELL',
    symbol: 'DUOL',
    qty: 1000,
    note: 'Firm quote requested, client is on the line',
  },
  {
    id: 'RFQ-222',
    time: '10:33',
    client: 'AM-21',
    side: 'BUY',
    symbol: 'TSLA',
    qty: 500,
    note: 'Client wants a two-way market',
  },
  {
    id: 'RFQ-223',
    time: '10:34',
    client: 'AM-18',
    side: 'SELL',
    symbol: 'AZN',
    qty: 2000,
    note: 'Large size, watch your inventory',
  },
]

const sizeLadder = [1200, 800, 650, 900, 1500]

export function bookFor(inst: Instrument): { bids: BookLevel[]; asks: BookLevel[] } {
  const tick = inst.last > 500 ? 0.5 : 0.25
  const bestBid = round2(inst.last - tick / 2)
  return {
    bids: sizeLadder.map((size, i) => ({ price: round2(bestBid - i * tick), size })),
    asks: sizeLadder
      .slice()
      .reverse()
      .map((size, i) => ({ price: round2(bestBid + tick + i * tick), size })),
  }
}

const seriesCache = new Map<string, number[]>()

function buildSeries(seed: number, last: number, length = 90): number[] {
  let s = seed
  let v = last * 0.965
  const raw: number[] = []
  for (let i = 0; i < length; i += 1) {
    s = (s * 9301 + 49297) % 233280
    const r = s / 233280
    v = v * (1 + (r - 0.48) * 0.009)
    raw.push(v)
  }
  const scale = last / raw[raw.length - 1]
  return raw.map((p) => round2(p * scale))
}

export function seriesFor(symbol: string): number[] {
  const cached = seriesCache.get(symbol)
  if (cached) return cached
  const idx = instruments.findIndex((i) => i.symbol === symbol)
  const inst = instruments[idx === -1 ? 0 : idx]
  const series = buildSeries(7919 + idx * 104729, inst.last)
  seriesCache.set(symbol, series)
  return series
}

export const eventMarkers = [
  { index: 18, label: 'FOMC' },
  { index: 42, label: 'TSLA' },
  { index: 63, label: 'DUOL' },
]

export const quotes: QuoteRow[] = [
  {
    id: 'Q-118',
    symbol: 'AZN',
    bidVolume: 10000,
    bid: 790,
    offer: 791,
    offerVolume: 10000,
    validFor: 45,
    status: 'LIVE',
  },
  {
    id: 'Q-117',
    symbol: 'DUOL',
    bidVolume: 2000,
    bid: 279.5,
    offer: 281,
    offerVolume: 2000,
    validFor: 12,
    status: 'FILLED',
  },
  {
    id: 'Q-116',
    symbol: 'TSLA',
    bidVolume: 500,
    bid: 196.2,
    offer: 196.9,
    offerVolume: 500,
    validFor: 30,
    status: 'EXPIRED',
  },
]

export const scoreCard: ScoreCard = {
  composite: 72,
  percentile: 62,
  dimensions: [
    { key: 'returns', label: 'Returns', value: 68 },
    { key: 'discipline', label: 'Discipline', value: 88 },
    { key: 'reaction', label: 'Reaction', value: 41 },
    { key: 'resilience', label: 'Resilience', value: 63 },
    { key: 'tradeManagement', label: 'Trade management', value: 74 },
    { key: 'adaptability', label: 'Adaptability', value: 55 },
  ],
}

export const sessionMeta = {
  clock: '10:34:56',
  dayIndex: 3,
  totalDays: 15,
  status: 'RUNNING',
  speed: '1x',
}

export { round2 }
