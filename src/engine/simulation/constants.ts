/**
 * 可推进的模拟市场引擎。
 *
 * 设计约束：
 * - 纯函数：`stepSession` 只依赖传入的 state，同样的 state 一定得到同样的结果（随机数种子存在 state 里）。
 * - 30 分钟 = 15 个交易日，所以 1 个 tick（250ms 真实时间）推进 48.75 个模拟秒；
 *   5 / 15 分钟档位只是把同一段模拟时间压得更短（见 SESSION_TIERS），tick 频率不变。
 * - 报价/派单/成交都在引擎里结算，UI 只负责渲染和派发动作。
 */
export const TICK_MS = 250

export const SPEEDS = [1, 2, 4] as const

export const DAY_SECONDS = 6.5 * 3600

export const SESSION_DAYS = 15

export const SESSION_SECONDS = DAY_SECONDS * SESSION_DAYS

export const START_SECONDS = 9 * 3600 + 30 * 60

/** 练习时长档位：同样的 15 个模拟交易日，压缩进 5 / 15 / 30 分钟真实时间 */
export type SessionMinutes = 5 | 15 | 30

export const SESSION_TIERS: SessionMinutes[] = [5, 15, 30]

export const DEFAULT_MINUTES: SessionMinutes = 30

/**
 * 每档位下一个 tick（250ms 真实时间）推进多少模拟秒：
 * 5 分钟档 292.5 秒/tick、15 分钟档 97.5、30 分钟档 48.75。
 * 档位只压缩时间轴，不改 tick 频率 —— 短档位反而更密（同样 20 条消息挤进更短的真实时间）。
 */
export const simSecondsPerTick = (minutes: SessionMinutes): number =>
  SESSION_SECONDS / ((minutes * 60 * 1000) / TICK_MS)

/** 默认 30 分钟档的节奏，保留给旧调用方与测试 */
export const SIM_SECONDS_PER_TICK = simSecondsPerTick(DEFAULT_MINUTES)

/**
 * 行情节奏：时钟每帧都走，价格与盘口每帧（0.25 秒真实时间）刷新一次，所以盘口是连续变的。
 * 每一帧的净变动都由「一笔微观流动 + 尚未释放完的新闻冲击」组成，没有无来源的随机噪声。
 */
export const PRICE_UPDATE_TICKS = 1

/** 新闻冲击每帧释放剩余幅度的 25%，几帧内释放完但会留下明显方向 */
export const DRIFT_RELEASE = 0.25

/** 每条新闻冲击最多存活多少帧行情（超过就清掉，避免长尾一直拖） */
export const DRIFT_TTL = 24

/** 每帧最多保留几个驱动因素写进价格记录 */
export const MAX_PRICE_DRIVERS = 3

/** 价格记录（供 PRICE TAPE 面板）保留多少条 */
export const PRICE_TAPE_LIMIT = 180

/** 只有当价格相对上次建簿的位置移动超过这个基点，才重建盘口 */
export const BOOK_MIN_MOVE_BPS = 8

/** 单条新闻冲击大于这个基点时强制重挂盘口（大消息必须立刻体现在报价上） */
export const FORCED_REBOOK_BPS = 12

/** 每次行情刷新有多大概率出现一笔微观流动：几乎每帧都有，但绝大多数是小单，偶尔才有一笔扫单 */
export const FLOW_CHANCE = 0.92

/** 我们自己的成交对价格的冲击：3–10bps，按成交金额线性放大，之后逐帧衰减 */
export const FILL_IMPACT_MIN_BPS = 3

export const FILL_IMPACT_MAX_BPS = 10

/** 成交金额到这个规模（约 200 万股 × 800 元）时冲击用满 10bps */
export const FILL_IMPACT_FULL_NOTIONAL = 1_600_000

/** 成交冲击先立刻走掉一部分，剩下的再逐帧衰减（避免冲击一闪而过看不见） */
export const FILL_IMPACT_SHARE = 0.4

/** 成交冲击剩余部分的存活帧数，和新闻冲量一样每帧释放剩余幅度的 25% */
export const FILL_IMPACT_TTL = 12

/** 报价比市场价差每宽 1 倍，被成交的概率下降多少（宽度 = 逆向选择的对价） */
export const WIDTH_FILL_PENALTY = 0.35

export const MIN_FILL_PROBABILITY = 0.12

export const MAX_FILL_PROBABILITY = 0.96

/** 佣金按成交额的 5 个基点/边计（真实股票佣金量级），不会吃掉正常点差利润 */
export const COMMISSION_RATE = 0.0005

/** 销售/做市台的总持有资金上限 */
export const STARTING_CASH = 20_000_000

/** 1 根 = 一次行情刷新（0.25 秒真实时间 ≈ 48.75 模拟秒），1 个交易日正好 480 根 */
export const CHART_POINTS = 480

export const HISTORY_POINTS = 480

export const MAX_DISPATCH = 3

export const MAX_QUOTES = 14

/** 没有消息时派单的间隔（模拟秒），有头条时按 INFORMED_INTERVAL_* 提速 */
export const DISPATCH_INTERVAL = 6000

export const INFORMED_INTERVAL_MIN = 1000

export const INFORMED_INTERVAL_MAX = 2400

/** 派单在客户失去耐心前有效（模拟秒），按客户画像的 patience 缩放 */
export const DISPATCH_TTL = 6000

/** 客户画像里 patience 的基准值（对应 DISPATCH_TTL） */
export const PATIENCE_BASE = 15

/** 排队消耗速度：每帧这个价位附近有多少主动成交量（占每档挂单量的比例 × 随机倍数） */
export const QUEUE_FLOW_MIN = 0.25

export const QUEUE_FLOW_MAX = 0.9

/** 回放用的价格快照上限（30 分钟档 7200 帧以内） */
export const HISTORY_LIMIT = 8000

/* 30 个智能体聚合后的流量/成交量缩放：人多但盘口深度不变，避免把行情打飞 */
export const AGENT_FLOW_SCALE = 0.5

export const AGENT_VOLUME_SCALE = 0.25
