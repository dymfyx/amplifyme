/**
 * 情景选择器与「自定义 JSON」弹窗的中文文案。
 * key 就是源码里的英文原文，组件里统一用 useT() 包起来；查不到时回退英文。
 * 由 src/i18n.tsx 汇总（Lead 稍后接线），这里只维护字典本身。
 */
export const zhScenario: Record<string, string> = {
  // 情景选择器
  SCENARIO: '情景',
  Scenario: '情景',
  'CUSTOM JSON': '自定义 JSON',

  // 内置剧本（入口 chip 直接渲染 name / blurb）
  Classic: '经典剧本',
  'Mixed macro and single-name headlines — the standard practice tape.':
    '宏观与个股消息交替 —— 标准练习剧本。',
  'FOMC day': 'FOMC 议息日',
  'One central-bank decision drives everything; the whole board re-rates.':
    '央行一纸决议主导全天，整个盘面重新定价。',
  'Earnings surprise': '财报意外',
  'Single-name earnings gaps — quote the print, manage the inventory.':
    '个股财报跳空 —— 为财报报价，同时管好库存。',
  'Risk-off crash': '避险崩盘',
  'Wide spreads, thin books, falling tape — sell into every bounce.':
    '价差走宽、盘口变薄、行情下挫 —— 每次反弹都逢高卖出。',
  'Short squeeze': '空头挤压',
  'A crowded short unwinds violently, then fades — chase with care.':
    '拥挤的空头剧烈平仓后归于平淡 —— 追涨需谨慎。',

  // 自定义情景解析后的兜底字段
  Custom: '自定义',
  'Custom scenario imported from JSON.': '从 JSON 导入的自定义情景。',

  // 自定义 JSON 弹窗
  'CUSTOM SCENARIO': '自定义情景',
  'Custom scenario': '自定义情景',
  'Load a scenario from JSON': '从 JSON 载入情景',
  'SCENARIO JSON': '情景 JSON',
  'Invalid scenario JSON': '情景 JSON 无效',
  'USE THE EXAMPLE': '使用示例',
  CANCEL: '取消',
  'LOAD SCENARIO': '载入情景',
  'Fields: name, news[].at (0-1), kind (macro/note/equity), impact (1-3), headline, short. Optional: direction (1 or -1), symbol, driftBps, spreadMultiplier, liquidityMultiplier.':
    '字段：name，news[].at（0-1），kind（macro/note/equity），impact（1-3），headline，short。可选：direction（1 或 -1）、symbol、driftBps、spreadMultiplier、liquidityMultiplier。',
}
