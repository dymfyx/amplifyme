import { useEffect, useState } from 'react'
import type { Role } from '../types'
import {
  DEFAULT_MINUTES,
  STARTING_CASH,
  createSession,
  selectBook,
  selectCash,
  selectChartMarkers,
  selectDrivers,
  selectInstruments,
  selectPnl,
  selectPositions,
  selectPriceTape,
  selectSeries,
  selectSessionMeta,
  type ExchangeTradeInput,
  type FillInput,
  type OpeningPosition,
  type QuoteInput,
  type SessionMinutes,
} from '../engine/simulation'
import { adviceFor, coachingSummary, scoreSession, selectSettlement } from '../engine/scoring'
import { NEWS_REACTION_TICKS } from '../engine/telemetry'
import { useT } from '../i18n'
import { useSimulation } from '../hooks/useSimulation'
import ChartPanel from '../components/ChartPanel'
import BookPanel from '../components/BookPanel'
import DispatchPanel from '../components/DispatchPanel'
import EventFeed from '../components/EventFeed'
import ExchangeTicket from '../components/ExchangeTicket'
import MarketWatch from '../components/MarketWatch'
import PriceTape from '../components/PriceTape'
import PositionsPanel from '../components/PositionsPanel'
import ScoreDrawer from '../components/ScoreDrawer'
import SettlementReport from '../components/SettlementReport'
import StatusBar from '../components/StatusBar'
import TopBar from '../components/TopBar'
import TradeTicket from '../components/TradeTicket'

interface TerminalProps {
  role: Role
  openingBook: OpeningPosition[]
  /** 深链里带的固定种子：全组练同一道题，RESTART 也按同一局重放 */
  seed?: number | null
  /** 练习时长档位：5 / 15 / 30 分钟 */
  minutes?: SessionMinutes
  onExit: () => void
}

export default function Terminal({
  role,
  openingBook,
  seed = null,
  minutes = DEFAULT_MINUTES,
  onExit,
}: TerminalProps) {
  const t = useT()
  const [initial] = useState(() => createSession(seed ?? undefined, openingBook, { minutes }))
  const simulation = useSimulation(initial, openingBook, seed, minutes)
  const { state } = simulation

  const [selected, setSelected] = useState('AZN')
  const [activeRfqId, setActiveRfqId] = useState<string | null>('RFQ-201')
  const [scoreOpen, setScoreOpen] = useState(false)
  const [reportDismissed, setReportDismissed] = useState(false)

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
  const score = scoreSession(state)
  const settlement = selectSettlement(state)
  const coaching = coachingSummary(state)
  const coachingText = t('Strongest: {best}. Weakest: {worst} — {advice}', {
    best: t(coaching.strongest),
    worst: t(coaching.weakest),
    advice: t(adviceFor(coaching.adviceKey), { ticks: NEWS_REACTION_TICKS }),
  })
  const closed = state.status === 'CLOSED'

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
        sharedSeed={seed}
        minutes={meta.minutes}
        timeLeftMs={meta.timeLeftMs}
        onOpenScore={() => setScoreOpen(true)}
        onRestart={handleRestart}
        onExit={onExit}
      />

      <main className="workspace">
        <aside className="rail rail--left">
          <MarketWatch
            instruments={instruments}
            selected={selected}
            drivers={drivers}
            onSelect={setSelected}
          />
          <BookPanel symbol={selected} book={book} />
          <DispatchPanel rfqs={rfqs} activeId={activeRfqId ?? ''} onSelect={selectRfq} role={role} />
        </aside>

        <section className="rail rail--center">
          <TradeTicket
            key={`${selected}-${activeRfqId ?? 'none'}-${state.seed}`}
            role={role}
            instrument={instrument}
            book={book}
            rfq={activeRfq}
            quotes={state.quotes}
            recentFills={state.trades}
            cash={cash}
            onQuote={handleQuote}
            onFill={handleFill}
            onDecline={handleDecline}
          />
          <ExchangeTicket
            key={`exchange-${selected}-${state.seed}`}
            instrument={instrument}
            book={book}
            cash={cash}
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

      {scoreOpen ? <ScoreDrawer score={score} onClose={() => setScoreOpen(false)} /> : null}
      {closed && !reportDismissed ? (
        <SettlementReport
          desk={t(role === 'sales' ? 'SALES DESK' : 'MARKET MAKING DESK')}
          stats={settlement}
          score={score}
          coaching={coachingText}
          onRestart={handleRestart}
          onClose={() => setReportDismissed(true)}
        />
      ) : null}
    </div>
  )
}
