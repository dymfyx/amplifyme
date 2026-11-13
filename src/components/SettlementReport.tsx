import { useEffect } from 'react'
import type { ScoreCard } from '../types'
import type { DecisionReview, SettlementStats } from '../engine/scoring'
import type { SessionVerdict } from '../engine/evaluation'
import { formatGoalValue, type GoalStatus } from '../engine/goals'
import type { HistoryBoard, SessionLeaderboard } from '../engine/leaderboard'
import LeaderboardCard from './LeaderboardCard'
import { STARTING_CASH } from '../engine/simulation'
import { useT } from '../i18n'
import DrillVerdict from './DrillVerdict'
import type { Drill, DrillProgress } from '../train/drills'

interface SettlementReportProps {
  desk: string
  stats: SettlementStats
  score: ScoreCard
  coaching: string
  /** 决策审阅：逆向选择、错过的消息、最大回撤、消息灵通客户占比 */
  review: DecisionReview
  /** 赛后文字评价：分档 + 行为标签 + 一句点评 */
  verdict: SessionVerdict
  /** 本局难度档位名（显示在评价卡角上） */
  tierName: string
  /** 开局目标卡的结算结果 */
  goals: GoalStatus[]
  /** 导出这一局给队友做同题对比 */
  onExportGhost?: () => void
  /** 打开同题对比抽屉 */
  onCompareGhost?: () => void
  /** 是否已经有可对比的影子 */
  hasGhost?: boolean
  /** 结算榜单：这一局的人机排名 */
  leaderboard: SessionLeaderboard
  /** 结算榜单：本地历史前几名 */
  historyBoard: HistoryBoard
  scenarioName: string
  /** 训练模式：结算时插一张 drill 判定卡 */
  drill?: Drill | null
  drillProgress?: DrillProgress | null
  drillAttempts?: number
  drillPasses?: number
  onDrillRetry?: () => void
  onDrillExit?: () => void
  onRestart: () => void
  onClose: () => void
}

const money = (value: number) =>
  `${value < 0 ? '-$' : '$'}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`

const signedMoney = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('en-US', {
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
  review,
  verdict,
  tierName,
  goals,
  onExportGhost,
  onCompareGhost,
  hasGhost = false,
  leaderboard,
  historyBoard,
  scenarioName,
  drill = null,
  drillProgress = null,
  drillAttempts = 0,
  drillPasses = 0,
  onDrillRetry,
  onDrillExit,
  onRestart,
  onClose,
}: SettlementReportProps) {
  const t = useT()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const tone = stats.total < 0 ? 'num--down' : 'num--up'
  const ourReturnPct = (stats.total / STARTING_CASH) * 100

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
            <span className="report__eyebrow">
              {t('SESSION COMPLETE · {desk}', { desk })}
            </span>
            <h2 id="settlement-title" className="report__title">
              {t('Settlement report')}
            </h2>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close settlement report">
            {t('CLOSE')}
          </button>
        </header>

        <div className="report__hero">
          <div>
            <span className="report__hero-label">{t('TOTAL P&L')}</span>
            <span className={`report__hero-value ${tone}`}>{money(stats.total)}</span>
          </div>
          <dl className="report__breakdown">
            <div>
              <dt>{t('REALISED')}</dt>
              <dd>{money(stats.realised)}</dd>
            </div>
            <div>
              <dt>{t('UNREALISED')}</dt>
              <dd className={stats.unrealised < 0 ? 'num--down' : 'num--up'}>{money(stats.unrealised)}</dd>
            </div>
            <div>
              <dt>{t('COMMISSION')}</dt>
              <dd>{money(stats.commission)}</dd>
            </div>
            <div>
              <dt>{t('CASH LEFT')}</dt>
              <dd>{money(stats.cash)}</dd>
            </div>
          </dl>
        </div>

        <div className={stats.beatsBenchmark ? 'report__bench report__bench--win' : 'report__bench'}>
          <div className="report__bench-side">
            <span className="report__bench-label">
              {t('BENCHMARK')} · {t('BUY & HOLD')}
            </span>
            <span className="report__bench-value">{money(stats.benchmarkPnl)}</span>
            <span className="report__bench-note">
              {t('BENCHMARK RETURN')} {stats.benchmarkReturnPct >= 0 ? '+' : ''}
              {stats.benchmarkReturnPct.toFixed(2)}%
            </span>
          </div>
          <div className="report__bench-side report__bench-side--right">
            <span
              className={
                stats.beatsBenchmark
                  ? 'report__bench-verdict report__bench-verdict--win'
                  : 'report__bench-verdict'
              }
            >
              {t(stats.beatsBenchmark ? 'YOU BEAT THE BENCHMARK' : 'BEHIND THE BENCHMARK')}
            </span>
            <span className="report__bench-note">
              {t('ALPHA VS BENCHMARK')} <span className={stats.alpha >= 0 ? 'num--up' : 'num--down'}>{signedMoney(stats.alpha)}</span>
            </span>
            <span className="report__bench-note">
              {t('YOUR RETURN')} {ourReturnPct >= 0 ? '+' : ''}
              {ourReturnPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {drill && drillProgress ? (
          <DrillVerdict
            drill={drill}
            progress={drillProgress}
            attempts={drillAttempts}
            passes={drillPasses}
            onRetry={onDrillRetry ?? onRestart}
            onExit={onDrillExit ?? onClose}
          />
        ) : null}

        <div className={`report__verdict report__verdict--${verdict.band}`}>
          <div className="report__review-head">
            <h3 className="report__card-title">{t('SESSION VERDICT')}</h3>
            <span className="report__review-scenario">{tierName}</span>
          </div>
          <p className={`report__verdict-headline report__verdict-headline--${verdict.tone}`}>
            {t(verdict.headline)}
          </p>
          <div className="report__verdict-tags">
            <span className="report__review-label">{t('BEHAVIOUR TAGS')}</span>
            {verdict.tags.map((tag) => (
              <span key={tag.key} className="report__verdict-tag">
                {t(tag.label)}
              </span>
            ))}
          </div>
          <p className="report__verdict-note">{t(verdict.line)}</p>
        </div>

        <div className="report__grid report__grid--closures">
          <article className="report__card" data-testid="report-goals">
            <h3 className="report__card-title">{t('SESSION GOALS')}</h3>
            <ul className="report__goals">
              {goals.map((goal) => (
                <li key={goal.id} className={goal.ok ? 'report__goal report__goal--ok' : 'report__goal'}>
                  <span className="report__goal-mark">{goal.ok ? '✓' : '✗'}</span>
                  <span className="report__goal-label">
                    {t(goal.label)}
                    <span className="report__goal-hint">{t(goal.hint)}</span>
                  </span>
                  <span className="report__goal-value">
                    {formatGoalValue(goal.current, goal.unit)} · {goal.compare === 'gte' ? '≥' : '≤'}{' '}
                    {formatGoalValue(goal.target, goal.unit)}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="report__card" data-testid="report-attribution">
            <h3 className="report__card-title">{t('P&L ATTRIBUTION')}</h3>
            <dl className="report__rows">
              <div>
                <dt>{t('Client spread')}</dt>
                <dd className={stats.clientEdge < 0 ? 'num--down' : 'num--up'}>
                  {signedMoney(stats.clientEdge)}
                </dd>
              </div>
              <div>
                <dt>{t('Taker cost (spread + impact)')}</dt>
                <dd className={stats.takerEdge < 0 ? 'num--down' : 'num--up'}>
                  {signedMoney(stats.takerEdge)}
                </dd>
              </div>
              <div>
                <dt>{t('Commission')}</dt>
                <dd className="num--down">{signedMoney(-stats.commission)}</dd>
              </div>
              <div>
                <dt>{t('Inventory & drift')}</dt>
                <dd className={stats.attributionResidual < 0 ? 'num--down' : 'num--up'}>
                  {signedMoney(stats.attributionResidual)}
                </dd>
              </div>
              <div>
                <dt>{t('TOTAL P&L')}</dt>
                <dd className={stats.total < 0 ? 'num--down' : 'num--up'}>{signedMoney(stats.total)}</dd>
              </div>
            </dl>
          </article>
        </div>

        <LeaderboardCard session={leaderboard} history={historyBoard} desk={desk} />

        <div className="report__grid">
          <article className="report__card">
            <h3 className="report__card-title">{t('FLOW')}</h3>
            <dl className="report__rows">
              <div>
                <dt>{t('Fills')}</dt>
                <dd>
                  {stats.trades} ({stats.buys}B / {stats.sells}S)
                </dd>
              </div>
              <div>
                <dt>{t('Venue split')}</dt>
                <dd>{t('{client} client · {dealer} dealer · {exchange} exchange', { client: stats.clientFills, dealer: stats.dealerFills, exchange: stats.exchangeFills })}</dd>
              </div>
              <div>
                <dt>{t('Entry vs mid')}</dt>
                <dd className={stats.entryEdgeBps < 0 ? 'num--down' : 'num--up'}>{stats.entryEdgeBps.toFixed(1)} bps</dd>
              </div>
              <div>
                <dt>{t('Spread capture')}</dt>
                <dd className={stats.spreadCapture < 0 ? 'num--down' : 'num--up'}>
                  {signedMoney(stats.spreadCapture)}
                </dd>
              </div>
              <div>
                <dt>{t('Hit ratio above mid')}</dt>
                <dd>{pct(stats.winRate)}</dd>
              </div>
              <div>
                <dt>{t('Avg edge / fill')}</dt>
                <dd>{signed(stats.avgEdge)}</dd>
              </div>
              <div>
                <dt>{t('Best / worst edge')}</dt>
                <dd>
                  {signed(stats.bestEdge)} / {signed(stats.worstEdge)}
                </dd>
              </div>
              <div>
                <dt>{t('Quotes sent')}</dt>
                <dd>{stats.quotes}</dd>
              </div>
              <div>
                <dt>{t('Quote width vs market')}</dt>
                <dd>{stats.avgSpreadRatio === null ? '—' : `${stats.avgSpreadRatio.toFixed(2)}x`}</dd>
              </div>
            </dl>
          </article>

          <article className="report__card">
            <h3 className="report__card-title">{t('RISK & RESPONSE')}</h3>
            <dl className="report__rows">
              <div>
                <dt>{t('Peak P&L')}</dt>
                <dd>{money(stats.peakPnl)}</dd>
              </div>
              <div>
                <dt>{t('Max drawdown')}</dt>
                <dd className={stats.maxDrawdown > 0 ? 'num--down' : undefined}>{money(-stats.maxDrawdown)}</dd>
              </div>
              <div>
                <dt>{t('Avg gross exposure')}</dt>
                <dd>{money(stats.avgGross)}</dd>
              </div>
              <div>
                <dt>{t('Net exposure at close')}</dt>
                <dd>{money(stats.netExposure)}</dd>
              </div>
              <div>
                <dt>{t('Median RFQ response')}</dt>
                <dd>
                  {stats.medianResponseTicks === null
                    ? '—'
                    : t('{ticks} ticks', { ticks: stats.medianResponseTicks })}
                </dd>
              </div>
              <div>
                <dt>{t('Headlines traded into')}</dt>
                <dd>
                  {stats.headlinesAnswered}/{stats.headlines}
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <div className="report__review">
          <div className="report__review-head">
            <h3 className="report__card-title">{t('DECISION REVIEW')}</h3>
            <span className="report__review-scenario">{scenarioName}</span>
          </div>
          <div className="report__review-grid">
            <article className="report__review-block">
              <span className="report__review-label">{t('PICKED OFF')}</span>
              {review.adverse.length === 0 ? (
                <p className="report__review-empty">{t('No client fill was immediately run over.')}</p>
              ) : (
                review.adverse.map((fill) => (
                  <p key={fill.id} className="report__review-row">
                    <span>
                      {fill.time} · {fill.side} {fill.qty.toLocaleString('en-US')} {fill.symbol}
                    </span>
                    <span className="num--down">-{fill.adverseBps.toFixed(1)} bps</span>
                  </p>
                ))
              )}
            </article>
            <article className="report__review-block">
              <span className="report__review-label">{t('MISSED HEADLINES')}</span>
              {review.missed.length === 0 ? (
                <p className="report__review-empty">{t('You traded into every single-name headline.')}</p>
              ) : (
                review.missed.map((item) => (
                  <p key={item.id} className="report__review-row">
                    <span>
                      {item.time} · {item.symbol}
                    </span>
                    <span className={item.moveBps >= 0 ? 'num--up' : 'num--down'}>
                      {item.moveBps >= 0 ? '+' : ''}
                      {item.moveBps.toFixed(1)} bps
                    </span>
                  </p>
                ))
              )}
            </article>
            <article className="report__review-block">
              <span className="report__review-label">{t('WORST DRAWDOWN')}</span>
              {review.worstDrawdown ? (
                <>
                  <p className="report__review-row">
                    <span>{review.worstDrawdown.time}</span>
                    <span className="num--down">{money(-review.worstDrawdown.dollars)}</span>
                  </p>
                  <p className="report__review-empty">{t('That is the point where discipline matters most.')}</p>
                </>
              ) : (
                <p className="report__review-empty">{t('No drawdown inside the session.')}</p>
              )}
            </article>
            <article className="report__review-block">
              <span className="report__review-label">{t('INFORMED FLOW')}</span>
              <p className="report__review-row">
                <span>{t('Clients traded on a headline')}</span>
                <span>
                  {review.informed.fills}/{review.informed.rfqs}
                </span>
              </p>
              <p className="report__review-empty">
                {t('These are the calls that hurt most when you are slow. {ticks} ticks is the window.', {
                  ticks: review.windowTicks,
                })}
              </p>
            </article>
          </div>
        </div>

        <div className="report__score">
          <div className="report__score-head">
            <span className="drawer__composite-value">{score.composite}</span>
            <div>
              <span className="report__score-label">{t('COMPOSITE')}</span>
              <span className="report__score-percentile">
                {t('{percentile}th percentile', { percentile: score.percentile })}
              </span>
            </div>
          </div>
          <ul className="score-list score-list--compact">
            {score.dimensions.map((dimension) => (
              <li key={dimension.key} className="score-row">
                <div className="score-row__top">
                  <span className="score-row__label">{t(dimension.label)}</span>
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
          {onExportGhost ? (
            <button type="button" className="btn btn--ghost" onClick={onExportGhost}>
              {t('EXPORT GHOST')}
            </button>
          ) : null}
          {onCompareGhost ? (
            <button type="button" className="btn btn--ghost" onClick={onCompareGhost}>
              {t(hasGhost ? 'COMPARE GHOST' : 'IMPORT GHOST')}
            </button>
          ) : null}
          <button type="button" className="btn btn--primary" onClick={onRestart}>
            {t('RUN ANOTHER SESSION')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('REVIEW THE DESK')}
          </button>
        </div>
      </section>
    </div>
  )
}
