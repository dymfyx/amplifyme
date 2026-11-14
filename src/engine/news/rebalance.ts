import type { NewsPool } from '../news'

/**
 * Rebalance：指数调整日。
 * 公告、被动资金估算、收盘集合竞价失衡、ETF 申赎和做市商库存轮流主导盘面，
 * 生效日收盘之后再反转。标题只给流程和数据，不给价格方向。
 */
export const rebalanceNews: NewsPool = [
  {
    id: 'RB1',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'index calendar', zh: '指数日历' },
    headline: {
      en: 'The index review calendar puts the effective date this week',
      zh: '指数评审日历把生效日定在本周',
    },
    detail: {
      en: 'The provider publishes changes after the close and the new weights take effect at the next rebalance. Between the two dates there is a window in which index funds must trade and nobody else has to. The estimate of the flow published by the desk goes to clients with a caveat about tracking-error trades, which are never quite as mechanical as they look.',
      zh: '指数提供商在收盘后公布变动，新权重在下一个再平衡日生效。两个日期之间存在一个窗口：指数基金必须交易，而其他人不必。交易台发给客户的资金流估算附了一段关于跟踪误差交易的说明——这类交易从来不像看起来那么机械。',
    },
    source: 'exchange notice',
  },
  {
    id: 'RB2',
    kind: 'equity',
    tag: 'DUOL',
    impact: 3,
    symbol: 'DUOL',
    direction: 1,
    driftBps: 130,
    short: { en: 'index shortlist', zh: '指数候选' },
    headline: {
      en: 'Duolingo appears on the index review shortlist',
      zh: '多邻国出现在指数评审候选名单上',
    },
    detail: {
      en: 'The shortlist is not the final list, and this provider has changed its mind at this stage before. Inclusion would put the stock in front of a pool of money that does not choose names, and the free float is small enough that the flow is large relative to daily volume. The announcement is due after the close, and the desk will publish a revised estimate within the hour.',
      zh: '候选名单不是最终名单，这家提供商在这个阶段改过主意。一旦纳入，这只股票就会面对一批不挑名字的资金，而它的自由流通盘足够小，以致这笔流量相对日均成交量很大。公告将在收盘后发布，交易台会在一小时内更新估算。',
    },
    source: 'wire',
  },
  {
    id: 'RB3',
    kind: 'equity',
    tag: 'TSCO',
    impact: 3,
    symbol: 'TSCO',
    direction: -1,
    driftBps: 120,
    short: { en: 'size test', zh: '规模门槛' },
    headline: {
      en: 'Tesco sits on the wrong side of the size test in the preliminary screen',
      zh: '乐购在初筛的规模门槛上落在了不合适的一侧',
    },
    detail: {
      en: 'The screen uses a float-adjusted measure and Tesco sits close enough to the line that a small change in the share count changes the answer. Deletion would force index funds to trade into a market that already knows the calendar. The provider has discretion here, and it has used it in previous reviews, sometimes against the obvious reading of its own rules.',
      zh: '这次筛选用的是自由流通调整后的口径，乐购离门槛足够近，股本数的一点变化就会改变结论。被剔除会迫使指数基金在一个已经知道日历的市场里交易。提供商在这里有裁量权，而且在前几次评审里用过。',
    },
    source: 'broker round',
  },
  {
    id: 'RB4',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: 1,
    driftBps: 55,
    short: { en: 'passive flow', zh: '被动资金' },
    headline: {
      en: 'Passive flow estimates point to a busy close on the effective date',
      zh: '被动资金估算指向生效日会有一个繁忙的收盘',
    },
    detail: {
      en: 'The estimate is built from index weights, free float and average daily volume, and it is revised every day until the final number is published. Most of the flow lands in the closing auction, which is why the last thirty minutes matter more than the rest of the session. The desk publishes a range rather than a point, and the range is wide.',
      zh: '这个估算由指数权重、自由流通盘和日均成交量推算，在最终数字公布前每天都会修正。大部分流量落在收盘集合竞价，这就是最后三十分钟比其余时段更重要的原因。交易台公布的是一个区间而不是一个点，而且区间很宽。',
    },
    source: 'desk note',
  },
  {
    id: 'RB5',
    kind: 'equity',
    tag: 'NFLX',
    impact: 2,
    symbol: 'NFLX',
    direction: 1,
    driftBps: 70,
    short: { en: 'weight change', zh: '权重调整' },
    headline: {
      en: 'A free-float adjustment changes the Netflix weight in one benchmark',
      zh: '自由流通调整改变了奈飞在一个基准里的权重',
    },
    detail: {
      en: 'The provider has reclassified part of a long-standing strategic stake as free float, which increases the share count used in the benchmark. Trackers must trade the difference at the next rebalance, and the desk expects the flow to split between the auction and the following morning. The change is mechanical: nothing about the prospects of the company has moved, and the flow is the only reason the name is on any list today.',
      zh: '提供商把一笔长期战略持股的一部分重新归类为自由流通，增加了基准计算中使用的股数。跟踪基金必须在下一个再平衡日交易这个差额，交易台预计流量会分在竞价和次日早盘两处。这个变化是机械的：公司的前景没有任何变化。',
    },
    source: 'exchange notice',
  },
  {
    id: 'RB6',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'auction imbalance', zh: '竞价失衡' },
    headline: {
      en: 'The auction imbalance estimate has been revised twice this week',
      zh: '竞价失衡预估本周已经改过两次',
    },
    detail: {
      en: 'The number moves with the underlying and with whatever else is in the auction that day, so early estimates are unreliable by construction. The desk publishes its own range and marks it indicative until the final feed arrives, and it has had to pull its own number twice already. Client orders must be in fifteen minutes before the close to be included at all, and late orders are routinely rejected.',
      zh: '这个数字会随标的以及当天竞价里的其他内容变动，所以早期预估从构造上就不可靠。交易台发布自己的区间，并在最终数据到达前标注为参考值。客户委托必须在收盘前十五分钟送到才算在内，晚到的委托通常直接被拒。',
    },
    source: 'desk note',
  },
  {
    id: 'RB7',
    kind: 'equity',
    tag: 'AZN',
    impact: 2,
    symbol: 'AZN',
    direction: -1,
    driftBps: 80,
    short: { en: 'capping rule', zh: '权重上限' },
    headline: {
      en: 'A capping rule bites on AstraZeneca in one regional benchmark',
      zh: '一条上限规则在一个区域基准里对阿斯利康生效',
    },
    detail: {
      en: 'The index caps any single name at a set percentage, and AstraZeneca has sat above that level since the last review. Capping forces trackers to trim at the rebalance regardless of what they think of the company, and the trim is close to a full day of volume in the name. The provider will publish the exact adjustment factor with the announcement, and the desk will re-run its flow estimate then.',
      zh: '该指数把单一成分股的权重限制在固定百分比，而阿斯利康自上次评审以来一直在上限之上。封顶会迫使跟踪基金在再平衡时削减仓位，不管它们怎么看这家公司。提供商会在公告里公布确切的调整系数，交易台届时会重新跑一遍资金流估算。',
    },
    source: 'exchange notice',
  },
  {
    id: 'RB8',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 60,
    short: { en: 'ETF flows', zh: '申赎动向' },
    headline: {
      en: 'ETF desks report redemptions building into the effective date',
      zh: 'ETF 台称生效日前的赎回在累积',
    },
    detail: {
      en: 'Creation and redemption activity is the part of the flow that shows up first, and this week it has been one-sided in the sector ETFs. Redemptions do not have to be sold in the auction, which makes the timing uncertain. The desk watches the underlying basket more closely than the fund itself, because both are priced off the same closing print.',
      zh: '申购赎回是最先体现出来的那部分流量，而本周板块 ETF 一直是单边的。赎回不一定非得在竞价里卖出，所以时点不确定。交易台更关注底层一篮子股票而不是基金本身，因为两者都按同一个收盘价定价。',
    },
    source: 'market colour',
  },
  {
    id: 'RB9',
    kind: 'equity',
    tag: 'TSLA',
    impact: 3,
    symbol: 'TSLA',
    direction: -1,
    driftBps: 90,
    short: { en: 'quarterly trim', zh: '季度削减' },
    headline: {
      en: 'A quarterly rebalance trims the Tesla weight in a growth benchmark',
      zh: '一次季度再平衡削减了特斯拉在成长基准里的权重',
    },
    detail: {
      en: 'The trim follows a rule rather than a view: the benchmark re-weights to cap concentration, and Tesla is one of the names above the line. Trackers sell the difference at the close on the effective date. The desk notes that the same rule added to this name two quarters ago, which is why nobody is reading it as a judgment.',
      zh: '这次削减遵循规则而不是观点：该基准重新配权以限制集中度，而特斯拉是越过红线的那几只之一。跟踪基金在生效日收盘卖出差额。交易台提醒，同一条规则两个季度前还是给这只股票加仓，所以没人把它当成判断。',
    },
    source: 'broker round',
  },
  {
    id: 'RB10',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'market depth', zh: '市场深度' },
    headline: {
      en: 'Market makers are carrying more inventory than usual into the close',
      zh: '做市商带着比平时更多的库存进入收盘',
    },
    detail: {
      en: 'Inventory builds when clients trade in one direction and the desk has to warehouse the other side. That does not have to move the print, but it changes how willing the desk is to quote size late in the day. The imbalance estimate is the number to watch, and it has been late twice this week, which makes the current print less useful than usual.',
      zh: '当客户往一个方向交易、交易台不得不把另一边吃下来时，库存就会累积。这不一定影响成交价，但会改变交易台在尾盘报量的意愿。要盯的数字是失衡预估，而这个数字本周已经迟了两次。',
    },
    source: 'desk note',
  },
  {
    id: 'RB11',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 45,
    short: { en: 'post-print flow', zh: '生效后资金' },
    headline: {
      en: 'Dealers expect the flow to turn after the rebalance print',
      zh: '交易商预计再平衡成交后资金会转向',
    },
    detail: {
      en: 'The trading that the rebalance requires is finished once the auction prints, and the desks that positioned for it have no reason to stay. That reversal is well understood, which is why part of it happens before the effective date rather than after. The desk has no strong view on the size, and says so to clients, which is not the same thing as having no view at all.',
      zh: '再平衡所需的交易在竞价成交后就结束了，为此布局的交易台没有理由继续留着。这种转向是众所周知的，所以有一部分在生效日之前就已经发生。交易台对规模没有强观点，也对客户这么讲。',
    },
    source: 'market colour',
  },
  {
    id: 'RB12',
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    short: { en: 'final print', zh: '收盘定盘' },
    headline: {
      en: 'The effective date closes with one number that everyone watches',
      zh: '生效日以一个所有人都在看的数字收尾',
    },
    detail: {
      en: 'The closing auction on the effective date is the largest single liquidity event of the quarter for the affected names, and the print is published minutes afterwards. Desks use it to check their estimates and to re-mark positions that were hedged against a different number. Nothing about it is a forecast, and the next day usually looks different, which is why the desk refuses to read the print as a signal.',
      zh: '生效日的收盘集合竞价是受影响股票本季度最大的一次流动性事件，成交数据在几分钟后公布。交易台用它校验自己的估算，并重新标记那些按另一个数字对冲的仓位。它本身不是任何预测，第二天的盘面通常不一样。',
    },
    source: 'exchange notice',
  },
]
