import { useEffect, useState } from 'react'
import type { Book, Instrument, QuoteRow, Rfq, Role, Side, TradeRow } from '../types'
import { COMMISSION_RATE, fillProbability } from '../engine/simulation'
import type { FillInput, QuoteInput } from '../engine/simulation'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface TradeTicketProps {
  role: Role
  instrument: Instrument
  book: Book
  rfq: Rfq | undefined
  quotes: QuoteRow[]
  recentFills: TradeRow[]
  cash: number
  /** 高档位的 EST. FILL 会有抖动（工具不那么好用的感觉），默认 0 */
  fillJitter?: number
  onQuote: (input: QuoteInput) => string
  onFill: (input: FillInput) => string
  onDecline: () => string
}

export default function TradeTicket({
  role,
  instrument,
  book,
  rfq,
  quotes,
  recentFills,
  cash,
  fillJitter = 0,
  onQuote,
  onFill,
  onDecline,
}: TradeTicketProps) {
  const t = useT()
  const [validFor, setValidFor] = useState('45')
  const [bidPrice, setBidPrice] = useState(() => book.bids[0].price.toFixed(2))
  const [offerPrice, setOfferPrice] = useState(() => book.asks[0].price.toFixed(2))
  const [bidVolume, setBidVolume] = useState('10000')
  const [offerVolume, setOfferVolume] = useState('10000')
  /* 这里的 BUY/SELL 是"我们这一边"的动作：客户卖 → 我们买 */
  const [side, setSide] = useState<Side>(rfq ? (rfq.side === 'SELL' ? 'BUY' : 'SELL') : 'BUY')
  const [qty, setQty] = useState(String(rfq?.qty ?? 1000))
  const [limitPrice, setLimitPrice] = useState(() => instrument.last.toFixed(2))
  const [tab, setTab] = useState<'live' | 'old'>('live')
  const [flash, setFlash] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  /* 未手工改价前，报价/限价跟随实时盘口，避免挂出已被行情甩开的价 */
  useEffect(() => {
    if (touched) return
    setBidPrice(book.bids[0].price.toFixed(2))
    setOfferPrice(book.asks[0].price.toFixed(2))
    setLimitPrice(instrument.last.toFixed(2))
  }, [book, instrument.last, touched])

  const isMaker = role === 'market-maker'
  const notional = isMaker
    ? Number(offerVolume || 0) * Number(offerPrice || 0)
    : Number(qty || 0) * Number(limitPrice || 0)
  const commission = notional * COMMISSION_RATE
  /* 报价宽度相对市场价差 → 客户接受概率（报得越宽越难成交） */
  const marketSpread = book.asks[0].price - book.bids[0].price
  const ourSpread = Number(offerPrice || 0) - Number(bidPrice || 0)
  const baseFillChance = marketSpread > 0 && ourSpread > 0 ? fillProbability(ourSpread / marketSpread) : 1
  /* 高档位显示的是估算值：会上下摆动，别把 96% 当成承诺 */
  const fillChance = Math.min(0.99, Math.max(0.02, baseFillChance + fillJitter))

  const onSend = () => {
    if (isMaker) {
      const message = onQuote({
        symbol: instrument.symbol,
        bid: Number(bidPrice),
        offer: Number(offerPrice),
        bidVolume: Number(bidVolume),
        offerVolume: Number(offerVolume),
        validFor: Number(validFor),
        rfqId: rfq?.id,
      })
      setFlash(message)
      return
    }
    const message = onFill({
      symbol: instrument.symbol,
      clientSide: side === 'BUY' ? 'SELL' : 'BUY',
      client: rfq?.client ?? 'AM-39',
      qty: Number(qty),
      price: Number(limitPrice),
      rfqId: rfq?.id,
    })
    setFlash(message)
  }

  const onDeclineClick = () => setFlash(onDecline())

  /* 在途（PENDING）也算活跃报价：客户能看到它正在路上，然后才挂进盘口 */
  const isOpen = (status: string) => status === 'PENDING' || status === 'LIVE'
  const rows = quotes.filter((quote) => (tab === 'live' ? isOpen(quote.status) : !isOpen(quote.status)))

  return (
    <section className="panel panel--ticket">
      <PanelHeader
        index="4"
        title={t(isMaker ? 'QUOTE TICKET' : 'CLIENT ORDER')}
        right={
          <span className="panel__meta">
            {rfq
              ? t('{client} · CLIENT {side} {qty} {symbol}', {
                  client: rfq.client,
                  side: t(rfq.side),
                  qty: rfq.qty,
                  symbol: rfq.symbol,
                })
              : t('SYSTEM DISPATCH')}
          </span>
        }
      />

      <div className="ticket">
        <div className="ticket__grid">
          <label className="field">
            <span className="field__label">{t('Instrument')}</span>
            <input className="field__input" value={instrument.symbol} readOnly tabIndex={-1} />
          </label>

          {isMaker ? (
            <>
              <label className="field">
                <span className="field__label">{t('Valid for (seconds)')}</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={validFor}
                  onChange={(event) => setValidFor(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('Bid price')}</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={bidPrice}
                  onChange={(event) => { setTouched(true); setBidPrice(event.target.value) }}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('Offer price')}</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={offerPrice}
                  onChange={(event) => { setTouched(true); setOfferPrice(event.target.value) }}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('Bid volume')}</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={bidVolume}
                  onChange={(event) => setBidVolume(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('Offer volume')}</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={offerVolume}
                  onChange={(event) => setOfferVolume(event.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field__label">{t('Client')}</span>
                <input className="field__input" value={rfq?.client ?? 'AM-39'} readOnly tabIndex={-1} />
              </label>
              <div className="field">
                <span className="field__label">{t('Desk side')}</span>
                <div className="segmented" role="group" aria-label={t('Side')}>
                  {(['BUY', 'SELL'] as Side[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={side === option ? 'segmented__btn segmented__btn--on' : 'segmented__btn'}
                      aria-pressed={side === option}
                      onClick={() => setSide(option)}
                    >
                      {t(option)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="field__label">{t('Quantity')}</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('Limit price')}</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={limitPrice}
                  onChange={(event) => { setTouched(true); setLimitPrice(event.target.value) }}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('Client ref')}</span>
                <input className="field__input" value={rfq?.id ?? 'MANUAL'} readOnly tabIndex={-1} />
              </label>
            </>
          )}
        </div>

        <div className="ticket__summary">
          <div className="stat">
            <span className="stat__label">{t('LIVE MKT')}</span>
            <span className="stat__value stat__value--live">
              {book.bids[0].price.toFixed(2)} / {book.asks[0].price.toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('NOTIONAL')}</span>
            <span className="stat__value">${money(notional)}</span>
          </div>
          <div className="stat">
            <span className="stat__label">{t('COMMISSION')}</span>
            <span className="stat__value">${money(commission)}</span>
          </div>
          {isMaker && (
            <div className="stat" title={t('Quote width versus the market book — a wider quote is less likely to trade')}>
              <span className="stat__label">{t('EST. FILL')}</span>
              <span className="stat__value stat__value--live">{Math.round(fillChance * 100)}%</span>
            </div>
          )}
          <div className="stat">
            <span className="stat__label">{t('AVAILABLE CASH')}</span>
            <span className="stat__value stat__value--live">${money(cash)}</span>
          </div>
          <div className="ticket__actions">
            <button type="button" className="btn btn--primary" onClick={onSend}>
              {t(isMaker ? 'SEND QUOTE' : 'FILL CLIENT ORDER')}
            </button>
            {!isMaker && (
              <button type="button" className="btn btn--danger" onClick={onDeclineClick}>
                {t('DECLINE')}
              </button>
            )}
          </div>
        </div>

        {flash ? (
          <p className="ticket__flash" role="status">
            {flash}
          </p>
        ) : null}
      </div>

      {isMaker ? (
        <>
          <div className="tabs">
            <button
              type="button"
              className={tab === 'live' ? 'tab tab--on' : 'tab'}
              onClick={() => setTab('live')}
              aria-pressed={tab === 'live'}
            >
              {t('LIVE QUOTES')}
            </button>
            <button
              type="button"
              className={tab === 'old' ? 'tab tab--on' : 'tab'}
              onClick={() => setTab('old')}
              aria-pressed={tab === 'old'}
            >
              {t('OLD QUOTES')}
            </button>
          </div>
          <div className="table-wrap">
            <table className="grid grid--quotes">
              <thead>
                <tr>
                  <th scope="col">{t('ID')}</th>
                  <th scope="col">{t('SECURITY')}</th>
                  <th scope="col" className="num">{t('BID VOL')}</th>
                  <th scope="col" className="num">{t('BID')}</th>
                  <th scope="col" className="num">{t('OFFER')}</th>
                  <th scope="col" className="num">{t('OFFER VOL')}</th>
                  <th scope="col" className="num">{t('VALID FOR')}</th>
                  <th scope="col">{t('STATUS')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((quote) => (
                  <tr key={quote.id} className="row">
                    <td className="muted">{quote.id}</td>
                    <td className="strong">{quote.symbol}</td>
                    <td className="num">{quote.bidVolume.toLocaleString('en-US')}</td>
                    <td className="num num--up">{quote.bid.toFixed(2)}</td>
                    <td className="num num--down">{quote.offer.toFixed(2)}</td>
                    <td className="num">{quote.offerVolume.toLocaleString('en-US')}</td>
                    <td className="num">{quote.validFor}s</td>
                    <td>
                      <span className={`badge badge--${quote.status.toLowerCase()}`}>{t(quote.status)}</span>
                      {quote.status === 'PENDING' ? (
                        <span className="quote-extra" title={t('Ticks left before the quote reaches the market')}>
                          +{quote.latencyTicks}
                        </span>
                      ) : null}
                      {quote.status === 'LIVE' && quote.queueAhead > 0 ? (
                        <span className="quote-extra" title={t('Size ahead of you at this price')}>
                          Q{quote.queueAhead.toLocaleString('en-US')}
                        </span>
                      ) : null}
                      {quote.filledQty > 0 ? (
                        <span className="quote-extra" title={t('Filled / quoted quantity')}>
                          {quote.filledQty.toLocaleString('en-US')}/{quote.qty.toLocaleString('en-US')}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      {t(tab === 'live'
                        ? 'No live quotes — send one from the ticket above'
                        : 'No filled or expired quotes yet')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="tabs">
            <button type="button" className="tab tab--on">
              {t('RECENT FILLS')}
            </button>
          </div>
          <div className="table-wrap">
            <table className="grid grid--quotes">
              <thead>
                <tr>
                  <th scope="col">{t('TIME')}</th>
                  <th scope="col">{t('SECURITY')}</th>
                  <th scope="col">{t('VENUE')}</th>
                  <th scope="col">{t('SIDE')}</th>
                  <th scope="col" className="num">{t('QTY')}</th>
                  <th scope="col" className="num">{t('PRICE')}</th>
                  <th scope="col" className="num">{t('FEE')}</th>
                  <th scope="col">{t('ID')}</th>
                </tr>
              </thead>
              <tbody>
                {recentFills.slice(0, 4).map((fill) => (
                  <tr key={fill.id} className="row">
                    <td className="muted">{fill.time}</td>
                    <td className="strong">{fill.symbol}</td>
                    <td>
                      <span className={`badge badge--${fill.venue}`}>
                        {t(fill.venue === 'client' ? 'CLIENT' : 'EXCHANGE')}
                      </span>
                    </td>
                    <td className={fill.side === 'BUY' ? 'num--up' : 'num--down'}>{t(fill.side)}</td>
                    <td className="num">{fill.qty.toLocaleString('en-US')}</td>
                    <td className="num">{fill.price.toFixed(2)}</td>
                    <td className="num">{fill.fee.toFixed(2)}</td>
                    <td className="muted">{fill.id}</td>
                  </tr>
                ))}
                {recentFills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      {t('No fills yet — the first client order will land here')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}