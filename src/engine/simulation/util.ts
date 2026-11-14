import { DAY_SECONDS, SESSION_DAYS, START_SECONDS } from './constants'

export const round2 = (value: number) => Math.round(value * 100) / 100

export const pad = (value: number) => String(Math.floor(value)).padStart(2, '0')

/* ------------------------------------------------------------------ */
/* 时间                                                                */
/* ------------------------------------------------------------------ */
export function formatClock(simSeconds: number): string {
  const elapsed = ((simSeconds - START_SECONDS) % DAY_SECONDS + DAY_SECONDS) % DAY_SECONDS
  const total = START_SECONDS + elapsed
  return `${pad(total / 3600)}:${pad((total % 3600) / 60)}:${pad(total % 60)}`
}

export function formatShortTime(simSeconds: number): string {
  return formatClock(simSeconds).slice(0, 5)
}

export function dayIndexAt(simSeconds: number): number {
  const elapsed = Math.max(0, simSeconds - START_SECONDS)
  return Math.min(SESSION_DAYS, Math.floor(elapsed / DAY_SECONDS) + 1)
}
