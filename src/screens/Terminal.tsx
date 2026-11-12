import { useEffect, useState } from 'react'
import type { Role } from '../types'
import { scoreCard } from '../data/mock'
import {
  createSession,
  selectBook,
  selectChartMarkers,
  selectInstruments,
  selectPnl,
  selectPositions,
  selectSessionMeta,
  selectSeries,
  type FillInput,
  type QuoteInput,
} from '../engine/simulation'
import { useSimulation } from '../hooks/useSimulation'
import BookPanel from '../components/BookPanel'
import ChartPanel from '../components/ChartPanel'
import DispatchPanel from '../components/DispatchPanel'
import EventFeed from '../components/EventFeed'
import MarketWatch from '../components/MarketWatch'
import PositionsPanel from '../components/PositionsPanel'
import ScoreDrawer from '../components/ScoreDrawer'
import StatusBar from '../components/StatusBar'
import TopBar from '../components/TopBar'
import TradeTicket from '../components/TradeTicket'

interface TerminalProps {
  role: Role
  onExit: () => void
}

export default function Terminal({ role, onExit }: TerminalProps) {
  const [initial] = useState(() => createSession())
  const simulation = useSimulation(initial)
  const { state } = simulation

  const [selected, setSelected] = useState('AZN')
  const [activeRfqId, setActiveRfqId] = useState<string | null>('RFQ-201')
  const [scoreOpen, setScoreOpen] = useState(false)

  const instruments = selectInstruments(state)
  const instrument = instruments.find((item) => item.symbol === selected) ?? instruments[0]
  const positions = selectPositions(state)
  const pnl = selectPnl(state)
  const book = selectBook(state, selected)
  const series = selectSeries(state, selected)
  const markers = selectChartMarkers(state, selected)
  const rfqs = state.dispatch
  const activeRfq = rfqs.find((item) => item.id === activeRfqId)
  const meta = selectSessionMeta(state, simulation.latencyMs)

  const selectRfq = (id: string) => {
    setActiveRfqId(id)
    const rfq = rfqs.find((item) => item.id === id)
    if (rfq) setSelected(rfq.symbol)
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
        scoreOpen={scoreOpen}
        onOpenScore={() => setScoreOpen(true)}
        onExit={onExit}
      />

      <main className="workspace">
        <aside className="rail rail--left">
          <MarketWatch instruments={instruments} selected={selected} onSelect={setSelected} />
          <BookPanel symbol={selected} book={book} />
          <DispatchPanel rfqs={rfqs} activeId={activeRfqId ?? ''} onSelect={selectRfq} role={role} />
        </aside>

        <section className="rail rail--center">
          <TradeTicket
            key={`${selected}-${activeRfqId ?? 'none'}`}
            role={role}
            instrument={instrument}
            book={book}
            rfq={activeRfq}
            quotes={state.quotes}
            onQuote={handleQuote}
            onFill={handleFill}
            onDecline={handleDecline}
          />
          <ChartPanel instrument={instrument} series={series} markers={markers} />
          <PositionsPanel positions={positions} orders={state.orders} trades={state.trades} />
        </section>

        <aside className="rail rail--right">
          <EventFeed news={state.news} />
          <button type="button" className="score-teaser" onClick={() => setScoreOpen(true)}>
            <span className="score-teaser__label">SESSION SCORECARD</span>
            <span className="score-teaser__hint">Hidden during the session · click to reveal</span>
          </button>
        </aside>
      </main>

      <StatusBar meta={meta} onTogglePause={simulation.togglePause} onCycleSpeed={simulation.cycleSpeed} />

      {scoreOpen ? <ScoreDrawer score={scoreCard} onClose={() => setScoreOpen(false)} /> : null}
    </div>
  )
}
