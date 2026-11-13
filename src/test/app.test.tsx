import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import StatusBar from '../components/StatusBar'
import { readArchive, readSettings } from '../storage/archive'
import { readDrillRecords } from '../train/records'

beforeEach(() => {
  // 语言/时长/剧本现在会存进本地设置，测试之间必须清掉，否则上一条用例的语言会漏到下一��
  window.localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  window.location.hash = ''
  window.localStorage.clear()
})

const openDesk = (desk: 'Sales' | 'Market Maker') => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: `Start as ${desk}` }))
  fireEvent.click(screen.getByRole('button', { name: `Open the ${desk} desk` }))
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

  it('opens the sales terminal with a request-quote ticket', () => {
    openDesk('Sales')
    expect(screen.getByText('SALES DESK')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'REQUEST QUOTE' })).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity')).toHaveValue('2000')
    expect(screen.getByRole('heading', { name: 'DEALER QUOTES' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Bid price')).not.toBeInTheDocument()
  })

  it('returns to the entry screen when the desk is exited', () => {
    openDesk('Sales')
    fireEvent.click(screen.getByRole('button', { name: 'EXIT DESK' }))
    expect(screen.getByRole('button', { name: 'Start as Market Maker' })).toBeInTheDocument()
  })
})

describe('opening book', () => {
  it('starts flat unless a custom book is configured', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start as Market Maker' }))
    expect(screen.getByRole('button', { name: /FLAT/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /CUSTOM BOOK/ })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Open the Market Maker desk' }))
    expect(screen.getByText('Flat — no open positions in this session')).toBeInTheDocument()
  })

  it('carries a custom position into the session without touching cash', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start as Sales' }))
    fireEvent.click(screen.getByRole('button', { name: /CUSTOM BOOK/ }))
    fireEvent.change(screen.getByLabelText('TSLA opening quantity'), { target: { value: '1200' } })
    fireEvent.change(screen.getByLabelText('TSLA average price'), { target: { value: '196.80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open the Sales desk' }))
    expect(screen.queryByText('Flat — no open positions in this session')).not.toBeInTheDocument()
    expect(screen.getByText('196.80')).toBeInTheDocument()
    expect(screen.getAllByText('$20,000,000.00').length).toBeGreaterThan(0)
  })

  it('re-applies the configured opening book on restart', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start as Market Maker' }))
    fireEvent.click(screen.getByRole('button', { name: /CUSTOM BOOK/ }))
    fireEvent.change(screen.getByLabelText('DUOL opening quantity'), { target: { value: '-500' } })
    fireEvent.change(screen.getByLabelText('DUOL average price'), { target: { value: '281.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open the Market Maker desk' }))
    fireEvent.click(screen.getByRole('button', { name: 'RESTART' }))
    expect(screen.getByText('SIM 09:30:00')).toBeInTheDocument()
    expect(screen.getAllByText('DUOL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('281.00').length).toBeGreaterThan(0)
  })

  it('goes back to the desk picker when the setup is cancelled', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start as Sales' }))
    fireEvent.click(screen.getByRole('button', { name: '← CHANGE DESK' }))
    expect(screen.getByRole('button', { name: 'Start as Market Maker' })).toBeInTheDocument()
  })
})

describe('terminal shell', () => {
  it('can open a desk straight from the url hash', () => {
    window.location.hash = '#market-maker'
    render(<App />)
    expect(screen.getByText('MARKET MAKING DESK')).toBeInTheDocument()
  })

  it('pins a shared seed from the url hash so the group sees the same scenario', () => {
    window.location.hash = '#market-maker?seed=20261112'
    render(<App />)
    expect(screen.getByText('MARKET MAKING DESK')).toBeInTheDocument()
    expect(screen.getByText('SEED 20261112')).toBeInTheDocument()
    expect(screen.getByText('SHARED SEED')).toBeInTheDocument()
  })

  it('replays the pinned seed when the desk is restarted', () => {
    window.location.hash = '#sales?seed=777'
    render(<App />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'RESTART' }))
    expect(screen.getByText('SEED 777')).toBeInTheDocument()
    expect(clockText()).toBe('SIM 09:30:00')
  })

  it('shows the pnl strip and the simulated clock', () => {
    openDesk('Sales')
    expect(screen.getByText('REALISED P&L')).toBeInTheDocument()
    expect(screen.getByText('TOTAL P&L')).toBeInTheDocument()
    expect(clockText()).toBe('SIM 09:30:00')
    expect(screen.getByText('DAY 1/15')).toBeInTheDocument()
  })

  it('refreshes prices on the market cadence, not on every frame', () => {
    openDesk('Market Maker')
    const beforeClock = clockText()
    const beforeRow = screen.getByTestId('market-row-AZN').textContent

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(clockText()).not.toBe(beforeClock)
    expect(screen.getByTestId('market-row-AZN').textContent).not.toBe(beforeRow)
  })

  it('shows the cash budget for the desk', () => {
    openDesk('Sales')
    expect(screen.getAllByText('AVAILABLE CASH').length).toBeGreaterThan(0)
    expect(screen.getByText('CASH')).toBeInTheDocument()
  })

  it('restarts into a fresh session from the top bar', () => {
    openDesk('Market Maker')
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(clockText()).not.toBe('SIM 09:30:00')
    fireEvent.click(screen.getByRole('button', { name: 'RESTART' }))
    expect(clockText()).toBe('SIM 09:30:00')
    expect(screen.getByText('DAY 1/15')).toBeInTheDocument()
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

  it('puts a named driver next to every price that moves', () => {
    openDesk('Market Maker')
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const drivers = screen.getAllByTestId(/^driver-/)
    expect(drivers.length).toBeGreaterThan(0)
    for (const driver of drivers) {
      expect(driver.textContent?.trim().length ?? 0).toBeGreaterThan(2)
      expect(driver.getAttribute('title')).toMatch(/bps/)
    }
  })

  it('explains the tape in the price tape panel and jumps to a name from it', () => {
    openDesk('Sales')
    fireEvent.keyDown(window, { key: '4' })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByRole('heading', { name: 'PRICE TAPE' })).toBeInTheDocument()
    const tapeRow = screen.getAllByRole('button', { name: /Open .* from the price tape/ })[0]
    const symbol = /Open (\w+) from the price tape/.exec(tapeRow.getAttribute('aria-label') ?? '')?.[1]
    expect(symbol).toBeTruthy()
    fireEvent.click(tapeRow)
    expect(screen.getByDisplayValue(symbol as string)).toBeInTheDocument()
  })

  it('marks each headline as bullish or bearish in the event feed', () => {
    openDesk('Market Maker')
    fireEvent.keyDown(window, { key: '4' })
    act(() => {
      vi.advanceTimersByTime(7000)
    })
    const bias = screen.getAllByText(/BULLISH|BEARISH/)
    expect(bias.length).toBeGreaterThan(0)
  })

  it('loads the dispatched rfq into the ticket', () => {
    openDesk('Market Maker')
    expect(screen.getByText('AM-18 · CLIENT SELL 2000 AZN')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /RFQ-201/ }))
    expect(screen.getByDisplayValue('AZN')).toBeInTheDocument()
  })

  it('keeps the scorecard hidden until it is requested', () => {
    openDesk('Market Maker')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'SCORE' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('COMPOSITE')).toBeInTheDocument()
    expect(screen.getByText('DISCIPLINE')).toBeInTheDocument()
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

  it('shows the estimated fill chance next to the maker ticket', () => {
    openDesk('Market Maker')
    const label = screen.getByText('EST. FILL')
    const stat = label.parentElement
    expect(stat?.textContent).toMatch(/EST\. FILL\d{1,3}%/)
    const chance = Number(stat?.textContent?.replace('EST. FILL', '').replace('%', ''))
    expect(chance).toBeGreaterThan(0)
    expect(chance).toBeLessThanOrEqual(96)
  })

  it('asks a dealer for a price and takes it', () => {
    openDesk('Sales')
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: 'SEND RFQ' }))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const take = screen.getAllByRole('button', { name: /^BUY .* AZN at .* from / })[0]
    fireEvent.click(take)
    expect(screen.getByText(/DEALER FILLED · BUY/)).toBeInTheDocument()
    expect(screen.getAllByText(/1,500/).length).toBeGreaterThan(0)
  })

  it('opens every session flat and fills the book as orders land', () => {
    openDesk('Market Maker')
    expect(screen.getByText('Flat — no open positions in this session')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ORDERS/ }))
    expect(screen.getByText('No orders yet — book one from the ticket')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /TRADES/ }))
    expect(screen.getByText('No fills yet in this session')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'BUY AT MARKET' }))
    expect(screen.getAllByText(/^TRD-\d+$/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /ORDERS/ }))
    expect(screen.getByText(/^ORD-\d+$/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /POSITIONS/ }))
    expect(screen.getAllByText('AZN').length).toBeGreaterThan(0)
    expect(screen.queryByText('Flat — no open positions in this session')).not.toBeInTheDocument()
  })

  it('clears the book when the session is restarted', () => {
    openDesk('Market Maker')
    fireEvent.click(screen.getByRole('button', { name: 'SEND QUOTE' }))
    act(() => {
      vi.advanceTimersByTime(20000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'RESTART' }))
    expect(screen.getByText('SIM 09:30:00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /POSITIONS/ }))
    expect(screen.getByText('Flat — no open positions in this session')).toBeInTheDocument()
    expect(screen.getAllByText('$20,000,000.00').length).toBeGreaterThan(0)
  })
})

describe('status bar at the close', () => {
  it('pins the clock to the close and hides the pause control once the session is over', () => {
    let toggled = false
    render(
      <StatusBar
        meta={{
          clock: '16:00:00',
          dayIndex: 15,
          totalDays: 15,
          status: 'CLOSED',
          speed: 1,
          latencyMs: 3,
          seed: 424242,
          minutes: 30,
          timeLeftMs: 0,
        }}
        onTogglePause={() => {
          toggled = true
        }}
        onCycleSpeed={() => {}}
      />,
    )

    expect(screen.getByText('CLOSED')).toBeInTheDocument()
    expect(screen.getByText('SIM 16:00:00')).toBeInTheDocument()
    expect(screen.getByText('DAY 15/15')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'PAUSE' })).not.toBeInTheDocument()
    expect(toggled).toBe(false)
  })
})
describe('entry settings', () => {
  it('switches the entry screen to Chinese and back to English', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    expect(screen.getByRole('heading', { name: '市场模拟' })).toBeInTheDocument()
    expect(screen.getByText('语言')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { name: 'Market Simulation' })).toBeInTheDocument()
  })

  it('carries the chosen session length into the desk and shows the countdown', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '5 minute session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start as Market Maker' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the Market Maker desk' }))
    expect(screen.getByText('TIME LEFT')).toBeInTheDocument()
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(screen.getByText('5 MIN')).toBeInTheDocument()
  })

  it('links the beginner guide from the entry screen', () => {
    render(<App />)
    const link = screen.getByRole('link', { name: 'BEGINNER GUIDE (PDF)' })
    expect(link).toHaveAttribute('href', './beginner-guide.pdf')
  })

  it('keeps the language when the desk is opened', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start as Sales' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the Sales desk' }))
    expect(screen.getByText('销售台面')).toBeInTheDocument()
  })
})

describe('shared session links', () => {
  it('pins the language and the session length from the url', () => {
    window.location.hash = '#market-maker?seed=20261112&lang=zh&minutes=5'
    render(<App />)
    expect(screen.getByText('共享种子')).toBeInTheDocument()
    expect(screen.getByText('种子 20261112')).toBeInTheDocument()
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(screen.getByText('5 分钟')).toBeInTheDocument()
  })
})

describe('session end', () => {
  it('auto-settles when the 5-minute clock runs out', () => {
    window.location.hash = '#sales?seed=7&minutes=5'
    render(<App />)
    act(() => {
      vi.advanceTimersByTime(301_000)
    })
    expect(screen.getByRole('heading', { name: 'Settlement report' })).toBeInTheDocument()
    expect(screen.getByText(/BENCHMARK · BUY & HOLD/)).toBeInTheDocument()
    expect(screen.getByText(/ALPHA VS BENCHMARK/)).toBeInTheDocument()
  })
})

describe('exchange trading', () => {
  it('shows a separate exchange ticket next to the client flow', () => {
    openDesk('Market Maker')
    expect(screen.getByRole('heading', { name: 'EXCHANGE' })).toBeInTheDocument()
    expect(screen.getByLabelText('Exchange quantity')).toHaveValue('1000')
    expect(screen.getByRole('button', { name: 'BUY AT MARKET' })).toBeEnabled()
    expect(screen.getByText('BOOK SIZE')).toBeInTheDocument()
  })

  it('takes liquidity at the market and tags the fill as an exchange trade', () => {
    openDesk('Market Maker')
    fireEvent.change(screen.getByLabelText('Exchange quantity'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'BUY AT MARKET' }))
    expect(screen.getByText(/EXCHANGE FILLED · BUY 100 AZN/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /TRADES/ }))
    // 面板标题也是一个 EXCHANGE，所以至少两处：标题 + 成交行的来源徽标
    expect(screen.getAllByText('EXCHANGE').length).toBeGreaterThanOrEqual(2)
  })

  it('tags dealer fills with the dealer venue', () => {
    openDesk('Sales')
    fireEvent.click(screen.getByRole('button', { name: 'SEND RFQ' }))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    fireEvent.click(screen.getAllByRole('button', { name: /^SELL .* AZN at .* to / })[0])
    fireEvent.click(screen.getByRole('button', { name: 'RECENT FILLS' }))
    expect(screen.getAllByText('DEALER').length).toBeGreaterThan(0)
  })

  it('translates the exchange ticket when the desk runs in Chinese', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start as Market Maker' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the Market Maker desk' }))
    expect(screen.getByRole('heading', { name: '交易所' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '市价买入' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^成交/ }))
    expect(screen.getByText('来源')).toBeInTheDocument()
  })
})

describe('machine flow', () => {
  it('opens the flow drawer with the ten machine traders', () => {
    openDesk('Market Maker')
    fireEvent.click(screen.getByRole('button', { name: 'FLOW' }))
    expect(screen.getByRole('heading', { name: 'Ten machines, one market' })).toBeInTheDocument()
    expect(screen.getByTestId('agent-AI-01')).toBeInTheDocument()
    expect(screen.getByTestId('agent-AI-10')).toBeInTheDocument()
    expect(screen.getByText('THEIR COMBINED P&L')).toBeInTheDocument()
  })

  it('closes the flow drawer on escape', () => {
    openDesk('Market Maker')
    fireEvent.click(screen.getByRole('button', { name: 'FLOW' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('heading', { name: 'Ten machines, one market' })).not.toBeInTheDocument()
  })

  it('localises the flow drawer in Chinese', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start as Market Maker' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the Market Maker desk' }))
    fireEvent.click(screen.getByRole('button', { name: '资金流' }))
    expect(screen.getByRole('heading', { name: '十台机器，一个市场' })).toBeInTheDocument()
    expect(screen.getByText('它们的合计盈亏')).toBeInTheDocument()
  })
})

describe('local archive', () => {
  it('remember the entry settings between visits', () => {
    const first = render(<App />)
    // 剧本 chip 的名称会跟着语言变，先按英文点，再切中文
    fireEvent.click(screen.getByRole('button', { name: 'Risk-off crash' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chinese' }))
    fireEvent.click(screen.getByRole('button', { name: '5 minute session' }))
    expect(readSettings()).toMatchObject({ language: 'zh', minutes: 5, scenarioId: 'crash' })
    first.unmount()

    render(<App />)
    expect(screen.getByRole('button', { name: 'Chinese' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '5 minute session' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the archive drawer from the entry screen', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^ARCHIVE \(0\)$/ }))
    expect(screen.getByRole('dialog', { name: 'Session archive' })).toBeInTheDocument()
    expect(screen.getByText('Saved sessions')).toBeInTheDocument()
  })

  it('saves the finished session once the clock runs out', () => {
    window.location.hash = '#sales?seed=7&minutes=5'
    render(<App />)
    act(() => {
      vi.advanceTimersByTime(301_000)
    })
    expect(screen.getByRole('heading', { name: 'Settlement report' })).toBeInTheDocument()
    const stored = readArchive()
    expect(stored.sessions).toHaveLength(1)
    expect(stored.sessions[0]).toMatchObject({ desk: 'sales', minutes: 5, seed: 7 })
  })

  it('lists the saved session in the archive drawer', () => {
    window.location.hash = '#sales?seed=7&minutes=5'
    render(<App />)
    act(() => {
      vi.advanceTimersByTime(301_000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close settlement report' }))
    fireEvent.click(screen.getByRole('button', { name: 'EXIT DESK' }))
    fireEvent.click(screen.getByRole('button', { name: /^ARCHIVE \(1\)$/ }))
    expect(screen.getAllByText(/Sales/).length).toBeGreaterThan(0)
  })
})

describe('training mode', () => {
  it('lists the five drills after switching the entry to TRAIN', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Train mode' }))

    expect(screen.getByRole('button', { name: 'Start drill: Quote discipline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start drill: Headline reaction' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start drill: Inventory control' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start drill: Adverse selection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start drill: Two venues' })).toBeInTheDocument()
  })

  it('starts a drill straight into a five minute session with the HUD up', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Train mode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start drill: Quote discipline' }))

    expect(screen.getByRole('status')).toHaveTextContent('TRAIN · Quote discipline')
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(screen.getByText(/Quotes sent/i)).toBeInTheDocument()
  })

  it('fails the drill at the close, records the attempt and returns to the list', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Train mode' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start drill: Quote discipline' }))

    act(() => {
      vi.advanceTimersByTime(301_000)
    })

    expect(screen.getByText('DRILL RESULT')).toBeInTheDocument()
    expect(screen.getByText('FAILED')).toBeInTheDocument()

    const records = readDrillRecords()
    expect(records['quote-discipline']).toMatchObject({ attempts: 1, passes: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'BACK TO DRILLS' }))
    expect(screen.getByRole('button', { name: 'Start drill: Quote discipline' })).toBeInTheDocument()
    expect(screen.getByText(/ATTEMPTS 1/)).toBeInTheDocument()
  })
})
