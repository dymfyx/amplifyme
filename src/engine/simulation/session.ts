import type { Book, NewsItem, OrderRow, Side, TradeRow } from '../../types'
import { createSeed, nextRandom, normalish, randomInt } from '../rng'
import { SYMBOLS, UNIVERSE } from '../scenario'
import { scheduleNews } from '../news'
import { DEFAULT_TIER_ID, tierById } from '../difficulty'
import { aggregateFlows, createAgents, findCounterparty, stepAgents } from '../agents'
import type { AgentFlow } from '../agents'
import { DEFAULT_CLIENTS, DEFAULT_SCENARIO } from '../scenarios'
import type { ClientType } from '../scenarios'
import { createTelemetry, patchQuote, recordDecline, recordFill, recordNews, recordQuote, recordRfq, sampleExposure } from '../telemetry'
import { AGENT_FLOW_SCALE, AGENT_VOLUME_SCALE, BOOK_MIN_MOVE_BPS, CHART_POINTS, DEFAULT_MINUTES, DRIFT_RELEASE, DRIFT_TTL, FILL_IMPACT_TTL, FLOW_CHANCE, FORCED_REBOOK_BPS, HISTORY_LIMIT, HISTORY_POINTS, MAX_PRICE_DRIVERS, MAX_QUOTES, PRICE_TAPE_LIMIT, PRICE_UPDATE_TICKS, QUEUE_FLOW_MAX, QUEUE_FLOW_MIN, SESSION_SECONDS, SPEEDS, STARTING_CASH, START_SECONDS, simSecondsPerTick } from './constants'
import { initialDispatch, stepDispatch } from './dispatch'
import { applyFillImpact, applyPositionFill, bookMid, clampUnit, commissionOf, decayNewsBias, exchangeLiquidity, makeBook, pickFlowEvent, riskLimitBreach, tierOf, venuePricePreview, volScale } from './market'
import { fillProbability, priceCompetitiveness, queueAheadAt } from './quotes'
import type { ActionResult, ChartEvent, EnginePosition, ExchangeTradeInput, FillInput, InstrumentState, LimitOrderInput, LiveQuote, OpeningPosition, PriceDriver, PriceFrame, PriceImpulse, QuoteInput, RestingOrder, SessionOptions, SessionStatus, SimulationState } from './types'
import { formatShortTime, round2 } from './util'

/** 每一局换一个新的种子，保证同一局内可复现、不同局走势不同 */
export function randomSeed(): number {
  return 100000 + Math.floor(Math.random() * 900000)
}

/** 过滤掉非法/为零的行，只保留本局真实可交易的名字 */
export function normaliseOpeningBook(book: OpeningPosition[]): EnginePosition[] {
  return book
    .filter(
      (entry) =>
        UNIVERSE.some((instrument) => instrument.symbol === entry.symbol) &&
        Number.isFinite(entry.netQty) &&
        Number.isFinite(entry.avgPrice) &&
        Math.trunc(entry.netQty) !== 0 &&
        entry.avgPrice > 0,
    )
    .map((entry) => ({
      symbol: entry.symbol,
      netQty: Math.trunc(entry.netQty),
      avgPrice: round2(entry.avgPrice),
      realised: 0,
    }))
}

export function createSession(
  seed = randomSeed(),
  openingBook: OpeningPosition[] = [],
  options: SessionOptions = {},
): SimulationState {
  const minutes = options.minutes ?? DEFAULT_MINUTES
  const scenario = options.scenario ?? DEFAULT_SCENARIO
  const role = options.role ?? 'market-maker'
  const tier = options.tier ?? tierById(role, DEFAULT_TIER_ID)
  /* 每局从剧本的新闻池里随机抽一批、随机铺时间：
     seed 决定一切，所以同一个分享链接仍然复现，换一个 seed 顺序和措辞都不同。
     档位 headlineCount 只是上限，池子不够时全部用上。 */
  const scheduledNews = scheduleNews(
    scenario.news,
    (seed ^ 0x9e3779b9) >>> 0,
    Math.min(tier.headlineCount, scenario.newsCount, scenario.news.length),
  )
  /* 场景可以把盘口拉宽、把深度抽干：崩盘日做市要难得多 */
  const spreadMultiplier = scenario.spreadMultiplier ?? 1
  const liquidityMultiplier = scenario.liquidityMultiplier ?? 1
  let rng = createSeed(seed)
  const instruments = UNIVERSE.map((entry) => {
    const prevClose = round2(entry.last / (1 + entry.changePct / 100))
    const raw: number[] = []
    let value = entry.last * (1 - entry.sigma * 10)
    for (let i = 0; i < HISTORY_POINTS; i += 1) {
      const [shock, next] = normalish(rng)
      rng = next
      value = Math.max(0.01, value * (1 + shock * entry.sigma))
      raw.push(value)
    }
    const scale = entry.last / raw[raw.length - 1]
    const series = raw.map((point) => round2(point * scale))
    const spreadBps = round2(entry.spreadBps * spreadMultiplier)
    const lot = Math.max(10, Math.round(entry.lot * liquidityMultiplier))
    const bookSize = Math.max(300, Math.round((entry.bookSize * liquidityMultiplier) / 100) * 100)
    const [book, afterBook] = makeBook(rng, entry.last, spreadBps, bookSize)
    rng = afterBook
    return {
      symbol: entry.symbol,
      name: entry.name,
      prevClose,
      openPrice: entry.last,
      last: entry.last,
      lastMove: 0,
      sigma: entry.sigma,
      spreadBps,
      lot,
      bookSize,
      series,
      book,
      bookMid: entry.last,
      impulses: [],
      driver: null,
    }
  })

  /* 10 个流式智能体：各自有现金与持仓，主动买卖并把净流量汇成价格冲击 */
  const [agents, afterAgents] = createAgents(rng)
  rng = afterAgents

  return {
    rng,
    seed,
    tick: 0,
    lastPriceTick: 0,
    startedAt: START_SECONDS,
    simSeconds: START_SECONDS,
    status: 'RUNNING',
    speed: 1,
    minutes,
    simSecondsPerTick: simSecondsPerTick(minutes),
    instruments,
    // 新的一局：持仓只来自开局自选的初始仓位，成交、委托、佣金、已实现盈亏都归零
    positions: normaliseOpeningBook(openingBook),
    orders: [],
    trades: [],
    quotes: [],
    dispatch: [initialDispatch()],
    news: [],
    pendingNews: scheduledNews.map(({ template, at: slot }) => {
      const at = START_SECONDS + slot * SESSION_SECONDS
      return {
        id: template.id,
        time: formatShortTime(at),
        tag: template.tag,
        kind: template.kind,
        impact: template.impact,
        headline: template.headline.en,
        headlineZh: template.headline.zh,
        short: template.short.en,
        shortZh: template.short.zh,
        detail: template.detail.en,
        detailZh: template.detail.zh,
        source: template.source,
        direction: template.direction,
        at,
        driftBps: template.driftBps,
        symbol: template.symbol,
      }
    }),
    chartEvents: [],
    priceTape: [],
    commission: 0,
    cash: STARTING_CASH,
    nextDispatchAt: START_SECONDS + 900,
    counters: { rfq: 201, quote: 118, order: 1043, trade: 8841, dealerQuote: 0, resting: 0 },
    telemetry: recordRfq(createTelemetry()),
    scenario,
    clients: DEFAULT_CLIENTS,
    clientHeat: {},
    newsBias: {},
    history: [
      {
        tick: 0,
        time: formatShortTime(START_SECONDS),
        prices: Object.fromEntries(instruments.map((instrument) => [instrument.symbol, instrument.last])),
      },
    ],
    agents,
    role,
    dealerQuotes: [],
    restingOrders: [],
    tier,
    commissionRate: tier.commissionRate,
    declines: 0,
    drainUntilTick: 0,
  }
}

/** 按最新价格把持仓 mark-to-market：敞口、净额和总 P&L（已实现 + 未实现 − 佣金） */
export function markToMarket(positions: EnginePosition[], instruments: InstrumentState[], commission: number) {
  let realised = 0
  let unrealised = 0
  let gross = 0
  let net = 0
  for (const position of positions) {
    const instrument = instruments.find((item) => item.symbol === position.symbol)
    const last = instrument?.last ?? position.avgPrice
    realised += position.realised
    unrealised += position.netQty * (last - position.avgPrice)
    const value = position.netQty * last
    gross += Math.abs(value)
    net += value
  }
  return {
    gross: round2(gross),
    net: round2(net),
    pnl: round2(realised + unrealised - commission),
  }
}

export function bookOf(instruments: InstrumentState[], symbol: string): Book {
  return instruments.find((item) => item.symbol === symbol)?.book ?? { bids: [], asks: [] }
}

/* ------------------------------------------------------------------ */
/* 推进                                                                */
/* ------------------------------------------------------------------ */
export function stepSession(state: SimulationState): SimulationState {
  if (state.status !== 'RUNNING') return state

  const tick = state.tick + 1
  const simSeconds = state.simSeconds + state.simSecondsPerTick
  let rng = state.rng
  let telemetry = state.telemetry

  /* 1. 到达的新闻与冲击 */
  const due = state.pendingNews.filter((item) => item.at <= simSeconds)
  const pendingNews = state.pendingNews.filter((item) => item.at > simSeconds)
  const revealed: NewsItem[] = due.map((item) => ({
    id: item.id,
    time: item.time,
    tag: item.tag,
    kind: item.kind,
    impact: item.impact,
    headline: item.headline,
    headlineZh: item.headlineZh,
    short: item.short,
    shortZh: item.shortZh,
    detail: item.detail,
    detailZh: item.detailZh,
    source: item.source,
    direction: item.direction,
    symbol: item.symbol,
  }))
  const news = revealed.length === 0 ? state.news : [...state.news, ...revealed]
  for (const item of revealed) {
    telemetry = recordNews(telemetry, item.id, tick)
  }
  const revealedEvents: ChartEvent[] = due.map((item) =>
    item.symbol ? { tick, label: item.symbol, symbol: item.symbol } : { tick, label: 'MACRO' },
  )
  const chartEvents =
    revealedEvents.length === 0 ? state.chartEvents : [...state.chartEvents, ...revealedEvents].slice(-40)

  const tier = tierOf(state)
  /* 1b. 把到点的新闻转成对标的的价格冲量：利好推高、利空压低，按标的波动率放大后逐帧释放 */
  const impulsesBySymbol = new Map<string, PriceImpulse[]>()
  for (const item of due) {
    if (!item.direction || !item.driftBps) continue
    const targets = item.symbol ? [item.symbol] : SYMBOLS
    for (const symbol of targets) {
      const instrument = state.instruments.find((candidate) => candidate.symbol === symbol)
      if (!instrument) continue
      const impulse: PriceImpulse = {
        id: `${item.id}-${symbol}`,
        label: item.short,
        direction: item.direction,
        bps: round2(item.driftBps * volScale(instrument.sigma) * tier.newsVolMult),
        ttl: DRIFT_TTL,
        hint: item.headline,
        source: 'headline',
      }
      impulsesBySymbol.set(symbol, [...(impulsesBySymbol.get(symbol) ?? []), impulse])
    }
  }

  /* 1b2. 抢单：高档位里，知情客户会专门打掉「又宽又旧」的报价。
     命中的报价在这一帧被强制成交，然后价格顺着新闻继续走 —— 这就是 PICKED OFF。 */
  const snipedQuoteIds = new Set<string>()
  if (tier.snipeChance > 0) {
    for (const item of due) {
      if (!item.direction || !item.driftBps) continue
      const targets = item.symbol ? [item.symbol] : SYMBOLS
      for (const symbol of targets) {
        const [snipeRoll, afterSnipe] = nextRandom(rng)
        rng = afterSnipe
        if (snipeRoll >= tier.snipeChance) continue
        for (const quote of state.quotes) {
          if (quote.symbol !== symbol || quote.status !== 'LIVE') continue
          if (tick - quote.createdTick < 2) continue
          if (quote.spreadRatio < 1.2) continue
          snipedQuoteIds.add(quote.id)
        }
      }
    }
  }

  /* 1c. 更新新闻热度：给刚出的头条记一笔带方向的偏移，派单用它找「消息灵通」的客户 */
  let newsBias = decayNewsBias(state.newsBias)
  let headlineHeat = false
  for (const item of due) {
    if (!item.direction || !item.driftBps) continue
    const targets = item.symbol ? [item.symbol] : SYMBOLS
    for (const symbol of targets) {
      const instrument = state.instruments.find((candidate) => candidate.symbol === symbol)
      if (!instrument) continue
      headlineHeat = true
      newsBias = {
        ...newsBias,
        [symbol]: round2(
          (newsBias[symbol] ?? 0) + item.direction * item.driftBps * volScale(instrument.sigma) * tier.newsVolMult,
        ),
      }
    }
  }

  /* 1d. 10 个流式智能体：各自决定买/卖/不动，同一标的的流量汇总成一次价格冲击。
     它们不挂单，只贡献「主动成交」，所以既会推动价格，也会消耗盘口上排在我们前面的量。 */
  const agentStep = stepAgents(state.agents, rng, {
    tick,
    instruments: state.instruments.map((instrument) => ({
      symbol: instrument.symbol,
      last: instrument.last,
      openPrice: instrument.openPrice,
      series: instrument.series,
      lot: instrument.lot,
      spreadBps: instrument.spreadBps,
    })),
    newsBias,
  })
  rng = agentStep.rng
  const agents = agentStep.agents
  const agentFlows: AgentFlow[] = agentStep.flows
  const agentFlowBySymbol = new Map(aggregateFlows(agentFlows).map((flow) => [flow.symbol, flow]))
  const agentVolumeBySymbol = new Map<string, number>()
  for (const flow of agentFlows) {
    agentVolumeBySymbol.set(flow.symbol, (agentVolumeBySymbol.get(flow.symbol) ?? 0) + flow.qty)
  }

  /* 2. 价格与盘口：时钟每帧都走，行情每 PRICE_UPDATE_TICKS 帧（0.25 秒）刷新一次 */
  const priceDue = tick - state.lastPriceTick >= PRICE_UPDATE_TICKS
  /* S4 黑天鹅：整局随机抽干一次流动性（盘口变薄、价差翻倍），30–60 帧后恢复 */
  let drainUntilTick = state.drainUntilTick
  if (priceDue && tier.liquidityDrain && drainUntilTick === 0 && tick > 120) {
    const [drainRoll, afterDrain] = nextRandom(rng)
    rng = afterDrain
    if (drainRoll < 0.0008) drainUntilTick = tick + 30 + Math.round(drainRoll * 30_000)
  }
  const draining = drainUntilTick > tick
  let priceTape = state.priceTape
  let instruments = priceDue
    ? state.instruments.map((instrument) => {
        const scale = volScale(instrument.sigma)

        /* 先释放还没走完的新闻冲量 + 本帧刚到点的新闻冲量 */
        const released: PriceDriver[] = []
        const impulses: PriceImpulse[] = []
        for (const impulse of [...instrument.impulses, ...(impulsesBySymbol.get(instrument.symbol) ?? [])]) {
          const bps = round2(impulse.bps * DRIFT_RELEASE)
          if (bps >= 0.05) {
            released.push({
              label: impulse.label,
              direction: impulse.direction,
              bps,
              source: impulse.source,
              hint: impulse.hint,
            })
          }
          const remaining = round2(impulse.bps * (1 - DRIFT_RELEASE))
          const ttl = impulse.ttl - 1
          if (ttl > 0 && remaining >= 0.5) impulses.push({ ...impulse, bps: remaining, ttl })
        }

        /* 本帧的微观流动来源：绝大多数帧都有成交（多为小单、偶尔扫单），只要有价格变动就一定有来源 */
        const [chanceRoll, afterChance] = nextRandom(rng)
        rng = afterChance
        let flowDriver: PriceDriver | null = null
        if (chanceRoll < FLOW_CHANCE) {
          const [flowRoll, afterFlow] = nextRandom(rng)
          rng = afterFlow
          const [sizeRoll, afterSize] = nextRandom(rng)
          rng = afterSize
          const [dirRoll, afterDir] = nextRandom(rng)
          rng = afterDir
          const event = pickFlowEvent(flowRoll)
          const flowDirection = (event.direction === 0 ? (dirRoll < 0.5 ? -1 : 1) : event.direction) as 1 | -1
          flowDriver = {
            label: event.label,
            direction: flowDirection,
            bps: round2(event.bps * (0.6 + sizeRoll * 1.0 + 2.4 * Math.pow(sizeRoll, 8)) * scale),
            source: 'flow',
            hint: event.hint,
          }
        }

        /* 这一帧里 30 个流式智能体在同一标的上的净流量；按人数缩放，保持和 10 人时同一量级的波动 */
        const rawAgentFlow = agentFlowBySymbol.get(instrument.symbol) ?? null
        const agentFlow = rawAgentFlow
          ? { ...rawAgentFlow, bps: round2(rawAgentFlow.bps * AGENT_FLOW_SCALE * tier.agentSkill) }
          : null
        const agentDriver: PriceDriver | null = agentFlow
          ? {
              label: agentFlow.label,
              direction: agentFlow.direction,
              bps: Math.abs(agentFlow.bps),
              source: 'agent',
              hint: agentFlow.hint,
            }
          : null

        const netBps = round2(
          released.reduce((sum, driver) => sum + driver.direction * driver.bps, 0) +
            (flowDriver ? flowDriver.direction * flowDriver.bps : 0) +
            (agentFlow ? agentFlow.bps : 0),
        )
        const last = round2(Math.max(0.01, instrument.last * (1 + netBps / 10000)))
        const direction: 1 | -1 = netBps >= 0 ? 1 : -1
        const drivers = [...released, ...(flowDriver ? [flowDriver] : []), ...(agentDriver ? [agentDriver] : [])]
          .sort((a, b) => b.bps - a.bps)
          .slice(0, MAX_PRICE_DRIVERS)
        /* 用「和实际涨跌方向一致的最大驱动」解释这次变动，箭头就不会和标签打架 */
        const driver = drivers.find((candidate) => candidate.direction === direction) ?? drivers[0] ?? null

        if (last !== instrument.last) {
          priceTape = [
            ...priceTape,
            {
              id: `PX-${tick}-${instrument.symbol}`,
              tick,
              time: formatShortTime(simSeconds),
              symbol: instrument.symbol,
              price: last,
              pct: round2(((last - instrument.last) / instrument.last) * 100),
              bps: netBps,
              direction,
              drivers,
            },
          ].slice(-PRICE_TAPE_LIMIT)
        }

        /* 盘口只在价格相对上次挂单的位置明显移动、或刚吃到一条大新闻时才重挂 */
        const movedBps = (Math.abs(last - instrument.bookMid) / instrument.bookMid) * 10000
        const headlineBps = released.reduce((sum, candidate) => sum + candidate.bps, 0)
        let book = instrument.book
        let bookMid = instrument.bookMid
        if (
          draining ||
          headlineBps >= FORCED_REBOOK_BPS ||
          movedBps >= BOOK_MIN_MOVE_BPS ||
          Math.abs(agentFlow?.bps ?? 0) >= FORCED_REBOOK_BPS
        ) {
          const [nextBook, afterBook] = makeBook(
            rng,
            last,
            instrument.spreadBps * (draining ? 2 : 1),
            draining ? Math.max(300, Math.round((instrument.bookSize * 0.4) / 100) * 100) : instrument.bookSize,
            instrument.book,
          )
          rng = afterBook
          book = nextBook
          bookMid = last
        }

        return {
          ...instrument,
          last,
          lastMove: round2(last - instrument.last),
          series: [...instrument.series.slice(-(CHART_POINTS - 1)), last],
          book,
          bookMid,
          impulses,
          driver,
        }
      })
    : state.instruments.map((instrument) =>
        instrument.lastMove === 0 ? instrument : { ...instrument, lastMove: 0 },
      )
  /* 3. 报价生命周期：延迟 → 挂上排队 → 部分成交 → 全成/过期 */
  let positions = state.positions
  let trades = state.trades
  let orders = state.orders
  let commission = state.commission
  let cash = state.cash
  let counters = state.counters
  let dispatch = state.dispatch
  let clientHeat = { ...state.clientHeat }
  const quotes: LiveQuote[] = []

  for (const quote of state.quotes) {
    if (quote.status === 'FILLED' || quote.status === 'EXPIRED' || quote.status === 'PARTIAL') {
      quotes.push(quote)
      continue
    }
    const ourSide: Side = quote.clientSide === 'SELL' ? 'BUY' : 'SELL'
    const ourPrice = quote.clientSide === 'SELL' ? quote.bid : quote.offer

    /* 3a. 报价还在路上：延迟结束前不挂进盘口 */
    if (quote.status === 'PENDING') {
      const latencyTicks = quote.latencyTicks - 1
      if (latencyTicks > 0) {
        quotes.push({ ...quote, latencyTicks })
        continue
      }
      const queueAhead = queueAheadAt(bookOf(instruments, quote.symbol), quote.clientSide, ourPrice)
      quotes.push({ ...quote, status: 'LIVE', latencyTicks: 0, queueAhead })
      continue
    }

    /* 3b. 挂在盘口上的每一帧：有效期倒计时、排队消耗、主动成交可能打到我们 */
    const ttlTicks = quote.ttlTicks - 1
    if (ttlTicks <= 0) {
      const finalStatus = quote.filledQty > 0 ? 'PARTIAL' : 'EXPIRED'
      if (quote.rfqId) dispatch = dispatch.filter((item) => item.id !== quote.rfqId)
      telemetry = patchQuote(telemetry, quote.id, { filledQty: quote.filledQty, queueTicks: quote.queueTicks })
      quotes.push({ ...quote, status: finalStatus, ttlTicks: 0 })
      continue
    }

    const boardSize = instruments.find((item) => item.symbol === quote.symbol)?.bookSize ?? 5_000
    const [volRoll, afterVol] = nextRandom(rng)
    rng = afterVol
    /* 智能体的主动单也在消耗盘口，所以它们活跃时我们的报价更容易被成交 */
    const agentVolume = Math.round(
      (agentVolumeBySymbol.get(quote.symbol) ?? 0) * AGENT_VOLUME_SCALE * tier.agentSkill,
    )
    const rawMarketVolume =
      Math.round(boardSize * (QUEUE_FLOW_MIN + volRoll * (QUEUE_FLOW_MAX - QUEUE_FLOW_MIN))) + agentVolume
    const marketVolume = Math.round(rawMarketVolume * tier.queueDecayMult)
    const queueBefore = quote.queueAhead
    const queueAhead = Math.max(0, queueBefore - marketVolume)
    /* 排在队首之后的帧数：清空队列的那一帧定格，用来衡量「报价被晾了多久」 */
    const queueTicks = queueBefore === 0 ? quote.queueTicks : queueAhead === 0 ? quote.queueTicks : quote.queueTicks + 1
    let next: LiveQuote = { ...quote, ttlTicks, queueAhead, queueTicks }
    if (queueBefore > 0 && queueAhead === 0) {
      telemetry = patchQuote(telemetry, quote.id, { queueTicks })
    }

    /* 队列前面的量被吃掉后，剩下的主动成交才可能打到我们 */
    const sniped = snipedQuoteIds.has(quote.id)
    const remainingQty = quote.qty - quote.filledQty
    const available = sniped ? remainingQty : Math.max(0, marketVolume - queueBefore)
    if (available > 0 && remainingQty > 0) {
      const [roll, afterRoll] = nextRandom(rng)
      rng = afterRoll
      /* 报得比市场宽，除了「更难成交」，在难档位里还要再打折（宽度惩罚） */
      const widthFactor =
        quote.spreadRatio > 1
          ? Math.max(0.2, 1 - (quote.spreadRatio - 1) * (tier.widthPenalty - 1) * 0.6)
          : 1
      const chance = clampUnit(
        priceCompetitiveness(bookOf(instruments, quote.symbol), quote.clientSide, ourPrice) *
          (0.5 + 0.5 * quote.fillProbability) *
          quote.tolerance *
          widthFactor,
      )
      if (sniped || roll < chance) {
        const fillQty = Math.min(remainingQty, available)
        const gross = ourPrice * fillQty
        const fee = round2(gross * commissionOf(state))
        /* 资金约束：买入必须付得起，付不起这张报价就作废 */
        if (ourSide === 'BUY' && gross + fee > cash) {
          if (quote.rfqId) dispatch = dispatch.filter((item) => item.id !== quote.rfqId)
          quotes.push({ ...next, status: 'EXPIRED', ttlTicks: 0 })
          continue
        }
        cash = round2(cash + (ourSide === 'BUY' ? -(gross + fee) : gross - fee))
        positions = applyPositionFill(positions, quote.symbol, ourSide, fillQty, ourPrice)
        /* 我们自己的成交推动价格：买上推、卖下压，幅度按成交金额（3–10bps），之后逐帧衰减 */
        instruments = applyFillImpact(instruments, quote.symbol, ourSide, gross, tick)
        /* 知情客户成交后，价格还会顺着他们的方向继续走一段：越难的档位漂得越远 */
        if (quote.clientType === 'informed' && tier.adverseDriftMult > 1) {
          const adverseBps = round2(6 * (tier.adverseDriftMult - 1))
          if (adverseBps >= 0.5) {
            instruments = instruments.map((instrument) =>
              instrument.symbol === quote.symbol
                ? {
                    ...instrument,
                    impulses: [
                      ...instrument.impulses,
                      {
                        id: `ADV-${tick}-${quote.symbol}`,
                        label: 'informed flow',
                        direction: (ourSide === 'BUY' ? -1 : 1) as 1 | -1,
                        bps: adverseBps,
                        ttl: FILL_IMPACT_TTL,
                        hint: 'An informed client just hit you — the tape keeps moving against your book.',
                        source: 'flow',
                      },
                    ],
                  }
                : instrument,
            )
          }
        }
        commission = round2(commission + fee)
        counters = { ...counters, trade: counters.trade + 1, order: counters.order + 1 }
        const filledTrade: TradeRow = {
          id: `TRD-${counters.trade}`,
          time: formatShortTime(simSeconds),
          symbol: quote.symbol,
          side: ourSide,
          qty: fillQty,
          price: round2(ourPrice),
          fee,
          venue: 'client',
        }
        const filledOrder: OrderRow = {
          id: `ORD-${counters.order}`,
          time: formatShortTime(simSeconds),
          symbol: quote.symbol,
          side: ourSide,
          qty: fillQty,
          price: round2(ourPrice),
          status: 'FILLED',
          venue: 'client',
        }
        trades = [filledTrade, ...trades].slice(0, 20)
        orders = [filledOrder, ...orders].slice(0, 20)
        const fillMid = bookMid(bookOf(instruments, quote.symbol))
        telemetry = recordFill(telemetry, {
          id: filledTrade.id,
          symbol: quote.symbol,
          side: ourSide,
          qty: fillQty,
          price: round2(ourPrice),
          mid: fillMid,
          edge: round2(ourSide === 'BUY' ? fillMid - ourPrice : ourPrice - fillMid),
          notional: round2(gross),
          fee,
          tick,
          venue: 'client',
          clientType: quote.clientType,
          quoteId: quote.id,
          counterparty: findCounterparty(agentFlows, quote.symbol, quote.clientSide) ?? undefined,
        })
        const filledQty = quote.filledQty + fillQty
        telemetry = patchQuote(telemetry, quote.id, { filledQty })
        /* 好的服务会抵消一点客户怨气 */
        clientHeat = { ...clientHeat, [quote.client]: Math.max(0, round2((clientHeat[quote.client] ?? 0) - 0.5)) }
        const stillLive = filledQty < quote.qty
        next = { ...next, filledQty, status: stillLive ? 'LIVE' : 'FILLED' }
        if (!stillLive && quote.rfqId) {
          dispatch = dispatch.filter((item) => item.id !== quote.rfqId)
        }
      }
    }
    quotes.push(next)
  }

  /* 3b. 交易所限价挂单：价格穿过挂单价后，吃这一帧的市场流量成交（可部分成交、可撤单） */
  let restingOrders = state.restingOrders
  if (restingOrders.some((order) => order.status === 'WORKING')) {
    const updatedResting: RestingOrder[] = []
    for (const resting of restingOrders) {
      if (resting.status !== 'WORKING' || resting.remaining <= 0) {
        updatedResting.push(resting)
        continue
      }
      const instrument = instruments.find((candidate) => candidate.symbol === resting.symbol)
      if (!instrument) {
        updatedResting.push({ ...resting, status: 'CANCELLED', remaining: 0 })
        continue
      }
      const crossed =
        resting.side === 'BUY' ? instrument.last <= resting.limit : instrument.last >= resting.limit
      if (!crossed) {
        updatedResting.push(resting)
        continue
      }
      const [flowRoll, afterFlow] = nextRandom(rng)
      rng = afterFlow
      /* 这一帧有多少自然流量能在挂单价上成交 */
      const marketFlow = Math.max(
        100,
        Math.round(instrument.bookSize * (QUEUE_FLOW_MIN + flowRoll * (QUEUE_FLOW_MAX - QUEUE_FLOW_MIN))),
      )
      const price =
        resting.side === 'BUY' ? Math.min(resting.limit, instrument.last) : Math.max(resting.limit, instrument.last)
      const affordable =
        resting.side === 'BUY'
          ? Math.floor(cash / (price * (1 + state.commissionRate)))
          : resting.remaining
      const fillQty = Math.min(resting.remaining, marketFlow, affordable)
      if (fillQty < 1) {
        updatedResting.push(resting)
        continue
      }
      const gross = round2(price * fillQty)
      const fee = round2(gross * state.commissionRate)
      const fillMid = bookMid(instrument.book)
      instruments = applyFillImpact(instruments, resting.symbol, resting.side, gross, tick)
      positions = applyPositionFill(positions, resting.symbol, resting.side, fillQty, price)
      cash = round2(cash + (resting.side === 'BUY' ? -(gross + fee) : gross - fee))
      commission = round2(commission + fee)
      counters = { ...counters, trade: counters.trade + 1, order: counters.order + 1 }
      const tradeRow: TradeRow = {
        id: `TRD-${counters.trade}`,
        time: formatShortTime(simSeconds),
        symbol: resting.symbol,
        side: resting.side,
        qty: fillQty,
        price: round2(price),
        fee,
        venue: 'exchange',
      }
      trades = [tradeRow, ...trades].slice(0, 20)
      const remaining = resting.remaining - fillQty
      const status: RestingOrder['status'] = remaining > 0 ? 'WORKING' : 'FILLED'
      const orderIndex = orders.findIndex((order) => order.id === resting.orderId)
      if (orderIndex === -1) {
        const orderRow: OrderRow = {
          id: resting.orderId,
          time: formatShortTime(simSeconds),
          symbol: resting.symbol,
          side: resting.side,
          qty: remaining,
          price: resting.limit,
          status,
          venue: 'exchange',
        }
        orders = [orderRow, ...orders].slice(0, 30)
      } else {
        orders = orders.map((order, index) =>
          index === orderIndex ? { ...order, qty: remaining, status } : order,
        )
      }
      telemetry = recordFill(telemetry, {
        id: tradeRow.id,
        symbol: resting.symbol,
        side: resting.side,
        qty: fillQty,
        price: round2(price),
        mid: fillMid,
        edge: round2(resting.side === 'BUY' ? fillMid - price : price - fillMid),
        notional: gross,
        fee,
        tick,
        venue: 'exchange',
      })
      updatedResting.push({ ...resting, remaining, status })
    }
    restingOrders = updatedResting
  }

  /* 4. 系统派单：过期清理 + 新单到达；头条刚出时消息灵通的客户会扎堆来做方向 */
  const dispatchStep = stepDispatch({
    state,
    simSeconds,
    dispatch,
    counters,
    telemetry,
    rng,
    tier,
    clientHeat,
    newsBias,
    headlineHeat,
  })
  dispatch = dispatchStep.dispatch
  counters = dispatchStep.counters
  telemetry = dispatchStep.telemetry
  rng = dispatchStep.rng
  clientHeat = dispatchStep.clientHeat
  const nextDispatchAt = dispatchStep.nextDispatchAt

  /* 5. 遥测采样：每帧记一次敞口与 P&L，维护峰值/最大回撤 */
  const marked = markToMarket(positions, instruments, commission)
  telemetry = sampleExposure(telemetry, { tick, gross: marked.gross, net: marked.net, pnl: marked.pnl })

  /* 6. 会话结束 */
  const status: SessionStatus = simSeconds - state.startedAt >= SESSION_SECONDS ? 'CLOSED' : 'RUNNING'

  /* 6b. dealer 回价过期：电话里报的价格有有效期 */
  const dealerQuotes = state.dealerQuotes.filter((quote) => tick <= quote.expiresAt)

  /* 7. 回放帧：每帧记录五个名字的价格，供结算后的复盘时间轴使用 */
  const history: PriceFrame[] =
    tick % PRICE_UPDATE_TICKS === 0
      ? [
          ...state.history,
          {
            tick,
            time: formatShortTime(simSeconds),
            prices: Object.fromEntries(instruments.map((item) => [item.symbol, item.last])),
          },
        ].slice(-HISTORY_LIMIT)
      : state.history

  return {
    ...state,
    rng,
    tick,
    lastPriceTick: priceDue ? tick : state.lastPriceTick,
    simSeconds,
    status,
    instruments,
    positions,
    orders,
    trades,
    quotes: quotes.slice(-MAX_QUOTES),
    dispatch,
    news,
    pendingNews,
    chartEvents,
    priceTape,
    commission,
    cash,
    nextDispatchAt,
    counters,
    telemetry,
    newsBias,
    clientHeat,
    history,
    agents,
    dealerQuotes,
    restingOrders,
    drainUntilTick: drainUntilTick > tick ? drainUntilTick : 0,
  }
}

export function advanceSession(state: SimulationState, ticks: number): SimulationState {
  let next = state
  for (let i = 0; i < ticks; i += 1) {
    const stepped = stepSession(next)
    if (stepped === next) break
    next = stepped
  }
  return next
}

export function sendQuote(state: SimulationState, input: QuoteInput): ActionResult {
  if (!(input.bid > 0) || !(input.offer > 0) || input.offer < input.bid) {
    return { state, message: 'QUOTE REJECTED · bid/offer out of range' }
  }
  const rfq = input.rfqId ? state.dispatch.find((item) => item.id === input.rfqId) : undefined
  const clientSide = rfq?.side ?? 'SELL'
  const qty = rfq?.qty ?? Math.max(500, Math.round((input.bidVolume + input.offerVolume) / 4))
  const ourSide: Side = clientSide === 'SELL' ? 'BUY' : 'SELL'
  const ourPrice = ourSide === 'BUY' ? input.bid : input.offer
  /* 报价也是一种风险承诺：这张单全部成交后会突破档位的单名/总敞口上限就不报 */
  const riskBreach = riskLimitBreach(state, input.symbol, ourSide, qty, ourPrice)
  if (riskBreach) return { state, message: riskBreach }
  /* 客户卖给我们 = 我们要拿现金接货，接不下就别报价 */
  if (clientSide === 'SELL' && qty * input.bid * (1 + commissionOf(state)) > state.cash) {
    return {
      state,
      message: `QUOTE REJECTED · buying ${qty.toLocaleString('en-US')} would exceed the cash budget`,
    }
  }
  const counter = state.counters.quote + 1
  let rng = state.rng
  /* 报价不是点一下就到位：先在路上待 1–3 个 tick，能被抢跑 */
  const [latencyTicks, afterLatency] = randomInt(rng, 1, 3)
  rng = afterLatency
  /** "Valid for" 用模拟秒表示；按 tick 折算并按难度档位缩放（越难，报价越容易失效） */
  const ttlTicks = Math.min(
    40,
    Math.max(4, Math.round((input.validFor / 10) * tierOf(state).quoteTtlMult)),
  )
  const marketBook = state.instruments.find((item) => item.symbol === input.symbol)?.book
  const liveSpread = marketBook ? round2(marketBook.asks[0].price - marketBook.bids[0].price) : 0
  const ourSpread = round2(input.offer - input.bid)
  /** 报价宽度相对市场价差的倍数：决定被成交的概率，也进纪律评分 */
  const spreadRatio = liveSpread > 0 ? round2(ourSpread / liveSpread) : 1
  const profile = rfq ? state.clients.find((candidate) => candidate.id === rfq.client) : undefined
  const clientType: ClientType = profile?.type ?? 'uninformed'
  const tolerance = profile?.tolerance ?? 1
  const quote: LiveQuote = {
    id: `Q-${counter}`,
    symbol: input.symbol,
    bidVolume: input.bidVolume,
    bid: round2(input.bid),
    offer: round2(input.offer),
    offerVolume: input.offerVolume,
    validFor: input.validFor,
    status: 'PENDING',
    client: rfq?.client ?? 'AM-39',
    clientType,
    tolerance,
    qty,
    clientSide,
    ttlTicks,
    latencyTicks,
    queueTicks: 0,
    queueAhead: 0,
    filledQty: 0,
    createdTick: state.tick,
    spreadRatio,
    fillProbability: fillProbability(spreadRatio),
    rfqId: rfq?.id,
  }
  const responseTicks = rfq
    ? Math.max(0, Math.round((state.simSeconds - rfq.createdAt) / state.simSecondsPerTick))
    : null
  const telemetry = recordQuote(state.telemetry, {
    id: quote.id,
    symbol: quote.symbol,
    tick: state.tick,
    ourSpread: round2(quote.offer - quote.bid),
    marketSpread: liveSpread,
    responseTicks,
    rfqId: rfq?.id,
    clientType,
    queueTicks: 0,
    filledQty: 0,
  })
  /* 报得太离谱会得罪客户：怨气累积，下一次他更可能去找别家 */
  const clientHeat =
    spreadRatio > 2.2 && rfq
      ? { ...state.clientHeat, [rfq.client]: Math.min(3, round2((state.clientHeat[rfq.client] ?? 0) + 1)) }
      : state.clientHeat

  return {
    state: {
      ...state,
      rng,
      telemetry,
      clientHeat,
      quotes: [...state.quotes, quote].slice(-MAX_QUOTES),
      counters: { ...state.counters, quote: counter },
    },
    message: `QUOTE SENT · ${input.symbol} ${quote.bid.toFixed(2)} / ${quote.offer.toFixed(2)} · VALID ${input.validFor}s`,
  }
}

export function fillClientOrder(state: SimulationState, input: FillInput): ActionResult {
  if (!(input.qty > 0) || !(input.price > 0)) {
    return { state, message: 'ORDER REJECTED · quantity and price must be positive' }
  }
  const ourSide: Side = input.clientSide === 'SELL' ? 'BUY' : 'SELL'
  const gross = input.qty * input.price
  const fee = round2(gross * commissionOf(state))
  if (ourSide === 'BUY' && gross + fee > state.cash) {
    const need = Math.ceil(gross + fee).toLocaleString('en-US')
    const have = Math.floor(state.cash).toLocaleString('en-US')
    return { state, message: `ORDER REJECTED · insufficient cash (need $${need}, have $${have})` }
  }
  const positions = applyPositionFill(state.positions, input.symbol, ourSide, input.qty, input.price)
  /* 自己的成交同样会推动价格：按成交金额给 3–10bps 的冲量，随后逐帧衰减 */
  const instruments = applyFillImpact(state.instruments, input.symbol, ourSide, gross, state.tick)
  const counters = { ...state.counters, trade: state.counters.trade + 1, order: state.counters.order + 1 }
  const order: OrderRow = {
    id: `ORD-${counters.order}`,
    time: formatShortTime(state.simSeconds),
    symbol: input.symbol,
    side: ourSide,
    qty: input.qty,
    price: round2(input.price),
    status: 'FILLED',
    venue: 'client',
  }
  const trade: TradeRow = {
    id: `TRD-${counters.trade}`,
    time: formatShortTime(state.simSeconds),
    symbol: input.symbol,
    side: ourSide,
    qty: input.qty,
    price: round2(input.price),
    fee,
    venue: 'client',
  }
  const mid = bookMid(bookOf(state.instruments, input.symbol))
  const telemetry = recordFill(state.telemetry, {
    id: trade.id,
    symbol: input.symbol,
    side: ourSide,
    qty: input.qty,
    price: round2(input.price),
    mid,
    edge: round2(ourSide === 'BUY' ? mid - input.price : input.price - mid),
    notional: round2(gross),
    fee,
    tick: state.tick,
    venue: 'client',
  })
  return {
    state: {
      ...state,
      positions,
      instruments,
      telemetry,
      commission: round2(state.commission + fee),
      orders: [order, ...state.orders].slice(0, 20),
      trades: [trade, ...state.trades].slice(0, 20),
      cash: round2(state.cash + (ourSide === 'BUY' ? -(gross + fee) : gross - fee)),
      counters,
      dispatch: input.rfqId ? state.dispatch.filter((item) => item.id !== input.rfqId) : state.dispatch,
    },
    message: `FILLED · ${ourSide} ${input.qty.toLocaleString('en-US')} ${input.symbol} @ ${round2(
      input.price,
    ).toFixed(2)} · ${input.client}`,
  }
}

/**
 * 自己在交易所主动成交（take liquidity）：沿盘口逐档吃，按加权均价成交。
 *
 * 和客户流相比：客户流是「你报价、客户决定是否成交」，价格里含你的价差；
 * 交易所这边没有报价环节，你付出的是市场价差 + 冲击成本，换来立刻到手的库存。
 * 两条腿价差（客户买/交易所卖，或反过来）就是台面的利润来源。
 */
export function tradeOnExchange(state: SimulationState, input: ExchangeTradeInput): ActionResult {
  const qty = Math.trunc(input.qty)
  if (!(qty > 0)) return { state, message: 'EXCHANGE REJECTED · quantity must be positive' }

  const instrument = state.instruments.find((item) => item.symbol === input.symbol)
  if (!instrument) return { state, message: 'EXCHANGE REJECTED · unknown instrument' }

  const levels = input.side === 'BUY' ? instrument.book.asks : instrument.book.bids
  const liquidity = exchangeLiquidity(levels)
  if (liquidity <= 0) {
    const sideLabel = input.side === 'BUY' ? 'offers' : 'bids'
    return { state, message: `EXCHANGE REJECTED · no ${sideLabel} in ${input.symbol} right now` }
  }
  if (qty > liquidity) {
    const available = liquidity.toLocaleString('en-US')
    return { state, message: `EXCHANGE REJECTED · only ${available} ${input.symbol} on the book` }
  }

  const tier = tierOf(state)
  /* 难度档位的工具限制：单笔上限、只能减仓的委托、以及不能裸空 */
  if (qty > tier.maxExchangeQty) {
    return {
      state,
      message: `EXCHANGE LIMIT · this mandate caps a single order at ${tier.maxExchangeQty.toLocaleString(
        'en-US',
      )} shares`,
    }
  }
  if (tier.maxExchangeBookShare < 1 && qty > Math.floor(liquidity * tier.maxExchangeBookShare)) {
    return {
      state,
      message: `EXCHANGE LIMIT · this mandate lets you take at most ${Math.round(
        tier.maxExchangeBookShare * 100,
      )}% of the visible book`,
    }
  }
  const heldQty = state.positions.find((position) => position.symbol === input.symbol)?.netQty ?? 0
  if (state.role === 'sales' && !tier.allowShort && input.side === 'SELL' && heldQty < qty) {
    return { state, message: 'NO SHORTING · retail accounts can only sell what they already hold' }
  }
  const reducesRisk =
    input.side === 'BUY' ? heldQty < 0 : heldQty > 0
  if (tier.exchangeMode === 'reduce-only' && !reducesRisk) {
    return {
      state,
      message: 'EXCHANGE LIMIT · this mandate only lets the desk reduce risk on the exchange',
    }
  }

  /* 成交价 = 这个角色在面板 5 上看到的买/卖价；MM 的双边价更紧，Sales 更宽 */
  const preview = venuePricePreview(state, input.symbol)
  const price = input.side === 'BUY' ? preview.buy : preview.sell
  const mid = preview.mid
  if (!(price > 0)) return { state, message: 'EXCHANGE REJECTED · no market right now' }

  const gross = qty * price
  const fee = round2(gross * commissionOf(state))
  if (input.side === 'BUY' && gross + fee > state.cash) {
    const need = Math.ceil(gross + fee).toLocaleString('en-US')
    const have = Math.floor(state.cash).toLocaleString('en-US')
    return { state, message: `EXCHANGE REJECTED · insufficient cash (need $${need}, have $${have})` }
  }
  const riskBreach = riskLimitBreach(state, input.symbol, input.side, qty, price)
  if (riskBreach) return { state, message: riskBreach }

  const positions = applyPositionFill(state.positions, input.symbol, input.side, qty, price)
  /* 做市商提供流动性，自己下单对市场的冲击小一些；Sales 主动吃单，冲击全额 */
  const impactNotional = gross * (state.role === 'sales' ? 1 : 0.7)
  const instruments = applyFillImpact(state.instruments, input.symbol, input.side, impactNotional, state.tick)
  const counters = { ...state.counters, trade: state.counters.trade + 1, order: state.counters.order + 1 }
  const order: OrderRow = {
    id: `ORD-${counters.order}`,
    time: formatShortTime(state.simSeconds),
    symbol: input.symbol,
    side: input.side,
    qty,
    price,
    status: 'FILLED',
    venue: 'exchange',
  }
  const trade: TradeRow = {
    id: `TRD-${counters.trade}`,
    time: formatShortTime(state.simSeconds),
    symbol: input.symbol,
    side: input.side,
    qty,
    price,
    fee,
    venue: 'exchange',
  }
  const telemetry = recordFill(state.telemetry, {
    id: trade.id,
    symbol: input.symbol,
    side: input.side,
    qty,
    price,
    mid,
    edge: round2(input.side === 'BUY' ? mid - price : price - mid),
    notional: round2(gross),
    fee,
    tick: state.tick,
    venue: 'exchange',
  })

  return {
    state: {
      ...state,
      positions,
      instruments,
      telemetry,
      commission: round2(state.commission + fee),
      orders: [order, ...state.orders].slice(0, 20),
      trades: [trade, ...state.trades].slice(0, 20),
      cash: round2(state.cash + (input.side === 'BUY' ? -(gross + fee) : gross - fee)),
      counters,
    },
    message: `EXCHANGE FILLED · ${input.side} ${qty.toLocaleString('en-US')} ${input.symbol} @ ${price.toFixed(
      2,
    )} · ${preview.gapBps.toFixed(0)}bps ${state.role === 'sales' ? 'taker' : 'maker'} spread`,
  }
}

/**
 * 挂一张限价单到交易所。和市价单不同，单子不会立刻成交：
 * 价格穿过挂单价之后，每帧按市场流量逐笔成交，可以部分成交，也可以撤单。
 */
export function placeLimitOrder(state: SimulationState, input: LimitOrderInput): ActionResult {
  const qty = Math.trunc(input.qty)
  if (!(qty > 0)) return { state, message: 'LIMIT REJECTED · quantity must be positive' }

  const instrument = state.instruments.find((item) => item.symbol === input.symbol)
  if (!instrument) return { state, message: 'LIMIT REJECTED · unknown instrument' }
  if (!(input.limit > 0)) return { state, message: 'LIMIT REJECTED · limit price must be positive' }
  if (Math.abs(input.limit - instrument.last) / instrument.last > 0.2) {
    return { state, message: 'LIMIT REJECTED · keep the limit within 20% of the market' }
  }

  const tier = tierOf(state)
  if (qty > tier.maxExchangeQty) {
    return {
      state,
      message: `EXCHANGE LIMIT · this mandate caps a single order at ${tier.maxExchangeQty.toLocaleString(
        'en-US',
      )} shares`,
    }
  }
  const heldQty = state.positions.find((position) => position.symbol === input.symbol)?.netQty ?? 0
  if (state.role === 'sales' && !tier.allowShort && input.side === 'SELL' && heldQty < qty) {
    return { state, message: 'NO SHORTING · retail accounts can only sell what they already hold' }
  }
  const reducesRisk = input.side === 'BUY' ? heldQty < 0 : heldQty > 0
  if (tier.exchangeMode === 'reduce-only' && !reducesRisk) {
    return {
      state,
      message: 'EXCHANGE LIMIT · this mandate only lets the desk reduce risk on the exchange',
    }
  }
  const gross = qty * input.limit
  const fee = round2(gross * commissionOf(state))
  if (input.side === 'BUY' && gross + fee > state.cash) {
    const need = Math.ceil(gross + fee).toLocaleString('en-US')
    const have = Math.floor(state.cash).toLocaleString('en-US')
    return { state, message: `LIMIT REJECTED · insufficient cash (need ${need}, have ${have})` }
  }
  const riskBreach = riskLimitBreach(state, input.symbol, input.side, qty, input.limit)
  if (riskBreach) return { state, message: riskBreach }

  const counters = {
    ...state.counters,
    order: state.counters.order + 1,
    resting: state.counters.resting + 1,
  }
  const orderId = `ORD-${counters.order}`
  const resting: RestingOrder = {
    id: `LIM-${counters.resting}`,
    orderId,
    symbol: input.symbol,
    side: input.side,
    qty,
    remaining: qty,
    limit: round2(input.limit),
    tick: state.tick,
    status: 'WORKING',
  }
  const order: OrderRow = {
    id: orderId,
    time: formatShortTime(state.simSeconds),
    symbol: input.symbol,
    side: input.side,
    qty,
    price: resting.limit,
    status: 'WORKING',
    venue: 'exchange',
  }
  return {
    state: {
      ...state,
      restingOrders: [...state.restingOrders, resting],
      orders: [order, ...state.orders].slice(0, 30),
      counters,
    },
    message: `ORDER WORKING · ${input.side} ${qty.toLocaleString('en-US')} ${input.symbol} @ ${resting.limit.toFixed(
      2,
    )}`,
  }
}

export function cancelLimitOrder(state: SimulationState, orderId: string): ActionResult {
  const resting = state.restingOrders.find((order) => order.id === orderId)
  if (!resting) return { state, message: 'ORDER NOT FOUND' }
  if (resting.status !== 'WORKING') return { state, message: 'ORDER ALREADY DONE' }
  const restingOrders = state.restingOrders.map((order) =>
    order.id === orderId ? { ...order, status: 'CANCELLED' as const, remaining: 0 } : order,
  )
  const orders = state.orders.map((order) =>
    order.id === resting.orderId ? { ...order, status: 'CANCELLED' as const, qty: 0 } : order,
  )
  return {
    state: { ...state, restingOrders, orders },
    message: `ORDER CANCELLED · ${resting.side} ${resting.remaining.toLocaleString('en-US')} ${
      resting.symbol
    } @ ${resting.limit.toFixed(2)}`,
  }
}

export function declineDispatch(state: SimulationState, rfqId: string): ActionResult {
  const rfq = state.dispatch.find((item) => item.id === rfqId)
  if (!rfq) return { state, message: 'DISPATCH NOT FOUND' }
  const tier = tierOf(state)
  const declines = (state.declines ?? 0) + 1
  /* 超过档位配额后，每拒一单客户的怨气涨得更快；配额内是正常的礼貌拒绝 */
  const overQuota = tier.declineQuota !== null && declines > tier.declineQuota
  const heatStep = 0.8 + (overQuota ? tier.declineHeat : 0)
  /* 拒单留下怨气：这位客户接下来更可能去找别家，派单权重下降 */
  const clientHeat = {
    ...state.clientHeat,
    [rfq.client]: Math.min(3, round2((state.clientHeat[rfq.client] ?? 0) + heatStep)),
  }
  return {
    state: {
      ...state,
      clientHeat,
      declines,
      dispatch: state.dispatch.filter((item) => item.id !== rfqId),
      telemetry: recordDecline(state.telemetry),
    },
    message: overQuota
      ? `DISPATCH DECLINED · ${rfq.id} ${rfq.client} · over the decline quota`
      : `DISPATCH DECLINED · ${rfq.id} ${rfq.client}`,
  }
}

export function togglePause(state: SimulationState): SimulationState {
  if (state.status === 'CLOSED') return state
  return { ...state, status: state.status === 'PAUSED' ? 'RUNNING' : 'PAUSED' }
}

export function cycleSpeed(state: SimulationState): SimulationState {
  const index = SPEEDS.indexOf(state.speed as (typeof SPEEDS)[number])
  return { ...state, speed: SPEEDS[(index + 1) % SPEEDS.length] }
}

export function setSpeed(state: SimulationState, speed: number): SimulationState {
  const next = SPEEDS.find((option) => option === speed)
  return next && next !== state.speed ? { ...state, speed: next } : state
}
