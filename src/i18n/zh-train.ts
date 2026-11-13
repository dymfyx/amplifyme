/**
 * TRAIN 模式的中文文案：入口的 drill 卡片、盘中 HUD、结算里的判定卡。
 * key 就是源码里的英文原文，组件里统一 useT()；查不到时回退英文。
 * 由 src/i18n.tsx 汇总（Lead 接线），这里只维护字典本身。
 */
export const zhTrain: Record<string, string> = {
  // 通用 chrome（card kicker / HUD / 徽标）
  MODE: '模式',
  TRAIN: '训练',
  SIMULATE: '模拟',
  'START DRILL': '开始训练',
  'Pick a drill to run a focused five-minute session with a fixed seed.': '选一个训练项目，固定种子、五分钟、专注练一项。',
  LIVE: '进行中',
  'DRILL RESULT': '训练结果',
  PASSED: '通过',
  FAILED: '未通过',
  'NOT ATTEMPTED YET': '尚未尝试',
  'RETRY DRILL': '重试训练',
  'BACK TO DRILLS': '返回训练列表',

  // 记录行
  'ATTEMPTS {n} · PASSED {m}': '尝试 {n} 次 · 通过 {m} 次',
  'ATTEMPTS {n}': '尝试 {n} 次',
  'PASSED {m}': '通过 {m} 次',

  // 无障碍标签 / chip title
  'Start drill: {name}': '开始训练：{name}',
  'Drill: {name}': '训练：{name}',
  'Drill result: {name}': '训练结果：{name}',
  '{label}: {value} of {target}': '{label}：{value}，目标 {target}',

  // Drill 1 · Quote discipline
  'Quote discipline': '报价纪律',
  'Stream at least eight quotes and keep 90% of them inside 1.8x the market spread.':
    '至少挂出八次报价，并让其中 90% 落在市场价差 1.8 倍以内。',
  'Quotes sent': '报价次数',
  'Quotes inside 1.8x': '价差 1.8 倍内的报价占比',

  // Drill 2 · Headline reaction
  'Headline reaction': '消息反应',
  'Trade inside the 20-tick window on at least four of the day’s headlines.':
    '在当天至少四条消息的 20 tick 窗口内完成交易。',
  'Headlines traded': '已交易的消息数',
  'Share of headlines answered': '消息响应率',

  // Drill 3 · Inventory control
  'Inventory control': '库存控制',
  'You start long 1,500 TSLA. Be flat enough at the close: no name left above 300 shares.':
    '开局持有 1,500 股 TSLA 多头。收盘时要足够接近平仓：任何标的持仓不超过 300 股。',
  'Largest position at close': '收盘最大持仓',

  // Drill 4 · Adverse selection
  'Adverse selection': '逆向选择',
  'A risk-off tape. Get picked off at most twice and still beat buy & hold.':
    '避险行情。被逆向打掉最多两次，同时仍要跑赢买入持有。',
  'Fills run over': '立即被反向吃掉的成交数',
  'Alpha vs buy & hold': '相对买入持有的超额收益',

  // Drill 5 · Two venues
  'Two venues': '双市场',
  'Take client flow and lay it off on the exchange: hedge at least 80% of client notional and capture spread.':
    '接下客户流并在交易所对冲：至少对冲 80% 的客户名义金额，同时赚取价差。',
  'Client notional hedged on exchange': '交易所对冲的客户名义金额占比',
  'Spread capture': '价差收益',
}
