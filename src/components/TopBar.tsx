import type { Pnl, Role } from '../types'

const roleLabel: Record<Role, string> = {
  sales: 'SALES DESK',
  'market-maker': 'MARKET MAKING DESK',
}

const fmt = (value: number) =>
  `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`

interface TopBarProps {
  role: Role
  pnl: Pnl
  scoreOpen: boolean
  onOpenScore: () => void
  onExit: () => void
}

export default function TopBar({ role, pnl, scoreOpen, onOpenScore, onExit }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="brand-mark brand-mark--sm">Λ</span>
        <div className="topbar__brand-text">
          <strong>Market Simulation</strong>
          <span className="topbar__desk">{roleLabel[role]}</span>
        </div>
      </div>

      <dl className="pnl-strip">
        <div className="pnl-strip__item">
          <dt>REALISED P&amp;L</dt>
          <dd>{fmt(pnl.realised)}</dd>
        </div>
        <div className="pnl-strip__item">
          <dt>UNREALISED P&amp;L</dt>
          <dd className={pnl.unrealised < 0 ? 'num--down' : 'num--up'}>{fmt(pnl.unrealised)}</dd>
        </div>
        <div className="pnl-strip__item">
          <dt>NET EXPOSURE</dt>
          <dd>{fmt(pnl.netExposure)}</dd>
        </div>
        <div className="pnl-strip__item">
          <dt>COMMISSION</dt>
          <dd>{fmt(pnl.commission)}</dd>
        </div>
        <div className="pnl-strip__item pnl-strip__item--total">
          <dt>TOTAL P&amp;L</dt>
          <dd className={pnl.total < 0 ? 'num--down' : 'num--up'}>{fmt(pnl.total)}</dd>
        </div>
      </dl>

      <div className="topbar__actions">
        <button
          type="button"
          className={scoreOpen ? 'btn btn--active' : 'btn btn--ghost'}
          onClick={onOpenScore}
          aria-expanded={scoreOpen}
        >
          SCORE
        </button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          EXIT DESK
        </button>
      </div>
    </header>
  )
}
