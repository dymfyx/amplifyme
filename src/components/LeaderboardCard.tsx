import { useState } from 'react'
import { ARCHETYPE_LABELS } from '../engine/agents'
import type { HistoryBoard, SessionLeaderboard } from '../engine/leaderboard'
import { useT } from '../i18n'

interface LeaderboardCardProps {
  /** 这一局：人机 + 你 */
  session: SessionLeaderboard
  /** 本地历史：存档里分数最高的几局 + 这一局 */
  history: HistoryBoard
  /** 台面名，显示在标题右侧 */
  desk: string
}

type BoardTab = 'session' | 'history'

const signedPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`

const signedMoney = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`

const shortDate = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(
    date.getHours(),
  ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * 结算榜单：默认看这一局和人机的排名，另一个页签看本地历史的前几名。
 * 人机成绩按投入资本的百分比收益排，历史按综合分排；当前这一局始终高亮。
 */
export default function LeaderboardCard({ session, history, desk }: LeaderboardCardProps) {
  const t = useT()
  const [tab, setTab] = useState<BoardTab>('session')

  return (
    <section className="leaderboard" data-testid="leaderboard-card">
      <div className="leaderboard__head">
        <div>
          <span className="report__card-title">{t('LEADERBOARD')}</span>
          <span className="leaderboard__desk">{desk}</span>
        </div>
        <div className="segmented" role="group" aria-label={t('Leaderboard view')}>
          <button
            type="button"
            className={tab === 'session' ? 'segmented__btn segmented__btn--on' : 'segmented__btn'}
            aria-pressed={tab === 'session'}
            aria-label={t('This session')}
            onClick={() => setTab('session')}
          >
            {t('THIS SESSION')}
          </button>
          <button
            type="button"
            className={tab === 'history' ? 'segmented__btn segmented__btn--on' : 'segmented__btn'}
            aria-pressed={tab === 'history'}
            aria-label={t('Local history')}
            onClick={() => setTab('history')}
          >
            {t('LOCAL HISTORY')}
          </button>
        </div>
      </div>

      {tab === 'session' ? (
        <>
          <p className="leaderboard__standing">
            {t('You are #{rank} of {total} against the machines, on return on capital.', {
              rank: session.you.rank,
              total: session.you.total,
            })}
          </p>
          <div className="leaderboard__table" data-testid="leaderboard-session">
            <div className="leaderboard__header">
              <span>#</span>
              <span>{t('TRADER')}</span>
              <span>{t('RETURN')}</span>
              <span>{t('P&L')}</span>
            </div>
            {[
              ...session.entries.slice(0, 12),
              ...session.entries.slice(12).filter((entry) => entry.isYou),
            ].map((entry, index) => (
              <div
                key={entry.id}
                className={entry.isYou ? 'leaderboard__row leaderboard__row--you' : 'leaderboard__row'}
                data-testid={entry.isYou ? 'leaderboard-you' : `leaderboard-${entry.id}`}
              >
                <span className="leaderboard__rank">{index + 1}</span>
                <span className="leaderboard__name">
                  {entry.isYou ? t('You') : entry.name}
                  <span className="leaderboard__tag">
                    {entry.isYou ? t('YOUR DESK') : t(ARCHETYPE_LABELS[entry.archetype ?? 'noise'])}
                  </span>
                </span>
                <span
                  className={
                    entry.returnPct < 0 ? 'leaderboard__value num--down' : 'leaderboard__value num--up'
                  }
                >
                  {signedPct(entry.returnPct)}
                </span>
                <span className={entry.pnl < 0 ? 'leaderboard__pnl num--down' : 'leaderboard__pnl num--up'}>
                  {signedMoney(entry.pnl)}
                </span>
              </div>
            ))}
          </div>
          <p className="leaderboard__note">
            {t('Machines start with $1m, you start with $20m — the rank compares return on capital, not raw dollars.')}
          </p>
        </>
      ) : (
        <div data-testid="leaderboard-history">
          {history.entries.length === 0 ? (
            <p className="leaderboard__empty">
              {t('No finished sessions yet — this run becomes the first line.')}
            </p>
          ) : (
            <>
              {history.you ? (
                <p className="leaderboard__standing">
                  {t('This run sits #{rank} of {total} in your local archive, by composite score.', {
                    rank: history.you.rank,
                    total: history.you.total,
                  })}
                </p>
              ) : null}
              <div className="leaderboard__table">
                <div className="leaderboard__header">
                  <span>#</span>
                  <span>{t('WHEN')}</span>
                  <span>{t('SCORE')}</span>
                  <span>{t('ALPHA')}</span>
                </div>
                {history.entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={
                      entry.isCurrent ? 'leaderboard__row leaderboard__row--you' : 'leaderboard__row'
                    }
                  >
                    <span className="leaderboard__rank">{index + 1}</span>
                    <span className="leaderboard__name">
                      {shortDate(entry.savedAt)}
                      <span className="leaderboard__tag">
                        {t(entry.desk === 'sales' ? 'SALES' : 'MARKET MAKER')} · {t('T{tier}', { tier: entry.tier })} ·{' '}
                        {entry.minutes}m
                        {entry.isCurrent ? ` · ${t('THIS RUN')}` : ''}
                      </span>
                    </span>
                    <span className="leaderboard__value">{entry.score.toFixed(1)}</span>
                    <span className={entry.alpha < 0 ? 'leaderboard__pnl num--down' : 'leaderboard__pnl num--up'}>
                      {signedMoney(entry.alpha)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
