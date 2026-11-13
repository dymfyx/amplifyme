import { useState } from 'react'
import type { Book, Instrument, Role, Side } from '../types'
import {
  exchangeLiquidity,
  type ExchangeTradeInput,
  type VenuePricePreview,
} from '../engine/simulation'
import type { DifficultyTier } from '../engine/difficulty'
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
  /** 当前难度档位：手续费、单笔上限、做空/减仓权限都由它决定 */
  tier: DifficultyTier
  /** 当前标的的净持仓（用来判断减仓/做空权限） */
  netQty: number
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
  tier,
  netQty,
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
  const commission = notional * tier.commissionRate
  const roundTrip = preview.gapPoints * Math.max(0, requested) + commission * 2
  /* 单笔上限由档位决定；盘口可成交量也要够，否则点下去只会拿到拒单 */
  const capHit = requested > tier.maxExchangeQty
  /* 权限：reduce-only 档只能减仓；不允许做空时卖出量不能超过持仓 */
  const reduces = side === 'BUY' ? netQty < 0 : netQty > 0
  const mandateBlocked =
    tier.exchangeMode === 'reduce-only'
      ? !reduces
      : !tier.allowShort && side === 'SELL' && requested > Math.max(0, netQty)
  /*
   * 不把按钮锁死：点下去让引擎把拒绝原因说出来（限额 / 权限 / 盘口不够），
   * 否则用户只看到一颗灰色按钮，不知道是坏了还是不能做。
   */
  const ready = requested > 0 && price > 0
  const blockedReason = mandateBlocked
    ? tier.exchangeMode === 'reduce-only'
      ? t('EXCHANGE LIMIT · this mandate only lets the desk reduce risk on the exchange')
      : t('NO SHORTING · retail accounts can only sell what they already hold')
    : capHit
      ? t('This mandate caps a single order at {n} shares', {
          n: tier.maxExchangeQty.toLocaleString('en-US'),
        })
      : requested > liquidity
        ? t('Only {n} {symbol} on this side of the book', {
            n: liquidity.toLocaleString('en-US'),
            symbol: instrument.symbol,
          })
        : null

  /* 提示行已经说明原因时，不再把同一句拒绝话重复一遍 */
  const visibleFlash = flash && flash !== blockedReason ? flash : null

  const submit = () => {
    /* 已经知道会在哪一步被拒，就直接显示本地化的原因，不再多弹一条英文引擎消息 */
    if (blockedReason) {
      setFlash(blockedReason)
      return
    }
    setFlash(onTrade({ symbol: instrument.symbol, side, qty: requested }))
  }

  return (
    <section className="panel panel--exchange">
      <PanelHeader
        index="5"
        title={t('EXCHANGE')}
        right={
          <span className="panel__meta">
            {instrument.symbol} · {t(role === 'sales' ? 'TAKER PRICE' : 'MAKER PRICE')} ·{' '}
            {t(
              tier.exchangeMode === 'reduce-only'
                ? 'REDUCE ONLY'
                : tier.allowShort
                  ? 'FULL ACCESS'
                  : 'NO SHORTING',
            )}
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
              title={t('This mandate caps a single order at {n} shares', {
                n: tier.maxExchangeQty.toLocaleString('en-US'),
              })}
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

        {blockedReason ? (
          <p className="exchange__hint" role="status">
            {blockedReason}
          </p>
        ) : null}

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
            <button type="button" className="btn btn--primary" onClick={submit} disabled={!ready}>
              {t(side === 'BUY' ? 'BUY AT MARKET' : 'SELL AT MARKET')}
            </button>
          </div>
        </div>

        {visibleFlash ? (
          <p
            className={
              /LIMIT|NO SHORTING|RISK LIMIT|REJECTED/.test(visibleFlash)
                ? 'ticket__flash ticket__flash--warn'
                : 'ticket__flash'
            }
            role="status"
          >
            {visibleFlash}
          </p>
        ) : null}
      </div>
    </section>
  )
}
