/**
 * 台面面板（行情、盘口、派单、票据、持仓、事件流、价格带）的中文文案。
 * key 是源码里的英文原文；面板组件里统一用 `const t = useT()` 包起来。
 * 注意：SECURITY / AVG PRICE / UNREALISED / REALISED / NOTIONAL / COMMISSION
 * 已在 zh-chrome.ts 里覆盖，这里不要重复。
 */
export const zhPanels: Record<string, string> = {
  // 行情监控
  'MARKET WATCH': '行情',
  '{count} NAMES': '{count} 只标的',
  TICKER: '代码',
  LAST: '最新价',
  'CHG %': '涨跌幅',
  DRIVER: '驱动',
  'Select {symbol}': '选择 {symbol}',

  // 盘口
  'ORDER BOOK': '盘口',
  'BID SIZE': '买量',
  BID: '买价',
  ASK: '卖价',
  'ASK SIZE': '卖量',
  'SPREAD {spread} · {symbol}': '价差 {spread} · {symbol}',
  'BEST BID {price}': '买一 {price}',
  'BEST ASK {price}': '卖一 {price}',

  // 派单 / 客户流
  DISPATCH: '派单',
  'CLIENT FLOW': '客户流',
  '{count} OPEN': '{count} 笔待处理',
  'SYSTEM DISPATCH': '系统派单',
  'SYSTEM DISPATCH · AUTO-ROUTED': '系统派单 · 自动路由',
  BUY: '买入',
  SELL: '卖出',
  'Firm quote requested, client is on the line': '客户来电，要求实盘报价',
  'Client wants a two-way market': '客户要求双边报价',
  'Large size, watch your inventory': '大额委托，注意库存',
  'Client is working an index rebalance': '客户正在执行指数再平衡',
  'Urgent — client needs a price in 30 seconds': '紧急 —— 客户需在 30 秒内报价',
  'Spread-sensitive account, quote tight': '价差敏感客户，报价从紧',

  // 报价单 / 客户委托
  'QUOTE TICKET': '报价单',
  'CLIENT ORDER': '客户委托',
  '{client} · CLIENT {side} {qty} {symbol}': '{client} · 客户 {side} {qty} {symbol}',
  Instrument: '标的',
  'Valid for (seconds)': '有效期（秒）',
  'Bid price': '买价',
  'Offer price': '卖价',
  'Bid volume': '买量',
  'Offer volume': '卖量',
  Client: '客户',
  'Desk side': '台面方向',
  Side: '方向',
  Quantity: '数量',
  'Limit price': '限价',
  'Client ref': '客户单号',
  'LIVE MKT': '实时行情',
  'AVAILABLE CASH': '可用现金',
  'SEND QUOTE': '发送报价',
  'FILL CLIENT ORDER': '成交客户委托',
  DECLINE: '拒绝',

  // 报价 / 成交台账
  ID: '编号',
  TIME: '时间',
  SIDE: '方向',
  QTY: '数量',
  PRICE: '价格',
  FEE: '费用',
  STATUS: '状态',
  'BID VOL': '买量',
  OFFER: '卖价',
  'OFFER VOL': '卖量',
  'VALID FOR': '有效期',
  'LIVE QUOTES': '有效报价',
  'OLD QUOTES': '历史报价',
  'RECENT FILLS': '最近成交',
  LIVE: '有效',
  FILLED: '已成交',
  EXPIRED: '已过期',
  'No live quotes — send one from the ticket above': '暂无有效报价 —— 在上方报价单中发送',
  'No filled or expired quotes yet': '暂无已成交或已过期的报价',
  'No fills yet — the first client order will land here': '暂无成交 —— 首笔客户委托将出现在这里',

  // 持仓 / 委托 / 成交
  BOOK: '账簿',
  POSITIONS: '持仓',
  ORDERS: '委托',
  TRADES: '成交',
  'NET POS': '净持仓',
  'POS VALUE': '持仓市值',
  'NET P&L': '净盈亏',
  WORKING: '执行中',
  CANCELLED: '已取消',
  'Flat — no open positions in this session': '空仓 —— 本局暂无持仓',
  'No orders yet — book one from the ticket': '暂无委托 —— 在报价单中下一单',
  'No fills yet in this session': '本局暂无成交',

  // 事件流
  'EVENT FEED': '事件流',
  ITEM: '条',
  ITEMS: '条',
  '▲ BULLISH': '▲ 看涨',
  '▼ BEARISH': '▼ 看跌',
  'Impact {impact} of 3': '影响 {impact}/3',
  'Waiting for the next headline…': '等待下一条消息…',

  // 价格带
  'PRICE TAPE': '价格带',
  'WHY IT MOVED': '异动原因',
  'Open {symbol} from the price tape': '从价格带打开 {symbol}',
  'Waiting for the market to move…': '等待行情启动…',
}
