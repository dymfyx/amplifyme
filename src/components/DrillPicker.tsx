import type { Role } from '../types'
import {
  formatMetric,
  type Drill,
  type DrillCriterion,
  type DrillId,
} from '../train/drills'
import { useT } from '../i18n'

interface DrillPickerProps {
  drills: Drill[]
  onStart: (id: DrillId) => void
  /** 跨局记录；缺省时卡片显示 NOT ATTEMPTED YET */
  best?: Record<string, { attempts: number; passes: number }>
}

/** 台面代码是固定英文，不做本地化 */
const ROLE_LABEL: Record<Role, string> = {
  sales: 'SALES',
  'market-maker': 'MARKET MAKER',
}

const COMPARE_GLYPH: Record<DrillCriterion['compare'], string> = {
  gte: '≥',
  lte: '≤',
  gt: '>',
}

/**
 * TRAIN 入口的五个固定 drill。整张卡是一个按钮，
 * 点击直接把 drill id 交给上层的开局逻辑。
 */
export default function DrillPicker({ drills, onStart, best }: DrillPickerProps) {
  const t = useT()

  return (
    <div className="drill-picker">
      {drills.map((drill) => {
        const record = best?.[drill.id]
        const criteria = drill.criteria
          .map(
            (criterion) =>
              `${t(criterion.label)} ${COMPARE_GLYPH[criterion.compare]}${formatMetric(
                criterion.target,
                criterion.unit,
              )}`,
          )
          .join(', ')

        return (
          <button
            key={drill.id}
            type="button"
            className="drill-card"
            aria-label={t('Start drill: {name}', { name: t(drill.name) })}
            onClick={() => onStart(drill.id)}
          >
            <span className="drill-card__kicker">
              {t('TRAIN')} · {ROLE_LABEL[drill.role]}
            </span>
            <span className="drill-card__name">{t(drill.name)}</span>
            <span className="drill-card__blurb">{t(drill.blurb)}</span>
            <span className="drill-card__criteria">{criteria}</span>
            <span className="drill-card__foot">
              <span className="drill-card__record">
                {record
                  ? t('ATTEMPTS {n} · PASSED {m}', {
                      n: record.attempts,
                      m: record.passes,
                    })
                  : t('NOT ATTEMPTED YET')}
              </span>
              <span className="drill-card__cta">{t('START DRILL')}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
