import type { Pnl, Role } from '../types'
import type { SessionMinutes } from '../engine/simulation'
import { useT } from '../i18n'

const roleLabel: Record<Role, string> = {
  sales: 'SALES DESK',
  'market-maker': 'MARKET MAKING DESK',
}

const fmt = (value: number) =>
  `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`

/** 剩余真实时间，顶栏倒计时用 */
const fmtLeft = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

interface TopBarProps {
  role: Role
  pnl: Pnl
  cash: number
  budget: number
  scoreOpen: boolean
  /** 回放抽屉是否打开（按钮高亮用） */
  replayOpen: boolean
  /** 深链带了固定种子时，提示这是全组同一道题 */
  sharedSeed: number | null
  /** 练习时长档位 */
  minutes: SessionMinutes
  /** 剩余真实时间（毫秒） */
  timeLeftMs: number
  onOpenScore: () => void
  onOpenReplay: () => void
  onRestart: () => void
  onExit: () => void
}

export default function TopBar({
  role,
  pnl,
  cash,
  budget,
  scoreOpen,
  replayOpen,
  sharedSeed,
  minutes,
  timeLeftMs,
  onOpenScore,
  onOpenReplay,
  onRestart,
  onExit,
}: TopBarProps) {
  const t = useT()
  const cashTone = cash < budget * 0.1 ? 'num--down' : undefined
  const lowTime = timeLeftMs <= 30_000
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="brand-mark brand-mark--sm">Λ</span>
        <div className="topbar__brand-text">
          <strong>{t('Market Simulation')}</strong>
          <span className="topbar__desk">{t(roleLabel[role])}</span>
        </div>
      </div>

      <dl className="pnl-strip">
        <div className="pnl-strip__item">
          <dt>{t('REALISED P&L')}</dt>
          <dd>{fmt(pnl.realised)}</dd>
        </div>
        <div className="pnl-strip__item">
          <dt>{t('UNREALISED P&L')}</dt>
          <dd className={pnl.unrealised < 0 ? 'num--down' : 'num--up'}>{fmt(pnl.unrealised)}</dd>
        </div>
        <div className="pnl-strip__item">
          <dt>{t('NET EXPOSURE')}</dt>
          <dd>{fmt(pnl.netExposure)}</dd>
        </div>
        <div className="pnl-strip__item">
          <dt>{t('CASH')}</dt>
          <dd className={cashTone}>{fmt(cash)}</dd>
        </div>
        <div className="pnl-strip__item">
          <dt>{t('COMMISSION')}</dt>
          <dd>{fmt(pnl.commission)}</dd>
        </div>
        <div className="pnl-strip__item pnl-strip__item--total">
          <dt>{t('TOTAL P&L')}</dt>
          <dd className={pnl.total < 0 ? 'num--down' : 'num--up'}>{fmt(pnl.total)}</dd>
        </div>
      </dl>

      <div className="topbar__actions">
        <span className={lowTime ? 'topbar__clock topbar__clock--warn' : 'topbar__clock'}>
          <span className="topbar__clock-label">{t('TIME LEFT')}</span>
          <span className="topbar__clock-value">{fmtLeft(timeLeftMs)}</span>
          <span className="topbar__clock-tier">{t('{minutes} MIN', { minutes })}</span>
        </span>
        {sharedSeed !== null && (
          <span
            className="topbar__shared"
            title={`Shared seed ${sharedSeed}: everyone who opens this link gets the same scenario`}
          >
            {t('SHARED SEED')}
          </span>
        )}
        <button
          type="button"
          className={scoreOpen ? 'btn btn--active' : 'btn btn--ghost'}
          onClick={onOpenScore}
          aria-expanded={scoreOpen}
        >
          {t('SCORE')}
        </button>
        <button
          type="button"
          className={replayOpen ? 'btn btn--active' : 'btn btn--ghost'}
          onClick={onOpenReplay}
          aria-expanded={replayOpen}
          title={t('Replay this session frame by frame')}
        >
          {t('REPLAY')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onRestart}
          title={t(
            sharedSeed !== null
              ? 'Replay the same scenario from the start (same seed)'
              : 'Start a new session with a fresh random seed',
          )}
        >
          {t('RESTART')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          {t('EXIT DESK')}
        </button>
      </div>
    </header>
  )
}
