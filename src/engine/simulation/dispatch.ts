import type { Side } from '../../types'
import { nextRandom, pickOne, randomInt } from '../rng'
import { DISPATCH_NOTES, SYMBOLS } from '../scenario'
import type { DifficultyTier } from '../difficulty'
import { recordRfq } from '../telemetry'
import type { Telemetry } from '../telemetry'
import { DISPATCH_INTERVAL, DISPATCH_TTL, INFORMED_INTERVAL_MAX, INFORMED_INTERVAL_MIN, MAX_DISPATCH, PATIENCE_BASE, START_SECONDS } from './constants'
import type { DispatchState, SimulationState } from './types'
import { formatShortTime, round2 } from './util'

/* ------------------------------------------------------------------ */
/* 初始化                                                              */
/* ------------------------------------------------------------------ */
export function initialDispatch(): DispatchState {
  return {
    id: 'RFQ-201',
    time: formatShortTime(START_SECONDS),
    client: 'AM-18',
    side: 'SELL',
    symbol: 'AZN',
    qty: 2000,
    note: 'Large size, watch your inventory',
    createdAt: START_SECONDS,
  }
}

/** 按权重抽一个名字（派单时让热度高的标的更容易被 informed 客户选中） */
export function pickWeighted(roll: number, entries: Array<[string, number]>): string {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let target = roll * total
  for (const [symbol, weight] of entries) {
    target -= weight
    if (target <= 0) return symbol
  }
  return entries[entries.length - 1][0]
}

export interface DispatchStepParams {
  state: SimulationState
  simSeconds: number
  dispatch: DispatchState[]
  counters: SimulationState['counters']
  telemetry: Telemetry
  rng: number
  tier: DifficultyTier
  clientHeat: Record<string, number>
  newsBias: Record<string, number>
  headlineHeat: boolean
}

export interface DispatchStepResult {
  dispatch: DispatchState[]
  counters: SimulationState['counters']
  telemetry: Telemetry
  rng: number
  clientHeat: Record<string, number>
  nextDispatchAt: number
}

export function stepDispatch(params: DispatchStepParams): DispatchStepResult {
  const { state, simSeconds, tier, newsBias, headlineHeat } = params
  let { dispatch, counters, telemetry, rng, clientHeat } = params
  dispatch = dispatch.filter((item) => {
    const profile = state.clients.find((candidate) => candidate.id === item.client)
    const ttl = DISPATCH_TTL * ((profile?.patience ?? PATIENCE_BASE) / PATIENCE_BASE)
    return simSeconds - item.createdAt < ttl
  })
  let nextDispatchAt = state.nextDispatchAt
  /* 头条刚落地：消息灵通的客户立刻打电话，把下一单从远处拉回来 */
  if (headlineHeat) nextDispatchAt = Math.min(nextDispatchAt, simSeconds + 1)
  /* 客户怨气每次派单衰减 15%：服务好一点，客户会回来 */
  clientHeat = Object.fromEntries(
    Object.entries(clientHeat).map(([id, heat]) => [id, round2(heat * 0.85)]),
  )
  if (simSeconds >= nextDispatchAt && dispatch.length < MAX_DISPATCH) {
    const hot = Object.entries(newsBias).filter(([, value]) => Math.abs(value) >= 8)
    const [typeRoll, afterType] = nextRandom(rng)
    rng = afterType
    const informed = hot.length > 0 && typeRoll < tier.informedShare
    /* 档位越高：客户来得越密、单子越大 */
    const intervalMultiplier = tier.clientIntervalMult
    let symbol: string
    let clientSide: Side
    if (informed) {
      /* 消息灵通的客户挑最热的名字、顺着新闻方向做 */
      const [symbolRoll, afterSymbolRoll] = nextRandom(rng)
      rng = afterSymbolRoll
      symbol = pickWeighted(symbolRoll, hot.map(([name, value]) => [name, Math.abs(value)] as [string, number]))
      clientSide = (newsBias[symbol] ?? 0) >= 0 ? 'BUY' : 'SELL'
    } else {
      const [symbolPick, afterSymbolPick] = pickOne(rng, SYMBOLS)
      rng = afterSymbolPick
      symbol = symbolPick
      const [sideRoll, afterSideRoll] = nextRandom(rng)
      rng = afterSideRoll
      clientSide = sideRoll < 0.5 ? 'SELL' : 'BUY'
    }
    const roster = state.clients.filter((candidate) => candidate.type === (informed ? 'informed' : 'uninformed'))
    const pool = roster.length > 0 ? roster : state.clients
    /* 客户记忆：上次被报得离谱或拒过单的客户，这一轮更不容易再上门 */
    const [clientRoll, afterClientRoll] = nextRandom(rng)
    rng = afterClientRoll
    const clientId = pickWeighted(
      clientRoll,
      pool.map((profile) => [profile.id, 1 / (1 + (clientHeat[profile.id] ?? 0))] as [string, number]),
    )
    const profile = state.clients.find((candidate) => candidate.id === clientId) ?? pool[0]
    const [units, afterUnits] = randomInt(
      rng,
      informed ? Math.max(1, tier.clientUnitsMin + 1) : tier.clientUnitsMin,
      informed ? tier.clientUnitsMax + 1 : Math.max(tier.clientUnitsMin, tier.clientUnitsMax),
    )
    rng = afterUnits
    const [noteRoll, afterNote] = nextRandom(rng)
    rng = afterNote
    const note =
      DISPATCH_NOTES[Math.min(DISPATCH_NOTES.length - 1, Math.floor(noteRoll * DISPATCH_NOTES.length))]
    const rfqCounter = counters.rfq + 1
    counters = { ...counters, rfq: rfqCounter }
    telemetry = recordRfq(telemetry, informed)
    dispatch = [
      ...dispatch,
      {
        id: `RFQ-${rfqCounter}`,
        time: formatShortTime(simSeconds),
        client: profile.id,
        side: clientSide,
        symbol,
        qty: units * 500,
        note: informed ? profile.note : note,
        createdAt: simSeconds,
      },
    ]
    nextDispatchAt =
      simSeconds +
      intervalMultiplier *
        (hot.length > 0
          ? INFORMED_INTERVAL_MIN + Math.round(typeRoll * (INFORMED_INTERVAL_MAX - INFORMED_INTERVAL_MIN))
          : DISPATCH_INTERVAL)
  }
  return { dispatch, counters, telemetry, rng, clientHeat, nextDispatchAt }
}
