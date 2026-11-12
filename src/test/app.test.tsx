import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

const openDesk = async (desk: 'Sales' | 'Market Maker') => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: `Start as ${desk}` }))
  return user
}

describe('role selection', () => {
  it('offers two separate desks on the entry screen', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Market Simulation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start as Sales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start as Market Maker' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('opens the market making terminal with a two-way quote ticket', async () => {
    await openDesk('Market Maker')
    expect(screen.getByText('MARKET MAKING DESK')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'QUOTE TICKET' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bid price')).toBeInTheDocument()
    expect(screen.getByLabelText('Offer price')).toBeInTheDocument()
  })

  it('opens the sales terminal with a client order ticket', async () => {
    await openDesk('Sales')
    expect(screen.getByText('SALES DESK')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CLIENT ORDER' })).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity')).toHaveValue('2000')
    expect(screen.queryByLabelText('Bid price')).not.toBeInTheDocument()
  })

  it('returns to the entry screen when the desk is exited', async () => {
    const user = await openDesk('Sales')
    await user.click(screen.getByRole('button', { name: 'EXIT DESK' }))
    expect(screen.getByRole('button', { name: 'Start as Market Maker' })).toBeInTheDocument()
  })
})

describe('terminal shell', () => {
  afterEach(() => {
    window.location.hash = ''
  })

  it('can open a desk straight from the url hash', () => {
    window.location.hash = '#market-maker'
    render(<App />)
    expect(screen.getByText('MARKET MAKING DESK')).toBeInTheDocument()
  })

  it('shows the pnl strip and the simulated clock', async () => {
    await openDesk('Sales')
    expect(screen.getByText('REALISED P&L')).toBeInTheDocument()
    expect(screen.getByText('TOTAL P&L')).toBeInTheDocument()
    expect(screen.getByText('SIM 10:34:56')).toBeInTheDocument()
    expect(screen.getByText('DAY 3/15')).toBeInTheDocument()
  })

  it('switches the loaded instrument when a market row is picked', async () => {
    const user = await openDesk('Sales')
    expect(screen.getByDisplayValue('AZN')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Select NFLX' }))
    expect(screen.getByDisplayValue('NFLX')).toBeInTheDocument()
  })

  it('loads the dispatched rfq into the ticket', async () => {
    const user = await openDesk('Market Maker')
    await user.click(screen.getByRole('button', { name: /RFQ-222/ }))
    expect(screen.getByText('AM-21 · BUY 500 TSLA')).toBeInTheDocument()
    expect(screen.getByDisplayValue('TSLA')).toBeInTheDocument()
  })

  it('keeps the scorecard hidden until it is requested', async () => {
    const user = await openDesk('Market Maker')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'SCORE' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('COMPOSITE')).toBeInTheDocument()
    expect(screen.getByText('Discipline')).toBeInTheDocument()
  })

  it('closes the scorecard on escape', async () => {
    const user = await openDesk('Sales')
    await user.click(screen.getByRole('button', { name: 'SCORE' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('tickets', () => {
  it('confirms a two-way quote for a market maker', async () => {
    const user = await openDesk('Market Maker')
    await user.click(screen.getByRole('button', { name: 'SEND QUOTE' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('QUOTE SENT')
    expect(status).toHaveTextContent('AZN')
  })

  it('confirms a client order for a sales trader', async () => {
    const user = await openDesk('Sales')
    const quantity = screen.getByLabelText('Quantity')
    await user.clear(quantity)
    await user.type(quantity, '1500')
    await user.click(screen.getByRole('button', { name: 'FILL CLIENT ORDER' }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('ORDER ROUTED · SELL 1,500 AZN')
  })

  it('switches the book between positions, orders and trades', async () => {
    const user = await openDesk('Sales')
    await user.click(screen.getByRole('button', { name: /ORDERS/ }))
    expect(screen.getByText('ORD-1042')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /TRADES/ }))
    expect(screen.getByText('TRD-8841')).toBeInTheDocument()
  })
})
