import { formatMetric, type Drill, type DrillProgress } from '../train/drills'
import { useT } from '../i18n'

interface DrillVerdictProps {
  drill: Drill
  progress: DrillProgress
  attempts: number
  passes: number
  onRetry: () => void
  onExit: () => void
}

/**
 * 结算报告里的训练判定卡：大号 PASSED / FAILED 徽标、逐条判定、
 * 历史记录与「重试 / 返回」两个出口。
 */
export default function DrillVerdict({
  drill,
  progress,
  attempts,
  passes,
  onRetry,
  onExit,
}: DrillVerdictProps) {
  const t = useT()

  return (
    <section
      className="drill-verdict"
      role="group"
      aria-label={t('Drill result: {name}', { name: t(drill.name) })}
    >
      <header className="drill-verdict__head">
        <span className="drill-verdict__eyebrow">{t('DRILL RESULT')}</span>
        <h3 className="drill-verdict__name">{t(drill.name)}</h3>
        <span
          className={
            progress.passed
              ? 'drill-verdict__badge drill-verdict__badge--pass'
              : 'drill-verdict__badge drill-verdict__badge--fail'
          }
        >
          {t(progress.passed ? 'PASSED' : 'FAILED')}
        </span>
      </header>

      <ul className="drill-verdict__rows">
        {progress.metrics.map((metric) => (
          <li key={metric.id} className="drill-verdict__row">
            <span
              className={
                metric.ok
                  ? 'drill-verdict__tick drill-verdict__tick--ok'
                  : 'drill-verdict__tick drill-verdict__tick--bad'
              }
              aria-hidden="true"
            >
              {metric.ok ? '✓' : '✕'}
            </span>
            <span className="drill-verdict__label">{t(metric.label)}</span>
            <span className="drill-verdict__values">
              {`${formatMetric(metric.value, metric.unit)} / ${formatMetric(metric.target, metric.unit)}`}
            </span>
          </li>
        ))}
      </ul>

      <footer className="drill-verdict__foot">
        <span className="drill-verdict__record">
          {t('ATTEMPTS {n} · PASSED {m}', { n: attempts, m: passes })}
        </span>
        <div className="drill-verdict__actions">
          <button
            type="button"
            className="drill-verdict__btn drill-verdict__btn--primary"
            onClick={onRetry}
          >
            {t('RETRY DRILL')}
          </button>
          <button type="button" className="drill-verdict__btn" onClick={onExit}>
            {t('BACK TO DRILLS')}
          </button>
        </div>
      </footer>
    </section>
  )
}
