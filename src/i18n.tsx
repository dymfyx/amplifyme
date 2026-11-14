import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { zhAgents } from './i18n/zh-agents'
import { zhArchive } from './i18n/zh-archive'
import { zhChrome } from './i18n/zh-chrome'
import { zhData } from './i18n/zh-data'
import { zhEval } from './i18n/zh-eval'
import { zhNews } from './i18n/zh-news'
import { zhPanels } from './i18n/zh-panels'
import { zhReplay } from './i18n/zh-replay'
import { zhScenario } from './i18n/zh-scenario'
import { zhTrain } from './i18n/zh-train'
import { zhClosures } from './i18n/zh-closures'
import { zhProgress } from './i18n/zh-progress'
import { zhGhost } from './i18n/zh-ghost'
import { zhLeaderboard } from './i18n/zh-leaderboard'
import { NEWS_SHORT_ZH } from './engine/news/index'

export type Language = 'en' | 'zh'

export const LANGUAGES: Language[] = ['en', 'zh']

export const languageLabel: Record<Language, string> = {
  en: 'EN',
  zh: '中文',
}

/** 所有中文文案都从这几个字典里查；英文是源码里的原文，查不到就原样输出 */
const ZH: Record<string, string> = {
  ...zhChrome,
  ...zhPanels,
  // zhTrain 的 LIVE 是「进行中」，必须在 zhPanels 之后覆盖
  ...zhTrain,
  ...zhData,
  ...zhArchive,
  ...zhScenario,
  ...zhReplay,
  ...zhAgents,
  ...zhClosures,
  ...zhProgress,
  ...zhGhost,
  ...zhLeaderboard,
  ...zhEval,
  ...zhNews,
  // 新闻池里的短标签（英文 short → 中文），放在最后，避免被别的字典覆盖
  ...NEWS_SHORT_ZH,
}

export type Translate = (text: string, vars?: Record<string, string | number>) => string

interface I18nValue {
  lang: Language
  t: Translate
}

const fill = (template: string, vars?: Record<string, string | number>): string => {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] === undefined ? match : String(vars[key]),
  )
}

/** 没有 Provider 时（组件单测）也要能填模板变量，默认按英文输出 */
const I18nContext = createContext<I18nValue>({ lang: 'en', t: (text, vars) => fill(text, vars) })

export function I18nProvider({ lang, children }: { lang: Language; children: ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: (text, vars) => fill(lang === 'zh' ? ZH[text] ?? text : text, vars),
    }),
    [lang],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = (): I18nValue => useContext(I18nContext)
export const useT = (): Translate => useContext(I18nContext).t
