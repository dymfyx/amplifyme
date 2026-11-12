import { useEffect } from 'react'
import type { ScoreCard } from '../types'

interface ScoreDrawerProps {
  score: ScoreCard
  onClose: () => void
}

export default function ScoreDrawer({ score, onClose }: ScoreDrawerProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="drawer-backdrop" onClick={onClose} data-testid="score-backdrop">
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer__head">
          <div>
            <span className="drawer__eyebrow">SESSION SCORECARD</span>
            <h2 id="score-drawer-title" className="drawer__title">
              Performance snapshot
            </h2>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close scorecard">
            CLOSE
          </button>
        </header>

        <div className="drawer__hero">
          <div className="drawer__composite">
            <span className="drawer__composite-value">{score.composite}</span>
            <span className="drawer__composite-label">COMPOSITE</span>
          </div>
          <div className="drawer__percentile">
            <span className="drawer__percentile-value">{score.percentile}th</span>
            <span className="drawer__percentile-label">PERCENTILE VS COHORT</span>
          </div>
        </div>

        <ul className="score-list">
          {score.dimensions.map((dimension) => (
            <li key={dimension.key} className="score-row">
              <div className="score-row__top">
                <span className="score-row__label">{dimension.label}</span>
                <span className="score-row__value">{dimension.value}</span>
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

        <p className="drawer__note">
          Provisional read — the full breakdown unlocks when the session ends. Press ESC to close.
        </p>
      </aside>
    </div>
  )
}
