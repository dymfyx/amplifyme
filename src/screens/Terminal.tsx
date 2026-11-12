import { useState } from 'react'
import type { Role } from '../types'
import {
  instruments,
  news,
  orders,
  pnl,
  positions,
  quotes,
  rfqs,
  scoreCard,
  sessionMeta,
  trades,
} from '../data/mock'
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
  const [selected, setSelected] = useState('AZN')
  const [activeRfqId, setActiveRfqId] = useState('RFQ-223')
  const [scoreOpen, setScoreOpen] = useState(false)

  const instrument = instruments.find((item) => item.symbol === selected) ?? instruments[0]
  const activeRfq = rfqs.find((item) => item.id === activeRfqId)

  const selectRfq = (id: string) => {
    setActiveRfqId(id)
    const rfq = rfqs.find((item) => item.id === id)
    if (rfq) setSelected(rfq.symbol)
  }

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
          <BookPanel instrument={instrument} />
          <DispatchPanel rfqs={rfqs} activeId={activeRfqId} onSelect={selectRfq} role={role} />
        </aside>

        <section className="rail rail--center">
          <TradeTicket
            key={selected}
            role={role}
            instrument={instrument}
            rfq={activeRfq}
            quotes={quotes}
          />
          <ChartPanel instrument={instrument} />
          <PositionsPanel positions={positions} orders={orders} trades={trades} />
        </section>

        <aside className="rail rail--right">
          <EventFeed news={news} />
          <button type="button" className="score-teaser" onClick={() => setScoreOpen(true)}>
            <span className="score-teaser__label">SESSION SCORECARD</span>
            <span className="score-teaser__hint">Hidden during the session · click to reveal</span>
          </button>
        </aside>
      </main>

      <StatusBar meta={sessionMeta} />

      {scoreOpen ? <ScoreDrawer score={scoreCard} onClose={() => setScoreOpen(false)} /> : null}
    </div>
  )
}
