import type { Instrument } from '../types'
import type { PriceDriver } from '../engine/simulation'
import { useT } from '../i18n'
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
  const t = useT()
  return (
    <section className="panel panel--market">
      <PanelHeader
        index="1"
        title={t('MARKET WATCH')}
        right={<span className="panel__meta">{t('{count} NAMES', { count: instruments.length })}</span>}
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
              <th scope="col">{t('TICKER')}</th>
              <th scope="col" className="num">{t('LAST')}</th>
              <th scope="col" className="num">{t('CHG %')}</th>
              <th scope="col">{t('DRIVER')}</th>
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
                    <button
                      type="button"
                      className="ticker"
                      aria-label={t('Select {symbol}', { symbol: instrument.symbol })}
                    >
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
                        title={`${t(driver.label)} · ${driver.bps.toFixed(1)}bps · ${t(driver.hint)}`}
                        data-testid={`driver-${instrument.symbol}`}
                      >
                        <span className="driver__arrow">{driver.direction > 0 ? '▲' : '▼'}</span>
                        <span className="driver__label">{t(driver.label)}</span>
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
