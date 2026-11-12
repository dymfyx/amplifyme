import type { SessionMeta } from '../engine/simulation'

interface StatusBarProps {
  meta: SessionMeta
  onTogglePause: () => void
  onCycleSpeed: () => void
}

const dotTone: Record<SessionMeta['status'], string> = {
  RUNNING: 'live',
  PAUSED: 'warn',
  CLOSED: 'down',
}

export default function StatusBar({ meta, onTogglePause, onCycleSpeed }: StatusBarProps) {
  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        <span className={`statusbar__dot statusbar__dot--${dotTone[meta.status]}`} aria-hidden="true" />
        <span className="statusbar__status">{meta.status}</span>
        {meta.status !== 'CLOSED' && (
          <button
            type="button"
            className="statusbar__btn statusbar__btn--strong"
            onClick={onTogglePause}
            title="Pause or resume the simulated clock"
          >
            {meta.status === 'RUNNING' ? 'PAUSE' : 'RESUME'}
          </button>
        )}
        <span className="statusbar__clock">SIM {meta.clock}</span>
      </div>
      <div className="statusbar__group">
        <span>
          DAY {meta.dayIndex}/{meta.totalDays}
        </span>
        <button
          type="button"
          className="statusbar__btn"
          onClick={onCycleSpeed}
          title="Cycle simulation speed (1x / 2x / 4x)"
        >
          SPEED {meta.speed}x
        </button>
        <span>LATENCY {meta.latencyMs}ms</span>
        <span title="Session seed — a restart picks a new one">SEED {meta.seed}</span>
      </div>
      <div className="statusbar__group statusbar__group--end">
        <span>SPACE pause · 1/2/4 speed</span>
      </div>
    </footer>
  )
}
