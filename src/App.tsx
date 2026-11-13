import { useEffect, useState } from 'react'
import type { Role } from './types'
import { ArchiveDrawer } from './components/ArchiveDrawer'
import RoleSelect from './screens/RoleSelect'
import SessionSetup from './screens/SessionSetup'
import Terminal from './screens/Terminal'
import { DEFAULT_MINUTES, SESSION_TIERS, type OpeningPosition, type SessionMinutes } from './engine/simulation'
import { DEFAULT_SCENARIO, SCENARIOS, type Scenario } from './engine/scenarios'
import { I18nProvider, type Language } from './i18n'
import { useArchive } from './hooks/useArchive'

interface DeepLink {
  role: Role
  /** 带 ?seed=123456 时全组练同一道题；没带就是随机新局 */
  seed: number | null
  /** 链接里指定的界面语言 */
  language: Language
  /** 链接里指定的练习时长档位 */
  minutes: SessionMinutes
  /** 链接里指定的情景剧本（内置场景 id，例如 crash） */
  scenario: Scenario
}

const isLanguage = (value: string | null): value is Language => value === 'en' || value === 'zh'

const parseMinutes = (value: string | null): SessionMinutes => {
  const parsed = Number(value)
  return SESSION_TIERS.includes(parsed as SessionMinutes) ? (parsed as SessionMinutes) : DEFAULT_MINUTES
}

/**
 * 支持这几种深链：
 *   #sales / #market-maker                                                      空仓直接开台
 *   #sales?seed=20261112                                                        固定种子（同一道题，可重放）
 *   #market-maker?seed=20261112&lang=zh&minutes=5                               固定种子 + 中文界面 + 5 分钟档
 *   #market-maker?seed=20261112&scenario=crash                                  固定种子 + 崩盘剧本
 */
const readDeepLink = (): DeepLink | null => {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return null
  const [path, query = ''] = raw.split('?')
  if (path !== 'sales' && path !== 'market-maker') return null
  const params = new URLSearchParams(query)
  const seedParam = params.get('seed')
  const seed = seedParam && /^\d{1,9}$/.test(seedParam) ? Number(seedParam) : null
  const langParam = params.get('lang')
  const minutesParam = params.get('minutes')
  const scenarioParam = params.get('scenario')
  const scenario = SCENARIOS.find((item) => item.id === scenarioParam) ?? DEFAULT_SCENARIO
  return {
    role: path,
    seed,
    language: isLanguage(langParam) ? langParam : 'en',
    minutes: parseMinutes(minutesParam),
    scenario,
  }
}

export default function App() {
  const deepLink = readDeepLink()
  const archive = useArchive()
  const [role, setRole] = useState<Role | null>(deepLink?.role ?? null)
  // 深链进来时跳过开局设置，直接从空仓开台（方便截图与分享）
  const [configured, setConfigured] = useState(deepLink !== null)
  const [openingBook, setOpeningBook] = useState<OpeningPosition[]>([])
  const [seed, setSeed] = useState<number | null>(deepLink?.seed ?? null)
  // 没有深链时沿用上次的语言、时长与剧本，省得每次重选
  const [language, setLanguage] = useState<Language>(deepLink?.language ?? archive.settings.language)
  const [minutes, setMinutes] = useState<SessionMinutes>(deepLink?.minutes ?? archive.settings.minutes)
  const [scenario, setScenario] = useState<Scenario>(
    deepLink?.scenario ??
      SCENARIOS.find((item) => item.id === archive.settings.scenarioId) ??
      DEFAULT_SCENARIO,
  )
  const [archiveOpen, setArchiveOpen] = useState(false)

  // 入口上的选择立即记进设置，下次打开还是这套（saveSettings 是稳定回调，不能把 archive 放进依赖）
  const saveSettings = archive.saveSettings
  useEffect(() => {
    saveSettings({ language, minutes, scenarioId: scenario.id })
  }, [saveSettings, language, minutes, scenario.id])

  const reset = () => {
    setConfigured(false)
    setRole(null)
    setOpeningBook([])
    setSeed(null)
    window.location.hash = ''
  }

  let screen
  if (!role) {
    screen = (
      <RoleSelect
        language={language}
        minutes={minutes}
        scenario={scenario}
        archiveCount={archive.file.sessions.length}
        onLanguage={setLanguage}
        onMinutes={setMinutes}
        onScenario={setScenario}
        onOpenArchive={() => setArchiveOpen(true)}
        onSelect={(nextRole) => {
          setRole(nextRole)
          setConfigured(false)
          setSeed(null)
        }}
      />
    )
  } else if (!configured) {
    screen = (
      <SessionSetup
        role={role}
        minutes={minutes}
        onStart={(book) => {
          setOpeningBook(book)
          setConfigured(true)
        }}
        onBack={() => setRole(null)}
      />
    )
  } else {
    screen = (
      <Terminal
        role={role}
        openingBook={openingBook}
        seed={seed}
        minutes={minutes}
        scenario={scenario}
        onSessionSaved={archive.addSession}
        onExit={reset}
      />
    )
  }

  return (
    <I18nProvider lang={language}>
      {screen}
      {archiveOpen ? (
        <ArchiveDrawer
          file={archive.file}
          linked={archive.sharedLabel !== null}
          linkLabel={archive.sharedLabel}
          busy={archive.busy}
          onClose={() => setArchiveOpen(false)}
          onDelete={archive.deleteSession}
          onClear={archive.clearAll}
          onImport={archive.importText}
          onLink={() => void archive.linkSharedFile()}
          onUnlink={() => void archive.unlinkSharedFile()}
        />
      ) : null}
    </I18nProvider>
  )
}
