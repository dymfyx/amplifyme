/**
 * 会话回放抽屉（ReplayDrawer）的中文文案。
 * key 是源码里的英文原文；组件里统一用 `const t = useT()` 包起来。
 * 与 zh-chrome / zh-panels / zh-data 一样按「英文 key -> 中文」收录，
 * 由 Lead 在 src/i18n.tsx 里统一合并（本文件只负责回放相关字符串）。
 */
export const zhReplay: Record<string, string> = {
  // 抽屉标题与会话摘要
  'DECISION REVIEW': '决策复盘',
  'SESSION REPLAY': '会话回放',
  'Session replay': '会话回放',
  '{desk} · SEED {seed} · {minutes} MIN · {scenario}':
    '{desk} · 种子 {seed} · {minutes} 分钟 · {scenario}',
  CLOSE: '关闭',

  // 空状态
  'No price history yet in this session': '本场会话暂无价格历史',
  'No price history for this symbol': '该标的暂无价格历史',

  // 标的选择与图表
  'Replay symbol': '回放标的',
  '{symbol} price across the session': '{symbol} 全时段价格',
  EVENTS: '事件',
  DECISIONS: '决策',
  'FRAME {index} / {total}': '帧 {index} / {total}',

  // 播放游标
  'Replay position': '回放位置',
  FRAME: '帧',

  // 决策清单
  'DECISION LOG': '决策日志',
  'No decisions logged in this session': '本场会话暂无决策记录',
  QUOTE: '报价',
  FILL: '成交',
  DECLINE: '拒绝',

  // 底部提示
  'Click a decision to jump to that moment. Press ESC to close.':
    '点击任意决策可跳到当时画面。按 ESC 关闭。',
}
