import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  window.location.hash = ''
})

const openDesk = (desk: 'Sales' | 'Market Maker') => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: `Start as ${desk}` }))
}

const clockText = () => screen.getByText(/^SIM /).textContent

describe('role selection', () => {
  it('offers two separate desks on the entry screen', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Market Simulation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start as Sales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start as Market Maker' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('opens the market making terminal with a two-way quote ticket', () => {
    openDesk('Market Maker')
    expect(screen.getByText('MARKET MAKING DESK')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'QUOTE TICKET' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bid price')).toBeInTheDocument()
    expect(screen.getByLabelText('Offer price')).toBeInTheDocument()
  })

  it('opens the sales terminal with a client order ticket', () => {
    openDesk('Sales')
    expect(screen.getByText('SALES DESK')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CLIENT ORDER' })).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity')).toHaveValue('2000')
    expect(screen.queryByLabelText('Bid price')).not.toBeInTheDocument()
  })

  it('returns to the entry screen when the desk is exited', () => {
    openDesk('Sales')
    fireEvent.click(screen.getByRole('button', { name: 'EXIT DESK' }))
    expect(screen.getByRole('button', { name: 'Start as Market Maker' })).toBeInTheDocument()
  })
})

describe('terminal shell', () => {
  it('can open a desk straight from the url hash', () => {
    window.location.hash = '#market-maker'
    render(<App />)
    expect(screen.getByText('MARKET MAKING DESK')).toBeInTheDocument()
  })

  it('shows the pnl strip and the simulated clock', () => {
    openDesk('Sales')
    expect(screen.getByText('REALISED P&L')).toBeInTheDocument()
    expect(screen.getByText('TOTAL P&L')).toBeInTheDocument()
    expect(clockText()).toBe('SIM 09:30:00')
    expect(screen.getByText('DAY 1/15')).toBeInTheDocument()
  })

  it('advances the clock and the prices on every tick', () => {
    openDesk('Market Maker')
    const beforeClock = clockText()
    const beforeRow = screen.getByTestId('market-row-AZN').textContent

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(clockText()).not.toBe(beforeClock)
    expect(screen.getByTestId('market-row-AZN').textContent).not.toBe(beforeRow)
  })

  it('pauses and resumes the clock from the status bar', () => {
    openDesk('Market Maker')
    fireEvent.click(screen.getByRole('button', { name: 'PAUSE' }))
    expect(screen.getByRole('button', { name: 'RESUME' })).toBeInTheDocument()

    const pausedClock = clockText()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(clockText()).toBe(pausedClock)

    fireEvent.click(screen.getByRole('button', { name: 'RESUME' }))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(clockText()).not.toBe(pausedClock)
  })

  it('switches the loaded instrument when a market row is picked', () => {
    openDesk('Sales')
    expect(screen.getByDisplayValue('AZN')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Select NFLX' }))
    expect(screen.getByDisplayValue('NFLX')).toBeInTheDocument()
  })

  it('loads the dispatched rfq into the ticket', () => {
    openDesk('Market Maker')
    expect(screen.getByText('AM-18 · SELL 2000 AZN')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /RFQ-201/ }))
    expect(screen.getByDisplayValue('AZN')).toBeInTheDocument()
  })

  it('keeps the scorecard hidden until it is requested', () => {
    openDesk('Market Maker')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'SCORE' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('COMPOSITE')).toBeInTheDocument()
    expect(screen.getByText('Discipline')).toBeInTheDocument()
  })

  it('closes the scorecard on escape', () => {
    openDesk('Sales')
    fireEvent.click(screen.getByRole('button', { name: 'SCORE' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('tickets', () => {
  it('confirms a two-way quote for a market maker', () => {
    openDesk('Market Maker')
    fireEvent.click(screen.getByRole('button', { name: 'SEND QUOTE' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('QUOTE SENT')
    expect(status).toHaveTextContent('AZN')
  })

  it('shows the sent quote in the live quotes blotter', () => {
    openDesk('Market Maker')
    fireEvent.click(screen.getByRole('button', { name: 'SEND QUOTE' }))
    expect(screen.getByText(/^Q-\d+$/)).toBeInTheDocument()
  })

  it('fills a client order for a sales trader and updates the position', () => {
    openDesk('Sales')
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: 'FILL CLIENT ORDER' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('FILLED · BUY 1,500 AZN')
    expect(screen.getAllByText('1,500').length).toBeGreaterThan(0)
  })

  it('switches the book between positions, orders and trades', () => {
    openDesk('Sales')
    fireEvent.click(screen.getByRole('button', { name: /ORDERS/ }))
    expect(screen.getByText('ORD-1042')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /TRADES/ }))
    expect(screen.getByText('TRD-8841')).toBeInTheDocument()
  })
})
