import { useState } from 'react'
import type { OrderRow, Position, TradeRow } from '../types'
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
  const [tab, setTab] = useState<TabKey>('positions')

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'positions', label: 'POSITIONS', count: positions.length },
    { key: 'orders', label: 'ORDERS', count: orders.length },
    { key: 'trades', label: 'TRADES', count: trades.length },
  ]

  return (
    <section className="panel panel--positions">
      <PanelHeader index="6" title="BOOK" />
      <div className="tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'tab tab--on' : 'tab'}
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label} <span className="tab__count">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {tab === 'positions' && (
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">SECURITY</th>
                <th scope="col" className="num">NET POS</th>
                <th scope="col" className="num">AVG PRICE</th>
                <th scope="col" className="num">POS VALUE</th>
                <th scope="col" className="num">UNREALISED</th>
                <th scope="col" className="num">REALISED</th>
                <th scope="col" className="num">NET P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td className="empty" colSpan={7}>
                    Flat — no open positions in this session
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
                <th scope="col">ID</th>
                <th scope="col">TIME</th>
                <th scope="col">SECURITY</th>
                <th scope="col">SIDE</th>
                <th scope="col" className="num">QTY</th>
                <th scope="col" className="num">PRICE</th>
                <th scope="col">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td className="empty" colSpan={7}>
                    No orders yet — book one from the ticket
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="row">
                  <td className="muted">{order.id}</td>
                  <td className="muted">{order.time}</td>
                  <td className="strong">{order.symbol}</td>
                  <td className={order.side === 'BUY' ? 'side side--buy' : 'side side--sell'}>{order.side}</td>
                  <td className="num">{order.qty.toLocaleString('en-US')}</td>
                  <td className="num">{order.price.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge--${order.status.toLowerCase()}`}>{order.status}</span>
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
                <th scope="col">ID</th>
                <th scope="col">TIME</th>
                <th scope="col">SECURITY</th>
                <th scope="col">SIDE</th>
                <th scope="col" className="num">QTY</th>
                <th scope="col" className="num">PRICE</th>
                <th scope="col" className="num">FEE</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr>
                  <td className="empty" colSpan={7}>
                    No fills yet in this session
                  </td>
                </tr>
              )}
              {trades.map((trade) => (
                <tr key={trade.id} className="row">
                  <td className="muted">{trade.id}</td>
                  <td className="muted">{trade.time}</td>
                  <td className="strong">{trade.symbol}</td>
                  <td className={trade.side === 'BUY' ? 'side side--buy' : 'side side--sell'}>{trade.side}</td>
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
