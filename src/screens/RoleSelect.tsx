import type { Role } from '../types'

interface RoleOption {
  id: Role
  tag: string
  title: string
  subtitle: string
  blurb: string
  bullets: string[]
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'sales',
    tag: 'S&T · SALES',
    title: 'Sales',
    subtitle: 'Client flow & execution',
    blurb: 'Take system-dispatched client orders, price them against your book and keep the desk in the black.',
    bullets: [
      'Receive auto-routed client orders',
      'Quote one-way prices under time pressure',
      'Manage your book and hit a P&L target',
    ],
  },
  {
    id: 'market-maker',
    tag: 'S&T · MARKET MAKING',
    title: 'Market Maker',
    subtitle: 'Two-way pricing & inventory',
    blurb: 'Stream two-way markets on five names, stay competitive on every RFQ and hedge the risk you accumulate.',
    bullets: [
      'Stream bid and offer with size',
      'Manage inventory and net exposure',
      'Balance spread capture against adverse selection',
    ],
  },
]

interface RoleSelectProps {
  onSelect: (role: Role) => void
}

export default function RoleSelect({ onSelect }: RoleSelectProps) {
  return (
    <main className="role-select">
      <div className="role-select__inner">
        <header className="role-select__header">
          <span className="brand-mark">Λ</span>
          <div>
            <h1 className="role-select__title">Market Simulation</h1>
            <p className="role-select__subtitle">
              Pick a desk to open the session — 30 minutes, 15 simulated trading days, 5 names.
            </p>
          </div>
        </header>

        <div className="role-grid">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="role-card"
              onClick={() => onSelect(option.id)}
              aria-label={`Start as ${option.title}`}
            >
              <span className="role-card__tag">{option.tag}</span>
              <span className="role-card__title">{option.title}</span>
              <span className="role-card__subtitle">{option.subtitle}</span>
              <span className="role-card__blurb">{option.blurb}</span>
              <span className="role-card__bullets">
                {option.bullets.map((bullet) => (
                  <span key={bullet} className="role-card__bullet">
                    <i className="role-card__tick">+</i>
                    {bullet}
                  </span>
                ))}
              </span>
              <span className="role-card__cta">ENTER DESK →</span>
            </button>
          ))}
        </div>

        <footer className="role-select__footer">
          <span>SCENARIO · REAL-WORLD EVENT REPLAY</span>
          <span>MARKET · EQUITIES</span>
          <span>MODE · PRACTICE</span>
        </footer>
      </div>
    </main>
  )
}
