import { useState } from 'react'
import type { Role } from '../types'
import { SESSION_TIERS, type SessionMinutes } from '../engine/simulation'
import { SCENARIOS, scenarioById, type Scenario } from '../engine/scenarios'
import { LANGUAGES, languageLabel, useT, type Language } from '../i18n'
import ScenarioPicker from '../components/ScenarioPicker'
import CustomScenarioModal from '../components/CustomScenarioModal'

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
  language: Language
  minutes: SessionMinutes
  scenario: Scenario
  onLanguage: (language: Language) => void
  onMinutes: (minutes: SessionMinutes) => void
  onScenario: (scenario: Scenario) => void
  /** 本地存档里已有多少条记录 */
  archiveCount: number
  onOpenArchive: () => void
  onSelect: (role: Role) => void
}

export default function RoleSelect({
  language,
  minutes,
  scenario,
  onLanguage,
  onMinutes,
  onScenario,
  archiveCount,
  onOpenArchive,
  onSelect,
}: RoleSelectProps) {
  const t = useT()
  const [customOpen, setCustomOpen] = useState(false)
  return (
    <main className="role-select">
      <div className="role-select__inner">
        <header className="role-select__header">
          <span className="brand-mark">Λ</span>
          <div>
            <h1 className="role-select__title">{t('Market Simulation')}</h1>
            <p className="role-select__subtitle">
              {t('Pick a desk to open the session — {minutes} minutes, 15 simulated trading days, 5 names.', {
                minutes,
              })}
            </p>
          </div>
        </header>

        <div className="entry-settings">
          <div className="entry-settings__group" role="group" aria-label="Language">
            <span className="entry-settings__label">{t('LANGUAGE')}</span>
            {LANGUAGES.map((option) => (
              <button
                key={option}
                type="button"
                className={language === option ? 'chip chip--on' : 'chip'}
                aria-pressed={language === option}
                aria-label={option === 'en' ? 'English' : 'Chinese'}
                onClick={() => onLanguage(option)}
              >
                {languageLabel[option]}
              </button>
            ))}
          </div>
          <div className="entry-settings__group" role="group" aria-label="Session length">
            <span className="entry-settings__label">{t('SESSION LENGTH')}</span>
            {SESSION_TIERS.map((option) => (
              <button
                key={option}
                type="button"
                className={minutes === option ? 'chip chip--on' : 'chip'}
                aria-pressed={minutes === option}
                aria-label={`${option} minute session`}
                onClick={() => onMinutes(option)}
              >
                {t('{minutes} MIN', { minutes: option })}
              </button>
            ))}
          </div>
        </div>

        <ScenarioPicker
          scenarios={SCENARIOS}
          selectedId={scenario.id}
          onSelect={(id) => onScenario(scenarioById(id))}
          onOpenCustom={() => setCustomOpen(true)}
        />

        <div className="role-grid">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="role-card"
              onClick={() => onSelect(option.id)}
              aria-label={`Start as ${option.title}`}
            >
              {/* 台面代号是行业缩写，中英文都保留原样 */}
              <span className="role-card__tag">{option.tag}</span>
              <span className="role-card__title">{t(option.title)}</span>
              <span className="role-card__subtitle">{t(option.subtitle)}</span>
              <span className="role-card__blurb">{t(option.blurb)}</span>
              <span className="role-card__bullets">
                {option.bullets.map((bullet) => (
                  <span key={bullet} className="role-card__bullet">
                    <i className="role-card__tick">+</i>
                    {t(bullet)}
                  </span>
                ))}
              </span>
              <span className="role-card__cta">{t('ENTER DESK →')}</span>
            </button>
          ))}
        </div>

        <footer className="role-select__footer">
          <span>{t('SCENARIO · REAL-WORLD EVENT REPLAY')}</span>
          <span>{t('MARKET · EQUITIES')}</span>
          <span>{t('MODE · PRACTICE')}</span>
          <button type="button" className="role-select__archive" onClick={onOpenArchive}>
            {t('ARCHIVE ({count})', { count: archiveCount })}
          </button>
          <a className="role-select__guide" href="./beginner-guide.pdf" target="_blank" rel="noreferrer">
            {t('BEGINNER GUIDE (PDF)')}
          </a>
        </footer>
      </div>

      {customOpen ? (
        <CustomScenarioModal
          onClose={() => setCustomOpen(false)}
          onLoad={(loaded) => onScenario(loaded)}
        />
      ) : null}
    </main>
  )
}
