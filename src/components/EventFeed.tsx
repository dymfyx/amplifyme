import { useEffect, useRef } from 'react'
import type { NewsItem } from '../types'
import { useI18n, useT } from '../i18n'
import PanelHeader from './PanelHeader'

interface EventFeedProps {
  news: NewsItem[]
  /** 点击一条新闻，打开详情卡片 */
  onOpenNews?: (item: NewsItem) => void
  /** 三、四档隐藏利好/利空标注，让玩家自己判断方向 */
  hideDirection?: boolean
}

export default function EventFeed({ news, onOpenNews, hideDirection = false }: EventFeedProps) {
  const t = useT()
  const { lang } = useI18n()
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [news.length])

  const headlineOf = (item: NewsItem) => (lang === 'zh' && item.headlineZh ? item.headlineZh : item.headline)

  return (
    <section className="panel panel--events">
      <PanelHeader
        index="9"
        title={t('EVENT FEED')}
        right={
          <span className="badge badge--live">
            {news.length} {t(news.length === 1 ? 'ITEM' : 'ITEMS')}
          </span>
        }
      />
      <ol className="feed" ref={listRef}>
        {news.map((item) => {
          const body = (
            <>
              <div className="feed__meta">
                <span className="feed__time">{item.time}</span>
                <span className={`feed__tag feed__tag--${item.kind}`}>{t(item.tag)}</span>
                {!hideDirection && item.direction ? (
                  <span className={`feed__bias feed__bias--${item.direction > 0 ? 'up' : 'down'}`}>
                    {t(item.direction > 0 ? '▲ BULLISH' : '▼ BEARISH')}
                  </span>
                ) : null}
                <span className="feed__impact" aria-label={t('Impact {impact} of 3', { impact: item.impact })}>
                  {'●'.repeat(item.impact)}
                  <span className="feed__impact-off">{'●'.repeat(3 - item.impact)}</span>
                </span>
              </div>
              <p className="feed__headline">{headlineOf(item)}</p>
            </>
          )
          return (
            <li key={item.id} className={`feed__item feed__item--${item.kind}`}>
              {onOpenNews ? (
                <button
                  type="button"
                  className="feed__hit"
                  aria-label={t('Open headline: {headline}', { headline: headlineOf(item) })}
                  onClick={() => onOpenNews(item)}
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          )
        })}
        {news.length === 0 ? (
          <li className="feed__item">
            <p className="feed__headline muted">{t('Waiting for the next headline…')}</p>
          </li>
        ) : null}
      </ol>
    </section>
  )
}
