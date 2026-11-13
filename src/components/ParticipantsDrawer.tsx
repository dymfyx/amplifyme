import { useEffect } from 'react'
import type { AgentView } from '../engine/agents'
import { ARCHETYPE_LABELS } from '../engine/agents'
import { useT } from '../i18n'

interface ParticipantsDrawerProps {
  agents: AgentView[]
  onClose: () => void
}

const money = (value: number) => {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`
}

const postureLabel = (posture: -1 | 0 | 1) => (posture > 0 ? 'LONG' : posture < 0 ? 'SHORT' : 'FLAT')

const postureClass = (posture: -1 | 0 | 1) =>
  posture > 0 ? 'agent-row__posture agent-row__posture--long' : posture < 0 ? 'agent-row__posture agent-row__posture--short' : 'agent-row__posture'

/** 十个流式智能体的实时状态：谁在做方向、谁在赚、谁刚被打了一拳 */
export default function ParticipantsDrawer({ agents, onClose }: ParticipantsDrawerProps) {
  const t = useT()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const active = agents.filter((agent) => agent.lastAction !== null).length
  const totalPnl = agents.reduce((sum, agent) => sum + agent.pnl, 0)

  return (
    <div className="drawer-backdrop" onClick={onClose} data-testid="flow-backdrop">
      <aside
        className="drawer drawer--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer__head">
          <div>
            <span className="drawer__eyebrow">{t('DESK FLOW')}</span>
            <h2 id="flow-drawer-title" className="drawer__title">
              {t('Ten machines, one market')}
            </h2>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close desk flow">
            {t('CLOSE')}
          </button>
        </header>

        <div className="flow-summary">
          <span className="flow-summary__item">
            <span className="flow-summary__label">{t('ACTIVE')}</span>
            <span className="flow-summary__value">
              {active}/{agents.length}
            </span>
          </span>
          <span className="flow-summary__item">
            <span className="flow-summary__label">{t('THEIR COMBINED P&L')}</span>
            <span className={totalPnl < 0 ? 'flow-summary__value num--down' : 'flow-summary__value num--up'}>
              {money(totalPnl)}
            </span>
          </span>
          <span className="flow-summary__note">
            {t('Their flow moves the tape — and their prints land in the price tape by archetype.')}
          </span>
        </div>

        <div className="agent-table">
          <div className="agent-table__head">
            <span>{t('AGENT')}</span>
            <span>{t('TYPE')}</span>
            <span>{t('POSITION')}</span>
            <span className="agent-table__num">{t('GROSS')}</span>
            <span className="agent-table__num">{t('P&L')}</span>
            <span>{t('LAST ACTION')}</span>
          </div>
          {agents.map((agent) => (
            <div className="agent-row" key={agent.id} data-testid={`agent-${agent.id}`}>
              <span className="agent-row__name">
                {agent.name}
                <span className="agent-row__id">{agent.id}</span>
              </span>
              <span className="agent-row__type">{t(ARCHETYPE_LABELS[agent.archetype])}</span>
              <span className={postureClass(agent.posture)}>{t(postureLabel(agent.posture))}</span>
              <span className="agent-table__num agent-row__gross">{money(agent.gross)}</span>
              <span className={agent.pnl < 0 ? 'agent-table__num num--down' : 'agent-table__num num--up'}>
                {money(agent.pnl)}
              </span>
              <span className="agent-row__action">
                {agent.lastAction ? (
                  <>
                    <span className="agent-row__action-text">{agent.lastAction}</span>
                    <span className="agent-row__action-tick">@{agent.lastActionTick}</span>
                  </>
                ) : (
                  <span className="agent-row__idle">{t('waiting')}</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <p className="drawer__note">
          {t(
            'Informed agents follow fresh headlines, momentum chases, value fades, market makers lean against the move and noise trades at random. They pay the spread like everyone else.',
          )}
        </p>
      </aside>
    </div>
  )
}
