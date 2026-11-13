import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProgressDrawer from '../components/ProgressDrawer'
import type { ArchivedSession } from '../storage/archive'

/**
 * ProgressDrawer 的单测：全部用手工构造的 ArchivedSession 夹具，不碰引擎。
 * 默认 I18n context 就是英文，所以直接 render 即可，不需要 I18nProvider。
 */

const makeSession = (overrides: Partial<ArchivedSession> = {}): ArchivedSession => ({
  id: 'session-1',
  savedAt: '2026-11-13T06:05:00.000Z',
  desk: 'sales',
  scenarioId: 'classic',
  scenarioName: 'Classic',
  minutes: 30,
  seed: 1,
  total: 1234,
  realised: 900,
  unrealised: 334,
  commission: -120,
  cash: 100000,
  benchmarkPnl: 800,
  alpha: 434,
  composite: 72.5,
  percentile: 84,
  trades: 12,
  quotes: 88,
  informedFills: 5,
  informedRfqs: 9,
  adverse: 2,
  missed: 3,
  worstDrawdown: 250,
  tags: [],
  ...overrides,
})

const renderDrawer = (sessions: ArchivedSession[]): { onClose: ReturnType<typeof vi.fn> } => {
  const onClose = vi.fn()
  render(<ProgressDrawer sessions={sessions} onClose={onClose} />)
  return { onClose }
}

describe('ProgressDrawer', () => {
  it('renders the summary tiles with session count and average score', () => {
    renderDrawer([
      makeSession({ id: 'summary-a', composite: 70, alpha: 300 }),
      makeSession({ id: 'summary-b', composite: 40, alpha: -100, desk: 'market-maker' }),
    ])

    expect(screen.getByTestId('progress-tile-sessions')).toHaveTextContent('2')
    expect(screen.getByTestId('progress-tile-score')).toHaveTextContent('55.0')
    expect(screen.getByTestId('progress-tile-alpha')).toHaveTextContent('$100')
    expect(screen.getByTestId('progress-tile-beat')).toHaveTextContent('1 / 2')
  })

  it('renders the trend svg with a polyline for the composite series', () => {
    renderDrawer([
      makeSession({ id: 'trend-a', savedAt: '2026-11-10T09:00:00.000Z', composite: 45 }),
      makeSession({ id: 'trend-b', savedAt: '2026-11-11T09:00:00.000Z', composite: 62 }),
      makeSession({ id: 'trend-c', savedAt: '2026-11-12T09:00:00.000Z', composite: 71 }),
    ])

    const trend = screen.getByTestId('progress-trend')
    expect(trend.tagName.toLowerCase()).toBe('svg')
    expect(trend).toHaveAttribute('viewBox', '0 0 640 160')

    const polyline = trend.querySelector('polyline')
    expect(polyline).not.toBeNull()
    expect(polyline?.getAttribute('points')?.trim().split(/\s+/)).toHaveLength(3)
    expect(trend.querySelectorAll('circle')).toHaveLength(3)
  })

  it('breaks sessions down by desk with rows for both desks', () => {
    renderDrawer([
      makeSession({ id: 'desk-a' }),
      makeSession({ id: 'desk-b', desk: 'market-maker', composite: 41.2, alpha: -80 }),
    ])

    const table = screen.getByTestId('progress-desk-table')
    expect(table.tagName.toLowerCase()).toBe('table')
    expect(table).toHaveClass('progress-table')
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(within(table).getByText('Sales')).toBeInTheDocument()
    expect(within(table).getByText('Market Maker')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'BY DESK' })).toBeInTheDocument()
  })

  it('lists the most common weakness with its count', () => {
    renderDrawer([
      makeSession({ id: 'tags-a', tags: ['Overtrading', 'Chasing the tape'] }),
      makeSession({ id: 'tags-b', tags: ['Overtrading', 'Holding losers'] }),
    ])

    expect(screen.getByText('MOST COMMON WEAKNESSES')).toBeInTheDocument()
    expect(screen.getByText('Overtrading')).toBeInTheDocument()
    expect(screen.getByText('×2')).toBeInTheDocument()
    expect(screen.getByText('Chasing the tape')).toBeInTheDocument()
  })

  it('closes on ESC and on backdrop click', () => {
    const { onClose } = renderDrawer([makeSession({ id: 'close-a' })])

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('progress-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
