import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ArchiveDrawer } from '../components/ArchiveDrawer'
import { I18nProvider } from '../i18n'
import { emptyArchive, formatArchiveDate } from '../storage/archive'
import type { ArchiveFile, ArchivedSession } from '../storage/archive'

/**
 * i18n.tsx 里把 zhArchive 合并进词典是主程序的接线工作（我们不修改已有文件）。
 * 在接线完成前，这里把词典挂到最后一个被展开的字典模块上，
 * 这样 lang="zh" 的断言测到的仍然是真实的 I18nProvider + zhArchive。
 */
vi.mock('../i18n/zh-agents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../i18n/zh-agents')>()
  const { zhArchive } = await import('../i18n/zh-archive')
  return { ...actual, zhAgents: { ...actual.zhAgents, ...zhArchive } }
})

const makeSession = (overrides: Partial<ArchivedSession> = {}): ArchivedSession => ({
  id: 'sales-1-classic-30-2026-11-13T06:05:00.000Z',
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
  ...overrides,
})

const archiveWith = (sessions: ArchivedSession[]): ArchiveFile => ({
  ...emptyArchive(),
  sessions,
})

const twoSessions = (): ArchiveFile =>
  archiveWith([
    makeSession({
      id: 'session-sales',
      savedAt: '2026-11-13T06:05:00.000Z',
      scenarioName: 'Classic',
    }),
    makeSession({
      id: 'session-mm',
      savedAt: '2026-11-12T09:30:00.000Z',
      desk: 'market-maker',
      scenarioName: 'Momentum',
      total: -250,
      alpha: -80,
      composite: 41.2,
      percentile: 25,
    }),
  ])

type DrawerProps = Parameters<typeof ArchiveDrawer>[0]

const renderDrawer = (
  overrides: Partial<DrawerProps> = {},
  lang: 'en' | 'zh' = 'en',
): { props: DrawerProps } => {
  const props: DrawerProps = {
    file: emptyArchive(),
    linked: false,
    linkLabel: null,
    onClose: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    onImport: vi.fn(),
    onLink: vi.fn(),
    onUnlink: vi.fn(),
    ...overrides,
  }
  render(
    <I18nProvider lang={lang}>
      <ArchiveDrawer {...props} />
    </I18nProvider>,
  )
  return { props }
}

describe('ArchiveDrawer', () => {
  it('renders the empty state when there are no saved sessions', () => {
    renderDrawer()

    expect(screen.getByRole('dialog', { name: 'Session archive' })).toBeInTheDocument()
    expect(
      screen.getByText('No saved sessions yet — close a session and it lands here.'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('archive-detail')).not.toBeInTheDocument()
    expect(screen.queryByText('CLEAR ALL')).not.toBeInTheDocument()
  })

  it('renders every saved session with date, desk, scenario, minutes, P&L and score', () => {
    const file = twoSessions()
    renderDrawer({ file })

    expect(screen.getByText('Classic')).toBeInTheDocument()
    expect(screen.getByText('Momentum')).toBeInTheDocument()
    expect(screen.getByText('Sales')).toBeInTheDocument()
    expect(screen.getByText('Market Maker')).toBeInTheDocument()
    expect(screen.getAllByText('30m')).toHaveLength(2)

    const firstDate = formatArchiveDate('2026-11-13T06:05:00.000Z')
    expect(screen.getByLabelText(`Save #1 · ${firstDate}`)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Save #2/)).toBeInTheDocument()
  })

  it('expands the details panel when a row is clicked', () => {
    renderDrawer({ file: twoSessions() })

    expect(screen.queryByTestId('archive-detail')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/^Save #1/))

    const detail = screen.getByTestId('archive-detail')
    expect(detail).toBeInTheDocument()
    expect(screen.getByText('TOTAL P&L')).toBeInTheDocument()
    expect(screen.getByText('REALISED')).toBeInTheDocument()
    expect(screen.getByText('WORST DRAWDOWN')).toBeInTheDocument()

    // 再点一次收起
    fireEvent.click(screen.getByLabelText(/^Save #1/))
    expect(screen.queryByTestId('archive-detail')).not.toBeInTheDocument()
  })

  it('calls onDelete with the selected session id', () => {
    const { props } = renderDrawer({ file: twoSessions() })

    fireEvent.click(screen.getByLabelText(/^Save #2/))
    fireEvent.click(screen.getByText('DELETE THIS SESSION'))

    expect(props.onDelete).toHaveBeenCalledTimes(1)
    expect(props.onDelete).toHaveBeenCalledWith('session-mm')
  })

  it('requires a second click before clearing all sessions', () => {
    const { props } = renderDrawer({ file: twoSessions() })

    fireEvent.click(screen.getByText('CLEAR ALL'))
    expect(props.onClear).not.toHaveBeenCalled()
    expect(screen.getByText('CLICK AGAIN TO CLEAR')).toBeInTheDocument()

    fireEvent.click(screen.getByText('CLICK AGAIN TO CLEAR'))
    expect(props.onClear).toHaveBeenCalledTimes(1)
  })

  it('closes on ESC and on backdrop click', () => {
    const { props } = renderDrawer()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('archive-backdrop'))
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })

  it('renders a hidden JSON import input and forwards the picked file text', async () => {
    const { props } = renderDrawer()

    const input = screen.getByTestId('archive-import')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', 'application/json')

    const picked = { text: () => Promise.resolve('{"version":1}') } as unknown as File
    fireEvent.change(input, { target: { files: [picked] } })

    await waitFor(() => expect(props.onImport).toHaveBeenCalledWith('{"version":1}'))
  })

  it('shows the linked shared file label and unlinks', () => {
    const { props } = renderDrawer({ linked: true, linkLabel: 'trading-archive.json' })

    expect(screen.getByText('SHARED FILE · trading-archive.json')).toBeInTheDocument()
    fireEvent.click(screen.getByText('UNLINK'))
    expect(props.onUnlink).toHaveBeenCalledTimes(1)
  })

  it('offers linking a shared file when none is linked', () => {
    const { props } = renderDrawer()
    fireEvent.click(screen.getByText('LINK ARCHIVE FILE'))
    expect(props.onLink).toHaveBeenCalledTimes(1)
  })

  it('renders the archive in Chinese', () => {
    renderDrawer(
      {
        file: archiveWith([makeSession({ id: 'zh-session' })]),
      },
      'zh',
    )

    expect(screen.getByText('保存记录')).toBeInTheDocument()
    expect(screen.getByText('导出')).toBeInTheDocument()
    expect(screen.getByText('导入')).toBeInTheDocument()
    expect(screen.getByText('日期')).toBeInTheDocument()
    expect(screen.getByText('全部清空')).toBeInTheDocument()
  })

  it('renders the Chinese empty state', () => {
    renderDrawer({}, 'zh')
    expect(
      screen.getByText('还没有保存记录——结束一场会话后会自动出现在这里。'),
    ).toBeInTheDocument()
  })
})
