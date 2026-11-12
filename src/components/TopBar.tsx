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
  cash: number
  budget: number
  scoreOpen: boolean
  /** 深链带了固定种子时，提示这是全组同一道题 */
  sharedSeed: number | null
  onOpenScore: () => void
  onRestart: () => void
  onExit: () => void
}

export default function TopBar({
  role,
  pnl,
  cash,
  budget,
  scoreOpen,
  sharedSeed,
  onOpenScore,
  onRestart,
  onExit,
}: TopBarProps) {
  const cashTone = cash < budget * 0.1 ? 'num--down' : undefined
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
          <dt>CASH</dt>
          <dd className={cashTone}>{fmt(cash)}</dd>
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
        {sharedSeed !== null && (
          <span
            className="topbar__shared"
            title={`Shared seed ${sharedSeed}: everyone who opens this link gets the same scenario`}
          >
            SHARED SEED
          </span>
        )}
        <button
          type="button"
          className={scoreOpen ? 'btn btn--active' : 'btn btn--ghost'}
          onClick={onOpenScore}
          aria-expanded={scoreOpen}
        >
          SCORE
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onRestart}
          title={sharedSeed !== null ? 'Replay the same scenario from the start (same seed)' : 'Start a new session with a fresh random seed'}
        >
          RESTART
        </button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          EXIT DESK
        </button>
      </div>
    </header>
  )
}
