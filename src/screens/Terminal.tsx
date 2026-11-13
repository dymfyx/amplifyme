import { useEffect, useRef, useState } from 'react'
import type { Role } from '../types'
import {
  DEFAULT_MINUTES,
  STARTING_CASH,
  createSession,
  selectAgents,
  selectBook,
  selectCash,
  selectDealerQuotes,
  selectChartMarkers,
  selectDrivers,
  selectHistory,
  selectInstruments,
  selectPnl,
  selectPositions,
  selectPriceTape,
  selectScenario,
  selectSeries,
  selectSessionMeta,
  venuePricePreview,
  selectRestingOrders,
  type DealerRequestInput,
  type ExchangeTradeInput,
  type LimitOrderInput,
  type FillInput,
  type OpeningPosition,
  type QuoteInput,
  type SessionMinutes,
} from '../engine/simulation'
import type { Scenario } from '../engine/scenarios'
import type { DifficultyTier } from '../engine/difficulty'
import { evaluateSession } from '../engine/evaluation'
import { evaluateGoals, goalsForSession } from '../engine/goals'
import {
  adviceFor,
  coachingSummary,
  decisionReview,
  scoreSession,
  selectSettlement,
} from '../engine/scoring'
import { NEWS_REACTION_TICKS } from '../engine/telemetry'
import { useT } from '../i18n'
import { useSimulation } from '../hooks/useSimulation'
import { makeSessionId, type ArchivedSession } from '../storage/archive'
import {
  buildGhost,
  clearGhost,
  parseGhost,
  readGhost,
  serializeGhost,
  writeGhost,
  type GhostDecision,
  type GhostSession,
  type GhostSummary,
} from '../storage/ghost'
import { drillProgress, type Drill, type DrillId } from '../train/drills'
import type { DrillRecord } from '../train/records'
import ChartPanel from '../components/ChartPanel'
import DrillHud from '../components/DrillHud'
import BookPanel from '../components/BookPanel'
import DealerQuotePanel from '../components/DealerQuotePanel'
import DispatchPanel from '../components/DispatchPanel'
import EventFeed from '../components/EventFeed'
import ExchangeTicket from '../components/ExchangeTicket'
import MarketWatch from '../components/MarketWatch'
import PriceTape from '../components/PriceTape'
import PositionsPanel from '../components/PositionsPanel'
import ParticipantsDrawer from '../components/ParticipantsDrawer'
import ScoreDrawer from '../components/ScoreDrawer'
import ReplayDrawer, {
  type ReplayDecision,
  type ReplayEvent,
} from '../components/ReplayDrawer'
import GhostDrawer from '../components/GhostDrawer'
import SettlementReport from '../components/SettlementReport'
import StatusBar from '../components/StatusBar'
import TopBar from '../components/TopBar'
import QuoteRequestTicket from '../components/QuoteRequestTicket'
import TradeTicket from '../components/TradeTicket'

interface TerminalProps {
  role: Role
  openingBook: OpeningPosition[]
  /** 深链里带的固定种子：全组练同一道题，RESTART 也按同一局重放 */
  seed?: number | null
  /** 练习时长档位：5 / 15 / 30 分钟 */
  minutes?: SessionMinutes
  /** 本局的情景剧本：新闻时间轴、价差/流动性系数都由它决定 */
  scenario: Scenario
  /** 这一局的难度档位：点差、手续费、限额与人机强度都由它决定 */
  tier: DifficultyTier
  /** 训练模式：这一局对应的 drill（盘中 HUD 与结算判定都用它） */
  drill?: Drill | null
  /** 该 drill 的历史记录：结算时用来显示尝试/通过次数 */
  drillRecord?: DrillRecord | null
  /** 结算时回报一次成绩，返回写入后的记录 */
  onDrillResult?: (id: DrillId, passed: boolean, composite: number) => DrillRecord | null
  /** 训练结束后回到 drill 列表 */
  onExitDrill?: () => void
  /** 本局结算后自动写入本地存档 */
  onSessionSaved?: (session: ArchivedSession) => void
  onExit: () => void
}

export default function Terminal({
  role,
  openingBook,
  seed = null,
  minutes = DEFAULT_MINUTES,
  scenario,
  tier,
  drill = null,
  drillRecord = null,
  onDrillResult,
  onExitDrill,
  onSessionSaved,
  onExit,
}: TerminalProps) {
  const t = useT()
  const [initial] = useState(() =>
    createSession(seed ?? undefined, openingBook, { minutes, scenario, role, tier }),
  )
  const simulation = useSimulation(initial, openingBook, seed, minutes, scenario, role, tier)
  const { state } = simulation

  const [selected, setSelected] = useState('AZN')
  const [activeRfqId, setActiveRfqId] = useState<string | null>('RFQ-201')
  const [scoreOpen, setScoreOpen] = useState(false)
  const [replayOpen, setReplayOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [reportDismissed, setReportDismissed] = useState(false)
  const [ghost, setGhost] = useState<GhostSession | null>(() => readGhost())
  const [ghostOpen, setGhostOpen] = useState(false)

  const instruments = selectInstruments(state)
  const instrument = instruments.find((item) => item.symbol === selected) ?? instruments[0]
  const positions = selectPositions(state)
  const pnl = selectPnl(state)
  const book = selectBook(state, selected)
  const series = selectSeries(state, selected)
  const markers = selectChartMarkers(state, selected)
  const drivers = selectDrivers(state)
  const tape = selectPriceTape(state)
  const rfqs = state.dispatch
  const activeRfq = rfqs.find((item) => item.id === activeRfqId)
  const meta = selectSessionMeta(state, simulation.latencyMs)
  const cash = selectCash(state)
  const dealerQuotes = selectDealerQuotes(state)
  const venuePreview = venuePricePreview(state, selected)
  const instrumentPosition = positions.find((item) => item.symbol === selected)?.netQty ?? 0
    const workingOrders = selectRestingOrders(state).filter((order) => order.symbol === selected)
  /* 高档位的成交率只是估算，屏幕上会轻微抖动 */
  const fillJitter = tier.estFillJitter
    ? Math.sin(state.tick * 0.7) * tier.estFillJitter
    : 0
  const score = scoreSession(state)
  const settlement = selectSettlement(state)
  const coaching = coachingSummary(state)
  const coachingText = t('Strongest: {best}. Weakest: {worst} — {advice}', {
    best: t(coaching.strongest),
    worst: t(coaching.weakest),
    advice: t(adviceFor(coaching.adviceKey), { ticks: NEWS_REACTION_TICKS }),
  })
  const closed = state.status === 'CLOSED'
  const review = decisionReview(state)
  const scenarioMeta = selectScenario(state)
  const verdict = evaluateSession(state)
  const goals = goalsForSession({ desk: role, minutes: meta.minutes, tier })
  const goalStatus = closed ? evaluateGoals(goals, state) : []
  const history = selectHistory(state)
  const agents = selectAgents(state)
  /* 每次结算写一条本地存档：同 seed/剧本/时长且同一收盘点的重复渲染只写一次 */
  /* 训练模式的盘中进度与一次性成绩回报（重开一局会重新记一次 attempt） */
  const progress = drill ? drillProgress(drill, state) : null
  const restartsRef = useRef(0)
  const recordedRef = useRef<string | null>(null)
  const [drillResult, setDrillResult] = useState<{ attempts: number; passes: number } | null>(null)
  useEffect(() => {
    if (!drill || !closed || !onDrillResult) return
    const key = `${drill.id}:${state.seed}:${restartsRef.current}`
    if (recordedRef.current === key) return
    recordedRef.current = key
    const record = onDrillResult(drill.id, progress?.passed ?? false, score.composite)
    if (record) setDrillResult({ attempts: record.attempts, passes: record.passes })
  })

  const savedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!closed || !onSessionSaved) return
    const desk = role === 'sales' ? 'sales' : 'market-maker'
    const id = makeSessionId(desk, meta.seed, scenarioMeta.id, meta.minutes, meta.clock)
    if (savedIdRef.current === id) return
    savedIdRef.current = id
    onSessionSaved({
      id,
      savedAt: new Date().toISOString(),
      desk,
      scenarioId: scenarioMeta.id,
      scenarioName: scenarioMeta.name,
      minutes: meta.minutes,
      tier: tier.id,
      seed: meta.seed,
      total: settlement.total,
      realised: settlement.realised,
      unrealised: settlement.unrealised,
      commission: settlement.commission,
      cash: settlement.cash,
      benchmarkPnl: settlement.benchmarkPnl,
      alpha: settlement.alpha,
      composite: score.composite,
      percentile: score.percentile,
      trades: settlement.trades,
      quotes: settlement.quotes,
      informedFills: review.informed.fills,
      informedRfqs: review.informed.rfqs,
      adverse: review.adverse.length,
      missed: review.missed.length,
      worstDrawdown: review.worstDrawdown ? review.worstDrawdown.dollars : 0,
      tags: verdict.tags.map((tag) => tag.label),
    })
  }, [closed, onSessionSaved, role, meta.seed, meta.minutes, meta.clock, scenarioMeta.id, scenarioMeta.name, settlement, score, review, verdict])

  /* 回放：价格帧直接用引擎历史；决策与事件从遥测里还原成时间轴上的点 */
  const timeAtTick = new Map(history.map((frame) => [frame.tick, frame.time]))
  const replayEvents: ReplayEvent[] = state.news.map((item) => {
    const reaction = state.telemetry.news.find((candidate) => candidate.id === item.id)
    return {
      id: item.id,
      tick: reaction?.tick ?? 0,
      time: item.time,
      label: item.headline,
      direction: item.direction,
    }
  })
  const replayDecisions: ReplayDecision[] = [
    ...state.telemetry.quotes.map<ReplayDecision>((quote) => ({
      id: quote.id,
      tick: quote.tick,
      time: timeAtTick.get(quote.tick) ?? '--:--',
      kind: 'quote',
      label: `${quote.symbol} ${quote.ourSpread.toFixed(2)} wide`,
      detail: t('{ratio}x market spread · {filled} filled', {
        ratio: quote.marketSpread > 0 ? (quote.ourSpread / quote.marketSpread).toFixed(1) : '—',
        filled: quote.filledQty,
      }),
      tone: quote.filledQty > 0 ? 'up' : undefined,
    })),
    ...state.telemetry.fills.map<ReplayDecision>((fill) => ({
      id: fill.id,
      tick: fill.tick,
      time: timeAtTick.get(fill.tick) ?? '--:--',
      kind: 'fill',
      label: `${fill.side} ${fill.qty.toLocaleString('en-US')} ${fill.symbol} @ ${fill.price.toFixed(2)}`,
      detail: t(fill.venue === 'client' ? 'Client flow · edge {edge}' : 'Exchange · edge {edge}', {
        edge: fill.edge.toFixed(1),
      }),
      tone: fill.edge >= 0 ? 'up' : 'down',
    })),
  ].sort((a, b) => a.tick - b.tick)

  /* 同题对比：把这一局压成一份可导出的影子，对比时只看数字与决策时间轴 */
  const ghostSummary: GhostSummary = {
    desk: role,
    scenarioName: scenarioMeta.name,
    tier: tier.id,
    minutes: meta.minutes,
    seed: meta.seed,
    composite: score.composite,
    percentile: score.percentile,
    total: settlement.total,
    alpha: settlement.alpha,
    trades: settlement.trades,
    tags: verdict.tags.map((tag) => tag.label),
  }
  const ghostDecisions: GhostDecision[] = replayDecisions.map((decision) => ({
    id: decision.id,
    tick: decision.tick,
    time: decision.time,
    kind: decision.kind,
    label: decision.label,
    detail: decision.detail,
  }))

  const handleExportGhost = () => {
    const next = buildGhost(ghostSummary, ghostDecisions)
    writeGhost(next)
    setGhost(next)
    const blob = new Blob([serializeGhost(next)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `market-sim-${role}-${meta.seed}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportGhost = (text: string) => {
    if (!text.trim()) {
      clearGhost()
      setGhost(null)
      return ''
    }
    const { ghost: parsed, error } = parseGhost(text)
    if (!parsed) return error ?? t('Could not read that replay file.')
    writeGhost(parsed)
    setGhost(parsed)
    return ''
  }

  const selectRfq = (id: string) => {
    setActiveRfqId(id)
    const rfq = rfqs.find((item) => item.id === id)
    if (rfq) setSelected(rfq.symbol)
  }

  /** 重开一局：换新种子，并把台面选择恢复成默认状态 */
  const handleRestart = () => {
    setSelected('AZN')
    setActiveRfqId('RFQ-201')
    setScoreOpen(false)
    setReportDismissed(false)
    simulation.restart()
  }

  const handleQuote = (input: QuoteInput) => simulation.sendQuote(input)
  const handleFill = (input: FillInput) => simulation.fillClientOrder(input)
  const handleExchangeTrade = (input: ExchangeTradeInput) => simulation.tradeOnExchange(input)
    const handlePlaceLimit = (input: LimitOrderInput) => simulation.placeLimitOrder(input)
    const handleCancelOrder = (orderId: string) => simulation.cancelLimitOrder(orderId)
  const handleDealerRequest = (input: DealerRequestInput) => simulation.requestDealerQuote(input)
  const handleDealerHit = (quoteId: string, side: 'BUY' | 'SELL') =>
    simulation.hitDealerQuote({ quoteId, side })
  const handleDecline = () =>
    activeRfq ? simulation.declineDispatch(activeRfq.id) : 'NO DISPATCH SELECTED'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        simulation.togglePause()
        return
      }
      if (event.key === '1' || event.key === '2' || event.key === '4') {
        simulation.setSpeed(Number(event.key))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [simulation])

  return (
    <div className="terminal">
      <TopBar
        role={role}
        pnl={pnl}
        cash={cash}
        budget={STARTING_CASH}
        scoreOpen={scoreOpen}
        replayOpen={replayOpen}
        flowOpen={flowOpen}
        sharedSeed={seed}
        minutes={meta.minutes}
        timeLeftMs={meta.timeLeftMs}
        difficulty={t(tier.name)}
        onOpenScore={() => setScoreOpen(true)}
        onOpenReplay={() => setReplayOpen(true)}
        onOpenFlow={() => setFlowOpen(true)}
        onRestart={handleRestart}
        onExit={onExit}
      />

      {drill && progress ? <DrillHud drill={drill} progress={progress} /> : null}

      <main className="workspace">
        <aside className="rail rail--left">
          <MarketWatch
            instruments={instruments}
            selected={selected}
            drivers={drivers}
            onSelect={setSelected}
          />
          <BookPanel symbol={selected} book={book} />
          {role === 'market-maker' ? (
            <DispatchPanel rfqs={rfqs} activeId={activeRfqId ?? ''} onSelect={selectRfq} role={role} />
          ) : (
            <DealerQuotePanel quotes={dealerQuotes} tick={state.tick} onTake={handleDealerHit} />
          )}
        </aside>

        <section className="rail rail--center">
          {role === 'market-maker' ? (
            <TradeTicket
              key={`${selected}-${activeRfqId ?? 'none'}-${state.seed}`}
              role={role}
              instrument={instrument}
              book={book}
              rfq={activeRfq}
              quotes={state.quotes}
              recentFills={state.trades}
              cash={cash}
              fillJitter={fillJitter}
              onQuote={handleQuote}
              onFill={handleFill}
              onDecline={handleDecline}
            />
          ) : (
            <QuoteRequestTicket
              key={`rfq-${selected}-${state.seed}`}
              instrument={instrument}
              cash={cash}
              recentFills={state.trades}
              onRequest={handleDealerRequest}
            />
          )}
          <ExchangeTicket
            key={`exchange-${selected}-${state.seed}-${role}`}
            instrument={instrument}
            book={book}
            cash={cash}
            role={role}
            preview={venuePreview}
            tier={tier}
            netQty={instrumentPosition}
              workingOrders={workingOrders}
              onPlaceLimit={handlePlaceLimit}
              onCancelOrder={handleCancelOrder}
            onTrade={handleExchangeTrade}
          />
          <ChartPanel
            instrument={instrument}
            series={series}
            markers={markers}
            simSecondsPerTick={state.simSecondsPerTick}
          />
          <PositionsPanel positions={positions} orders={state.orders} trades={state.trades} />
        </section>

        <aside className="rail rail--right">
          <PriceTape changes={tape} selected={selected} onSelect={setSelected} />
          <EventFeed news={state.news} />
          <button
            type="button"
            className="score-teaser"
            onClick={() => (closed ? setReportDismissed(false) : setScoreOpen(true))}
          >
            <span className="score-teaser__label">
              {t(closed ? 'SESSION COMPLETE' : 'SESSION SCORECARD')}
            </span>
            <span className="score-teaser__hint">
              {t(closed ? 'Open the settlement report' : 'Hidden during the session · click to reveal')}
            </span>
          </button>
        </aside>
      </main>

      <StatusBar meta={meta} onTogglePause={simulation.togglePause} onCycleSpeed={simulation.cycleSpeed} />

      {flowOpen ? <ParticipantsDrawer agents={agents} onClose={() => setFlowOpen(false)} /> : null}
      {scoreOpen ? <ScoreDrawer score={score} onClose={() => setScoreOpen(false)} /> : null}
      {replayOpen ? (
        <ReplayDrawer
          frames={history.map((frame) => ({ tick: frame.tick, time: frame.time, prices: frame.prices }))}
          decisions={replayDecisions}
          events={replayEvents}
          symbols={instruments.map((item) => item.symbol)}
          session={{
            desk: t(role === 'sales' ? 'SALES DESK' : 'MARKET MAKING DESK'),
            seed: state.seed,
            minutes: meta.minutes,
            scenario: t(scenarioMeta.name),
          }}
          onClose={() => setReplayOpen(false)}
        />
      ) : null}
      {ghostOpen ? (
        <GhostDrawer
          ghost={ghost}
          current={ghostSummary}
          onImport={handleImportGhost}
          onClose={() => setGhostOpen(false)}
        />
      ) : null}
      {closed && !reportDismissed ? (
        <SettlementReport
          desk={t(role === 'sales' ? 'SALES DESK' : 'MARKET MAKING DESK')}
          stats={settlement}
          score={score}
          coaching={coachingText}
          review={review}
          verdict={verdict}
          tierName={t(tier.name)}
          goals={goalStatus}
          onExportGhost={handleExportGhost}
          onCompareGhost={() => setGhostOpen(true)}
          hasGhost={Boolean(ghost)}
          scenarioName={t(scenarioMeta.name)}
          drill={drill}
          drillProgress={progress}
          drillAttempts={drillResult?.attempts ?? drillRecord?.attempts ?? 0}
          drillPasses={drillResult?.passes ?? drillRecord?.passes ?? 0}
          onDrillRetry={handleRestart}
          onDrillExit={onExitDrill}
          onRestart={handleRestart}
          onClose={() => setReportDismissed(true)}
        />
      ) : null}
    </div>
  )
}