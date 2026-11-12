import { useEffect, useState } from 'react'
import type { Book, Instrument, QuoteRow, Rfq, Role, Side, TradeRow } from '../types'
import type { FillInput, QuoteInput } from '../engine/simulation'
import PanelHeader from './PanelHeader'

const COMMISSION_RATE = 0.005

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface TradeTicketProps {
  role: Role
  instrument: Instrument
  book: Book
  rfq: Rfq | undefined
  quotes: QuoteRow[]
  recentFills: TradeRow[]
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
  onQuote,
  onFill,
  onDecline,
}: TradeTicketProps) {
  const [validFor, setValidFor] = useState('45')
  const [bidPrice, setBidPrice] = useState(() => book.bids[0].price.toFixed(2))
  const [offerPrice, setOfferPrice] = useState(() => book.asks[0].price.toFixed(2))
  const [bidVolume, setBidVolume] = useState('10000')
  const [offerVolume, setOfferVolume] = useState('10000')
  const [side, setSide] = useState<Side>(rfq?.side ?? 'SELL')
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
      clientSide: side,
      client: rfq?.client ?? 'AM-39',
      qty: Number(qty),
      price: Number(limitPrice),
      rfqId: rfq?.id,
    })
    setFlash(message)
  }

  const onDeclineClick = () => setFlash(onDecline())

  const rows = quotes.filter((quote) => (tab === 'live' ? quote.status === 'LIVE' : quote.status !== 'LIVE'))

  return (
    <section className="panel panel--ticket">
      <PanelHeader
        index="4"
        title={isMaker ? 'QUOTE TICKET' : 'CLIENT ORDER'}
        right={
          <span className="panel__meta">
            {rfq ? `${rfq.client} · ${rfq.side} ${rfq.qty} ${rfq.symbol}` : 'SYSTEM DISPATCH'}
          </span>
        }
      />

      <div className="ticket">
        <div className="ticket__grid">
          <label className="field">
            <span className="field__label">Instrument</span>
            <input className="field__input" value={instrument.symbol} readOnly tabIndex={-1} />
          </label>

          {isMaker ? (
            <>
              <label className="field">
                <span className="field__label">Valid for (seconds)</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={validFor}
                  onChange={(event) => setValidFor(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Bid price</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={bidPrice}
                  onChange={(event) => { setTouched(true); setBidPrice(event.target.value) }}
                />
              </label>
              <label className="field">
                <span className="field__label">Offer price</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={offerPrice}
                  onChange={(event) => { setTouched(true); setOfferPrice(event.target.value) }}
                />
              </label>
              <label className="field">
                <span className="field__label">Bid volume</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={bidVolume}
                  onChange={(event) => setBidVolume(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Offer volume</span>
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
                <span className="field__label">Client</span>
                <input className="field__input" value={rfq?.client ?? 'AM-39'} readOnly tabIndex={-1} />
              </label>
              <div className="field">
                <span className="field__label">Side</span>
                <div className="segmented" role="group" aria-label="Side">
                  {(['BUY', 'SELL'] as Side[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={side === option ? 'segmented__btn segmented__btn--on' : 'segmented__btn'}
                      aria-pressed={side === option}
                      onClick={() => setSide(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="field__label">Quantity</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Limit price</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={limitPrice}
                  onChange={(event) => { setTouched(true); setLimitPrice(event.target.value) }}
                />
              </label>
              <label className="field">
                <span className="field__label">Valid for (seconds)</span>
                <input
                  className="field__input"
                  inputMode="numeric"
                  value={validFor}
                  onChange={(event) => setValidFor(event.target.value)}
                />
              </label>
            </>
          )}
        </div>

        <div className="ticket__summary">
          <div className="stat">
            <span className="stat__label">LIVE MKT</span>
            <span className="stat__value stat__value--live">
              {book.bids[0].price.toFixed(2)} / {book.asks[0].price.toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">NOTIONAL</span>
            <span className="stat__value">${money(notional)}</span>
          </div>
          <div className="stat">
            <span className="stat__label">COMMISSION</span>
            <span className="stat__value">${money(commission)}</span>
          </div>
          <div className="ticket__actions">
            <button type="button" className="btn btn--primary" onClick={onSend}>
              {isMaker ? 'SEND QUOTE' : 'FILL CLIENT ORDER'}
            </button>
            {!isMaker && (
              <button type="button" className="btn btn--danger" onClick={onDeclineClick}>
                DECLINE
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
              LIVE QUOTES
            </button>
            <button
              type="button"
              className={tab === 'old' ? 'tab tab--on' : 'tab'}
              onClick={() => setTab('old')}
              aria-pressed={tab === 'old'}
            >
              OLD QUOTES
            </button>
          </div>
          <div className="table-wrap">
            <table className="grid grid--quotes">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">SECURITY</th>
                  <th scope="col" className="num">BID VOL</th>
                  <th scope="col" className="num">BID</th>
                  <th scope="col" className="num">OFFER</th>
                  <th scope="col" className="num">OFFER VOL</th>
                  <th scope="col" className="num">VALID FOR</th>
                  <th scope="col">STATUS</th>
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
                      <span className={`badge badge--${quote.status.toLowerCase()}`}>{quote.status}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      {tab === 'live'
                        ? 'No live quotes — send one from the ticket above'
                        : 'No filled or expired quotes yet'}
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
              RECENT FILLS
            </button>
          </div>
          <div className="table-wrap">
            <table className="grid grid--quotes">
              <thead>
                <tr>
                  <th scope="col">TIME</th>
                  <th scope="col">SECURITY</th>
                  <th scope="col">SIDE</th>
                  <th scope="col" className="num">QTY</th>
                  <th scope="col" className="num">PRICE</th>
                  <th scope="col" className="num">FEE</th>
                  <th scope="col">ID</th>
                </tr>
              </thead>
              <tbody>
                {recentFills.slice(0, 4).map((fill) => (
                  <tr key={fill.id} className="row">
                    <td className="muted">{fill.time}</td>
                    <td className="strong">{fill.symbol}</td>
                    <td className={fill.side === 'BUY' ? 'num--up' : 'num--down'}>{fill.side}</td>
                    <td className="num">{fill.qty.toLocaleString('en-US')}</td>
                    <td className="num">{fill.price.toFixed(2)}</td>
                    <td className="num">{fill.fee.toFixed(2)}</td>
                    <td className="muted">{fill.id}</td>
                  </tr>
                ))}
                {recentFills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      No fills yet — the first client order will land here
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