import { useState } from 'react'
import type { Instrument, QuoteRow, Rfq, Role, Side } from '../types'
import { bookFor } from '../data/mock'
import PanelHeader from './PanelHeader'

const COMMISSION_RATE = 0.005

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface TradeTicketProps {
  role: Role
  instrument: Instrument
  rfq: Rfq | undefined
  quotes: QuoteRow[]
}

export default function TradeTicket({ role, instrument, rfq, quotes }: TradeTicketProps) {
  const book = bookFor(instrument)
  const [validFor, setValidFor] = useState('45')
  const [bidPrice, setBidPrice] = useState(book.bids[0].price.toFixed(2))
  const [offerPrice, setOfferPrice] = useState(book.asks[0].price.toFixed(2))
  const [bidVolume, setBidVolume] = useState('10000')
  const [offerVolume, setOfferVolume] = useState('10000')
  const [side, setSide] = useState<Side>(rfq?.side ?? 'SELL')
  const [qty, setQty] = useState(String(rfq?.qty ?? 1000))
  const [limitPrice, setLimitPrice] = useState(instrument.last.toFixed(2))
  const [tab, setTab] = useState<'live' | 'old'>('live')
  const [flash, setFlash] = useState<string | null>(null)

  const isMaker = role === 'market-maker'
  const notional = isMaker
    ? Number(offerVolume || 0) * Number(offerPrice || 0)
    : Number(qty || 0) * Number(limitPrice || 0)
  const commission = notional * COMMISSION_RATE

  const onSend = () => {
    if (isMaker) {
      setFlash(
        `QUOTE SENT · ${instrument.symbol} ${Number(bidPrice).toFixed(2)} / ${Number(
          offerPrice,
        ).toFixed(2)} · ${Number(bidVolume).toLocaleString('en-US')}×${Number(
          offerVolume,
        ).toLocaleString('en-US')} · VALID ${validFor}s`,
      )
      return
    }
    setFlash(
      `ORDER ROUTED · ${side} ${Number(qty).toLocaleString('en-US')} ${
        instrument.symbol
      } @ ${Number(limitPrice).toFixed(2)} · CLIENT ${rfq?.client ?? 'AM-39'} · VALID ${validFor}s`,
    )
  }

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
                  onChange={(event) => setBidPrice(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Offer price</span>
                <input
                  className="field__input"
                  inputMode="decimal"
                  value={offerPrice}
                  onChange={(event) => setOfferPrice(event.target.value)}
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
                  onChange={(event) => setLimitPrice(event.target.value)}
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
              <button type="button" className="btn btn--danger" onClick={() => setFlash('ORDER DECLINED')}>
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
                  No quotes in this tab
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
