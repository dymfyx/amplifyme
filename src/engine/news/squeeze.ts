import type { NewsPool } from '../news'

/**
 * Squeeze：空头挤压日。
 * 前半段由借券、期权伽马和散户热度推动，后半段借券池回补、对冲需求退潮，
 * 方向可能反转。标题只给事实和疑问，不给涨跌。
 */
export const squeezeNews: NewsPool = [
  {
    id: 'SQ1',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'borrow notice', zh: '借券提示' },
    headline: {
      en: 'Stock-loan desk circulates a note on lendable supply',
      zh: '证券借贷台就可借券源发了一份提示',
    },
    detail: {
      en: 'The note goes to clients with borrow lines open and covers availability rather than price. Two large holders have asked for their stock back and the desk is quoting terms day by day instead of week by week. Nothing in it is a recommendation: desks send this kind of note when the pool of lendable shares changes shape, and the terms can move again before the open.',
      zh: '这份提示发给有借券额度的客户，讲的是可借量而不是价格。两家大持有人要求收回股票，交易台现在按日报价而不是按周报价。这不构成任何建议：当可借股票池的结构发生变化时，交易台就会发这类提示，而条件在开盘前还可能再变。',
    },
    source: 'desk note',
  },
  {
    id: 'SQ2',
    kind: 'equity',
    tag: 'TSLA',
    impact: 3,
    symbol: 'TSLA',
    direction: 1,
    driftBps: 120,
    short: { en: 'borrow terms', zh: '借券成本' },
    headline: {
      en: 'Borrow terms on Tesla draw a second look before the open',
      zh: '开盘前特斯拉的借券条件让人再看一眼',
    },
    detail: {
      en: 'Overnight the fee on new borrow moved and two lenders pulled inventory without saying why. The desk cannot tell whether this is a recall or a client closing a hedge, and the difference matters: a recall takes shares out of the pool for days. Options desks are already quoting wider on the calls side, and the settlement desk has moved its cut-off earlier for new lines.',
      zh: '隔夜新借券的费用出现变动，两家出借方没有说明原因就撤回了库存。交易台分不清这是召回还是客户在平掉对冲，而这个区别很关键：召回会让股票离开可借池好几天。期权台在看涨那一边报的价已经更宽，结算台也把新额度的截止时间提前了。',
    },
    source: 'market colour',
  },
  {
    id: 'SQ3',
    kind: 'equity',
    tag: 'DUOL',
    impact: 2,
    symbol: 'DUOL',
    direction: 1,
    driftBps: 110,
    short: { en: 'retail mentions', zh: '散户热度' },
    headline: {
      en: 'Duolingo sits near the top of a retail mention list',
      zh: '多邻国在散户提及榜上排在前列',
    },
    detail: {
      en: 'A third-party tracker puts the name among the most discussed small caps on two retail forums, and the count has been building since Monday. Mentions are not flow, and the desk notes that the same list produced two false starts this quarter. The options market is now paying more for two-week optionality on both sides, which is unusual for a name this size.',
      zh: '一家第三方追踪机构把这只股票列在两个散户论坛讨论最多的小盘股之中，提及量从周一以来一直在累积。提及不等于成交，交易台也提醒这份榜单本季度已经两次给出假信号。期权市场现在为两周的双向期权付更高的价，这对这个市值的股票来说并不常见。',
    },
    source: 'market colour',
  },
  {
    id: 'SQ4',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: 1,
    driftBps: 60,
    short: { en: 'gamma expiry', zh: '伽马到期' },
    headline: {
      en: 'Options desks flag a heavy gamma expiry on the calendar',
      zh: '期权台提示日历上有一次规模很大的伽马到期',
    },
    detail: {
      en: 'Dealer positioning into a large expiry is the story: market makers who are long gamma hedge mechanically, and the direction of that hedging depends on where spot sits relative to strike. The desk estimates the notional at a multi-month high but has no read on which side dealers are carrying. Hedging flows usually cluster in the last hour of the session.',
      zh: '关键在于做市商在大量到期前的仓位：多头伽马的做市商会机械对冲，而对冲的方向取决于现价相对行权价的位置。交易台估计名义规模处于数月高位，但看不清做市商持的是哪一边。对冲流通常集中在最后一个小时。',
    },
    source: 'market colour',
  },
  {
    id: 'SQ5',
    kind: 'equity',
    tag: 'NFLX',
    impact: 2,
    symbol: 'NFLX',
    direction: 1,
    driftBps: 85,
    short: { en: 'settlement date', zh: '结算日' },
    headline: {
      en: 'A settlement date puts Netflix borrow back in focus',
      zh: '一个结算日让奈飞的借券重新受到关注',
    },
    detail: {
      en: 'Two weeks of borrow rolled into a single settlement date and the desk is watching whether holders renew or take stock back. Renewals are the quiet part of this market: they do not print anywhere, but they decide how much supply is available next week. Short interest data is published with a lag, so the tape usually knows before the file does.',
      zh: '两周的借券滚到了同一个结算日，交易台在观察持有人是续借还是把股票收回。续借是市场里安静的那一部分：它不会在任何地方留下成交记录，却决定下周有多少券源可用。空头持仓数据有滞后，所以盘面通常比文件更早知道。',
    },
    source: 'market colour',
  },
  {
    id: 'SQ6',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'volatility pause', zh: '波动暂停' },
    headline: {
      en: 'A venue flags a short volatility pause in one name',
      zh: '某交易所对一个标的的短暂波动暂停作出提示',
    },
    detail: {
      en: 'The notice went to members only and did not name the security, which is unusual. Desks are guessing at the name from the tape and from which lines went quiet. A pause of a few minutes is routine; what the desk wants to know is whether trading resumes on the same terms, and whether any print from before the pause is later cancelled.',
      zh: '这份通知只发给会员，而且没有点名是哪只证券，这不太寻常。交易台在根据盘面和哪几条线突然安静来猜名字。几分钟的暂停是常规操作；交易台想知道的是恢复交易后条件是否一样，以及暂停前的成交是否会被撤销。',
    },
    source: 'exchange notice',
  },
  {
    id: 'SQ7',
    kind: 'equity',
    tag: 'AZN',
    impact: 2,
    symbol: 'AZN',
    direction: 1,
    driftBps: 45,
    short: { en: 'positioning', zh: '仓位分布' },
    headline: {
      en: 'Positioning screens put AstraZeneca at the quiet end of the board',
      zh: '仓位筛查把阿斯利康放在盘面上最安静的一端',
    },
    detail: {
      en: 'Crowding screens rank it at the quiet end of the board: short interest is low, the borrow is cheap and the options skew is close to flat. Portfolio managers who need to hold something while positioning in the crowded names is worked through keep arriving at the same three stocks, and this is one of them. Quiet is not the same as safe.',
      zh: '拥挤度筛查把它排在盘面最安静的一端：空头持仓低、借券便宜、期权偏斜几乎是平的。那些需要在拥挤标的的仓位慢慢消化期间持有一些东西的组合经理，最后总会落到同样的三只股票上，这是其中之一。安静不等于安全。',
    },
    source: 'broker round',
  },
  {
    id: 'SQ8',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 65,
    short: { en: 'hedge unwind', zh: '对冲调整' },
    headline: {
      en: 'Dealers pare hedges as the morning gamma rolls off',
      zh: '上午的伽马衰减后做市商在削减对冲',
    },
    detail: {
      en: 'The expiry that dominated hedging earlier in the session is now behind the market, and positions that were built around it are being worked off through the afternoon. The desk stresses that unwinds are flows rather than forecasts: they can be absorbed, the size depends on where the next strike sits, and two dealers have already cut their books while a third has not moved at all. Most of it tends to happen in the final hour, when the auction takes over.',
      zh: '上午主导对冲的那个到期现在已经过去，围绕它建立的头寸正在下午被逐步了结。交易台强调，平掉对冲是资金流而不是预测：它们可以被吸收，规模取决于下一个行权价的位置，而且已经有两家交易商削减了头寸，第三家却完全没动。大部分通常发生在最后一小时，由竞价接手。',
    },
    source: 'market colour',
  },
  {
    id: 'SQ9',
    kind: 'equity',
    tag: 'TSLA',
    impact: 3,
    symbol: 'TSLA',
    direction: -1,
    driftBps: 110,
    short: { en: 'lender returns', zh: '出借人还券' },
    headline: {
      en: 'Lenders put Tesla stock back into the pool',
      zh: '出借方把特斯拉的股票重新放回借券池',
    },
    detail: {
      en: 'Three lenders reversed their morning recalls and are quoting size again, according to two desks. That changes the arithmetic for anyone who borrowed at the high of the fee, and the desk has fielded four calls about it since lunch. The stock is still the most expensive borrow on the board, so this is a change in degree rather than in kind.',
      zh: '据两家交易台说，三家出借方撤销了上午的召回，重新报出了量。对那些在费用高点借券的人来说，算术变了，交易台从午盘以来已经接了四通相关电话。这只股票仍然是盘面上最贵的借券，所以这是程度上的变化，不是性质上的变化。',
    },
    source: 'market colour',
  },
  {
    id: 'SQ10',
    kind: 'equity',
    tag: 'DUOL',
    impact: 3,
    symbol: 'DUOL',
    direction: -1,
    driftBps: 130,
    short: { en: 'broker pushback', zh: '卖方质疑' },
    headline: {
      en: 'A broker round questions the durability of the move in Duolingo',
      zh: '一份卖方报告质疑多邻国这轮走势的持续性',
    },
    detail: {
      en: 'The note keeps its rating but argues that the free float is too small for the flows being discussed, and that the borrow market is not as tight as the tape implies. Two of the three authors have covered the name since listing. The desk reads it as a timing call rather than a view on the business, and notes that the same author has been early on this name before.',
      zh: '这份报告没有改评级，但认为自由流通盘相对于市场上谈论的资金流太小，而且借券市场没有盘面暗示的那么紧。三位作者里有两位从上市起就覆盖这只股票。交易台把它读成时点判断而不是对生意的看法，并指出同一位作者在这只股票上此前也早过。',
    },
    source: 'broker round',
  },
  {
    id: 'SQ11',
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    short: { en: 'closing imbalance', zh: '收盘失衡' },
    headline: {
      en: 'A closing imbalance estimate is revised for the second time',
      zh: '收盘失衡预估第二次被修正',
    },
    detail: {
      en: 'The estimate has moved twice since the European open and the desk is treating the current number as indicative only. Auction liquidity is shallow in the last half hour, and an order that looks small in the book can move the print more than expected. Client orders for the auction are due fifteen minutes before the close, which is why the desk has cut the size it is willing to show.',
      zh: '这个预估自欧洲开盘以来已经改过两次，交易台只把当前数字当作参考。最后半小时的集合竞价流动性很浅，盘口里看起来不大的单子也可能让成交价动得比预期多。客户委托在收盘前十五分钟截止，这也是交易台缩小愿意报出的量的原因。',
    },
    source: 'desk note',
  },
  {
    id: 'SQ12',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 45,
    short: { en: 'late flow', zh: '尾盘资金' },
    headline: {
      en: 'Late flow turns two-way as the session runs out',
      zh: '尾盘资金在收盘前变成双向',
    },
    detail: {
      en: 'For most of the afternoon the same accounts were on one side of the book; in the last forty minutes that changed and the desk is now seeing both. Two-way flow is not the same as an unwind, and the desk has been wrong about this before. Positioning data will not confirm anything until tomorrow morning, and the desk will not size a trade on a hunch.',
      zh: '整个下午大部分时间，都是同一批账户在盘口的一边；最后四十分钟变了，交易台现在两边都能看到。双向流动不等于平仓，交易台在这件事上以前也判断错过。仓位数据要到明天早上才能确认任何东西，交易台也不会凭直觉下大单。',
    },
    source: 'market colour',
  },
]
