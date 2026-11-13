/**
 * 影子对比抽屉：导入队友导出的单局 JSON，和自己的这一局逐项对比。
 *
 * 组件只做展示与交互：解析、落盘、清空都通过 props 回调交给上层。
 * 关闭行为与 ArchiveDrawer 保持一致（遮罩 + role="dialog" + ESC）。
 */

import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useT } from '../i18n'
import type { GhostDecision, GhostSession, GhostSummary } from '../storage/ghost'

interface GhostDrawerProps {
  ghost: GhostSession | null
  current: GhostSummary | null
  /** 返回错误文案；返回空串表示成功（传空串则清空当前影子） */
  onImport: (text: string) => string
  onClose: () => void
}

/** 台面代码是固定英文，不做本地化 */
const DESK_LABEL: Record<GhostSummary['desk'], string> = {
  sales: 'Sales',
  'market-maker': 'Market Maker',
}

const KIND_LABEL: Record<GhostDecision['kind'], string> = {
  quote: 'QUOTE',
  fill: 'FILL',
  decline: 'DECLINE',
}

/** 决策最多展示 20 条，超过的部分只在页脚提示数量 */
const DECISION_CAP = 20

type MetricKey = 'score' | 'percentile' | 'alpha' | 'total' | 'trades'

interface CompareMetric {
  key: MetricKey
  label: string
  format: (value: number) => string
  formatDelta: (value: number) => string
  /** trades 这类指标只比数量，不参与「好 / 坏」配色 */
  neutral?: boolean
}

const groupDigits = (value: number): string =>
  String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** `$1,234` / `-$1,234`：金额四舍五入到整数美元 */
const money = (value: number): string => `${value < 0 ? '-' : ''}$${groupDigits(value)}`

/** 带明确符号的金额：`+$1,234` / `-$1,234` */
const signedMoney = (value: number): string => {
  const rounded = Math.round(value)
  if (rounded === 0) return '$0'
  return `${rounded > 0 ? '+' : '-'}$${groupDigits(rounded)}`
}

/** 带明确符号的数字：`+3.2` / `-4` / `0` */
const signedNumber = (value: number, digits = 0): string => {
  const rounded = Number(value.toFixed(digits))
  const body = digits > 0 ? rounded.toFixed(digits) : String(rounded)
  return rounded > 0 ? `+${body}` : body
}

const COMPARE_METRICS: CompareMetric[] = [
  {
    key: 'score',
    label: 'SCORE',
    format: (value) => value.toFixed(1),
    formatDelta: (value) => signedNumber(value, 1),
  },
  {
    key: 'percentile',
    label: 'PERCENTILE',
    format: (value) => `${Math.round(value)}%`,
    formatDelta: (value) => `${signedNumber(value)}%`,
  },
  {
    key: 'alpha',
    label: 'ALPHA',
    format: signedMoney,
    formatDelta: signedMoney,
  },
  {
    key: 'total',
    label: "TOTAL P&L",
    format: money,
    formatDelta: signedMoney,
  },
  {
    key: 'trades',
    label: 'TRADES',
    format: (value) => String(Math.round(value)),
    formatDelta: (value) => signedNumber(value),
    neutral: true,
  },
]

const metricValue = (summary: GhostSummary, key: MetricKey): number => {
  switch (key) {
    case 'score':
      return summary.composite
    case 'percentile':
      return summary.percentile
    case 'alpha':
      return summary.alpha
    case 'total':
      return summary.total
    case 'trades':
      return summary.trades
  }
}

type DeltaTone = 'up' | 'down' | 'flat' | 'neutral'

/** 分数 / 百分位 / alpha / 盈亏都是越高越好；成交数不评分 */
const deltaTone = (delta: number, neutral: boolean | undefined): DeltaTone => {
  if (neutral) return 'neutral'
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

export default function GhostDrawer({ ghost, current, onImport, onClose }: GhostDrawerProps) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /** 成功（返回空串）后清空输入；失败时把后端/解析文案挂到 alert 上 */
  const importFromText = (text: string): void => {
    const message = onImport(text)
    setError(message)
    if (!message) setDraft('')
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget
    const picked = input.files?.[0]
    if (!picked) return
    try {
      importFromText(await picked.text())
    } catch {
      setError(t('That file could not be read.'))
    } finally {
      // 允许再次选择同一个文件
      input.value = ''
    }
  }

  const summary = ghost?.summary ?? null
  const summaryLine = summary
    ? t('{desk} · {scenario} · T{tier} · {minutes} MIN · seed {seed}', {
        desk: t(DESK_LABEL[summary.desk]),
        scenario: t(summary.scenarioName),
        tier: summary.tier,
        minutes: summary.minutes,
        seed: summary.seed,
      })
    : ''

  const decisions = ghost?.decisions ?? []
  const visibleDecisions = decisions.slice(0, DECISION_CAP)
  const hiddenDecisions = decisions.length - visibleDecisions.length

  return (
    <div className="drawer-backdrop ghost-backdrop" data-testid="ghost-backdrop" onClick={onClose}>
      <aside
        className="drawer ghost-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('Ghost compare')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer__head">
          <div>
            <span className="drawer__eyebrow">{t('GHOST REPLAY')}</span>
            <h2 className="drawer__title">{t('Compare a session')}</h2>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('CLOSE')}
          </button>
        </header>

        {error ? (
          <p className="ghost__error" role="alert">
            {error}
          </p>
        ) : null}

        {ghost === null ? (
          <div className="ghost__body">
            <p className="ghost__hint">
              {t('Import a session file a teammate exported and line it up against your own.')}
            </p>

            <textarea
              className="ghost__input"
              rows={8}
              spellCheck={false}
              aria-label={t('Ghost session JSON')}
              placeholder={t('Paste the JSON here — or pick the file below.')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />

            <div className="ghost__actions">
              <input
                className="ghost__file"
                type="file"
                accept="application/json"
                aria-label={t('Ghost session file')}
                onChange={(event) => {
                  void handleFileChange(event)
                }}
              />
              <button
                type="button"
                className="btn btn--primary ghost__btn"
                disabled={draft.trim() === ''}
                onClick={() => importFromText(draft)}
              >
                {t('LOAD GHOST')}
              </button>
            </div>
          </div>
        ) : (
          <div className="ghost__body">
            <p className="ghost__summary" data-testid="ghost-summary">
              {summaryLine}
            </p>

            <table className="ghost-table">
              <caption className="ghost__caption">{t('Ghost compare')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="ghost-table__corner" aria-label={t('METRIC')} />
                  <th scope="col" className="ghost-table__head">
                    {t('YOURS')}
                  </th>
                  <th scope="col" className="ghost-table__head">
                    {t('GHOST')}
                  </th>
                  <th scope="col" className="ghost-table__head">
                    {t('DELTA')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_METRICS.map((metric) => {
                  const ghostValue = metricValue(summary as GhostSummary, metric.key)
                  const yoursValue = current ? metricValue(current, metric.key) : null
                  const delta = yoursValue === null ? null : yoursValue - ghostValue
                  const tone = delta === null ? 'neutral' : deltaTone(delta, metric.neutral)

                  return (
                    <tr key={metric.key} data-testid={`ghost-row-${metric.key}`}>
                      <th scope="row" className="ghost-table__label">
                        {t(metric.label)}
                      </th>
                      <td className="ghost-table__value">
                        {yoursValue === null ? '—' : metric.format(yoursValue)}
                      </td>
                      <td className="ghost-table__value">{metric.format(ghostValue)}</td>
                      <td className={`ghost-table__value ghost-delta ghost-delta--${tone}`}>
                        {delta === null ? '—' : metric.formatDelta(delta)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <section className="ghost__section">
              <h3 className="ghost__section-title">{t('GHOST TAGS')}</h3>
              {summary && summary.tags.length > 0 ? (
                <ul className="ghost-tags">
                  {summary.tags.map((tag) => (
                    <li key={tag} className="ghost-tag">
                      {t(tag)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ghost__empty">{t('No tags recorded.')}</p>
              )}
            </section>

            <section className="ghost__section">
              <h3 className="ghost__section-title">{t('GHOST DECISIONS')}</h3>
              {decisions.length === 0 ? (
                <p className="ghost__empty">{t('This ghost did not trade.')}</p>
              ) : (
                <>
                  <ul className="ghost-decisions">
                    {visibleDecisions.map((decision) => (
                      <li key={decision.id} className="ghost-decision" data-testid="ghost-decision">
                        <div className="ghost-decision__head">
                          <span className="ghost-decision__time">{decision.time}</span>
                          <span
                            className={`ghost-decision__badge ghost-decision__badge--${decision.kind}`}
                          >
                            {t(KIND_LABEL[decision.kind])}
                          </span>
                        </div>
                        <span className="ghost-decision__label">{decision.label}</span>
                        <span className="ghost-decision__detail">{decision.detail}</span>
                      </li>
                    ))}
                  </ul>
                  {hiddenDecisions > 0 ? (
                    <p className="ghost__more">
                      {t('…and {count} more', { count: hiddenDecisions })}
                    </p>
                  ) : null}
                </>
              )}
            </section>

            <footer className="ghost__footer">
              <button
                type="button"
                className="btn btn--danger ghost__btn"
                onClick={() => importFromText('')}
              >
                {t('CLEAR GHOST')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {t('CLOSE')}
              </button>
            </footer>
          </div>
        )}
      </aside>
    </div>
  )
}
