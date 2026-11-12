import { useEffect } from 'react'
import type { ScoreCard } from '../types'
import type { SettlementStats } from '../engine/scoring'

interface SettlementReportProps {
  desk: string
  stats: SettlementStats
  score: ScoreCard
  coaching: string
  onRestart: () => void
  onClose: () => void
}

const money = (value: number) =>
  `${value < 0 ? '-$' : '$'}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`

const pct = (value: number) => `${Math.round(value * 100)}%`

const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`

export default function SettlementReport({
  desk,
  stats,
  score,
  coaching,
  onRestart,
  onClose,
}: SettlementReportProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const tone = stats.total < 0 ? 'num--down' : 'num--up'

  return (
    <div className="report-backdrop" data-testid="settlement-backdrop" onClick={onClose}>
      <section
        className="report"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="report__head">
          <div>
            <span className="report__eyebrow">SESSION COMPLETE · {desk}</span>
            <h2 id="settlement-title" className="report__title">
              Settlement report
            </h2>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close settlement report">
            CLOSE
          </button>
        </header>

        <div className="report__hero">
          <div>
            <span className="report__hero-label">TOTAL P&amp;L</span>
            <span className={`report__hero-value ${tone}`}>{money(stats.total)}</span>
          </div>
          <dl className="report__breakdown">
            <div>
              <dt>REALISED</dt>
              <dd>{money(stats.realised)}</dd>
            </div>
            <div>
              <dt>UNREALISED</dt>
              <dd className={stats.unrealised < 0 ? 'num--down' : 'num--up'}>{money(stats.unrealised)}</dd>
            </div>
            <div>
              <dt>COMMISSION</dt>
              <dd>{money(stats.commission)}</dd>
            </div>
            <div>
              <dt>CASH LEFT</dt>
              <dd>{money(stats.cash)}</dd>
            </div>
          </dl>
        </div>

        <div className="report__grid">
          <article className="report__card">
            <h3 className="report__card-title">FLOW</h3>
            <dl className="report__rows">
              <div>
                <dt>Fills</dt>
                <dd>
                  {stats.trades} ({stats.buys}B / {stats.sells}S)
                </dd>
              </div>
              <div>
                <dt>Hit ratio above mid</dt>
                <dd>{pct(stats.winRate)}</dd>
              </div>
              <div>
                <dt>Avg edge / fill</dt>
                <dd>{signed(stats.avgEdge)}</dd>
              </div>
              <div>
                <dt>Best / worst edge</dt>
                <dd>
                  {signed(stats.bestEdge)} / {signed(stats.worstEdge)}
                </dd>
              </div>
              <div>
                <dt>Quotes sent</dt>
                <dd>{stats.quotes}</dd>
              </div>
              <div>
                <dt>Quote width vs market</dt>
                <dd>{stats.avgSpreadRatio === null ? '—' : `${stats.avgSpreadRatio.toFixed(2)}x`}</dd>
              </div>
            </dl>
          </article>

          <article className="report__card">
            <h3 className="report__card-title">RISK &amp; RESPONSE</h3>
            <dl className="report__rows">
              <div>
                <dt>Peak P&amp;L</dt>
                <dd>{money(stats.peakPnl)}</dd>
              </div>
              <div>
                <dt>Max drawdown</dt>
                <dd className={stats.maxDrawdown > 0 ? 'num--down' : undefined}>{money(-stats.maxDrawdown)}</dd>
              </div>
              <div>
                <dt>Avg gross exposure</dt>
                <dd>{money(stats.avgGross)}</dd>
              </div>
              <div>
                <dt>Net exposure at close</dt>
                <dd>{money(stats.netExposure)}</dd>
              </div>
              <div>
                <dt>Median RFQ response</dt>
                <dd>
                  {stats.medianResponseTicks === null ? '—' : `${stats.medianResponseTicks} ticks`}
                </dd>
              </div>
              <div>
                <dt>Headlines traded into</dt>
                <dd>
                  {stats.headlinesAnswered}/{stats.headlines}
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <div className="report__score">
          <div className="report__score-head">
            <span className="drawer__composite-value">{score.composite}</span>
            <div>
              <span className="report__score-label">COMPOSITE</span>
              <span className="report__score-percentile">{score.percentile}th percentile</span>
            </div>
          </div>
          <ul className="score-list score-list--compact">
            {score.dimensions.map((dimension) => (
              <li key={dimension.key} className="score-row">
                <div className="score-row__top">
                  <span className="score-row__label">{dimension.label}</span>
                  <span className="score-row__value">{Math.round(dimension.value)}</span>
                </div>
                <div className="meter">
                  <span
                    className={
                      dimension.value >= 70 ? 'meter__fill meter__fill--good' : 'meter__fill meter__fill--warn'
                    }
                    style={{ width: `${dimension.value}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="report__coaching">{coaching}</p>

        <div className="report__actions">
          <button type="button" className="btn btn--primary" onClick={onRestart}>
            RUN ANOTHER SESSION
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            REVIEW THE DESK
          </button>
        </div>
      </section>
    </div>
  )
}
