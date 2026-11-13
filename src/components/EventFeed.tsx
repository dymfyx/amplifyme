import { useEffect, useRef } from 'react'
import type { NewsItem } from '../types'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

interface EventFeedProps {
  news: NewsItem[]
}

export default function EventFeed({ news }: EventFeedProps) {
  const t = useT()
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [news.length])

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
        {news.map((item) => (
          <li key={item.id} className={`feed__item feed__item--${item.kind}`}>
            <div className="feed__meta">
              <span className="feed__time">{item.time}</span>
              <span className={`feed__tag feed__tag--${item.kind}`}>{t(item.tag)}</span>
              {item.direction ? (
                <span className={`feed__bias feed__bias--${item.direction > 0 ? 'up' : 'down'}`}>
                  {t(item.direction > 0 ? '▲ BULLISH' : '▼ BEARISH')}
                </span>
              ) : null}
              <span className="feed__impact" aria-label={t('Impact {impact} of 3', { impact: item.impact })}>
                {'●'.repeat(item.impact)}
                <span className="feed__impact-off">{'●'.repeat(3 - item.impact)}</span>
              </span>
            </div>
            <p className="feed__headline">{item.headline}</p>
          </li>
        ))}
        {news.length === 0 ? (
          <li className="feed__item">
            <p className="feed__headline muted">{t('Waiting for the next headline…')}</p>
          </li>
        ) : null}
      </ol>
    </section>
  )
}
