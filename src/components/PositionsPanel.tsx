import { useState } from 'react'
import type { OrderRow, Position, TradeRow } from '../types'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

type TabKey = 'positions' | 'orders' | 'trades'

interface PositionsPanelProps {
  positions: Position[]
  orders: OrderRow[]
  trades: TradeRow[]
}

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const signed = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`

export default function PositionsPanel({ positions, orders, trades }: PositionsPanelProps) {
  const t = useT()
  const [tab, setTab] = useState<TabKey>('positions')

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'positions', label: 'POSITIONS', count: positions.length },
    { key: 'orders', label: 'ORDERS', count: orders.length },
    { key: 'trades', label: 'TRADES', count: trades.length },
  ]

  return (
    <section className="panel panel--positions">
      <PanelHeader index="7" title={t('BOOK')} />
      <div className="tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'tab tab--on' : 'tab'}
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {t(item.label)} <span className="tab__count">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {tab === 'positions' && (
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">{t('SECURITY')}</th>
                <th scope="col" className="num">{t('NET POS')}</th>
                <th scope="col" className="num">{t('AVG PRICE')}</th>
                <th scope="col" className="num">{t('POS VALUE')}</th>
                <th scope="col" className="num">{t('UNREALISED')}</th>
                <th scope="col" className="num">{t('REALISED')}</th>
                <th scope="col" className="num">{t('NET P&L')}</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td className="empty" colSpan={7}>
                    {t('Flat — no open positions in this session')}
                  </td>
                </tr>
              )}
              {positions.map((position) => (
                <tr key={position.symbol} className="row">
                  <td className="strong">{position.symbol}</td>
                  <td className={position.netQty < 0 ? 'num num--down' : 'num'}>{position.netQty.toLocaleString('en-US')}</td>
                  <td className="num">{position.avgPrice ? position.avgPrice.toFixed(2) : '—'}</td>
                  <td className="num">{money(position.value)}</td>
                  <td className={position.unrealised < 0 ? 'num num--down' : 'num num--up'}>
                    {signed(position.unrealised)}
                  </td>
                  <td className={position.realised < 0 ? 'num num--down' : 'num num--up'}>
                    {signed(position.realised)}
                  </td>
                  <td className={position.netPnl < 0 ? 'num num--down' : 'num num--up'}>
                    {signed(position.netPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'orders' && (
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">{t('ID')}</th>
                <th scope="col">{t('TIME')}</th>
                <th scope="col">{t('SECURITY')}</th>
                <th scope="col">{t('SIDE')}</th>
                <th scope="col" className="num">{t('QTY')}</th>
                <th scope="col" className="num">{t('PRICE')}</th>
                <th scope="col">{t('STATUS')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td className="empty" colSpan={7}>
                    {t('No orders yet — book one from the ticket')}
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="row">
                  <td className="muted">{order.id}</td>
                  <td className="muted">{order.time}</td>
                  <td className="strong">{order.symbol}</td>
                  <td className={order.side === 'BUY' ? 'side side--buy' : 'side side--sell'}>{t(order.side)}</td>
                  <td className="num">{order.qty.toLocaleString('en-US')}</td>
                  <td className="num">{order.price.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge--${order.status.toLowerCase()}`}>{t(order.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'trades' && (
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">{t('ID')}</th>
                <th scope="col">{t('TIME')}</th>
                <th scope="col">{t('SECURITY')}</th>
                <th scope="col">{t('VENUE')}</th>
                <th scope="col">{t('SIDE')}</th>
                <th scope="col" className="num">{t('QTY')}</th>
                <th scope="col" className="num">{t('PRICE')}</th>
                <th scope="col" className="num">{t('FEE')}</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr>
                  <td className="empty" colSpan={8}>
                    {t('No fills yet in this session')}
                  </td>
                </tr>
              )}
              {trades.map((trade) => (
                <tr key={trade.id} className="row">
                  <td className="muted">{trade.id}</td>
                  <td className="muted">{trade.time}</td>
                  <td className="strong">{trade.symbol}</td>
                  <td>
                    <span className={`badge badge--${trade.venue}`}>
                      {t(trade.venue === 'client' ? 'CLIENT' : 'EXCHANGE')}
                    </span>
                  </td>
                  <td className={trade.side === 'BUY' ? 'side side--buy' : 'side side--sell'}>{t(trade.side)}</td>
                  <td className="num">{trade.qty.toLocaleString('en-US')}</td>
                  <td className="num">{trade.price.toFixed(2)}</td>
                  <td className="num">{money(trade.fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
