import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GhostDrawer from '../components/GhostDrawer'
import type { GhostDecision, GhostSession, GhostSummary } from '../storage/ghost'

const ghostSummary: GhostSummary = {
  desk: 'market-maker',
  scenarioName: 'Rate shock',
  tier: 2,
  minutes: 30,
  seed: 20261112,
  composite: 71.4,
  percentile: 76,
  total: 1240,
  alpha: 180,
  trades: 46,
  tags: ['patient', 'tight book'],
}

const currentSummary: GhostSummary = {
  desk: 'sales',
  scenarioName: 'Rate shock',
  tier: 2,
  minutes: 30,
  seed: 20261112,
  composite: 68.2,
  percentile: 70,
  total: 900,
  alpha: 120,
  trades: 38,
  tags: [],
}

const makeDecision = (index: number): GhostDecision => ({
  id: `d-${index}`,
  tick: index + 1,
  time: `09:${30 + index}:00`,
  kind: index % 3 === 0 ? 'quote' : index % 3 === 1 ? 'fill' : 'decline',
  label: `Decision ${index + 1}`,
  detail: `Detail ${index + 1}`,
})

const ghostWith = (decisions: GhostDecision[]): GhostSession => ({
  version: 1,
  id: 'GH-test',
  savedAt: '2026-11-12T10:00:00.000Z',
  summary: ghostSummary,
  decisions,
})

type DrawerProps = Parameters<typeof GhostDrawer>[0]

const renderDrawer = (overrides: Partial<DrawerProps> = {}): DrawerProps => {
  const props: DrawerProps = {
    ghost: null,
    current: null,
    onImport: vi.fn<(text: string) => string>(() => ''),
    onClose: vi.fn<() => void>(),
    ...overrides,
  }
  render(<GhostDrawer {...props} />)
  return props
}

describe('GhostDrawer', () => {
  it('renders the import form and forwards textarea JSON on load', () => {
    const props = renderDrawer()

    expect(screen.getByRole('dialog', { name: 'Ghost compare' })).toBeInTheDocument()
    const fileInput = screen.getByLabelText('Ghost session file')
    expect(fileInput).toHaveAttribute('type', 'file')
    expect(fileInput).toHaveAttribute('accept', 'application/json')

    const load = screen.getByRole('button', { name: 'LOAD GHOST' })
    expect(load).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Ghost session JSON'), {
      target: { value: '{"summary":{"desk":"sales"}}' },
    })
    expect(load).toBeEnabled()

    fireEvent.click(load)
    expect(props.onImport).toHaveBeenCalledWith('{"summary":{"desk":"sales"}}')
  })

  it('shows a non-empty import error in an alert', () => {
    renderDrawer({
      onImport: vi.fn<(text: string) => string>(() => 'That file is not valid JSON.'),
    })

    fireEvent.change(screen.getByLabelText('Ghost session JSON'), {
      target: { value: 'not json' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'LOAD GHOST' }))

    expect(screen.getByRole('alert')).toHaveTextContent('That file is not valid JSON.')
  })

  it('compares yours against the ghost and renders a signed delta', () => {
    renderDrawer({ ghost: ghostWith([makeDecision(0)]), current: currentSummary })

    expect(screen.getByText('YOURS')).toBeInTheDocument()
    expect(screen.getByText('GHOST')).toBeInTheDocument()
    expect(screen.getByText('DELTA')).toBeInTheDocument()

    const scoreRow = screen.getByTestId('ghost-row-score')
    expect(within(scoreRow).getByText('68.2')).toBeInTheDocument()
    expect(within(scoreRow).getByText('71.4')).toBeInTheDocument()

    const delta = within(scoreRow).getByText('-3.2')
    expect(delta).toHaveClass('ghost-delta--down')

    // alpha 带明确符号，P&L 用 $1,240 这样的金额格式
    const alphaRow = screen.getByTestId('ghost-row-alpha')
    expect(within(alphaRow).getByText('+$120')).toBeInTheDocument()
    expect(within(alphaRow).getByText('+$180')).toBeInTheDocument()
    expect(within(alphaRow).getByText('-$60')).toBeInTheDocument()

    const totalRow = screen.getByTestId('ghost-row-total')
    expect(within(totalRow).getByText('$900')).toBeInTheDocument()
    expect(within(totalRow).getByText('$1,240')).toBeInTheDocument()
    expect(within(totalRow).getByText('-$340')).toBeInTheDocument()
  })

  it('caps the ghost decision list at twenty and reports the remainder', () => {
    const decisions = Array.from({ length: 25 }, (_, index) => makeDecision(index))
    renderDrawer({ ghost: ghostWith(decisions), current: currentSummary })

    expect(screen.getAllByTestId('ghost-decision')).toHaveLength(20)
    expect(screen.getByText('…and 5 more')).toBeInTheDocument()
  })

  it('closes on ESC and on backdrop click', () => {
    const props = renderDrawer()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('ghost-backdrop'))
    expect(props.onClose).toHaveBeenCalledTimes(2)

    // 点面板内部不应关闭
    fireEvent.click(screen.getByRole('dialog', { name: 'Ghost compare' }))
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })
})
