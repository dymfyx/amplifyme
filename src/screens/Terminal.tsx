import { useEffect, useState } from 'react'
import type { Role } from '../types'
import {
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
  selectSessionMeta,
  selectSeries,
  type FillInput,
  type OpeningPosition,
  type QuoteInput,
} from '../engine/simulation'
import { coachingLine, scoreSession, selectSettlement } from '../engine/scoring'
import { useSimulation } from '../hooks/useSimulation'
import BookPanel from '../components/BookPanel'
import ChartPanel from '../components/ChartPanel'
import DispatchPanel from '../components/DispatchPanel'
import EventFeed from '../components/EventFeed'
import MarketWatch from '../components/MarketWatch'
import PositionsPanel from '../components/PositionsPanel'
import PriceTape from '../components/PriceTape'
import ScoreDrawer from '../components/ScoreDrawer'
import SettlementReport from '../components/SettlementReport'
import StatusBar from '../components/StatusBar'
import TopBar from '../components/TopBar'
import TradeTicket from '../components/TradeTicket'

interface TerminalProps {
  role: Role
  openingBook: OpeningPosition[]
  onExit: () => void
}

export default function Terminal({ role, openingBook, onExit }: TerminalProps) {
  const [initial] = useState(() => createSession(undefined, openingBook))
  const simulation = useSimulation(initial, openingBook)
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
          <ChartPanel instrument={instrument} series={series} markers={markers} />
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
            <span className="score-teaser__label">{closed ? 'SESSION COMPLETE' : 'SESSION SCORECARD'}</span>
            <span className="score-teaser__hint">
              {closed ? 'Open the settlement report' : 'Hidden during the session · click to reveal'}
            </span>
          </button>
        </aside>
      </main>

      <StatusBar meta={meta} onTogglePause={simulation.togglePause} onCycleSpeed={simulation.cycleSpeed} />

      {scoreOpen ? <ScoreDrawer score={score} onClose={() => setScoreOpen(false)} /> : null}
      {closed && !reportDismissed ? (
        <SettlementReport
          desk={role === 'sales' ? 'SALES DESK' : 'MARKET MAKING DESK'}
          stats={settlement}
          score={score}
          coaching={coachingLine(state)}
          onRestart={handleRestart}
          onClose={() => setReportDismissed(true)}
        />
      ) : null}
    </div>
  )
}
