/**
 * 训练进展抽屉（ProgressDrawer）的中文文案。
 * 与仓库其他词典一致：key 就是源码里的英文原文，由 i18n 的 t() 直接查找；
 * 这里只维护字典本身，合并进 src/i18n.tsx 是主程序的接线工作。
 */
export const zhProgress: Record<string, string> = {
  // 抽屉框架
  PRACTICE: '训练',
  'Training progress': '训练进展',
  CLOSE: '关闭',
  Close: '关闭',

  // 概要块
  SESSIONS: '局数',
  'AVERAGE SCORE': '平均分',
  'AVERAGE ALPHA': '平均超额',
  'BEAT THE BENCHMARK': '跑赢基准',

  // 综合分走势
  'SCORE TREND': '综合分走势',

  // 分组表
  'BY DESK': '按台面',
  'BY SCENARIO': '按剧本',
  'BY TIER': '按难度',
  DESK: '台面',
  SCENARIO: '剧本',
  TIER: '难度',
  Sales: '销售',
  'Market Maker': '做市商',
  T1: '一档',
  T2: '二档',
  T3: '三档',
  T4: '四档',

  // 常犯弱点
  'MOST COMMON WEAKNESSES': '最常出现的弱点',
  'No tags recorded yet.': '还没有记录标签。',

  // 空态
  'No sessions saved yet — finish a session and it lands here.':
    '还没有保存的局——打完一局就会自动出现在这里。',
}
