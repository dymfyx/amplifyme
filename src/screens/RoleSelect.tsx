import { useState } from 'react'
import type { Role } from '../types'
import { SESSION_TIERS, type SessionMinutes } from '../engine/simulation'
import { SCENARIOS, scenarioById, type Scenario } from '../engine/scenarios'
import { tiersFor, tierById, type TierId } from '../engine/difficulty'
import { LANGUAGES, languageLabel, useT, type Language } from '../i18n'
import ScenarioPicker from '../components/ScenarioPicker'
import DrillPicker from '../components/DrillPicker'
import { DRILLS, type DrillId } from '../train/drills'
import type { DrillRecords } from '../train/records'
import CustomScenarioModal from '../components/CustomScenarioModal'
import HomeLeaderboard from '../components/HomeLeaderboard'
import type { ArchivedSession } from '../storage/archive'

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
    subtitle: 'Buy-side execution & RFQ',
    blurb: 'Shop three dealers for a price, trade the exchange yourself and beat the mid — and the benchmark.',
    bullets: [
      'Ask three dealers for a two-way price',
      'Hit the best dealer quote or take liquidity',
      'Trade the exchange at a taker price and beat it',
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

export type EntryMode = 'simulate' | 'train'

interface RoleSelectProps {
  language: Language
  minutes: SessionMinutes
  scenario: Scenario
  onLanguage: (language: Language) => void
  onMinutes: (minutes: SessionMinutes) => void
  onScenario: (scenario: Scenario) => void
  /** 入口模式：自由模拟，或按 drill 训练 */
  mode: EntryMode
  onMode: (mode: EntryMode) => void
  /** 训练模式的记录（只用于卡片上的最佳成绩） */
  drillRecords: DrillRecords
  onStartDrill: (id: DrillId) => void
  /** 两个台面各自记住的难度档位 */
  tiers: Record<Role, TierId>
  onTier: (role: Role, id: TierId) => void
  /** 本地存档里已有多少条记录 */
  archiveCount: number
  onOpenArchive: () => void
  /** 打开跨局趋势面板 */
  onOpenProgress: () => void
  /** 本地存档（首页历史榜用） */
  sessions: ArchivedSession[]
  onSelect: (role: Role) => void
}

export default function RoleSelect({
  language,
  minutes,
  scenario,
  mode,
  onMode,
  drillRecords,
  onStartDrill,
  onLanguage,
  onMinutes,
  onScenario,
  tiers,
  onTier,
  archiveCount,
  onOpenArchive,
  onOpenProgress,
  sessions,
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
              {mode === 'train'
                ? t('Pick a drill to run a focused five-minute session with a fixed seed.')
                : t('Pick a desk to open the session — {minutes} minutes, 15 simulated trading days, 5 names.', {
                    minutes,
                  })}
            </p>
          </div>
        </header>

        <div className="entry-settings">
          <div className="entry-settings__group" role="group" aria-label="Mode">
            <span className="entry-settings__label">{t('MODE')}</span>
            <button
              type="button"
              className={mode === 'simulate' ? 'chip chip--on' : 'chip'}
              aria-pressed={mode === 'simulate'}
              aria-label="Simulate mode"
              onClick={() => onMode('simulate')}
            >
              {t('SIMULATE')}
            </button>
            <button
              type="button"
              className={mode === 'train' ? 'chip chip--on' : 'chip'}
              aria-pressed={mode === 'train'}
              aria-label="Train mode"
              onClick={() => onMode('train')}
            >
              {t('TRAIN')}
            </button>
          </div>
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
          {mode === 'simulate' ? (
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
          ) : null}
        </div>

        {mode === 'train' ? (
          <DrillPicker drills={DRILLS} best={drillRecords} onStart={onStartDrill} />
        ) : (
          <>
            <ScenarioPicker
              scenarios={SCENARIOS}
              selectedId={scenario.id}
              onSelect={(id) => onScenario(scenarioById(id))}
              onOpenCustom={() => setCustomOpen(true)}
            />

            <div className="role-grid">
              {ROLE_OPTIONS.map((option) => {
                const selectedTier = tierById(option.id, tiers[option.id])
                return (
                  <div key={option.id} className="role-card">
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

                    <div className="role-card__difficulty" role="group" aria-label={`${option.title} difficulty`}>
                      <span className="entry-settings__label">{t('DIFFICULTY')}</span>
                      <div className="role-card__tiers">
                        {tiersFor(option.id).map((tier) => (
                          <button
                            key={tier.id}
                            type="button"
                            className={tier.id === tiers[option.id] ? 'chip chip--on' : 'chip'}
                            aria-pressed={tier.id === tiers[option.id]}
                            aria-label={`${option.title} difficulty: ${tier.name}`}
                            onClick={() => onTier(option.id, tier.id)}
                          >
                            {t(tier.name)}
                          </button>
                        ))}
                      </div>
                      <span className="role-card__tier-blurb">{t(selectedTier.blurb)}</span>
                    </div>

                    <button
                      type="button"
                      className="role-card__cta"
                      onClick={() => onSelect(option.id)}
                      aria-label={`Start as ${option.title}`}
                    >
                      {t('ENTER DESK →')}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <HomeLeaderboard sessions={sessions} onOpenArchive={onOpenArchive} />

        <footer className="role-select__footer">
          <span>{t('SCENARIO · REAL-WORLD EVENT REPLAY')}</span>
          <span>{t('MARKET · EQUITIES')}</span>
          <span>{t('MODE · PRACTICE')}</span>
          <button type="button" className="role-select__archive" onClick={onOpenArchive}>
            {t('ARCHIVE ({count})', { count: archiveCount })}
          </button>
          <button type="button" className="role-select__archive" onClick={onOpenProgress}>
            {t('PROGRESS')}
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
