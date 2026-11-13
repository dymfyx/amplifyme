import { useState } from 'react'
import type { Book, Instrument, Role, Side } from '../types'
import {
  COMMISSION_RATE,
  exchangeLiquidity,
  type ExchangeTradeInput,
  type VenuePricePreview,
} from '../engine/simulation'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface ExchangeTicketProps {
  instrument: Instrument
  book: Book
  cash: number
  role: Role
  /** 这个角色当前的买入价 / 卖出价 / 双边差距，由引擎的 venuePricePreview 算好 */
  preview: VenuePricePreview
  /** 返回结果文案，显示在票据下方 */
  onTrade: (input: ExchangeTradeInput) => string
}

/**
 * 交易所（主动成交）票据：两个角色都能随时自由买卖，但拿到的价不同。
 *
 * - MARKET MAKER：提供流动性，双边价更紧（gap ≈ 1–2 个价格点）；
 * - SALES：主动吃单边价，双边价更宽（gap ≈ 5–10 个价格点，随波动变化）。
 *
 * 票据上直接显示「你买 / 你卖 / 你的价差 / 来回成本」，让成本可见。
 */
export default function ExchangeTicket({
  instrument,
  book,
  cash,
  role,
  preview,
  onTrade,
}: ExchangeTicketProps) {
  const t = useT()
  const [side, setSide] = useState<Side>('BUY')
  const [qty, setQty] = useState('1000')
  const [flash, setFlash] = useState<string | null>(null)

  const requested = Math.trunc(Number(qty) || 0)
  const levels = side === 'BUY' ? book.asks : book.bids
  const liquidity = exchangeLiquidity(levels)
  const price = side === 'BUY' ? preview.buy : preview.sell
  const notional = requested > 0 && price > 0 ? requested * price : 0
  const commission = notional * COMMISSION_RATE
  const roundTrip = preview.gapPoints * Math.max(0, requested) + commission * 2
  const canTrade = requested > 0 && price > 0 && requested <= liquidity

  const submit = () => {
    setFlash(onTrade({ symbol: instrument.symbol, side, qty: requested }))
  }

  return (
    <section className="panel panel--exchange">
      <PanelHeader
        index="5"
        title={t('EXCHANGE')}
        right={
          <span className="panel__meta">
            {instrument.symbol} · {t(role === 'sales' ? 'TAKER PRICE' : 'MAKER PRICE')}
          </span>
        }
      />

      <div className="ticket exchange">
        <div className="ticket__grid">
          <div className="field">
            <span className="field__label">{t('Exchange side')}</span>
            <div className="segmented" role="group" aria-label={t('Exchange side')}>
              {(['BUY', 'SELL'] as Side[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={side === option ? 'segmented__btn segmented__btn--on' : 'segmented__btn'}
                  aria-pressed={side === option}
                  aria-label={t(`Exchange ${option}`)}
                  onClick={() => setSide(option)}
                >
                  {t(option)}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field__label">{t('Exchange quantity')}</span>
            <input
              className="field__input"
              inputMode="numeric"
              aria-label={t('Exchange quantity')}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">{t('You buy at')}</span>
            <input
              className="field__input"
              value={preview.buy > 0 ? preview.buy.toFixed(2) : '—'}
              readOnly
              tabIndex={-1}
              aria-label={t('You buy at')}
            />
          </label>

          <label className="field">
            <span className="field__label">{t('You sell at')}</span>
            <input
              className="field__input"
              value={preview.sell > 0 ? preview.sell.toFixed(2) : '—'}
              readOnly
              tabIndex={-1}
              aria-label={t('You sell at')}
            />
          </label>
        </div>

        <div className="ticket__summary">
          <div className="stat" title={t('Your buy price minus your sell price right now')}>
            <span className="stat__label">{t('YOUR SPREAD')}</span>
            <span className="stat__value stat__value--live">
              {preview.gapPoints.toFixed(2)} ({preview.gapBps.toFixed(0)}bps)
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('NOTIONAL')}</span>
            <span className="stat__value">${money(notional)}</span>
          </div>
          <div className="stat" title={t('Spread plus commission for a buy-then-sell round trip at this size')}>
            <span className="stat__label">{t('ROUND-TRIP COST')}</span>
            <span className="stat__value">${money(roundTrip)}</span>
          </div>
          <div className="stat" title={t('Shares available on the visible book for this side')}>
            <span className="stat__label">{t('BOOK SIZE')}</span>
            <span className="stat__value stat__value--live">{liquidity.toLocaleString('en-US')}</span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('AVAILABLE CASH')}</span>
            <span className="stat__value stat__value--live">${money(cash)}</span>
          </div>
          <div className="ticket__actions">
            <button type="button" className="btn btn--primary" onClick={submit} disabled={!canTrade}>
              {t(side === 'BUY' ? 'BUY AT MARKET' : 'SELL AT MARKET')}
            </button>
          </div>
        </div>

        {flash ? (
          <p className={flash.includes('REJECTED') ? 'ticket__flash ticket__flash--warn' : 'ticket__flash'} role="status">
            {flash}
          </p>
        ) : null}
      </div>
    </section>
  )
}
