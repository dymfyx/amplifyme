import type { PriceChangeRecord } from '../engine/simulation'
import { useT } from '../i18n'
import PanelHeader from './PanelHeader'

interface PriceTapeProps {
  changes: PriceChangeRecord[]
  selected: string
  onSelect: (symbol: string) => void
}

/** 每次行情刷新都会留一行：谁在推、推了多少，点行可切到该标的 */
export default function PriceTape({ changes, selected, onSelect }: PriceTapeProps) {
  const t = useT()
  return (
    <section className="panel panel--tape">
      <PanelHeader
        index="7"
        title={t('PRICE TAPE')}
        right={<span className="panel__meta">{t('WHY IT MOVED')}</span>}
      />
      <ol className="tape">
        {[...changes].reverse().map((change) => (
          <li
            key={change.id}
            className={`tape__row tape__row--${change.direction > 0 ? 'up' : 'down'}${
              change.symbol === selected ? ' tape__row--selected' : ''
            }`}
          >
            <button
              type="button"
              className="tape__hit"
              onClick={() => onSelect(change.symbol)}
              aria-label={t('Open {symbol} from the price tape', { symbol: change.symbol })}
            >
              <span className="tape__time">{change.time}</span>
              <span className="tape__symbol">{change.symbol}</span>
              <span className={`tape__pct tape__pct--${change.direction > 0 ? 'up' : 'down'}`}>
                {change.pct > 0 ? '+' : ''}
                {change.pct.toFixed(2)}%
              </span>
              <span className="tape__why">
                {change.drivers.slice(0, 2).map((driver) => (
                  <span
                    key={`${driver.label}-${driver.source}`}
                    className={`tape__chip tape__chip--${driver.direction > 0 ? 'up' : 'down'} tape__chip--${driver.source}`}
                    title={t(driver.hint)}
                  >
                    {t(driver.label)}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
        {changes.length === 0 ? (
          <li className="tape__empty">
            <p className="muted">{t('Waiting for the market to move…')}</p>
          </li>
        ) : null}
      </ol>
    </section>
  )
}
