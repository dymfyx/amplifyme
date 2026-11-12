import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  TICK_MS,
  createSession,
  cycleSpeed,
  declineDispatch,
  fillClientOrder,
  sendQuote,
  setSpeed as applySpeed,
  stepSession,
  togglePause,
  type ActionResult,
  type FillInput,
  DEFAULT_MINUTES,
  type OpeningPosition,
  type SessionMinutes,
  type QuoteInput,
  type SimulationState,
} from '../engine/simulation'

export interface SimulationApi {
  state: SimulationState
  latencyMs: number
  fillClientOrder: (input: FillInput) => string
  sendQuote: (input: QuoteInput) => string
  declineDispatch: (rfqId: string) => string
  togglePause: () => void
  cycleSpeed: () => void
  setSpeed: (speed: number) => void
  /** 换种子重开一局；固定种子（分享链接）时按同一道题重放 */
  restart: () => void
}

/**
 * 把纯引擎挂到 React 上：固定 250ms 一个 tick，按 speed 在一个 tick 内连续推进多步。
 * 所有写操作都走同一个 ref，避免 setState 的异步 updater 与动作回调读到旧状态。
 */
export function useSimulation(
  initial: SimulationState,
  openingBook: OpeningPosition[] = [],
  fixedSeed: number | null = null,
  minutes: SessionMinutes = DEFAULT_MINUTES,
): SimulationApi {
  const [state, setState] = useState<SimulationState>(initial)
  const [latencyMs, setLatencyMs] = useState(14)
  const latest = useRef(state)

  const commit = useCallback((next: SimulationState) => {
    latest.current = next
    setState(next)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const started = performance.now()
      const current = latest.current
      let next = current
      for (let step = 0; step < current.speed; step += 1) {
        const stepped = stepSession(next)
        if (stepped === next) break
        next = stepped
      }
      if (next !== current) commit(next)
      const elapsed = Math.max(1, Math.round(performance.now() - started))
      setLatencyMs((previous) => (previous === elapsed ? previous : elapsed))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [commit])

  const run = useCallback(
    (action: (current: SimulationState) => ActionResult): string => {
      const result = action(latest.current)
      commit(result.state)
      return result.message
    },
    [commit],
  )

  return useMemo<SimulationApi>(
    () => ({
      state,
      latencyMs,
      fillClientOrder: (input) => run((current) => fillClientOrder(current, input)),
      sendQuote: (input) => run((current) => sendQuote(current, input)),
      declineDispatch: (rfqId) => run((current) => declineDispatch(current, rfqId)),
      togglePause: () => commit(togglePause(latest.current)),
      cycleSpeed: () => commit(cycleSpeed(latest.current)),
      setSpeed: (speed) => commit(applySpeed(latest.current, speed)),
      restart: () => commit(createSession(fixedSeed ?? undefined, openingBook, { minutes })),
    }),
    [state, latencyMs, run, commit, openingBook, fixedSeed, minutes],
  )
}
