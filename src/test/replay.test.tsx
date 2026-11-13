import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ReplayDrawer, {
  type ReplayDecision,
  type ReplayDrawerProps,
  type ReplayEvent,
  type ReplayFrame,
} from '../components/ReplayDrawer'

const symbols = ['AZN', 'NFLX']

const frames: ReplayFrame[] = [
  { tick: 10, time: '09:30:00', prices: { AZN: 100, NFLX: 480 } },
  { tick: 20, time: '09:30:01', prices: { AZN: 101, NFLX: 482 } },
  { tick: 30, time: '09:30:02', prices: { AZN: 99.5, NFLX: 485 } },
  { tick: 40, time: '09:30:03', prices: { AZN: 102, NFLX: 483 } },
  { tick: 50, time: '09:30:04', prices: { AZN: 103.5, NFLX: 486 } },
]

const decisions: ReplayDecision[] = [
  {
    id: 'decision-1',
    tick: 25,
    time: '09:30:01',
    kind: 'quote',
    label: 'Quoted AZN',
    detail: 'Two-way 99.80 / 100.20',
  },
  {
    id: 'decision-2',
    tick: 40,
    time: '09:30:03',
    kind: 'fill',
    label: 'Client fill',
    detail: 'Bought 2,000 AZN at 99.90',
    tone: 'up',
  },
  {
    id: 'decision-3',
    tick: 90,
    time: '09:30:09',
    kind: 'decline',
    label: 'Declined RFQ',
    detail: 'Size too large for the book',
    tone: 'down',
  },
]

const events: ReplayEvent[] = [
  { id: 'event-1', tick: 15, time: '09:30:01', label: 'CPI print', direction: 1 },
  { id: 'event-2', tick: 35, time: '09:30:03', label: 'Fed speaker' },
  { id: 'event-3', tick: 45, time: '09:30:04', label: 'Guidance cut', direction: -1 },
]

const session = { desk: 'Market Making', seed: 20261112, minutes: 5, scenario: 'Rate shock' }

const setup = (overrides: Partial<Omit<ReplayDrawerProps, 'onClose'>> = {}) => {
  const onClose = vi.fn()
  render(
    <ReplayDrawer
      frames={frames}
      decisions={decisions}
      events={events}
      symbols={symbols}
      session={session}
      {...overrides}
      onClose={onClose}
    />,
  )
  return onClose
}

describe('ReplayDrawer', () => {
  it('renders the session summary and one chip per symbol', () => {
    setup()

    expect(screen.getByRole('dialog', { name: 'Session replay' })).toBeInTheDocument()
    expect(screen.getByText('SESSION REPLAY')).toBeInTheDocument()
    expect(screen.getByText(/Market Making/)).toBeInTheDocument()
    expect(screen.getByText(/SEED 20261112/)).toBeInTheDocument()
    expect(screen.getByText(/5 MIN/)).toBeInTheDocument()
    expect(screen.getByText(/Rate shock/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CLOSE' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'AZN' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'NFLX' })).toHaveAttribute('aria-pressed', 'false')

    const chart = screen.getByRole('img', { name: 'AZN price across the session' })
    expect(chart).toHaveAttribute('viewBox', '0 0 1000 320')
    expect(chart).toHaveAttribute('preserveAspectRatio', 'none')
    expect(chart.querySelectorAll('.replay__event')).toHaveLength(events.length)
    expect(chart.querySelectorAll('.replay__mark')).toHaveLength(decisions.length)

    fireEvent.click(screen.getByRole('button', { name: 'NFLX' }))
    expect(screen.getByRole('button', { name: 'NFLX' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AZN' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('img', { name: 'NFLX price across the session' })).toBeInTheDocument()
  })

  it('updates the displayed frame when the scrubber moves', () => {
    setup()

    const scrubber = screen.getByLabelText<HTMLInputElement>('Replay position')
    expect(scrubber.value).toBe('0')
    expect(screen.getByTestId('replay-frame-time')).toHaveTextContent('09:30:00')

    fireEvent.change(scrubber, { target: { value: '3' } })

    expect(scrubber.value).toBe('3')
    expect(screen.getByTestId('replay-frame-time')).toHaveTextContent('09:30:03')
    expect(screen.getByText('102.00')).toBeInTheDocument()
    expect(screen.getByText('483.00')).toBeInTheDocument()
  })

  it('jumps the scrubber to the nearest frame when a decision row is clicked', () => {
    setup()

    fireEvent.click(screen.getByRole('button', { name: /Quoted AZN/ }))
    expect(screen.getByLabelText<HTMLInputElement>('Replay position').value).toBe('1')
    expect(screen.getByTestId('replay-frame-time')).toHaveTextContent('09:30:01')

    fireEvent.click(screen.getByRole('button', { name: /Declined RFQ/ }))
    expect(screen.getByLabelText<HTMLInputElement>('Replay position').value).toBe('4')
    expect(screen.getByTestId('replay-frame-time')).toHaveTextContent('09:30:04')
  })

  it('closes on escape and on a backdrop click', () => {
    const onClose = setup()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('replay-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)

    // 点击面板内部不应冒泡到遮罩，也就不会关闭
    fireEvent.click(screen.getByText('SESSION REPLAY'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state when there are no frames', () => {
    setup({ frames: [], decisions: [], events: [] })

    expect(screen.getByText('No price history yet in this session')).toBeInTheDocument()
    expect(screen.queryByLabelText('Replay position')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Session replay' })).toBeInTheDocument()
  })
})
