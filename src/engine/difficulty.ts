import type { Role } from '../types'

/**
 * 四档难度预设表（P2.14）。
 *
 * 两个角色各自独立：SALES 是买方（S1 普通股民 → S4 江一黑天鹅），
 * MARKET MAKER 是报价方（M1 散户 → M4 大江一基金）。
 *
 * 设计原则：
 * - 第 2 档是「基准档」，数值与 P2.13 完全一致 —— 老玩家不改设置就是原来的手感；
 * - 难度不是简单乘一个系数，而是换「处境」：谁的报价更快失效、对手多聪明、
 *   你能用什么工具、库存被限制在哪；
 * - 评分公式与权重完全不随档位改变（用户明确要求），难度只体现在结果与点评上。
 */
export type TierId = 1 | 2 | 3 | 4

export type ExchangeMode = 'full' | 'reduce-only'

export interface DifficultyTier {
  id: TierId
  role: Role
  /** 英文名（界面默认语言） */
  name: string
  /** 一句话人设，界面副标题用 */
  blurb: string
  /* ---- 双方共用的成本与市场强度 ---- */
  /** 每边佣金（比例），基准 5bps */
  commissionRate: number
  /** 新闻冲击倍率 */
  newsVolMult: number
  /** 本局最多用几条头条 */
  headlineCount: number
  /** 人机强度：冲击/频率/数量都按它缩放 */
  agentSkill: number
  /** 有热度时派单里 informed 客户的比例 */
  informedShare: number
  /** 每条头条对每个名字的「抢单」概率（打掉陈旧报价） */
  snipeChance: number
  /** 知情客户成交后价格额外逆向漂移的倍率 */
  adverseDriftMult: number
  /** 单名净敞口上限（美元） */
  perNameLimit: number
  /** 总毛敞口上限（美元） */
  grossLimit: number
  /* ---- 交易所权限 ---- */
  exchangeMode: ExchangeMode
  /** 单笔交易所最大股数 */
  maxExchangeQty: number
  /** 单笔最多吃盘口的几成（1 = 不限） */
  maxExchangeBookShare: number
  /** 每局允许拒单的配额（null = 不限） */
  declineQuota: number | null
  /** 超过配额后每拒一单额外增加的客户热度 */
  declineHeat: number
  /* ---- SALES 专属 ---- */
  /** 是否允许净做空（S1 普通股民不允许） */
  allowShort: boolean
  /** 同时问价的 dealer 家数 */
  dealerCount: number
  /** 有概率掉线（回价缺失）的 dealer 家数 */
  dealerDowntime: number
  /** 回价延迟额外加几个 tick */
  dealerLatencyBonus: number
  /** 回价有效期倍率 */
  dealerValidityMult: number
  /** dealer 报价宽度倍率 */
  dealerGapMult: number
  /** 交易所 taker 价差倍率 */
  exchangeGapMult: number
  /** S4 的「流动性抽干」黑天鹅事件 */
  liquidityDrain: boolean
  /* ---- MARKET MAKER 专属 ---- */
  /** 客户派单间隔倍率（>1 更慢） */
  clientIntervalMult: number
  /** 客户单量（以 500 股为单位） */
  clientUnitsMin: number
  clientUnitsMax: number
  /** 做市台自己的交易所双边价差倍率（越小越紧） */
  makerGapMult: number
  /** 报价有效期倍率 */
  quoteTtlMult: number
  /** 排队消耗倍率（越大，别人越快排到你前面成交） */
  queueDecayMult: number
  /** 宽度惩罚倍率（越大，报得宽越难成交） */
  widthPenalty: number
  /** EST. FILL 展示抖动（0 = 精确） */
  estFillJitter: number
}

const BASE: Omit<DifficultyTier, 'id' | 'role' | 'name' | 'blurb'> = {
  commissionRate: 0.0005,
  newsVolMult: 1,
  headlineCount: 20,
  agentSkill: 1,
  informedShare: 0.55,
  snipeChance: 0,
  adverseDriftMult: 1,
  perNameLimit: 10_000_000,
  grossLimit: 18_000_000,
  exchangeMode: 'full',
  maxExchangeQty: 2_000,
  maxExchangeBookShare: 1,
  declineQuota: null,
  declineHeat: 0,
  allowShort: true,
  dealerCount: 3,
  dealerDowntime: 0,
  dealerLatencyBonus: 0,
  dealerValidityMult: 1,
  dealerGapMult: 1,
  exchangeGapMult: 1,
  liquidityDrain: false,
  clientIntervalMult: 1,
  clientUnitsMin: 1,
  clientUnitsMax: 4,
  makerGapMult: 1,
  quoteTtlMult: 1,
  queueDecayMult: 1,
  widthPenalty: 1,
  estFillJitter: 0,
}

export const SALES_TIERS: DifficultyTier[] = [
  {
    ...BASE,
    id: 1,
    role: 'sales',
    name: 'Retail punter',
    blurb: 'Small size, no shorting, and dealers are patient with you.',
    commissionRate: 0.0003,
    newsVolMult: 0.7,
    headlineCount: 16,
    agentSkill: 0.6,
    informedShare: 0.45,
    perNameLimit: 4_000_000,
    grossLimit: 8_000_000,
    maxExchangeQty: 1_000,
    allowShort: false,
    dealerValidityMult: 1.3,
    dealerGapMult: 0.8,
    exchangeGapMult: 0.8,
  },
  {
    ...BASE,
    id: 2,
    role: 'sales',
    name: 'Fast money',
    blurb: 'The standard tape: three dealers, normal costs, full tools.',
  },
  {
    ...BASE,
    id: 3,
    role: 'sales',
    name: 'Venture desk',
    blurb: 'Dealers are slower and pickier, and headlines bite harder.',
    commissionRate: 0.00065,
    newsVolMult: 1.25,
    headlineCount: 22,
    agentSkill: 1.35,
    informedShare: 0.7,
    snipeChance: 0.1,
    adverseDriftMult: 1.5,
    perNameLimit: 14_000_000,
    grossLimit: 24_000_000,
    maxExchangeQty: 5_000,
    dealerDowntime: 1,
    dealerLatencyBonus: 1,
    dealerValidityMult: 0.8,
    dealerGapMult: 1.2,
    exchangeGapMult: 1.2,
    widthPenalty: 1.3,
  },
  {
    ...BASE,
    id: 4,
    role: 'sales',
    name: 'Black-swan fund',
    blurb: 'Two dealers, short fuses, and the market can drain on you.',
    commissionRate: 0.0008,
    newsVolMult: 1.6,
    headlineCount: 24,
    agentSkill: 1.7,
    informedShare: 0.85,
    snipeChance: 0.18,
    adverseDriftMult: 1.9,
    perNameLimit: 18_000_000,
    grossLimit: 28_000_000,
    maxExchangeQty: 5_000,
    dealerCount: 2,
    dealerLatencyBonus: 2,
    dealerValidityMult: 0.6,
    dealerGapMult: 1.4,
    exchangeGapMult: 1.4,
    liquidityDrain: true,
  },
]

export const MAKER_TIERS: DifficultyTier[] = [
  {
    ...BASE,
    id: 1,
    role: 'market-maker',
    name: 'Retail shop',
    blurb: 'Tiny tickets, wide quotes, and customers who forgive you.',
    commissionRate: 0.0003,
    newsVolMult: 0.7,
    agentSkill: 0.6,
    informedShare: 0.4,
    perNameLimit: 4_000_000,
    grossLimit: 8_000_000,
    maxExchangeQty: 1_000,
    clientIntervalMult: 1.5,
    clientUnitsMin: 1,
    clientUnitsMax: 3,
    makerGapMult: 1.15,
    quoteTtlMult: 1.3,
    queueDecayMult: 1,
    widthPenalty: 1,
    estFillJitter: 0,
  },
  {
    ...BASE,
    id: 2,
    role: 'market-maker',
    name: 'Bank desk',
    blurb: 'The standard book: real flow, real size, real competition.',
    perNameLimit: 10_000_000,
    grossLimit: 18_000_000,
  },
  {
    ...BASE,
    id: 3,
    role: 'market-maker',
    name: 'Private fund',
    blurb: 'Faster flow, sharper customers, and the tape fights back.',
    commissionRate: 0.00065,
    newsVolMult: 1.25,
    agentSkill: 1.35,
    informedShare: 0.7,
    snipeChance: 0.1,
    adverseDriftMult: 1.5,
    perNameLimit: 14_000_000,
    grossLimit: 24_000_000,
    maxExchangeQty: 5_000,
    clientIntervalMult: 0.8,
    clientUnitsMin: 2,
    clientUnitsMax: 5,
    makerGapMult: 0.85,
    quoteTtlMult: 0.8,
    queueDecayMult: 1.7,
    widthPenalty: 1.3,
    estFillJitter: 0.08,
    declineQuota: 2,
    declineHeat: 2,
  },
  {
    ...BASE,
    id: 4,
    role: 'market-maker',
    name: 'Jiangyi fund',
    blurb: 'Big size, predatory flow, and a mandate that only lets you cut risk.',
    commissionRate: 0.0008,
    newsVolMult: 1.6,
    agentSkill: 1.7,
    informedShare: 0.85,
    snipeChance: 0.18,
    adverseDriftMult: 1.9,
    perNameLimit: 18_000_000,
    grossLimit: 28_000_000,
    exchangeMode: 'reduce-only',
    maxExchangeQty: 5_000,
    maxExchangeBookShare: 0.3,
    clientIntervalMult: 0.6,
    clientUnitsMin: 2,
    clientUnitsMax: 6,
    makerGapMult: 0.7,
    quoteTtlMult: 0.65,
    queueDecayMult: 2.2,
    widthPenalty: 1.6,
    estFillJitter: 0.15,
    declineQuota: 1,
    declineHeat: 3,
  },
]

export const DIFFICULTY_TIERS: Record<Role, DifficultyTier[]> = {
  sales: SALES_TIERS,
  'market-maker': MAKER_TIERS,
}

export const DEFAULT_TIER_ID: TierId = 2

export function clampTierId(value: unknown): TierId {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return DEFAULT_TIER_ID
  const rounded = Math.round(numeric)
  if (rounded < 1) return 1
  if (rounded > 4) return 4
  return rounded as TierId
}

export function tiersFor(role: Role): DifficultyTier[] {
  return DIFFICULTY_TIERS[role]
}

export function tierById(role: Role, id: TierId | number | string): DifficultyTier {
  const tiers = tiersFor(role)
  return tiers.find((tier) => tier.id === clampTierId(id)) ?? tiers[DEFAULT_TIER_ID - 1]
}

/** 结算点评的分档：≥85 传奇、70–85 优秀、60–70 稳健、45–60 毒舌、<45 惨败 */
export type VerdictBand = 'elite' | 'strong' | 'solid' | 'snark' | 'brutal'

export function verdictBand(composite: number): VerdictBand {
  if (composite >= 85) return 'elite'
  if (composite >= 70) return 'strong'
  if (composite >= 60) return 'solid'
  if (composite >= 45) return 'snark'
  return 'brutal'
}
