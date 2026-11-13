import { useState } from 'react'
import type { Role } from '../types'
import { UNIVERSE } from '../engine/scenario'
import {
  DEFAULT_MINUTES,
  STARTING_CASH,
  type OpeningPosition,
  type SessionMinutes,
} from '../engine/simulation'
import { useT } from '../i18n'
import { formatGoalValue, type SessionGoal } from '../engine/goals'

type Mode = 'flat' | 'custom'

interface DraftRow {
  qty: string
  price: string
}

interface SessionSetupProps {
  role: Role
  /** 开局目标卡：这一局要盯的 3–4 个目标（不参与评分） */
  goals?: SessionGoal[]
  minutes?: SessionMinutes
  onStart: (openingBook: OpeningPosition[]) => void
  onBack: () => void
}

const money = (value: number) =>
  `${value < 0 ? '-$' : '$'}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const ROLE_LABEL: Record<Role, string> = {
  sales: 'Sales',
  'market-maker': 'Market Maker',
}

const emptyDrafts = (): Record<string, DraftRow> =>
  Object.fromEntries(
    UNIVERSE.map((entry) => [entry.symbol, { qty: '', price: entry.last.toFixed(2) }]),
  )

export default function SessionSetup({
  role,
  goals = [],
  minutes = DEFAULT_MINUTES,
  onStart,
  onBack,
}: SessionSetupProps) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('flat')
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>(emptyDrafts)

  const rows = UNIVERSE.map((entry) => {
    const draft = drafts[entry.symbol]
    const qty = Number(draft.qty)
    const price = Number(draft.price)
    const valid = draft.qty.trim() !== '' && Number.isFinite(qty) && qty !== 0 && Number.isFinite(price) && price > 0
    return {
      symbol: entry.symbol,
      name: entry.name,
      qty: valid ? Math.trunc(qty) : 0,
      price: valid ? price : 0,
      notional: valid ? Math.trunc(qty) * price : 0,
    }
  })

  const openingBook: OpeningPosition[] =
    mode === 'custom'
      ? rows
          .filter((row) => row.qty !== 0 && row.price > 0)
          .map((row) => ({ symbol: row.symbol, netQty: row.qty, avgPrice: row.price }))
      : []

  const gross = openingBook.reduce((total, row) => total + Math.abs(row.netQty * row.avgPrice), 0)
  const net = openingBook.reduce((total, row) => total + row.netQty * row.avgPrice, 0)

  const update = (symbol: string, patch: Partial<DraftRow>) => {
    setDrafts((previous) => ({ ...previous, [symbol]: { ...previous[symbol], ...patch } }))
  }

  return (
    <main className="role-select">
      <div className="role-select__inner setup">
        <header className="setup__header">
          <span className="brand-mark">Λ</span>
          <div>
            <h1 className="role-select__title">{t('Opening book')}</h1>
            <p className="role-select__subtitle">
              {t(
                '{desk} desk · choose what inventory you start the session with — {minutes} minutes, 15 simulated trading days, 5 names.',
                { desk: t(ROLE_LABEL[role]), minutes },
              )}
            </p>
          </div>
        </header>

        <div className="setup__modes" role="group" aria-label="Opening book">
          <button
            type="button"
            className={mode === 'flat' ? 'setup__mode setup__mode--on' : 'setup__mode'}
            aria-pressed={mode === 'flat'}
            onClick={() => setMode('flat')}
          >
            <span className="setup__mode-title">{t('FLAT')}</span>
            <span className="setup__mode-note">{t('Start with no positions — build the book yourself.')}</span>
          </button>
          <button
            type="button"
            className={mode === 'custom' ? 'setup__mode setup__mode--on' : 'setup__mode'}
            aria-pressed={mode === 'custom'}
            onClick={() => setMode('custom')}
          >
            <span className="setup__mode-title">{t('CUSTOM BOOK')}</span>
            <span className="setup__mode-note">{t('Carry in a position per name, long or short.')}</span>
          </button>
        </div>

        {mode === 'custom' && (
          <div className="setup__table">
            <table className="grid grid--setup">
              <thead>
                <tr>
                  <th scope="col">{t('SECURITY')}</th>
                  <th scope="col" className="num">
                    {t('OPENING QTY')}
                  </th>
                  <th scope="col" className="num">
                    {t('AVG PRICE')}
                  </th>
                  <th scope="col" className="num">
                    {t('NOTIONAL')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.symbol} className="row">
                    <td>
                      <span className="strong">{row.symbol}</span>
                      <span className="setup__name">{row.name}</span>
                    </td>
                    <td className="num">
                      <input
                        className="field__input setup__input"
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`${row.symbol} opening quantity`}
                        value={drafts[row.symbol].qty}
                        onChange={(event) => update(row.symbol, { qty: event.target.value })}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="field__input setup__input"
                        inputMode="decimal"
                        aria-label={`${row.symbol} average price`}
                        value={drafts[row.symbol].price}
                        onChange={(event) => update(row.symbol, { price: event.target.value })}
                      />
                    </td>
                    <td className={row.notional < 0 ? 'num num--down' : 'num'}>
                      {row.notional === 0 ? '—' : money(row.notional)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="setup__hint">
              {t(
                'Negative quantity = short. Prices default to the opening print; the position is marked at that average, so P&L starts at zero.',
              )}
            </p>
          </div>
        )}

        <div className="setup__summary">
          <div className="setup__stat">
            <span className="setup__stat-label">{t('OPENING GROSS')}</span>
            <span className="setup__stat-value">{money(gross)}</span>
          </div>
          <div className="setup__stat">
            <span className="setup__stat-label">{t('OPENING NET')}</span>
            <span className={net < 0 ? 'setup__stat-value num--down' : 'setup__stat-value'}>
              {money(net)}
            </span>
          </div>
          <div className="setup__stat">
            <span className="setup__stat-label">{t('TRADING CASH')}</span>
            <span className="setup__stat-value">{money(STARTING_CASH)}</span>
          </div>
        </div>

        {goals.length > 0 ? (
          <div className="setup__goals" data-testid="setup-goals">
            <span className="setup__stat-label">{t('SESSION GOALS')}</span>
            <ul className="setup__goal-list">
              {goals.map((goal) => (
                <li key={goal.id} className="setup__goal">
                  <span className="setup__goal-label">{t(goal.label)}</span>
                  <span className="setup__goal-target">
                    {goal.compare === 'gte'
                      ? t('at least {value}', { value: formatGoalValue(goal.target, goal.unit) })
                      : t('at most {value}', { value: formatGoalValue(goal.target, goal.unit) })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="setup__hint">
              {t('Goals do not change the score — they just tell you what to watch this session.')}
            </p>
          </div>
        ) : null}

        <p className="setup__hint setup__hint--wide">
          {t(
            'The opening book is separate from the $20M trading budget: it is financed at the start and only shows up in P&L. Cash moves when you trade against it.',
          )}
        </p>

        <div className="setup__actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            {t('← CHANGE DESK')}
          </button>
          <button
            type="button"
            className="btn btn--primary setup__start"
            aria-label={`Open the ${ROLE_LABEL[role]} desk`}
            onClick={() => onStart(openingBook)}
          >
            {t('OPEN DESK →')}
          </button>
        </div>
      </div>
    </main>
  )
}
