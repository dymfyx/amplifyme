import type { SessionMeta } from '../engine/simulation'
import { useT } from '../i18n'

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
  const t = useT()
  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        <span className={`statusbar__dot statusbar__dot--${dotTone[meta.status]}`} aria-hidden="true" />
        <span className="statusbar__status">{t(meta.status)}</span>
        {meta.status !== 'CLOSED' && (
          <button
            type="button"
            className="statusbar__btn statusbar__btn--strong"
            onClick={onTogglePause}
            title={t('Pause or resume the simulated clock')}
          >
            {meta.status === 'RUNNING' ? t('PAUSE') : t('RESUME')}
          </button>
        )}
        <span className="statusbar__clock">{t('SIM {clock}', { clock: meta.clock })}</span>
      </div>
      <div className="statusbar__group">
        <span>{t('DAY {day}/{total}', { day: meta.dayIndex, total: meta.totalDays })}</span>
        <button
          type="button"
          className="statusbar__btn"
          onClick={onCycleSpeed}
          title={t('Cycle simulation speed (1x / 2x / 4x)')}
        >
          {t('SPEED {speed}x', { speed: meta.speed })}
        </button>
        <span>{t('LATENCY {latency}ms', { latency: meta.latencyMs })}</span>
        <span title={t('Session seed — a shared link pins it, otherwise restart picks a new one')}>
          {t('SEED {seed}', { seed: meta.seed })}
        </span>
      </div>
      <div className="statusbar__group statusbar__group--end">
        <span>{t('SPACE pause · 1/2/4 speed')}</span>
      </div>
    </footer>
  )
}
