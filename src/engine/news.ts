import type { NewsKind } from '../types'
import { nextRandom } from './rng'

/**
 * 新闻素材与排期。
 *
 * 设计目标（P3）：
 * - 每局从剧本的「新闻池」里随机抽 N 条、随机铺时间，而不是照一条固定时间轴走；
 *   抽取只依赖 seed，所以同一个分享链接仍然可以完整复现。
 * - 标题与正文故意写得含糊：不出现「上涨/下跌/超预期/不及预期」这类直接给答案的词，
 *   玩家需要结合标的、措辞、盘口和价格反应自己判断方向。
 * - 每条都配中英两版（用户要求新闻也有中文组）和一段更长的 detail，点开才能看到。
 */

export interface NewsCopy {
  en: string
  zh: string
}

export interface NewsTemplate {
  id: string
  kind: NewsKind
  tag: string
  impact: 1 | 2 | 3
  /** 个股消息的标的；宏观消息不填 */
  symbol?: string
  /** 利好 +1 / 利空 -1；不填表示中性提示，只进新闻流、不动价格 */
  direction?: 1 | -1
  /** 这条消息最终推动价格的总幅度（基点），按标的波动率放大后释放 */
  driftBps?: number
  /** 磁带上显示的短标签（中英各一版） */
  short: NewsCopy
  /** 标题：模糊，不直接给方向 */
  headline: NewsCopy
  /** 点开详情里才看到的背景描述 */
  detail: NewsCopy
  /** 消息来源，例如 market colour / exchange notice */
  source: string
}

export type NewsPool = NewsTemplate[]

/** 一条已经排好时间的新闻，at 是 0..1 的整局位置 */
export interface ScheduledNews {
  template: NewsTemplate
  at: number
}

/**
 * 从新闻池里挑 count 条并铺满整局。
 *
 * - 用 Fisher–Yates 洗牌保证同一 seed 稳定、不同 seed 差异明显；
 * - 时间按「等分 + 抖动」生成，既不会全挤在开头，也不会出现两条同一帧；
 * - 池子里条目不足时全用上，不重复。
 */
export function scheduleNews(pool: NewsPool, seed: number, count: number): ScheduledNews[] {
  if (pool.length === 0 || count <= 0) return []
  let rng = seed
  const indices = pool.map((_, index) => index)
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const [roll, next] = nextRandom(rng)
    rng = next
    const j = Math.floor(roll * (i + 1))
    const swap = indices[i]
    indices[i] = indices[j]
    indices[j] = swap
  }

  const total = Math.min(count, pool.length)
  const picked = indices.slice(0, total).map((index) => pool[index])
  const scheduled: ScheduledNews[] = []
  const step = 0.94 / total
  for (let i = 0; i < total; i += 1) {
    const [roll, next] = nextRandom(rng)
    rng = next
    const jitter = (roll - 0.5) * step * 0.5
    let slot = 0.015 + i * step + jitter
    /* 第一条永远落在开盘后 1.2%–2% 之间：玩家 30–60 秒内一定能看到第一条头条 */
    if (i === 0) slot = Math.min(slot, 0.02)
    const at = Math.min(0.985, Math.max(0.012, slot))
    scheduled.push({ template: picked[i], at })
  }
  return scheduled
}

/** 根据界面语言挑中文/英文字段 */
export function copyText(copy: NewsCopy | undefined, lang: 'en' | 'zh'): string {
  if (!copy) return ''
  return lang === 'zh' && copy.zh ? copy.zh : copy.en
}
