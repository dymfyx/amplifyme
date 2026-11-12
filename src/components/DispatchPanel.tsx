import type { Rfq, Role } from '../types'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

interface DispatchPanelProps {
  rfqs: Rfq[]
  activeId: string
  onSelect: (id: string) => void
  role: Role
}

export default function DispatchPanel({ rfqs, activeId, onSelect, role }: DispatchPanelProps) {
  const t = useT()
  const title = role === 'market-maker' ? 'DISPATCH' : 'CLIENT FLOW'
  return (
    <section className="panel panel--dispatch">
      <PanelHeader
        index="3"
        title={t(title)}
        right={<span className="badge badge--live">{t('{count} OPEN', { count: rfqs.length })}</span>}
      />
      <ul className="dispatch-list">
        {rfqs.map((rfq) => {
          const isActive = rfq.id === activeId
          return (
            <li key={rfq.id}>
              <button
                type="button"
                className={isActive ? 'dispatch dispatch--active' : 'dispatch'}
                onClick={() => onSelect(rfq.id)}
                aria-pressed={isActive}
              >
                <span className="dispatch__top">
                  <span className="dispatch__time">{rfq.time}</span>
                  <span className="dispatch__client">{rfq.client}</span>
                  <span className="dispatch__id">{rfq.id}</span>
                </span>
                <span className="dispatch__body">
                  <span className={rfq.side === 'BUY' ? 'side side--buy' : 'side side--sell'}>
                    {t(rfq.side)}
                  </span>
                  <span className="dispatch__size">{rfq.qty.toLocaleString('en-US')}</span>
                  <span className="dispatch__symbol">{rfq.symbol}</span>
                </span>
                <span className="dispatch__note">{t(rfq.note)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <footer className="panel__foot">
        <span>{t('SYSTEM DISPATCH · AUTO-ROUTED')}</span>
      </footer>
    </section>
  )
}
