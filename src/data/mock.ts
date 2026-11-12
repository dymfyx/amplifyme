import type { ScoreCard } from '../types'

/**
 * 评分的占位数据。
 *
 * 真实分数要等 P2 的决策遥测（报价宽度 vs 市场价差、响应 tick 数、库存偏离、纪律）
 * 接上之后才有东西可算，在那之前抽屉里先显示这份样例，避免面板空着像坏了。
 * 届时本文件可以整体删除。
 */
export const scoreCard: ScoreCard = {
  composite: 72,
  percentile: 62,
  dimensions: [
    { key: 'returns', label: 'Returns', value: 68 },
    { key: 'discipline', label: 'Discipline', value: 88 },
    { key: 'reaction', label: 'Reaction', value: 41 },
    { key: 'resilience', label: 'Resilience', value: 63 },
    { key: 'tradeManagement', label: 'Trade management', value: 74 },
    { key: 'adaptability', label: 'Adaptability', value: 55 },
  ],
}
