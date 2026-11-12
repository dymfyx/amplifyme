/**
 * 入口页 / 顶栏 / 状态栏 / 图表 / 结算报告 / 评分抽屉的中英文案。
 * key 就是源码里的英文原文；找不到时直接显示英文原文（见 src/i18n.tsx）。
 * 面板类组件（行情、盘口、派单、票据、持仓、事件流、价格带）的文案在 zh-panels.ts。
 */
export const zhChrome: Record<string, string> = {
  // 入口页
  'Market Simulation': '市场模拟',
  'Pick a desk to open the session — {minutes} minutes, 15 simulated trading days, 5 names.':
    '选一个台面开始本轮练习 —— {minutes} 分钟、15 个模拟交易日、5 只股票。',
  LANGUAGE: '语言',
  'SESSION LENGTH': '练习时长',
  'S&T · SALES': '销售交易 · 销售',
  Sales: '销售',
  'Client flow & execution': '客户流与执行',
  'Take system-dispatched client orders, price them against your book and keep the desk in the black.':
    '接系统派发的客户订单，按自己的库存报价，让交易台保持盈利。',
  'Receive auto-routed client orders': '接收自动路由的客户订单',
  'Quote one-way prices under time pressure': '在时间压力下报单边价',
  'Manage your book and hit a P&L target': '管理库存并达成盈亏目标',
  'S&T · MARKET MAKING': '销售交易 · 做市',
  'Market Maker': '做市商',
  'Two-way pricing & inventory': '双边报价与库存',
  'Stream two-way markets on five names, stay competitive on every RFQ and hedge the risk you accumulate.':
    '为五只股票连续提供双边市场，在每个询价上保持竞争力，并对冲累积的风险。',
  'Stream bid and offer with size': '带量报出买价与卖价',
  'Manage inventory and net exposure': '管理库存与净敞口',
  'Balance spread capture against adverse selection': '在赚取价差与逆向选择之间取得平衡',
  'ENTER DESK →': '进入台面 →',
  'SCENARIO · REAL-WORLD EVENT REPLAY': '情景 · 真实事件回放',
  'MARKET · EQUITIES': '市场 · 股票',
  'MODE · PRACTICE': '模式 · 练习',
  'BEGINNER GUIDE (PDF)': '新手指南（PDF）',

  // 初始持仓页
  'Opening book': '初始持仓',
  '{desk} desk · choose what inventory you start the session with — {minutes} minutes, 15 simulated trading days, 5 names.':
    '{desk}台面 · 选择本局开始时的库存 —— {minutes} 分钟、15 个模拟交易日、5 只股票。',
  FLAT: '空仓',
  'Start with no positions — build the book yourself.': '不带任何持仓开始，库存由你自己建立。',
  'CUSTOM BOOK': '自定义持仓',
  'Carry in a position per name, long or short.': '为每只股票带入一个多头或空头仓位。',
  SECURITY: '证券',
  'OPENING QTY': '初始数量',
  'AVG PRICE': '均价',
  NOTIONAL: '名义金额',
  'Negative quantity = short. Prices default to the opening print; the position is marked at that average, so P&L starts at zero.':
    '数量为负表示空头。价格默认取开盘价；仓位按该均价计价，因此 P&L 从 0 开始。',
  'OPENING GROSS': '初始总敞口',
  'OPENING NET': '初始净敞口',
  'TRADING CASH': '交易现金',
  'The opening book is separate from the $20M trading budget: it is financed at the start and only shows up in P&L. Cash moves when you trade against it.':
    '初始持仓与 2,000 万美元交易预算分开：开局时已结算，只体现在盈亏里；只有对它交易时现金才会变动。',
  '← CHANGE DESK': '← 更换台面',
  'OPEN DESK →': '开始本局 →',

  // 顶栏
  'REALISED P&L': '已实现盈亏',
  'UNREALISED P&L': '浮动盈亏',
  'NET EXPOSURE': '净敞口',
  CASH: '现金',
  COMMISSION: '佣金',
  'TOTAL P&L': '总盈亏',
  SCORE: '评分',
  RESTART: '重开',
  'EXIT DESK': '退出台面',
  'SHARED SEED': '共享种子',
  'TIME LEFT': '剩余',
  '{minutes} MIN': '{minutes} 分钟',
  'SALES DESK': '销售台面',
  'MARKET MAKING DESK': '做市台面',
  'Start a new session with a fresh random seed': '用新的随机种子重开一局',
  'Replay the same scenario from the start (same seed)': '按同一道题从 09:30 重放',

  // 状态栏
  PAUSE: '暂停',
  RESUME: '继续',
  'SIM {clock}': '模拟 {clock}',
  'DAY {day}/{total}': '第 {day}/{total} 天',
  'SPEED {speed}x': '速度 {speed}x',
  'LATENCY {latency}ms': '延迟 {latency}ms',
  'SEED {seed}': '种子 {seed}',
  'SPACE pause · 1/2/4 speed': '空格 暂停 · 1/2/4 变速',
  'Pause or resume the simulated clock': '暂停或继续模拟时钟',
  'Cycle simulation speed (1x / 2x / 4x)': '切换模拟速度（1x / 2x / 4x）',
  'Session seed — a shared link pins it, otherwise restart picks a new one':
    '本局种子 —— 分享链接会固定它，否则重开时随机',
  RUNNING: '运行中',
  PAUSED: '已暂停',
  CLOSED: '已收盘',

  // 图表
  CHARTS: '图表',
  'No events in window': '窗口内暂无事件',
  VOLUME: '成交量',

  // 评分抽屉
  'SESSION SCORECARD': '本局评分',
  'Performance snapshot': '表现快照',
  CLOSE: '关闭',
  COMPOSITE: '综合分',
  '{percentile}th percentile': '第 {percentile} 百分位',
  'PERCENTILE VS COHORT': '相对同组百分位',
  RETURNS: '收益',
  DISCIPLINE: '纪律',
  REACTION: '反应',
  RESILIENCE: '抗压',
  'TRADE MANAGEMENT': '交易管理',
  ADAPTABILITY: '适应',
  "Live read from this session's decision telemetry — every quote, fill and headline response feeds it. Press ESC to close.":
    '实时读取本局决策遥测 —— 每次报价、成交与消息响应都会计入。按 ESC 关闭。',

  // 结算报告
  'SESSION COMPLETE · {desk}': '本局结束 · {desk}',
  'Settlement report': '结算报告',
  REALISED: '已实现',
  UNREALISED: '浮动',
  'CASH LEFT': '剩余现金',
  FLOW: '成交流',
  Fills: '成交笔数',
  'Hit ratio above mid': '优于中间价的成交比例',
  'Avg edge / fill': '每笔平均价差',
  'Best / worst edge': '最佳 / 最差价差',
  'Quotes sent': '报价次数',
  'Quote width vs market': '报价宽度 / 市场价差',
  'RISK & RESPONSE': '风险与响应',
  'Peak P&L': '峰值盈亏',
  'Max drawdown': '最大回撤',
  'Avg gross exposure': '平均总敞口',
  'Net exposure at close': '收盘净敞口',
  'Median RFQ response': '询价响应中位数',
  '{ticks} ticks': '{ticks} 跳',
  'Headlines traded into': '消息后参与交易',
  'RUN ANOTHER SESSION': '再来一局',
  'REVIEW THE DESK': '查看台面',
  BENCHMARK: '基准',
  'BUY & HOLD': '买入并持有',
  'BENCHMARK P&L': '基准盈亏',
  'ALPHA VS BENCHMARK': '相对基准超额',
  'YOUR RETURN': '你的收益率',
  'BENCHMARK RETURN': '基准收益率',
  'YOU BEAT THE BENCHMARK': '跑赢基准',
  'BEHIND THE BENCHMARK': '落后基准',
  'Match the benchmark first, then size the edge.': '先追平基准，再放大优势。',
  'Equal-weight buy & hold of the five names from the opening print.':
    '五只股票按开盘价等权买入并持有的策略。',

  // 教练点评
  'Strongest: {best}. Weakest: {worst} — {advice}': '最强：{best}。最弱：{worst} —— {advice}',
  'size up the good trades and cut the ones that go against you early.': '放大顺势的交易，及早砍掉走反的仓位。',
  'quote closer to the market spread instead of shading every price.': '报价更贴近市场价差，别每笔都压价。',
  'answer RFQs faster — the first few seconds decide whether you keep the flow.':
    '更快回应询价 —— 最初几秒决定你能否留住这笔流。',
  'flatten inventory after a drawdown instead of doubling down.': '回撤后先平库存，而不是加倍下注。',
  'carry less gross risk into headlines.': '别带着过大的总敞口去面对消息。',
  'trade within {ticks} ticks of a headline instead of waiting it out.': '消息后 {ticks} 跳内就动手，而不是干等。',
  'keep the same process and repeat it.': '保持同样的流程，重复执行。',
}
