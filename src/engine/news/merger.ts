import type { NewsPool } from '../news'

/**
 * Merger：并购传闻日。
 * 两只标的在传闻里来回定价，中间夹着董事会回应、竞购方、反垄断时限和融资条件，
 * 临近收盘还要面对交易谈崩的概率。标题只描述事件，不描述股价。
 */
export const mergerNews: NewsPool = [
  {
    id: 'MG1',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'deal chatter', zh: '并购传闻' },
    headline: {
      en: 'Deal desks circulate chatter that nobody will put a name to',
      zh: '并购台在传一些没人愿意点名的消息',
    },
    detail: {
      en: 'The talk is second-hand and has been doing the rounds since Friday: a strategic review at a mid-cap, advisers appointed, no announcement. The desk has heard the same story from three directions, which is either confirmation or one person talking loudly. Nothing has been filed with any exchange, the company has not been asked to comment, and no adviser will confirm a mandate.',
      zh: '这些说法是二手的，从周五开始就在传：一家中盘股在做战略评估、已聘请顾问、还没有公告。交易台从三个方向听到了同一个故事三次，这要么是相互印证，要么就是一个人在到处说。目前没有任何交易所备案，公司没有被要求置评，也没有顾问愿意确认受托。',
    },
    source: 'desk note',
  },
  {
    id: 'MG2',
    kind: 'equity',
    tag: 'TSCO',
    impact: 3,
    symbol: 'TSCO',
    direction: 1,
    driftBps: 130,
    short: { en: 'approach talk', zh: '接洽传闻' },
    headline: {
      en: 'Tesco draws approach talk from a consortium nobody can name',
      zh: '乐购被传有财团接洽，但没人说得出名字',
    },
    detail: {
      en: 'The rumour puts a cash offer at a premium to the undisturbed price and names two private-equity houses as likely backers. Neither has commented, and the desk notes that the UK grocery space has been a graveyard for large deals since the last one failed on financing. Spreads are wide, the borrow is already being asked for, and the desk is treating the story as live rather than as noise.',
      zh: '传闻给出的现金报价相对未受扰动的价格有溢价，并点名两家私募可能出资。两家都没有评论，交易台也提醒：上一笔大交易因融资失败告吹之后，英国杂货板块对大型交易来说一直是坟场。价差很宽，已经有人在问借券。',
    },
    source: 'market colour',
  },
  {
    id: 'MG3',
    kind: 'equity',
    tag: 'DUOL',
    impact: 3,
    symbol: 'DUOL',
    direction: 1,
    driftBps: 140,
    short: { en: 'deal screens', zh: '并购筛选' },
    headline: {
      en: 'Duolingo shows up on a second set of deal screens',
      zh: '多邻国出现在第二批并购筛选名单里',
    },
    detail: {
      en: 'The name appeared last week in a screen from one broker covering small-cap assets with strategic value, and again this morning in a note from a different bank. Screens are not mandates, and the desk points out that this one has carried the name for a year without a bid. The options market has started to price the tail anyway.',
      zh: '这只股票上周出现在一家券商关于具战略价值小盘资产的筛选里，今早又出现在另一家银行的报告中。筛选不等于委托，交易台也指出这份名单挂这只股票已经一年了，始终没有出现买家。期权市场倒是已经开始为尾部情形定价。',
    },
    source: 'broker round',
  },
  {
    id: 'MG4',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: 1,
    driftBps: 45,
    short: { en: 'deal financing', zh: '并购融资' },
    headline: {
      en: 'Syndicate desks report fresh capacity for acquisition financing',
      zh: '银团台称并购融资出现新的额度',
    },
    detail: {
      en: 'Two banks have reopened commitments for leveraged acquisitions after a quiet quarter, according to people on the syndicate desks. The terms under discussion are tighter on covenants than last year, which matters more for the smaller deals in the pipeline, and the spread being quoted is wider than on the deals done in the spring. None of this is tied to a specific transaction, and both banks declined to comment.',
      zh: '据银团台的人说，在安静了一个季度之后，两家银行重新开放了杠杆收购的承贷额度。正在谈的条款在契约上比去年更严，这对在管道里的小型交易影响更大。这些都与任何具体交易无关，两家银行都拒绝评论。',
    },
    source: 'wire',
  },
  {
    id: 'MG5',
    kind: 'equity',
    tag: 'TSCO',
    impact: 3,
    symbol: 'TSCO',
    direction: 1,
    driftBps: 110,
    short: { en: 'board response', zh: '董事会回应' },
    headline: {
      en: 'The Tesco board says it will look at any credible proposal',
      zh: '乐购董事会称会考虑任何可信的提议',
    },
    detail: {
      en: 'The statement is three lines long and does not confirm that an approach exists, which is the standard formula when one does. It commits the board to reviewing terms and to updating the market if the situation changes. Under the code, the clock is now running and a firm offer or a walk-away is due within weeks, which is why the options market is already quoting two-week risk.',
      zh: '这份声明只有三行，也没有确认是否存在接洽——而存在接洽时，这就是标准措辞。董事会承诺会评估条款，并在情况变化时向市场更新。按收购守则，现在计时已经开始，几周内要么给出确定报价，要么放弃。',
    },
    source: 'company release',
  },
  {
    id: 'MG6',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'wide spreads', zh: '价差走阔' },
    headline: {
      en: 'Deal desks widen their markets in the two names under discussion',
      zh: '并购台对传闻里的两只股票拉宽了报价',
    },
    detail: {
      en: 'Quotes are being made for smaller size and with wider skew while the story is unconfirmed. That is normal practice rather than a signal: a desk that cannot hedge a position will quote defensively and show less. Size that was easy to fill on Friday now needs three calls, client orders in these two names need a named approver, and the desk has stopped honouring two-minute fills.',
      zh: '在消息未获确认期间，报价的量更小、偏斜更宽。这是常规做法而不是信号：无法对冲头寸的交易台会防守性报价，并且报得更少。这两只股票上的客户委托现在需要有具名审批人，交易台也不再保证两分钟内成交。',
    },
    source: 'desk note',
  },
  {
    id: 'MG7',
    kind: 'equity',
    tag: 'NFLX',
    impact: 2,
    symbol: 'NFLX',
    direction: -1,
    driftBps: 90,
    short: { en: 'suitor rumour', zh: '买方传闻' },
    headline: {
      en: 'Netflix is drawn into the deal column as a possible buyer',
      zh: '奈飞被写进并购专栏，被指可能是买方',
    },
    detail: {
      en: 'The column names Netflix as one of several potential strategic buyers for an education asset, without citing anyone. Buying earnings at a premium is a different proposition from building them, and the desk notes that the company has never done a deal of this shape. Financing is not the constraint here; integration would be, and the desk has seen the market misprice that distinction before.',
      zh: '这个专栏把奈飞列为某教育资产的几个潜在战略买家之一，但没有引述任何消息源。用溢价买利润和把利润做出来是两回事，交易台也指出公司从来没做过这种形态的交易。约束不在融资，而在整合。',
    },
    source: 'market colour',
  },
  {
    id: 'MG8',
    kind: 'equity',
    tag: 'DUOL',
    impact: 3,
    symbol: 'DUOL',
    direction: 1,
    driftBps: 120,
    short: { en: 'rival bidder', zh: '竞购方' },
    headline: {
      en: 'A second interested party is said to be doing work on Duolingo',
      zh: '据说第二个有意方正在对多邻国做功课',
    },
    detail: {
      en: 'An analyst note mentions a second party in the data room, and two people familiar with the process do not deny it. A competitive process changes the arithmetic for holders of the target and also raises the chance that nothing at all is agreed. The desk is watching the spread between the two names rather than either one on its own.',
      zh: '一份分析师报告提到数据室里还有第二个有意方，两位了解流程的人也没有否认。竞争性流程会改变标的持有人的算术，同时也会提高最终什么都谈不成的概率。交易台在观察这个故事里两只股票之间的价差，而不是单独看其中一只。',
    },
    source: 'broker round',
  },
  {
    id: 'MG9',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: -1,
    driftBps: 65,
    short: { en: 'antitrust clock', zh: '反垄断时限' },
    headline: {
      en: 'The antitrust review asks for more time on the sector deal',
      zh: '反垄断审查就这笔板块交易要求更多时间',
    },
    detail: {
      en: 'Phase two has been extended and the regulator has published a list of questions that goes beyond market share into hiring and data. Extensions are common and most deals still clear, but this timetable now runs past the financing commitment, and the commitment letter has a date on it. Arbitrage desks marked the spread wider on the headline, and two clients asked about the downside case before lunch.',
      zh: '第二阶段被延长，监管机构公布了一份问题清单，内容超出市场份额，涉及招聘和数据。延期很常见，多数交易仍能通过，但这条时间表现在已经超过融资承诺的期限。套利台在这条消息上把价差标记得更宽。',
    },
    source: 'regulatory notice',
  },
  {
    id: 'MG10',
    kind: 'equity',
    tag: 'TSCO',
    impact: 3,
    symbol: 'TSCO',
    direction: -1,
    driftBps: 100,
    short: { en: 'financing terms', zh: '融资条件' },
    headline: {
      en: 'Lenders want more equity in the Tesco structure',
      zh: '出借方希望乐购这笔交易的结构里有更多股本',
    },
    detail: {
      en: 'Members of the banking group around the consortium have asked for a larger equity cheque and a shorter commitment letter, according to two people involved. That does not kill a deal, but it changes who can afford to bid and how much. Any revised offer would land after the current timetable, which the board has said it will not extend.',
      zh: '据两位知情人士说，该财团银行团的成员要求更大的股本支票和更短的承诺函期限。这不至于让交易告吹，但会改变谁能出得起价、能出多少。任何修改后的报价都会晚于当前时间表，而董事会说过不会延期。',
    },
    source: 'wire',
  },
  {
    id: 'MG11',
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    short: { en: 'auction focus', zh: '竞价关注' },
    headline: {
      en: 'The closing auction is where the two names will be judged',
      zh: '这两只股票的成色要看收盘竞价',
    },
    detail: {
      en: 'Deal-driven names often trade strangely into the close: hedges are adjusted, index funds do not care about the story, and the print can land some distance from where the screen was. The desk suggests watching the auction imbalance rather than the last trade, and treating the final print as the real mark for the day rather than for the screen.',
      zh: '受交易驱动的股票在临近收盘时往往走得奇怪：对冲要调整，指数基金并不关心故事，最终成交价可能离屏幕上的价格有一段距离。交易台建议看竞价失衡，而不是最后一笔成交，并把收盘定盘价当作当天的真实标记。',
    },
    source: 'desk note',
  },
  {
    id: 'MG12',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: -1,
    driftBps: 45,
    short: { en: 'break risk', zh: '告吹风险' },
    headline: {
      en: 'Arb desks are pricing a wider chance that the talks end without a deal',
      zh: '套利台正在为谈判无果收场定更高的概率',
    },
    detail: {
      en: 'The spread has widened for three sessions and now implies a meaningful chance that no transaction happens. That repricing is about process rather than the businesses: financing, timing and the regulator all sit on the critical path, and none of them is under the control of either company. A confirmed bid would close most of it; a walk-away would not.',
      zh: '价差已经连续三个交易日走阔，现在隐含了相当概率的交易落空。这次重新定价针对的是流程而不是生意本身：融资、时间表和监管都在关键路径上。一旦出现确定报价，大部分价差会收掉；一旦放弃，就收不掉了。',
    },
    source: 'market colour',
  },
]
