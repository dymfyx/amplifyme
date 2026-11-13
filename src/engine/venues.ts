import type { Role } from '../types'

/**
 * 角色化成交价：同一个盘口，谁在拿流动性，谁就在付价差。
 *
 * - SALES（买方/客户侧）：主动吃单，没有流动性返还，买卖之间偏 5–10 个价格点
 *   （以 800 的股票为例，gap ≈ 4.8–9.6，波动越大越宽）；
 * - MARKET MAKER（做市商）：提供流动性、本来就该拿到更紧的双边价，gap 约 1–1.6 个点；
 * - DEALER（Sales 问价拿到的报价）：介于两者之间，比 Sales 硬吃便宜，但比 MM 自己的价差贵。
 *
 * 所有数字都是「双边总价差占中间价的比例」，挂单/吃单各付一半。
 */
export const SALES_BASE_GAP = 0.006
export const SALES_VOL_GAP = 0.006
export const MAKER_BASE_GAP = 0.0012
export const MAKER_VOL_GAP = 0.0008
export const DEALER_BASE_GAP = 0.0032
export const DEALER_VOL_GAP = 0.0016

/** 波动因子 0（平静）→ 1（剧烈），由最近价格波动与新闻热度合成 */
export const clampVol = (value: number): number => Math.min(1, Math.max(0, value))

export function venueGap(role: Role, volatility: number): number {
  const v = clampVol(volatility)
  return role === 'sales'
    ? SALES_BASE_GAP + SALES_VOL_GAP * v
    : MAKER_BASE_GAP + MAKER_VOL_GAP * v
}

export function dealerGap(volatility: number): number {
  const v = clampVol(volatility)
  return DEALER_BASE_GAP + DEALER_VOL_GAP * v
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/** 在中间价两侧各让出 gap/2，返回我们这个角色实际能成交的买入价与卖出价 */
export function quoteAroundMid(mid: number, gap: number): { buy: number; sell: number; gapPoints: number } {
  if (!(mid > 0)) return { buy: 0, sell: 0, gapPoints: 0 }
  const buy = round2(mid * (1 + gap / 2))
  const sell = round2(mid * (1 - gap / 2))
  return { buy, sell, gapPoints: round2(buy - sell) }
}

/**
 * 用最近的价格序列估一个 0–1 的波动因子：近 30 个点的收益标准差（bps）除以 10，
 * 再和当前新闻热度混合，保证「行情越激烈，价差越宽」但不会无限放大。
 */
export function volatilityScore(series: number[], newsBiasBps = 0): number {
  const window = series.slice(-30)
  let sum = 0
  let count = 0
  for (let index = 1; index < window.length; index += 1) {
    const previous = window[index - 1]
    if (previous <= 0) continue
    sum += Math.abs(window[index] / previous - 1) * 10_000
    count += 1
  }
  const meanMoveBps = count > 0 ? sum / count : 0
  const fromMoves = meanMoveBps / 10
  const fromNews = Math.abs(newsBiasBps) / 100
  return clampVol(0.6 * fromMoves + 0.4 * fromNews)
}
