import type { Instrument } from '../types'
import { bookFor } from '../data/mock'
import PanelHeader from './PanelHeader'

interface BookPanelProps {
  instrument: Instrument
}

export default function BookPanel({ instrument }: BookPanelProps) {
  const book = bookFor(instrument)
  const bestBid = book.bids[0]
  const bestAsk = book.asks[0]
  const spread = (bestAsk.price - bestBid.price).toFixed(2)
  const maxSize = Math.max(...book.bids.map((level) => level.size), ...book.asks.map((level) => level.size))
  const depthWidth = (size: number) => `${Math.max(8, Math.round((size / maxSize) * 100))}%`

  return (
    <section className="panel panel--book">
      <PanelHeader
        index="2"
        title="ORDER BOOK"
        right={<span className="panel__meta">{instrument.symbol}</span>}
      />
      <table className="grid grid--book">
        <thead>
          <tr>
            <th scope="col" className="num">BID SIZE</th>
            <th scope="col" className="num">BID</th>
            <th scope="col" className="num">ASK</th>
            <th scope="col" className="num">ASK SIZE</th>
            <th scope="col" className="cell-depth-head">
              DEPTH
            </th>
          </tr>
        </thead>
        <tbody>
          {[...book.asks].reverse().map((level) => (
            <tr key={`ask-${level.price}`} className="row row--ask">
              <td className="num muted">—</td>
              <td className="num muted">—</td>
              <td className="num num--down">{level.price.toFixed(2)}</td>
              <td className="num">{level.size.toLocaleString('en-US')}</td>
              <td className="cell-depth">
                <span className="depth-bar depth-bar--ask" style={{ width: depthWidth(level.size) }} />
              </td>
            </tr>
          ))}
          <tr className="row row--spread">
            <td colSpan={5} className="spread">
              SPREAD {spread} · {instrument.symbol}
            </td>
          </tr>
          {book.bids.map((level) => (
            <tr key={`bid-${level.price}`} className="row row--bid">
              <td className="num">{level.size.toLocaleString('en-US')}</td>
              <td className="num num--up">{level.price.toFixed(2)}</td>
              <td className="num muted">—</td>
              <td className="num muted">—</td>
              <td className="cell-depth">
                <span className="depth-bar depth-bar--bid" style={{ width: depthWidth(level.size) }} />
              </td>
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
