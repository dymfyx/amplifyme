import type { NewsPool } from '../news'

/**
 * Crash：风险偏好崩塌的一天。
 * 全篇偏空，但标题不出现跌、崩、抛售这类字眼：方向要靠相关性、流动性、借券和基差去读。
 */
export const crashNews: NewsPool = [
  {
    id: 'CR1',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: -1,
    driftBps: 75,
    short: { en: 'term structure', zh: '波动率曲线' },
    headline: {
      en: 'The volatility curve inverts before the cash open',
      zh: '现货开盘前，波动率曲线倒挂了',
    },
    detail: {
      en: 'One-month implied volatility is now above three-month, the first inversion since the autumn, and the move has come without a single catalyst. Dealers report demand for upside calls on the index as well as downside puts, which is unusual and suggests hedging rather than a directional bet. The VIX futures curve has followed, and the front contract trades at a premium to spot.',
      zh: '一个月隐含波动率现在高于三个月，是入秋以来第一次倒挂，而且没有单一触发因素。交易商报告指数上方看涨和下方看跌都有需求，这不太寻常，更像是对冲而不是方向性下注。VIX 期货曲线跟着动了，近月合约对现货出现溢价。',
    },
    source: 'market colour',
  },
  {
    id: 'CR2',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 50,
    short: { en: 'top of book', zh: '盘口深度' },
    headline: {
      en: 'The top of the book is not where it was at the open',
      zh: '盘口最上面那一层，和开盘时不一样了',
    },
    detail: {
      en: 'Quoted spreads on the cash index and on the top ten names are roughly double their twenty-day averages, and displayed size is down by half. Two market makers have pulled their quotes in the smaller names entirely, and a third is quoting one way only. The desk is working orders in slices and warning clients that the mid is not a price anyone will actually trade at.',
      zh: '现货指数和前十大权重股的报价价差差不多是二十日均值的两倍，挂出来的量少了一半。两家做市商干脆把小票的报价撤了，第三家只报单边。台里现在把单子切片做，并提醒客户：中间价不是真的能成交的价。',
    },
    source: 'desk note',
  },
  {
    id: 'CR3',
    kind: 'equity',
    tag: 'TSLA',
    impact: 3,
    symbol: 'TSLA',
    direction: -1,
    driftBps: 120,
    short: { en: 'borrow tight', zh: '借券紧张' },
    headline: {
      en: 'The borrow on Tesla goes tight while the screen is still liquid',
      zh: '屏幕还有流动性，特斯拉的借券已经紧了',
    },
    detail: {
      en: 'The borrow fee has moved from general collateral to low double digits in two sessions, and two prime brokers are now allocating rather than quoting. That usually happens when existing shorts are pressed or when a large long recalls stock, and the desk cannot tell which yet. Options skew has steepened at the same time, and the name is doing twice its average volume.',
      zh: '借券费两天内从一般抵押品水平跳到十几个点，两家主经纪商现在不是报价，而是在分配额度。这种情况通常出现在空头被追、或者大股东召回股票的时候，台里还分不清是哪一种。同期期权偏斜变陡，成交量是平时两倍。',
    },
    source: 'market colour',
  },
  {
    id: 'CR4',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: -1,
    driftBps: 60,
    short: { en: 'correlation', zh: '相关性' },
    headline: {
      en: 'Correlation desks mark their highest reading of the year',
      zh: '相关性台报出今年最高读数',
    },
    detail: {
      en: 'Realised pairwise correlation across the index is at the top of its range, which means stock-specific news is being overwhelmed by the factor move. Two long-short funds have cut gross exposure this morning, and the desk sees the same five names on every sell list. Discretionary managers are asking for index hedges rather than single-name protection, and dealers are charging for the privilege.',
      zh: '指数成分股的两两已实现相关性已经打到区间顶部，这意味着个股消息正在被因子行情淹没。今早有两家多空基金降了总仓位，台里在每一张卖出名单上都看到同样的五个名字。主动管理的经理们要的是指数对冲，而不是个股保护，交易商为此收起了费用。',
    },
    source: 'market colour',
  },
  {
    id: 'CR5',
    kind: 'equity',
    tag: 'AZN',
    impact: 2,
    symbol: 'AZN',
    direction: 1,
    driftBps: 65,
    short: { en: 'safety bid', zh: '避险买盘' },
    headline: {
      en: 'The healthcare book is the only one still showing depth',
      zh: '只有医疗这本账，还看得见深度',
    },
    detail: {
      en: 'AstraZeneca is trading with a bid that is three deep on every level, which is not what the rest of the board looks like this morning. The buying is described as asset allocation rather than a sector call: two European pension funds have moved money out of cyclicals and into pharma. The dividend yield is doing part of the work.',
      zh: '阿斯利康每一档买盘后面都还压着三层，和今早其余盘面完全不是一回事。这波买盘被形容为资产配置，而不是看好某个板块：两家欧洲养老金把钱从周期股挪进了医药。股息率在这里也起了一部分作用。',
    },
    source: 'market colour',
  },
  {
    id: 'CR6',
    kind: 'equity',
    tag: 'TSCO',
    impact: 2,
    symbol: 'TSCO',
    direction: 1,
    driftBps: 50,
    short: { en: 'staples', zh: '必需消费' },
    headline: {
      en: 'Grocery gets the rotation that used to go to bonds',
      zh: '本该流向债券的钱，这次去了杂货股',
    },
    detail: {
      en: 'Tesco is drawing the kind of flow that usually goes to short-dated government paper, on volume that is only average, which tells the desk the buying is patient. Clients describe it as a cash substitute: a 4% dividend yield, a defensive earnings stream and no duration. The UK grocery data due Thursday is the next thing that could disturb the trade.',
      zh: '流进 Tesco 的这类钱，平时是去买短久期国债的；成交量只是平均水平，说明买的人有耐心。客户把它形容成现金替代：4% 的股息率、防御性的盈利流、没有久期。周四的英国杂货数据是下一个可能扰动这笔交易的东西。',
    },
    source: 'market colour',
  },
  {
    id: 'CR7',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 55,
    short: { en: 'credit', zh: '信用利差' },
    headline: {
      en: 'Credit leads the next leg, as it usually does',
      zh: '和往常一样，信用市场先走了一步',
    },
    detail: {
      en: 'The high-yield cash index has widened for a fourth session and the CDX high-yield series is through its March level. New issue is effectively closed: two deals marketed on Monday have been pulled, and a third is being repriced at a wider spread. Equity desks treat the credit tape as the confirmatory signal, and this morning it is confirming on every screen the desk watches.',
      zh: '高收益现货指数已经连宽四个交易日，CDX 高收益系列跌破了三月的水平。新发市场实际上已经关了：周一还在路演的两笔交易被撤回，第三笔在更宽的价差上重新定价。股票台把信用盘面当作确认信号，而今天早上，我们盯的每一块屏幕都在确认。',
    },
    source: 'wire',
  },
  {
    id: 'CR8',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'margin chatter', zh: '追保传闻' },
    headline: {
      en: 'A margin-call note circulates on the dealer chat',
      zh: '一张追保通知，在交易商的群里传开',
    },
    detail: {
      en: 'The note is unsigned and names no fund, but it describes a multi-strategy book being cut by a prime broker and asks for quotes in size on a basket. Three desks have seen the same list; none will confirm it is live. The rule on this desk is to treat rumour as liquidity information, not as a reason to take a view.',
      zh: '通知没有署名，也没点基金名字，但描述了一个多策略账户被主经纪商砍仓，并为一个篮子要大额报价。三家台看到了同一份名单，没人愿意确认它是不是真的在跑。我们台里的规矩是：传闻只能当流动性信息用，不能拿来下判断。',
    },
    source: 'desk note',
  },
  {
    id: 'CR9',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 45,
    short: { en: 'funding', zh: '美元融资' },
    headline: {
      en: 'The cross-currency basis shows its first real stress print',
      zh: '交叉货币基差，第一次印出真正的压力',
    },
    detail: {
      en: 'The three-month euro-dollar basis has widened by the most since the spring, and the move is concentrated around quarter-end funding dates. Bank treasuries are said to be pre-funding earlier than usual, and one dealer has stopped quoting the tenor beyond a month. Equity desks watch this line because liquidity problems usually announce themselves here first, and the funding trader on this desk has been fielding calls since 07:00.',
      zh: '三个月欧元兑美元基差走宽幅度是春季以来最大，而且集中在季末的资金窗口。听说银行司库比往年更早开始提前融资，一家交易商已经不再报一个月以上的期限。股票台盯这条线，是因为流动性问题通常最先在这里露头；我们台的融资交易员从早上七点就开始接电话了。',
    },
    source: 'wire',
  },
  {
    id: 'CR10',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'regulator', zh: '监管表态' },
    headline: {
      en: 'The regulator says it is watching the session, and nothing more',
      zh: '监管机构表示在盯着今天的盘，仅此而已',
    },
    detail: {
      en: 'The statement runs to four paragraphs, confirms that no emergency measures are under consideration, and reminds participants of the existing short-selling disclosure rules. It was issued after the European open rather than before, which the desk reads as a response to the tape rather than a cause of it. Two compliance teams have asked for the same clarification, which suggests the wording is being read closely.',
      zh: '声明一共四段，确认没有在考虑任何紧急措施，并提醒参与者遵守现行的卖空披露规则。它是欧洲开盘之后发的，不是之前，交易台把这读成对盘面的回应，而不是原因。两家合规团队来问同一处措辞，说明大家都在细读。',
    },
    source: 'regulatory notice',
  },
  {
    id: 'CR11',
    kind: 'equity',
    tag: 'NFLX',
    impact: 2,
    symbol: 'NFLX',
    direction: -1,
    driftBps: 80,
    short: { en: 'long duration', zh: '长久期' },
    headline: {
      en: 'Netflix is where the growth book residual risk sits',
      zh: '成长股账本剩下的风险，都压在奈飞身上',
    },
    detail: {
      en: 'The stock is trading on the same factor as the rest of the growth book this morning, and the flow on this desk is dominated by one macro fund reducing exposure. Fundamental holders are still on the register, and none of them has been a seller. The level to watch is the April low, where the largest holder added in May.',
      zh: '今早这只票和整个成长股账本交易在同一个因子上，我们台的流水主要来自一家宏观基金在减敞口。基本面持有人还在名册上，没有一家是卖方。要盯的位置是四月低点，最大股东五月在那里加过仓。',
    },
    source: 'market colour',
  },
  {
    id: 'CR12',
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    short: { en: 'vol auction', zh: '波动竞价' },
    headline: {
      en: 'A volatility auction interrupts the tape in a mid-cap',
      zh: '一只中盘股的波动竞价，打断了盘面',
    },
    detail: {
      en: 'The exchange halted the name for five minutes after a move that tripped the band, and the reopening auction cleared well below the last print. It is a single stock and not an index event, but desks use these prints to gauge how much liquidity has actually been withdrawn. Two more names are on the watch list, and the halts are coming faster than earlier in the week.',
      zh: '这只股票因为触发了价格带被交易所停了五分钟，重新开盘的竞价在远低于停牌前的位置成交。这只是单只股票、不是指数层面的事件，但交易台会用这类成交来估流动性到底被抽走了多少。还有两个名字在观察名单上，而且停牌来得比本周早些时候更密。',
    },
    source: 'exchange notice',
  },
]
