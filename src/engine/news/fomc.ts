import type { NewsPool } from '../news'

/**
 * FOMC：央行决议日的剧本。
 * 从决议前的等待、声明落地、发布会措辞，到曲线、防御盘和收盘流动性。
 * 标题只给事件和措辞，方向留给标的、曲线和盘口去回答。
 */
export const fomcNews: NewsPool = [
  {
    id: 'FM1',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'Fed watch', zh: '决议观望' },
    headline: {
      en: 'Screens mark time before the 18:00 statement',
      zh: '18:00 的声明之前，屏幕先进入等待',
    },
    detail: {
      en: 'Overnight index pricing has barely moved since Monday: a hold is close to fully discounted, with two cuts still priced across the remainder of the year. Index options imply a little over 1% of movement by tomorrow close, rich for a meeting without a projection update. Positioning is described as light and evenly split, so the first headline may meet less resistance than usual.',
      zh: '隔夜指数互换自周一以来几乎没动：按兵不动的定价已经接近充分，年内剩下的两次降息也仍在价格里。指数期权隐含到明收盘约 1% 的波幅，对一个不更新经济预测的会议来说偏贵。仓位听说很轻、多空也算均衡，所以第一条标题出来时，阻力可能比平时小。',
    },
    source: 'desk note',
  },
  {
    id: 'FM2',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: 1,
    driftBps: 60,
    short: { en: 'statement day', zh: '声明落地' },
    headline: {
      en: 'The statement keeps the target range and rewrites the inflation paragraph',
      zh: '声明维持利率区间，重写了通胀那一段',
    },
    detail: {
      en: 'The committee left the target range where it was and changed only the inflation paragraph, softening the language and adding a reference to further progress. The median dot still shows two cuts this year, and one participant moved a projection down. The tape had been braced for a more cautious sentence, so the rewrite lands as the real information of the day.',
      zh: '委员会维持利率区间不变，只改写了通胀那一段：措辞放软，并补了一句关于进一步进展的表述。点阵图中位数仍显示今年两次降息，还有一位委员把预测往下调。市场原本防的是一句更谨慎的话，所以这次改写才是当天真正的信息。',
    },
    source: 'wire',
  },
  {
    id: 'FM3',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: -1,
    driftBps: 80,
    short: { en: 'presser', zh: '发布会' },
    headline: {
      en: 'The press conference takes the questions in a different direction',
      zh: '发布会上，提问被带向了另一个方向',
    },
    detail: {
      en: 'Asked four times whether the projected cuts are still appropriate, the chair declined to endorse the path priced by the market and returned to wage growth and services inflation. Two reporters tried again in different words and got the same answer. The front end has given back most of the move from the morning, and the press conference is only halfway through.',
      zh: '被四次问到预测中的降息是否仍然合适，主席都没有为市场已经定价的路径背书，而是把话题带回工资增长和服务业通胀。两位记者换了说法再问，得到的还是同一个答案。前端已经把上午的变动回吐了大半，而发布会才进行到一半。',
    },
    source: 'wire',
  },
  {
    id: 'FM4',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: 1,
    driftBps: 55,
    short: { en: 'no pushback', zh: '不作反驳' },
    headline: {
      en: 'The chair declines to push back on market pricing',
      zh: '主席没有去动市场的定价',
    },
    detail: {
      en: 'There was no pushback on the easing path this time, and the chair described the current stance as well placed. He said the committee would respond if the labour market cracked, which is as close to a green light as this desk has heard all year. Two-year yields are back at the session lows and the curve has bull-steepened since the statement.',
      zh: '这一次，主席没有对降息路径作出反驳。他把当前立场形容为位置合适，并表示如果劳动力市场出现裂口，委员会会作出反应——在我们台听来，这已经接近全年最明确的一次放行。两年期收益率回到日内低位，声明之后曲线呈牛陡。',
    },
    source: 'market colour',
  },
  {
    id: 'FM5',
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    direction: -1,
    driftBps: 65,
    short: { en: 'long end', zh: '长端' },
    headline: {
      en: 'The long end does the work after the statement',
      zh: '声明之后，长端承担了主要动作',
    },
    detail: {
      en: 'Ten-year yields are nine basis points higher while the front end is unchanged, which puts the 2s10s slope through its steepest level since spring. The move is being attributed to term premium rather than to the policy path, and mortgage desks have widened their spreads. Equity duration is the obvious transmission channel, and the growth screens have been the first to feel it.',
      zh: '十年期收益率上行了九个基点，前端却几乎没动，2s10s 斜率因此走到春季以来最陡。市场把这次变动归因于期限溢价，而不是政策路径，抵押贷款台已经拉宽了价差。股票久期是最直接的传导渠道，成长股那边最先感受到。',
    },
    source: 'wire',
  },
  {
    id: 'FM6',
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    direction: 1,
    driftBps: 45,
    short: { en: 'dissent', zh: '异议票' },
    headline: {
      en: 'One vote on the committee goes the other way',
      zh: '委员会里有一票投向了另一边',
    },
    detail: {
      en: 'The statement shows a single dissent, and it came from a governor who has publicly argued that policy is too tight. The rest of the committee did not follow, but the vote gives the doves a documented anchor for the next meeting. Front-end swaps added two basis points of easing after the release, and the desk is watching whether the wires follow up.',
      zh: '声明里出现了一张异议票，来自一位公开主张政策过紧的理事。其余委员没有跟，但这票给了鸽派在下一次会议上一个有记录的抓手。声明出来后，前端互换多计入了两个基点的宽松，交易台在看通讯社会不会跟进放大。',
    },
    source: 'wire',
  },
  {
    id: 'FM7',
    kind: 'equity',
    tag: 'AZN',
    impact: 2,
    symbol: 'AZN',
    direction: 1,
    driftBps: 70,
    short: { en: 'defensive bid', zh: '防御买盘' },
    headline: {
      en: 'The defensive list is where the afternoon flow is being worked',
      zh: '下午的流水，都集中在防御类名单上',
    },
    detail: {
      en: 'Healthcare and staples are the only sectors with consistent two-way size, and the fills are happening on the offer. A European wealth desk has been the largest buyer of AstraZeneca since the statement, splitting the order across three brokers to avoid showing size. The rest of the board is quieter than the index futures would suggest this late in the session.',
      zh: '医疗和必需消费是仅有的两个还能持续做出双边量的板块，而且成交都打在卖价上。声明之后，一家欧洲财富管理机构一直是阿斯利康最大的买家，单子拆给三家经纪商做，免得暴露体量。除了这两个板块，其余盘面在临近收盘时比股指期货所反映的要安静。',
    },
    source: 'market colour',
  },
  {
    id: 'FM8',
    kind: 'equity',
    tag: 'NFLX',
    impact: 2,
    symbol: 'NFLX',
    direction: -1,
    driftBps: 85,
    short: { en: 'duration', zh: '久期' },
    headline: {
      en: 'Netflix trades as a rate instrument again',
      zh: '奈飞又被打回利率品种来交易',
    },
    detail: {
      en: 'The stock has tracked the ten-year yield tick for tick since the statement, and the correlation is the highest it has been this quarter. Options desks report demand for downside protection into Friday, with the front-week put skew steepening. One large holder rolled a covered call a strike higher, which the desk reads as a cap rather than an exit.',
      zh: '声明之后，这只股票几乎跟着十年期收益率一跳一跳地走，相关性是本站季度最高。期权台报告周五前有对下行保护的需求，近月一周的看跌偏斜在变陡。还有一家大股东把备兑看涨期权往上移了一档，交易台把这读成设上限，而不是离场。',
    },
    source: 'market colour',
  },
  {
    id: 'FM9',
    kind: 'equity',
    tag: 'TSCO',
    impact: 2,
    symbol: 'TSCO',
    direction: 1,
    driftBps: 50,
    short: { en: 'staples', zh: '必需消费' },
    headline: {
      en: 'Grocery names pick up the volume the index leaves behind',
      zh: '指数留下的量，被杂货股接了过去',
    },
    detail: {
      en: 'Tesco is trading at a premium to its sector for the first time in a month, and the flow is described as real money rather than fast money. UK grocers are being used as the defensive leg: clients are short index futures against long cash positions in the sector. The beta of the stock to the index has fallen below 0.5 this week.',
      zh: 'Tesco 一个月来第一次相对板块出现溢价，而且这波流水被形容为真钱，不是快钱。英国杂货股正被当作防御腿：客户一边空指数期货，一边在这个板块持现货多头。本周这只股票对指数的 beta 已经掉到 0.5 以下。',
    },
    source: 'market colour',
  },
  {
    id: 'FM10',
    kind: 'equity',
    tag: 'TSLA',
    impact: 2,
    symbol: 'TSLA',
    direction: -1,
    driftBps: 95,
    short: { en: 'high beta', zh: '高贝塔' },
    headline: {
      en: 'Tesla carries the board beta into the afternoon',
      zh: '下午的贝塔，全压在特斯拉身上',
    },
    detail: {
      en: 'With the index flat and the statement digested, Tesla is doing twice the implied move of the index on half the usual volume. Market makers have widened quotes and cut size, and the flow has been one-way: clients buying puts and selling stock to fund the premium. One desk reports a large risk-reversal from the spring being unwound in the front two expiries.',
      zh: '指数走平、声明也消化完了，特斯拉却在用一半的成交量做出两倍于指数的隐含波幅。做市商拉宽了报价、缩小了挂单量，流水是单边的：客户买看跌期权，再卖股票来付权利金。还有一家台在拆一笔春季建的大风险逆转，集中在最近两个到期月。',
    },
    source: 'market colour',
  },
  {
    id: 'FM11',
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    short: { en: 'thin close', zh: '尾盘变薄' },
    headline: {
      en: 'The last half hour is thinner than the calendar suggests',
      zh: '最后半小时的流动性，比日历上看起来要薄',
    },
    detail: {
      en: 'Closing auction estimates are running at roughly 60% of the twenty-day average, and two index desks have already revised their imbalance numbers once. Quoted size in the top five names is now barely a third of what it was at the open. Desks that need to finish size today are being advised to work it early rather than into the print.',
      zh: '收盘集合竞价的预估量只有二十日均值的六成左右，两家指数台已经把失衡数字改过一次。前五大权重股的报价挂单量，现在只剩开盘时的三分之一。今天必须做完量的台，被建议早点动手，而不是等到收盘印出来。',
    },
    source: 'desk note',
  },
  {
    id: 'FM12',
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    short: { en: 'auction notice', zh: '竞价提示' },
    headline: {
      en: 'The exchange publishes a note on closing auction parameters',
      zh: '交易所就收盘竞价参数发出通知',
    },
    detail: {
      en: 'The notice confirms the collar, the cut-off time and the indicative publication schedule for the closing auction today, and it reminds participants that late revisions are not accepted after the freeze. Nothing in it changes the mechanics from yesterday, but operations desks are re-checking connectivity given the volumes seen this week. The exchange also flagged a weekend test of the backup matching engine.',
      zh: '通知确认了今日收盘竞价的价幅限制、截单时间和指示性价格的发布节奏，并提醒参与者在冻结之后不再接受改单。内容和昨天相比没有任何机制上的变化，但考虑到本周的量，运营台还是在重新检查连接。交易所同时提示，周末将进行备用撮合引擎的演练。',
    },
    source: 'exchange notice',
  },
]
