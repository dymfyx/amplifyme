import { useEffect } from 'react'
import type { NewsItem } from '../types'
import { useI18n, useT } from '../i18n'

interface NewsDetailProps {
  item: NewsItem
  /** 三、四档不展示涨跌，只给一句提示 */
  hideDirection?: boolean
  onClose: () => void
}

/**
 * 新闻详情卡：点开 EVENT FEED 里的一条才看到正文。
 * 标题和正文都刻意含糊，不直接给方向；三、四档连涨跌标注都没有。
 */
export default function NewsDetail({ item, hideDirection = false, onClose }: NewsDetailProps) {
  const t = useT()
  const { lang } = useI18n()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const text = (en?: string, zh?: string) => (lang === 'zh' && zh ? zh : en ?? '')
  const headline = text(item.headline, item.headlineZh)
  const detail = text(item.detail, item.detailZh)

  return (
    <div className="news-backdrop" data-testid="news-backdrop" onClick={onClose}>
      <div
        className="news-detail"
        role="dialog"
        aria-modal="true"
        aria-label={t('News detail')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="news-detail__head">
          <div>
            <p className="news-detail__eyebrow">{t('NEWS DETAIL')}</p>
            <h2 className="news-detail__title">{headline}</h2>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('CLOSE')}
          </button>
        </header>

        <div className="news-detail__meta">
          <span className="feed__time">{item.time}</span>
          <span className={`feed__tag feed__tag--${item.kind}`}>{t(item.tag)}</span>
          {item.symbol && item.symbol !== item.tag ? (
              <span className="news-detail__chip">{item.symbol}</span>
            ) : null}
          <span className="news-detail__chip">
            {t('Impact {impact} of 3', { impact: item.impact })}
          </span>
          {item.source ? <span className="news-detail__source">{t('Source: {source}', { source: item.source })}</span> : null}
        </div>

        <p className="news-detail__body">{detail || headline}</p>

        <p className="news-detail__note">
          {hideDirection
            ? t('Direction is not shown at this difficulty tier — read the tape and the wording.')
            : t('The feed does not tell you what to do with it. Check the book before you price it.')}
        </p>
      </div>
    </div>
  )
}
