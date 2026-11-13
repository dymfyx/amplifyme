import { useState } from 'react'
import type { Side } from '../types'
import type { DealerQuote } from '../engine/simulation'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

interface DealerQuotePanelProps {
  quotes: DealerQuote[]
  tick: number
  /** 打掉某家 dealer 的回价，返回引擎结果文案 */
  onTake: (quoteId: string, side: Side) => string
}

/**
 * Sales 的回价面板：向 dealer 发出 RFQ 后，这里显示每家回来的双边价。
 *
 * 回价有延迟（CALLING）与有效期（VALID FOR），数量可能小于你要的量；
 * 可以主动打 dealer 的 offer（买入）或砸他的 bid（卖出）。
 */
export default function DealerQuotePanel({ quotes, tick, onTake }: DealerQuotePanelProps) {
  const t = useT()
  const [flash, setFlash] = useState<string | null>(null)

  const live = quotes.filter((quote) => tick >= quote.readyAt)
  const calling = quotes.filter((quote) => tick < quote.readyAt)

  return (
    <section className="panel panel--dispatch">
      <PanelHeader
        index="3"
        title={t('DEALER QUOTES')}
        right={<span className="badge badge--live">{t('{count} LIVE', { count: live.length })}</span>}
      />

      <ul className="dispatch-list">
        {live.length === 0 && calling.length === 0 ? (
          <li className="dispatch__empty">
            {t('No dealer quotes — send an RFQ from the ticket above')}
          </li>
        ) : null}

        {live.map((quote) => {
          const left = Math.max(0, quote.expiresAt - tick)
          return (
            <li key={quote.id}>
              <div className="dispatch dealer">
                <span className="dispatch__top">
                  <span className="dispatch__time">{quote.dealerName}</span>
                  <span className="dispatch__id">{quote.requestId}</span>
                </span>
                <span className="dispatch__body">
                  {quote.symbol} · {t('SIZE')} {quote.size.toLocaleString('en-US')}
                </span>
                <span className="dealer__prices">
                  <button
                    type="button"
                    className="btn btn--tiny"
                    aria-label={t('SELL {qty} {symbol} at {price} to {dealer}', {
                      qty: quote.size.toLocaleString('en-US'),
                      symbol: quote.symbol,
                      price: quote.bid.toFixed(2),
                      dealer: quote.dealerName,
                    })}
                    disabled={quote.size <= 0}
                    onClick={() => setFlash(onTake(quote.id, 'SELL'))}
                  >
                    {t('SELL')} {quote.bid.toFixed(2)}
                  </button>
                  <span className="dealer__spread">
                    {(quote.offer - quote.bid).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    className="btn btn--tiny"
                    aria-label={t('BUY {qty} {symbol} at {price} from {dealer}', {
                      qty: quote.size.toLocaleString('en-US'),
                      symbol: quote.symbol,
                      price: quote.offer.toFixed(2),
                      dealer: quote.dealerName,
                    })}
                    disabled={quote.size <= 0}
                    onClick={() => setFlash(onTake(quote.id, 'BUY'))}
                  >
                    {t('BUY')} {quote.offer.toFixed(2)}
                  </button>
                </span>
                <span className="dispatch__note">
                  {t('Valid for {ticks} ticks', { ticks: left })}
                </span>
              </div>
            </li>
          )
        })}

        {calling.map((quote) => (
          <li key={quote.id}>
            <div className="dispatch dispatch--calling">
              <span className="dispatch__top">
                <span className="dispatch__time">{quote.dealerName}</span>
                <span className="dispatch__id">{quote.requestId}</span>
              </span>
              <span className="dispatch__body">
                {quote.symbol} · {t('CALLING · {ticks} ticks', { ticks: quote.readyAt - tick })}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {flash ? (
        <p className={flash.includes('REJECTED') ? 'ticket__flash ticket__flash--warn' : 'ticket__flash'} role="status">
          {flash}
        </p>
      ) : null}
    </section>
  )
}
