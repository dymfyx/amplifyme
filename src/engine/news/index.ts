import { classicNews } from './classic'
import { crashNews } from './crash'
import { creditNews } from './credit'
import { earningsNews } from './earnings'
import { fomcNews } from './fomc'
import { geopoliticsNews } from './geopolitics'
import { launchNews } from './launch'
import { mergerNews } from './merger'
import { rebalanceNews } from './rebalance'
import { squeezeNews } from './squeeze'
import type { NewsPool } from '../news'

/** 所有剧本的新闻池，UI/字典从这里按需取 */
export const NEWS_POOLS: NewsPool[] = [
  classicNews,
  fomcNews,
  earningsNews,
  crashNews,
  squeezeNews,
  mergerNews,
  rebalanceNews,
  geopoliticsNews,
  creditNews,
  launchNews,
]

/**
 * 价格带上的驱动短标签要跟着界面语言走，但它们是引擎直接产出的字符串，
 * 所以在这里把「英文 short → 中文 short」聚成一张字典，i18n 启动时并进去。
 */
export const NEWS_SHORT_ZH: Record<string, string> = Object.fromEntries(
  NEWS_POOLS.flat()
    .filter((template) => template.short.zh && template.short.zh !== template.short.en)
    .map((template) => [template.short.en, template.short.zh]),
)
