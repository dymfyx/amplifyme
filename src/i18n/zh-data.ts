/**
 * 引擎里动态拼出来的英文（逐笔驱动标签、头条短标签、派单备注）的中文映射。
 * 这些字符串来自 src/engine/scenario.ts 的 FLOW_EVENTS / NEWS_TEMPLATES / DISPATCH_NOTES，
 * 面板里统一走 t() 渲染，查不到就回退英文。
 */
export const zhData: Record<string, string> = {
  // 面板标题
  'PRICE TAPE': '价格流水',

  // 逐笔驱动（FLOW_EVENTS.label）
  'buy flow': '买盘流入',
  'sell flow': '卖盘流出',
  'ETF bid': 'ETF 买盘',
  'ETF offer': 'ETF 卖盘',
  'short cover': '空头回补',
  'long unwind': '多头减仓',
  'retail bid': '散户买入',
  'retail sell': '散户卖出',
  'index flow': '指数资金',
  'block print': '大宗成交',
  'sweep bid': '扫单买盘',
  'sweep offer': '扫单卖盘',
  'your fill': '你的成交',

  // 逐笔驱动提示（FLOW_EVENTS.hint）
  'A broker is working a buy order in the name': '经纪商正在该股上执行买单',
  'Sell-side inventory is being worked': '卖方库存正在被消化',
  'Index rebalance flow is leaning bid': '指数调仓资金偏向买盘',
  'Index rebalance flow is leaning offer': '指数调仓资金偏向卖盘',
  'Shorts are covering into the move': '空头在上涨中回补',
  'A long is unwinding into the bid': '多头正在向买盘减仓',
  'Retail flow is leaning bid': '散户资金偏向买入',
  'Retail flow is leaning offer': '散户资金偏向卖出',
  'Index futures are driving the tape': '股指期货带动盘面',
  'A block just printed through the book': '刚有一笔大额成交穿过盘口',
  'A buyer sweeps several offers on the screen': '买方连续扫掉多个卖价',
  'A seller sweeps several bids on the screen': '卖方连续砸掉多个买价',

  // 头条短标签（NEWS_TEMPLATES.short），显示在行情表驱动列与价格流水里
  'Fed cut': '降息',
  'share gains': '份额提升',
  'risk note': '风险提示',
  'FSD investment': 'FSD 投资',
  'ad-tier signups': '广告档增长',
  'France review': '法国审查',
  'rate cut odds': '降息预期',
  'EU recall': '欧盟召回',
  'quote note': '报价提示',
  'trial miss': '试验失利',
  'yields spike': '收益率飙升',
  'content spend': '内容支出',
  'risk limits': '风险限额',
  'review extended': '审查延长',
  'FDA fast-track': 'FDA 快速通道',
  downgrade: '降级',
  'deliveries beat': '交付超预期',
  'DAU slowdown': '日活放缓',
  'guidance lift': '上调指引',
  'pricing power': '定价能力',

  // 派单备注（DISPATCH_NOTES）
  'Firm quote requested, client is on the line': '客户在线，要求实盘报价',
  'Client wants a two-way market': '客户要双边报价',
  'Large size, watch your inventory': '单子偏大，注意库存',
  'Client is working an index rebalance': '客户在执行指数调仓',
  'Urgent — client needs a price in 30 seconds': '紧急 —— 客户 30 秒内要价',
  'Spread-sensitive account, quote tight': '客户对价差敏感，报价要走窄',

  // 新闻标签（NEWS_TEMPLATES.tag）
  MACRO: '宏观',
  NOTE: '提示',

  // 评分面板 teaser 与结算入口
  'SESSION COMPLETE': '本局结束',
  'Hidden during the session · click to reveal': '盘中隐藏 · 点击查看',
  'Open the settlement report': '打开结算报告',
  'Waiting for the next headline…': '等待下一条消息…',
  'Waiting for the market to move…': '等待行情跳动…',
  'Your own size pressed the tape — the bigger the fill, the longer the drift it leaves behind.': '你自己的成交推动了价格 —— 单子越大，留下的漂移越久。',
  'EST. FILL': '预计成交率',
  'Quote width versus the market book — a wider quote is less likely to trade': '报价宽度相对市场盘口 —— 报得越宽越难成交',
}
