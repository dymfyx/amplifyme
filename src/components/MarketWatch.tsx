import type { Instrument } from '../types'
import PanelHeader from './PanelHeader'

interface MarketWatchProps {
  instruments: Instrument[]
  selected: string
  onSelect: (symbol: string) => void
}

const fmt = (value: number) => value.toFixed(2)

const moveClass = (move: number | undefined) => {
  if (!move) return ''
  return move > 0 ? 'tick tick--up' : 'tick tick--down'
}

export default function MarketWatch({ instruments, selected, onSelect }: MarketWatchProps) {
  return (
    <section className="panel panel--market">
      <PanelHeader
        index="1"
        title="MARKET WATCH"
        right={<span className="panel__meta">{instruments.length} NAMES</span>}
      />
      <div className="table-wrap">
        <table className="grid grid--market">
          <thead>
            <tr>
              <th scope="col">TICKER</th>
              <th scope="col" className="num">LAST</th>
              <th scope="col" className="num">CHG %</th>
              <th scope="col">TYPE</th>
            </tr>
          </thead>
          <tbody>
            {instruments.map((instrument) => {
              const isSelected = instrument.symbol === selected
              const isDown = instrument.changePct < 0
              return (
                <tr
                  key={instrument.symbol}
                  className={isSelected ? 'row row--selected' : 'row'}
                  onClick={() => onSelect(instrument.symbol)}
                  data-testid={`market-row-${instrument.symbol}`}
                >
                  <td>
                    <button type="button" className="ticker" aria-label={`Select ${instrument.symbol}`}>
                      {instrument.symbol}
                    </button>
                    <span className="ticker__name">{instrument.name}</span>
                  </td>
                  <td className="num">
                    <span key={instrument.last} className={moveClass(instrument.lastMove)}>
                      {fmt(instrument.last)}
                    </span>
                  </td>
                  <td className={isDown ? 'num num--down' : 'num num--up'}>
                    {isDown ? '▼' : '▲'} {Math.abs(instrument.changePct).toFixed(2)}%
                  </td>
                  <td className="muted">Equity</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
