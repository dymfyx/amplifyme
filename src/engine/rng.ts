/**
 * 确定性随机数：引擎状态里只保存一个 32 位整数种子，
 * 每次 step 用 [value, nextSeed] 的形式推进，保证同样的输入得到同样的输出（便于测试与复盘）。
 */

export function createSeed(seed: number): number {
  const mixed = (seed ^ 0x9e3779b9) >>> 0
  return mixed === 0 ? 1 : mixed
}

/** mulberry32：返回 [0,1) 的随机数与下一个种子 */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0
  let t = Math.imul(next ^ (next >>> 15), 1 | next)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, next]
}

export function randomInt(state: number, min: number, max: number): [number, number] {
  const [value, next] = nextRandom(state)
  return [min + Math.floor(value * (max - min + 1)), next]
}

export function pickOne<T>(state: number, values: readonly T[]): [T, number] {
  const [value, next] = nextRandom(state)
  return [values[Math.floor(value * values.length) % values.length], next]
}

/** 近似正态（三个均匀分布相加），均值为 0，范围约 [-1.5, 1.5] */
export function normalish(state: number): [number, number] {
  let rng = state
  let total = 0
  for (let i = 0; i < 3; i += 1) {
    const [value, next] = nextRandom(rng)
    rng = next
    total += value
  }
  return [total - 1.5, rng]
}
