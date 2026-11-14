import type { ArchivedSession } from '../storage/archive'
import { historyLeaderboard } from '../engine/leaderboard'
import { useT } from '../i18n'

interface HomeLeaderboardProps {
  sessions: ArchivedSession[]
  onOpenArchive: () => void
}

/**
 * 入口页的本地历史榜：只展示综合分最高的几局，点进去看完整存档。
 * 数据全部来自 localStorage 里的存档，和结算页的 LOCAL HISTORY 用同一套排序。
 */
export default function HomeLeaderboard({ sessions, onOpenArchive }: HomeLeaderboardProps) {
  const t = useT()
  if (sessions.length === 0) return null
  const board = historyLeaderboard(sessions, null, 5)

  return (
    <section className="home-board" data-testid="home-leaderboard">
      <header className="home-board__head">
        <div>
          <p className="home-board__eyebrow">{t('LOCAL HISTORY')}</p>
          <h2 className="home-board__title">{t('Your best runs')}</h2>
        </div>
        <button type="button" className="btn btn--ghost btn--tiny" onClick={onOpenArchive}>
          {t('OPEN ARCHIVE')}
        </button>
      </header>

      <ol className="home-board__list">
        {board.entries.map((entry, index) => (
          <li key={entry.id} className="home-board__row">
            <span className="home-board__rank">#{index + 1}</span>
            <span className="home-board__desk">
              {t(entry.desk === 'sales' ? 'SALES' : 'MARKET MAKING')}
            </span>
            <span className="home-board__scenario">{t(entry.scenarioName)}</span>
            <span className="home-board__meta">
              T{entry.tier} · {entry.minutes} MIN
            </span>
            <span className="home-board__score">{entry.score.toFixed(1)}</span>
            <span
              className={
                entry.alpha >= 0 ? 'home-board__alpha home-board__alpha--up' : 'home-board__alpha'
              }
            >
              {entry.alpha >= 0 ? '+' : '−'}${Math.abs(Math.round(entry.alpha)).toLocaleString('en-US')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
