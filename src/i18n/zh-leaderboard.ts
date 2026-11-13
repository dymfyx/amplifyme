/**
 * 结算榜单（人机排名 + 本地历史）的中文文案。
 */
export const zhLeaderboard: Record<string, string> = {
  LEADERBOARD: '排行榜',
  'Leaderboard view': '榜单视图',
  'This session': '本局排名',
  'Local history': '本地历史',
  'THIS SESSION': '本局',
  'LOCAL HISTORY': '本地历史',
  TRADER: '交易员',
  RETURN: '收益率',
  'P&L': '盈亏',
  You: '你',
  'YOUR DESK': '你的台面',
  WHEN: '时间',
  SCORE: '综合分',
  'THIS RUN': '本局',
  'T{tier}': '档{tier}',
  'You are #{rank} of {total} against the machines, on return on capital.':
    '按投入资本收益率排名，你在这局排第 {rank} / {total}。',
  'Machines start with $1m, you start with $20m — the rank compares return on capital, not raw dollars.':
    '人机本金 $100 万、你的交易预算 $2000 万，所以比的是收益率而不是绝对美元。',
  'No finished sessions yet — this run becomes the first line.':
    '还没有完成的对局，这一局会成为榜单第一行。',
  'This run sits #{rank} of {total} in your local archive, by composite score.':
    '按综合分排，这一局在本地存档里排第 {rank} / {total}。',
}
