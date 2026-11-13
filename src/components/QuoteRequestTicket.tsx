import { useState } from 'react'
import type { Instrument, Side, TradeRow } from '../types'
import type { DealerRequestInput } from '../engine/simulation'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface QuoteRequestTicketProps {
  instrument: Instrument
  cash: number
  recentFills: TradeRow[]
  /** 向 dealer 发 RFQ，返回引擎结果文案 */
  onRequest: (input: DealerRequestInput) => string
}

/**
 * Sales 的询价票据：不再给别人报价，而是向 dealer 要价。
 *
 * 选标的、方向、数量后 SEND RFQ，三家 dealer 会陆续回价（面板 3 显示），
 * 回价有延迟与有效期，数量也可能不足以覆盖你要的量。
 */
export default function QuoteRequestTicket({
  instrument,
  cash,
  recentFills,
  onRequest,
}: QuoteRequestTicketProps) {
  const t = useT()
  const [side, setSide] = useState<Side>('BUY')
  const [qty, setQty] = useState('2000')
  const [flash, setFlash] = useState<string | null>(null)
  const [tab, setTab] = useState<'request' | 'fills'>('request')

  const requested = Math.trunc(Number(qty) || 0)
  const notional = requested * instrument.last

  const submit = () => {
    setFlash(onRequest({ symbol: instrument.symbol, side, qty: requested }))
  }

  return (
    <section className="panel panel--ticket">
      <PanelHeader
        index="4"
        title={t('REQUEST QUOTE')}
        right={
          <span className="panel__meta">
            {instrument.symbol} · {instrument.name} · {t('RFQ OUT')}
          </span>
        }
      />

      <div className="ticket">
        <div className="tabs">
          <button
            type="button"
            className={tab === 'request' ? 'tab tab--on' : 'tab'}
            onClick={() => setTab('request')}
          >
            {t('RFQ')}
          </button>
          <button
            type="button"
            className={tab === 'fills' ? 'tab tab--on' : 'tab'}
            onClick={() => setTab('fills')}
          >
            {t('RECENT FILLS')}
          </button>
        </div>

        {tab === 'request' ? (
          <>
            <div className="ticket__grid">
              <label className="field">
                <span className="field__label">{t('Instrument')}</span>
                <input className="field__input" value={instrument.symbol} readOnly tabIndex={-1} />
              </label>
              <div className="field">
                <span className="field__label">{t('We want to')}</span>
                <div className="segmented" role="group" aria-label={t('We want to')}>
                  {(['BUY', 'SELL'] as Side[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={side === option ? 'segmented__btn segmented__btn--on' : 'segmented__btn'}
                      aria-pressed={side === option}
                      aria-label={t(`We want to ${option}`)}
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
                  aria-label={t('Quantity')}
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('Indicative price')}</span>
                <input className="field__input" value={instrument.last.toFixed(2)} readOnly tabIndex={-1} />
              </label>
            </div>

            <div className="ticket__summary">
              <div className="stat">
                <span className="stat__label">{t('NOTIONAL')}</span>
                <span className="stat__value">${money(notional)}</span>
              </div>
              <div className="stat" title={t('Three dealers answer at once with their own two-way price')}>
                <span className="stat__label">{t('DEALERS ASKED')}</span>
                <span className="stat__value stat__value--live">3</span>
              </div>
              <div className="stat">
                <span className="stat__label">{t('AVAILABLE CASH')}</span>
                <span className="stat__value stat__value--live">${money(cash)}</span>
              </div>
              <div className="ticket__actions">
                <button type="button" className="btn btn--primary" onClick={submit} disabled={requested <= 0}>
                  {t('SEND RFQ')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="table-wrap">
            <table className="grid grid--trades">
              <thead>
                <tr>
                  <th>{t('TIME')}</th>
                  <th>{t('SECURITY')}</th>
                  <th>{t('VENUE')}</th>
                  <th>{t('SIDE')}</th>
                  <th>{t('QTY')}</th>
                  <th>{t('PRICE')}</th>
                  <th>{t('FEE')}</th>
                  <th>{t('ID')}</th>
                </tr>
              </thead>
              <tbody>
                {recentFills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      {t('No fills yet — hit a dealer quote or the exchange')}
                    </td>
                  </tr>
                ) : (
                  recentFills.map((fill) => (
                    <tr key={fill.id}>
                      <td>{fill.time}</td>
                      <td>{fill.symbol}</td>
                      <td>
                        <span className={`badge badge--${fill.venue}`}>
                          {t(fill.venue === 'client' ? 'CLIENT' : fill.venue === 'dealer' ? 'DEALER' : 'EXCHANGE')}
                        </span>
                      </td>
                      <td>{t(fill.side)}</td>
                      <td>{fill.qty.toLocaleString('en-US')}</td>
                      <td>{fill.price.toFixed(2)}</td>
                      <td>{money(fill.fee)}</td>
                      <td>{fill.id}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {flash ? (
          <p className={flash.includes('REJECTED') ? 'ticket__flash ticket__flash--warn' : 'ticket__flash'} role="status">
            {flash}
          </p>
        ) : null}
      </div>
    </section>
  )
}
