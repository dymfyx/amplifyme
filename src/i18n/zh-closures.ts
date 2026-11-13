/**
 * 练习闭环（目标卡 / 盈亏归因 / 进度 / 同题对比）的中文文案。
 * key 与英文原文一致，查不到时 i18n 会回退英文。
 */
export const zhClosures: Record<string, string> = {
  'SESSION GOALS': '本局目标',
  'P&L ATTRIBUTION': '盈亏归因',
  'Client spread': '客户价差',
  Commission: '佣金',
  'Taker cost (spread + impact)': '主动成交成本（价差 + 冲击）',
  'Inventory & drift': '库存与漂移',
  'EXPORT GHOST': '导出对比',
  'COMPARE GHOST': '对比复盘',
  'IMPORT GHOST': '导入对比',
  PROGRESS: '进度',
  'at least {value}': '至少 {value}',
  'at most {value}': '至多 {value}',
  'Goals do not change the score — they just tell you what to watch this session.':
    '目标不改变评分，只是提醒你这一局该盯什么。',
  'Could not read that replay file.': '这个对比文件读不出来。',

  'Dealer fills': '交易对手成交',
  'Hit at least two prices you shopped around for instead of taking the first one.':
    '至少从问过的价格里成交两次，而不是拿到第一个报价就点。',
  'Entry vs mid': '进场相对中间价',
  'Average entry should be at or better than the mid, not worse.':
    '平均进场价应当不差于中间价。',
  'Alpha vs buy & hold': '相对买入持有的超额',
  'Beat the passive equal-weight benchmark.': '跑赢等权买入持有的被动基准。',
  'Max drawdown': '最大回撤',
  'Keep the peak-to-trough loss inside the mandate.': '把峰谷回撤控制在授权额度内。',
  'Quotes sent': '报价次数',
  'Keep the market making desk visible: at least eight two-way prices.':
    '让做市台保持在场：至少报出八次双边价。',
  'Quotes inside 1.8x the market': '1.8 倍市场价差内的报价',
  'Competitive pricing: at least 90% of your quotes inside 1.8x the market spread.':
    '报价要有竞争力：至少九成的报价落在 1.8 倍市场价差以内。',
  'Net exposure at the close': '收盘净敞口',
  'Do not carry a one-way book into the close.': '别把单边库存带进收盘。',
}
