import type { NewsItem } from '../types'
import PanelHeader from './PanelHeader'

interface EventFeedProps {
  news: NewsItem[]
}

export default function EventFeed({ news }: EventFeedProps) {
  return (
    <section className="panel panel--events">
      <PanelHeader
        index="7"
        title="EVENT FEED"
        right={<span className="badge badge--live">{news.length} ITEMS</span>}
      />
      <ol className="feed">
        {news.map((item) => (
          <li key={item.id} className={`feed__item feed__item--${item.kind}`}>
            <div className="feed__meta">
              <span className="feed__time">{item.time}</span>
              <span className={`feed__tag feed__tag--${item.kind}`}>{item.tag}</span>
              <span className="feed__impact" aria-label={`Impact ${item.impact} of 3`}>
                {'●'.repeat(item.impact)}
                <span className="feed__impact-off">{'●'.repeat(3 - item.impact)}</span>
              </span>
            </div>
            <p className="feed__headline">{item.headline}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
