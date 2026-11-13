import { useState } from 'react'
import type { Book, Instrument, Side } from '../types'
import {
  COMMISSION_RATE,
  exchangeLiquidity,
  walkBook,
  type ExchangeTradeInput,
} from '../engine/simulation'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface ExchangeTicketProps {
  instrument: Instrument
  book: Book
  cash: number
  /** 返回结果文案，显示在票据下方 */
  onTrade: (input: ExchangeTradeInput) => string
}

/**
 * 交易所（主动成交）票据：客户流之外的另一条腿。
 *
 * 和客户票据的区别：这里没有报价/等待环节，你直接沿盘口吃流动性，
 * 付出市场价差和冲击成本，换来立刻成交。两条腿的价差就是台面的 edge。
 */
export default function ExchangeTicket({ instrument, book, cash, onTrade }: ExchangeTicketProps) {
  const t = useT()
  const [side, setSide] = useState<Side>('BUY')
  const [qty, setQty] = useState('1000')
  const [flash, setFlash] = useState<string | null>(null)

  const requested = Math.trunc(Number(qty) || 0)
  const levels = side === 'BUY' ? book.asks : book.bids
  const liquidity = exchangeLiquidity(levels)
  const walked = requested > 0 ? walkBook(levels, requested) : null
  const best = levels[0]?.price ?? null
  const price = walked?.avgPrice ?? null
  const notional = requested > 0 && price !== null ? requested * price : 0
  const commission = notional * COMMISSION_RATE
  const canTrade = walked !== null

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
            {instrument.symbol} · {t('TAKE LIQUIDITY')}
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
            <span className="field__label">{t('Best price')}</span>
            <input className="field__input" value={best === null ? '—' : best.toFixed(2)} readOnly tabIndex={-1} />
          </label>

          <label className="field">
            <span className="field__label">{t('Est. avg price')}</span>
            <input className="field__input" value={price === null ? '—' : price.toFixed(2)} readOnly tabIndex={-1} />
          </label>
        </div>

        <div className="ticket__summary">
          <div className="stat">
            <span className="stat__label">{t('NOTIONAL')}</span>
            <span className="stat__value">${money(notional)}</span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('COMMISSION')}</span>
            <span className="stat__value">${money(commission)}</span>
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
          <p className="ticket__flash" role="status">
            {flash}
          </p>
        ) : null}
      </div>
    </section>
  )
}
