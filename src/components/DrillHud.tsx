import { formatMetric, type Drill, type DrillProgress } from '../train/drills'
import { useT } from '../i18n'

interface DrillHudProps {
  drill: Drill
  progress: DrillProgress
}

/**
 * 盘中训练条：左边是当前 drill 与 LIVE 徽标，右边每个判定指标一枚 chip。
 * 数据全部来自 drillProgress()，和结算判定同一套口径。
 */
export default function DrillHud({ drill, progress }: DrillHudProps) {
  const t = useT()

  return (
    <div
      className="drill-hud"
      role="status"
      aria-label={t('Drill: {name}', { name: t(drill.name) })}
    >
      <div className="drill-hud__left">
        <span className="drill-hud__label">
          {t('TRAIN')} · {t(drill.name)}
        </span>
        <span className="drill-hud__live">{t('LIVE')}</span>
      </div>
      <ul className="drill-hud__metrics">
        {progress.metrics.map((metric) => {
          const current = formatMetric(metric.value, metric.unit)
          const target = formatMetric(metric.target, metric.unit)
          return (
            <li
              key={metric.id}
              className={
                metric.ok
                  ? 'drill-hud__chip drill-hud__chip--ok'
                  : 'drill-hud__chip drill-hud__chip--bad'
              }
              data-ok={metric.ok ? 'true' : 'false'}
              title={t('{label}: {value} of {target}', {
                label: t(metric.label),
                value: current,
                target,
              })}
            >
              <span className="drill-hud__chip-label">{t(metric.label)}</span>
              <span className="drill-hud__chip-value">{`${current} / ${target}`}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
