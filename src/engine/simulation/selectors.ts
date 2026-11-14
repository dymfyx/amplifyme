import type { Book, Instrument, Pnl, Position } from '../../types'
import { agentViews } from '../agents'
import type { AgentView } from '../agents'
import type { Scenario } from '../scenarios'
import { PRICE_UPDATE_TICKS, SESSION_DAYS, SESSION_SECONDS, TICK_MS } from './constants'
import type { DealerQuote, PriceChangeRecord, PriceDriver, PriceFrame, RestingOrder, SessionMeta, SimulationState } from './types'
import { dayIndexAt, formatClock, round2 } from './util'

export function selectRestingOrders(state: SimulationState): RestingOrder[] {
  return state.restingOrders.filter((order) => order.status === 'WORKING')
}

/** 当前在途/可打的 dealer 回价，按最早可成交时间排序 */
export function selectDealerQuotes(state: SimulationState): DealerQuote[] {
  return [...state.dealerQuotes].sort((a, b) => a.readyAt - b.readyAt)
}

/* ------------------------------------------------------------------ */
/* 选择器（把引擎状态映射成 UI 需要的形状）                            */
/* ------------------------------------------------------------------ */
export function selectInstruments(state: SimulationState): Instrument[] {
  return state.instruments.map((instrument) => ({
    symbol: instrument.symbol,
    name: instrument.name,
    last: instrument.last,
    changePct: (instrument.last / instrument.prevClose - 1) * 100,
    changeAbs: round2(instrument.last - instrument.prevClose),
    lastMove: instrument.lastMove,
  }))
}

export function selectPositions(state: SimulationState): Position[] {
  return state.positions.map((position) => {
    const instrument = state.instruments.find((item) => item.symbol === position.symbol)
    const last = instrument?.last ?? position.avgPrice
    const value = position.netQty * last
    const unrealised = position.netQty * (last - position.avgPrice)
    return {
      symbol: position.symbol,
      netQty: position.netQty,
      avgPrice: position.avgPrice,
      value: round2(value),
      unrealised: round2(unrealised),
      realised: position.realised,
      netPnl: round2(position.realised + unrealised),
    }
  })
}

export function selectPnl(state: SimulationState): Pnl {
  const positions = selectPositions(state)
  const realised = positions.reduce((total, position) => total + position.realised, 0)
  const unrealised = positions.reduce((total, position) => total + position.unrealised, 0)
  const netExposure = positions.reduce((total, position) => total + position.value, 0)
  return {
    realised: round2(realised),
    unrealised: round2(unrealised),
    netExposure: round2(netExposure),
    commission: round2(state.commission),
    total: round2(realised + unrealised - state.commission),
  }
}

export function selectBook(state: SimulationState, symbol: string): Book {
  const instrument = state.instruments.find((item) => item.symbol === symbol) ?? state.instruments[0]
  return instrument.book
}

export function selectSeries(state: SimulationState, symbol: string): number[] {
  const instrument = state.instruments.find((item) => item.symbol === symbol) ?? state.instruments[0]
  return instrument.series
}

export function selectChartMarkers(
  state: SimulationState,
  symbol: string,
): Array<{ index: number; label: string }> {
  const instrument = state.instruments.find((item) => item.symbol === symbol) ?? state.instruments[0]
  const total = instrument.series.length
  const priceIndexNow = Math.floor(state.tick / PRICE_UPDATE_TICKS)
  return state.chartEvents
    .filter((event) => !event.symbol || event.symbol === symbol)
    .map((event) => ({
      index: total - 1 - (priceIndexNow - Math.floor(event.tick / PRICE_UPDATE_TICKS)),
      label: event.label,
    }))
    .filter((marker) => marker.index >= 0 && marker.index < total)
}

export function selectCash(state: SimulationState): number {
  return round2(state.cash)
}

/** 本局用的场景（名字、简介、新闻脚本），给入口页与结算报告展示 */
export function selectScenario(state: SimulationState): Scenario {
  return state.scenario
}

/** 回放帧：每帧五个名字的价格，供 ReplayDrawer 画时间轴与曲线 */
export function selectHistory(state: SimulationState): PriceFrame[] {
  return state.history
}

/** 客户画像与怨气值：客户流失越严重，派单越少、报价质量评分越差 */
export function selectClientHeat(state: SimulationState): Record<string, number> {
  return state.clientHeat
}

/** 10 个流式智能体的实时状态：持仓、盈亏、最近一笔动作，给 FLOW 抽屉 */
export function selectAgents(state: SimulationState): AgentView[] {
  return agentViews(state.agents, {
    tick: state.tick,
    instruments: state.instruments.map((instrument) => ({
      symbol: instrument.symbol,
      last: instrument.last,
      openPrice: instrument.openPrice,
      series: instrument.series,
      lot: instrument.lot,
      spreadBps: instrument.spreadBps,
    })),
    newsBias: state.newsBias,
  })
}

/** 最近的价格变动记录：只留下有明显来源或幅度够看的，给 PRICE TAPE 面板 */
export function selectPriceTape(state: SimulationState, limit = 7, minBps = 4): PriceChangeRecord[] {
  const notable = state.priceTape.filter(
    (change) =>
      Math.abs(change.bps) >= minBps ||
      change.drivers.some(
        (driver) => driver.source === 'headline' || driver.source === 'fill' || driver.source === 'agent',
      ),
  )
  return notable.slice(-limit)
}

/** 每个标的最新一次价格变动的解释，给 MARKET WATCH 的 DRIVER 列 */
export function selectDrivers(state: SimulationState): Record<string, PriceDriver | null> {
  return Object.fromEntries(state.instruments.map((instrument) => [instrument.symbol, instrument.driver]))
}

export function selectSessionMeta(state: SimulationState, latencyMs = 0): SessionMeta {
  const elapsed = Math.max(0, state.simSeconds - state.startedAt)
  const remainingSim = Math.max(0, SESSION_SECONDS - elapsed)
  const timeLeftMs =
    state.status === 'CLOSED' ? 0 : Math.round((remainingSim / state.simSecondsPerTick) * TICK_MS)
  return {
    // 收盘时刻 simSeconds 正好停在 15 个交易日的边界上，formatClock 会回绕成 09:30:00，
    // 所以结束态直接钉在最后一天的收盘时间。
    clock: state.status === 'CLOSED' ? '16:00:00' : formatClock(state.simSeconds),
    dayIndex: dayIndexAt(state.simSeconds),
    totalDays: SESSION_DAYS,
    status: state.status,
    speed: state.speed,
    latencyMs,
    seed: state.seed,
    minutes: state.minutes,
    timeLeftMs,
  }
}
