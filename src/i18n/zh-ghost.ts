/**
 * 影子对比抽屉（GhostDrawer）的中文文案。
 * key 是源码里的英文原文；组件里统一用 `const t = useT()` 包起来。
 * 由 Lead 在 src/i18n.tsx 里统一合并（本文件只负责影子对比相关字符串）。
 */
export const zhGhost: Record<string, string> = {
  // 头部
  'GHOST REPLAY': '影子回放',
  'Compare a session': '同题对比',
  'Ghost compare': '影子对比',
  CLOSE: '关闭',

  // 未导入时的表单
  'Import a session file a teammate exported and line it up against your own.':
    '导入队友导出的会话文件，和自己的这一局逐项对比。',
  'Ghost session JSON': '影子会话 JSON',
  'Paste the JSON here — or pick the file below.': '把 JSON 粘贴到这里——或者选择下面的文件。',
  'Ghost session file': '影子会话文件',
  'LOAD GHOST': '载入影子',
  'That file could not be read.': '这个文件读取失败。',

  // 会话摘要
  '{desk} · {scenario} · T{tier} · {minutes} MIN · seed {seed}':
    '{desk} · {scenario} · T{tier} · {minutes} 分钟 · 种子 {seed}',
  Sales: '销售',
  'Market Maker': '做市商',

  // 对比表
  METRIC: '指标',
  YOURS: '你的',
  GHOST: '影子',
  DELTA: '差值',
  SCORE: '评分',
  PERCENTILE: '百分位',
  ALPHA: '超额',
  'TOTAL P&L': '总盈亏',
  TRADES: '成交数',

  // 标签
  'GHOST TAGS': '影子标签',
  'No tags recorded.': '没有记录标签。',

  // 决策
  'GHOST DECISIONS': '影子决策',
  'This ghost did not trade.': '这个影子没有成交。',
  QUOTE: '报价',
  FILL: '成交',
  DECLINE: '拒绝',
  '…and {count} more': '……还有 {count} 条',

  // 底部动作
  'CLEAR GHOST': '清除影子',
}
