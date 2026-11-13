/**
 * 训练进展抽屉：把本地存档的场次聚合成跨会话视图。
 *
 * 纯展示组件，数据由 props 传入；ESC / 遮罩关闭的行为与 ScoreDrawer、ArchiveDrawer 一致。
 * 所有可见文案都走 useT()，中文词典单独放在 src/i18n/zh-progress.ts，由主程序（Lead）合并。
 */

import { useEffect } from 'react'
import { useT } from '../i18n'
import type { ArchivedSession } from '../storage/archive'

export interface ProgressDrawerProps {
  sessions: ArchivedSession[]
  onClose: () => void
}

/** `$1,234` / `-$1,234`：与存档抽屉一致，金额四舍五入到整数美元 */
const money = (value: number): string => {
  const digits = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${value < 0 ? '-' : ''}$${digits}`
}

/** 金额正负配色，0 保持中性 */
const toneClass = (value: number): string =>
  value > 0 ? ' progress__value--up' : value < 0 ? ' progress__value--down' : ''

const DESK_LABEL: Record<ArchivedSession['desk'], string> = {
  sales: 'Sales',
  'market-maker': 'Market Maker',
}

const DESKS = ['sales', 'market-maker'] as const

const TREND_WIDTH = 640
const TREND_HEIGHT = 160
const TREND_TOP = 16
const TREND_BOTTOM = TREND_HEIGHT - TREND_TOP
const TREND_PAD_X = 18

/** 分数 60 的基准虚线（与 viewBox 坐标系一致） */
const BENCHMARK_Y = TREND_TOP + (1 - 60 / 100) * (TREND_BOTTOM - TREND_TOP)

const trendX = (index: number, count: number): number =>
  count < 2
    ? TREND_WIDTH / 2
    : TREND_PAD_X + (index / (count - 1)) * (TREND_WIDTH - TREND_PAD_X * 2)

const trendY = (score: number): number => {
  const clamped = Math.min(100, Math.max(0, score))
  return TREND_TOP + (1 - clamped / 100) * (TREND_BOTTOM - TREND_TOP)
}

interface GroupStat {
  sessions: number
  score: number
  alpha: number
}

/** 一组的三个汇总数字；只在非空分组上调用 */
const summarize = (group: ArchivedSession[]): GroupStat => ({
  sessions: group.length,
  score: group.reduce((sum, item) => sum + item.composite, 0) / group.length,
  alpha: group.reduce((sum, item) => sum + item.alpha, 0) / group.length,
})

interface BreakdownRow {
  key: string
  label: string
  stat: GroupStat
}

interface TileProps {
  label: string
  value: string
  testId: string
  className?: string
}

/** 概要块里的一格 */
function Tile({ label, value, testId, className = '' }: TileProps) {
  const t = useT()
  return (
    <div className="progress__tile">
      <span className="progress__tile-label">{t(label)}</span>
      <span className={`progress__tile-value${className}`} data-testid={testId}>
        {value}
      </span>
    </div>
  )
}

interface BreakdownTableProps {
  title: string
  header: string
  rows: BreakdownRow[]
  testId: string
}

/** 按台面 / 剧本 / 难度共用的三列汇总表 */
function BreakdownTable({ title, header, rows, testId }: BreakdownTableProps) {
  const t = useT()
  return (
    <section className="progress__section">
      <h3 className="progress__section-title">{t(title)}</h3>
      <table className="progress-table" data-testid={testId}>
        <thead>
          <tr>
            <th scope="col">{t(header)}</th>
            <th scope="col" className="progress-table__num">
              {t('SESSIONS')}
            </th>
            <th scope="col" className="progress-table__num">
              {t('AVERAGE SCORE')}
            </th>
            <th scope="col" className="progress-table__num">
              {t('AVERAGE ALPHA')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="progress-table__label">
                {t(row.label)}
              </th>
              <td className="progress-table__num">{row.stat.sessions}</td>
              <td className="progress-table__num">{row.stat.score.toFixed(1)}</td>
              <td className={`progress-table__num${toneClass(row.stat.alpha)}`}>
                {money(row.stat.alpha)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function ProgressDrawer({ sessions, onClose }: ProgressDrawerProps) {
  const t = useT()

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

  const total = sessions.length
  const averageScore =
    total === 0 ? 0 : sessions.reduce((sum, session) => sum + session.composite, 0) / total
  const averageAlpha =
    total === 0 ? 0 : sessions.reduce((sum, session) => sum + session.alpha, 0) / total
  const beatCount = sessions.filter((session) => session.alpha > 0).length

  // 只画最近 20 局，按保存时间从旧到新排序（存档本身是新→旧）
  const trendSessions = [...sessions]
    .sort((left, right) => left.savedAt.localeCompare(right.savedAt))
    .slice(-20)
  const trendPoints = trendSessions
    .map(
      (session, index) =>
        `${trendX(index, trendSessions.length).toFixed(1)},${trendY(session.composite).toFixed(1)}`,
    )
    .join(' ')

  // 按台面：只列出真正有场次的台面
  const deskRows: BreakdownRow[] = DESKS.flatMap((desk): BreakdownRow[] => {
    const group = sessions.filter((session) => session.desk === desk)
    if (group.length === 0) return []
    return [{ key: desk, label: DESK_LABEL[desk], stat: summarize(group) }]
  })

  // 按剧本：局数多的排前面，同分按名字排，保证顺序稳定
  const scenarioGroups = new Map<string, ArchivedSession[]>()
  for (const session of sessions) {
    const group = scenarioGroups.get(session.scenarioName)
    if (group) group.push(session)
    else scenarioGroups.set(session.scenarioName, [session])
  }
  const scenarioRows: BreakdownRow[] = [...scenarioGroups.entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([name, group]) => ({ key: name, label: name, stat: summarize(group) }))

  // 按难度：旧存档没有 tier，按 2 档处理；T1…T4 由 1→4 排列
  const tierGroups = new Map<number, ArchivedSession[]>()
  for (const session of sessions) {
    const tier = session.tier ?? 2
    const group = tierGroups.get(tier)
    if (group) group.push(session)
    else tierGroups.set(tier, [session])
  }
  const tierRows: BreakdownRow[] = [...tierGroups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([tier, group]) => ({ key: `tier-${tier}`, label: `T${tier}`, stat: summarize(group) }))

  // 弱点：统计所有行为标签，取出现最多的 3 个
  const tagCounts = new Map<string, number>()
  for (const session of sessions) {
    for (const tag of session.tags ?? []) {
      if (tag.length === 0) continue
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)

  return (
    <div
      className="drawer-backdrop progress-backdrop"
      data-testid="progress-backdrop"
      onClick={onClose}
    >
      <aside
        className="drawer progress"
        role="dialog"
        aria-modal="true"
        aria-label={t('Training progress')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer__head progress__head">
          <div>
            <span className="drawer__eyebrow">{t('PRACTICE')}</span>
            <h2 className="drawer__title">{t('Training progress')}</h2>
          </div>
          <button
            type="button"
            className="btn btn--ghost progress__close"
            aria-label={t('Close')}
            onClick={onClose}
          >
            {t('CLOSE')}
          </button>
        </header>

        <div className="progress__body">
          {total === 0 ? (
            <p className="progress__empty">
              {t('No sessions saved yet — finish a session and it lands here.')}
            </p>
          ) : (
            <>
              <div className="progress__tiles">
                <Tile label="SESSIONS" value={String(total)} testId="progress-tile-sessions" />
                <Tile
                  label="AVERAGE SCORE"
                  value={averageScore.toFixed(1)}
                  testId="progress-tile-score"
                />
                <Tile
                  label="AVERAGE ALPHA"
                  value={money(averageAlpha)}
                  testId="progress-tile-alpha"
                  className={toneClass(averageAlpha)}
                />
                <Tile
                  label="BEAT THE BENCHMARK"
                  value={`${beatCount} / ${total}`}
                  testId="progress-tile-beat"
                />
              </div>

              <section className="progress__section">
                <h3 className="progress__section-title" id="progress-trend-title">
                  {t('SCORE TREND')}
                </h3>
                <svg
                  className="progress__trend"
                  viewBox="0 0 640 160"
                  preserveAspectRatio="none"
                  role="img"
                  aria-labelledby="progress-trend-title"
                  data-testid="progress-trend"
                >
                  <line
                    className="progress__bench"
                    x1="0"
                    x2={TREND_WIDTH}
                    y1={BENCHMARK_Y}
                    y2={BENCHMARK_Y}
                    strokeDasharray="6 6"
                    vectorEffect="non-scaling-stroke"
                  />
                  {trendSessions.length >= 2 ? (
                    <polyline
                      className="progress__line"
                      points={trendPoints}
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  {trendSessions.map((session, index) => (
                    <circle
                      key={session.id}
                      className="progress__dot"
                      cx={trendX(index, trendSessions.length).toFixed(1)}
                      cy={trendY(session.composite).toFixed(1)}
                      r={3}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              </section>

              <BreakdownTable
                title="BY DESK"
                header="DESK"
                rows={deskRows}
                testId="progress-desk-table"
              />
              <BreakdownTable
                title="BY SCENARIO"
                header="SCENARIO"
                rows={scenarioRows}
                testId="progress-scenario-table"
              />
              <BreakdownTable
                title="BY TIER"
                header="TIER"
                rows={tierRows}
                testId="progress-tier-table"
              />

              <section className="progress__section">
                <h3 className="progress__section-title">{t('MOST COMMON WEAKNESSES')}</h3>
                {topTags.length === 0 ? (
                  <p className="progress__empty-note">{t('No tags recorded yet.')}</p>
                ) : (
                  <ul className="progress__chips">
                    {topTags.map(([tag, count]) => (
                      <li className="progress-chip" key={tag}>
                        <span className="progress-chip__label">{t(tag)}</span>
                        <span className="progress-chip__count">×{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
