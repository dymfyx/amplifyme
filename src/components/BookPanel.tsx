import type { CSSProperties } from 'react'
import type { Book } from '../types'
import PanelHeader from './PanelHeader'

interface BookPanelProps {
  symbol: string
  book: Book
}

export default function BookPanel({ symbol, book }: BookPanelProps) {
  const bestBid = book.bids[0]
  const bestAsk = book.asks[0]
  const spread = (bestAsk.price - bestBid.price).toFixed(2)
  const maxSize = Math.max(...book.bids.map((level) => level.size), ...book.asks.map((level) => level.size))
  const depthStyle = (size: number): CSSProperties =>
    ({ '--depth': `${Math.max(6, Math.round((size / maxSize) * 100))}%` }) as unknown as CSSProperties

  return (
    <section className="panel panel--book">
      <PanelHeader index="2" title="ORDER BOOK" right={<span className="panel__meta">{symbol}</span>} />
      <table className="grid grid--book">
        <thead>
          <tr>
            <th scope="col" className="num">BID SIZE</th>
            <th scope="col" className="num">BID</th>
            <th scope="col" className="num">ASK</th>
            <th scope="col" className="num">ASK SIZE</th>
          </tr>
        </thead>
        <tbody>
          {[...book.asks].reverse().map((level) => (
            <tr key={`ask-${level.price}`} className="row row--ask" style={depthStyle(level.size)}>
              <td className="num muted">—</td>
              <td className="num muted">—</td>
              <td className="num num--down">{level.price.toFixed(2)}</td>
              <td className="num">{level.size.toLocaleString('en-US')}</td>
            </tr>
          ))}
          <tr className="row row--spread">
            <td colSpan={4} className="spread">
              SPREAD {spread} · {symbol}
            </td>
          </tr>
          {book.bids.map((level) => (
            <tr key={`bid-${level.price}`} className="row row--bid" style={depthStyle(level.size)}>
              <td className="num">{level.size.toLocaleString('en-US')}</td>
              <td className="num num--up">{level.price.toFixed(2)}</td>
              <td className="num muted">—</td>
              <td className="num muted">—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="panel__foot">
        <span>BEST BID {bestBid.price.toFixed(2)}</span>
        <span>BEST ASK {bestAsk.price.toFixed(2)}</span>
      </footer>
    </section>
  )
}
