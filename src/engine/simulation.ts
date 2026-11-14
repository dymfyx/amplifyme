/**
 * 可推进的模拟市场引擎。
 *
 * 设计约束：
 * - 纯函数：`stepSession` 只依赖传入的 state，同样的 state 一定得到同样的结果（随机数种子存在 state 里）。
 * - 30 分钟 = 15 个交易日，所以 1 个 tick（250ms 真实时间）推进 48.75 个模拟秒；
 *   5 / 15 分钟档位只是把同一段模拟时间压得更短（见 SESSION_TIERS），tick 频率不变。
 * - 报价/派单/成交都在引擎里结算，UI 只负责渲染和派发动作。
 */

export * from './simulation/index'
