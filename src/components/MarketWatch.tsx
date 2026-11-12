import type { Instrument } from '../types'
import type { PriceDriver } from '../engine/simulation'
import PanelHeader from './PanelHeader'

interface MarketWatchProps {
  instruments: Instrument[]
  selected: string
  drivers: Record<string, PriceDriver | null>
  onSelect: (symbol: string) => void
}

const fmt = (value: number) => value.toFixed(2)

const moveClass = (move: number | undefined) => {
  if (!move) return ''
  return move > 0 ? 'tick tick--up' : 'tick tick--down'
}

export default function MarketWatch({ instruments, selected, drivers, onSelect }: MarketWatchProps) {
  return (
    <section className="panel panel--market">
      <PanelHeader
        index="1"
        title="MARKET WATCH"
        right={<span className="panel__meta">{instruments.length} NAMES</span>}
      />
      <div className="table-wrap">
        <table className="grid grid--market">
          <colgroup>
            <col />
            <col className="col--last" />
            <col className="col--chg" />
            <col className="col--driver" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">TICKER</th>
              <th scope="col" className="num">LAST</th>
              <th scope="col" className="num">CHG %</th>
              <th scope="col">DRIVER</th>
            </tr>
          </thead>
          <tbody>
            {instruments.map((instrument) => {
              const isSelected = instrument.symbol === selected
              const isDown = instrument.changePct < 0
              const driver = drivers[instrument.symbol]
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
                  <td>
                    {driver ? (
                      <span
                        className={`driver driver--${driver.direction > 0 ? 'up' : 'down'} driver--${driver.source}`}
                        title={`${driver.label} · ${driver.bps.toFixed(1)}bps · ${driver.hint}`}
                        data-testid={`driver-${instrument.symbol}`}
                      >
                        <span className="driver__arrow">{driver.direction > 0 ? '▲' : '▼'}</span>
                        <span className="driver__label">{driver.label}</span>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
