import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ScenarioPicker from '../components/ScenarioPicker'
import CustomScenarioModal from '../components/CustomScenarioModal'
import type { Scenario } from '../engine/scenarios'
import { zhScenario } from '../i18n/zh-scenario'

/** 只用于选择器渲染的最小剧本夹具 */
const SCENARIOS: Scenario[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Mixed macro and single-name headlines.',
    newsCount: 0,
    news: [],
  },
  {
    id: 'crash',
    name: 'Risk-off crash',
    blurb: 'Wide spreads and falling tape.',
    newsCount: 0,
    news: [],
  },
]

const VALID_SCENARIO = {
  name: 'Test tape',
  blurb: 'One headline only.',
  news: [
    {
      at: 0.25,
      kind: 'macro',
      tag: 'MACRO',
      impact: 2,
      headline: 'Central bank cuts rates',
      short: 'rate cut',
      direction: 1,
      driftBps: 50,
    },
  ],
}
const VALID_JSON = JSON.stringify(VALID_SCENARIO)

function renderPicker(selectedId = 'classic') {
  const onSelect = vi.fn<(id: string) => void>()
  const onOpenCustom = vi.fn<() => void>()
  render(
    <ScenarioPicker
      scenarios={SCENARIOS}
      selectedId={selectedId}
      onSelect={onSelect}
      onOpenCustom={onOpenCustom}
    />,
  )
  return { onSelect, onOpenCustom }
}

function renderModal() {
  const onClose = vi.fn<() => void>()
  const onLoad = vi.fn<(scenario: Scenario) => void>()
  render(<CustomScenarioModal onClose={onClose} onLoad={onLoad} />)
  return { onClose, onLoad }
}

/** textarea 的可见 label 是 "SCENARIO JSON"（全大写），用正则忽略大小写 */
function setJson(value: string) {
  fireEvent.change(screen.getByLabelText(/scenario json/i), { target: { value } })
}

describe('ScenarioPicker', () => {
  it('renders one chip per scenario and marks the selected chip pressed', () => {
    renderPicker('crash')

    // 两个剧本 chip + 一个 CUSTOM JSON
    expect(screen.getAllByRole('button')).toHaveLength(SCENARIOS.length + 1)
    expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Risk-off crash' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'CUSTOM JSON' })).toBeInTheDocument()
    // 选中剧本的说明只出现一次（chip 里只是 title，不算文本）
    expect(screen.getByText('Wide spreads and falling tape.')).toBeInTheDocument()
  })

  it('calls onSelect with the id of the clicked chip', () => {
    const { onSelect, onOpenCustom } = renderPicker('classic')

    fireEvent.click(screen.getByRole('button', { name: 'Risk-off crash' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('crash')
    expect(onOpenCustom).not.toHaveBeenCalled()
  })

  it('opens the custom JSON modal from the last chip', () => {
    const { onSelect, onOpenCustom } = renderPicker()

    fireEvent.click(screen.getByRole('button', { name: 'CUSTOM JSON' }))

    expect(onOpenCustom).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('CustomScenarioModal', () => {
  it('shows a parse error and does not load an invalid JSON', () => {
    const { onClose, onLoad } = renderModal()
    const loadButton = screen.getByRole('button', { name: 'LOAD SCENARIO' })

    // 空文本时 LOAD 不可用
    expect(loadButton).toBeDisabled()

    setJson('{ not json')
    expect(loadButton).toBeEnabled()
    fireEvent.click(loadButton)

    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid JSON/i)
    expect(onLoad).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('loads a parsed scenario from valid JSON and closes', () => {
    const { onClose, onLoad } = renderModal()

    setJson(VALID_JSON)
    fireEvent.click(screen.getByRole('button', { name: 'LOAD SCENARIO' }))

    expect(onLoad).toHaveBeenCalledTimes(1)
    const loaded = onLoad.mock.calls[0][0]
    expect(loaded.id).toBe('custom')
    expect(loaded.name).toBe('Test tape')
    expect(loaded.blurb).toBe('One headline only.')
    expect(loaded.news).toHaveLength(1)
    expect(loaded.newsCount).toBe(1)
    expect(loaded.news[0].headline.en).toBe('Central bank cuts rates')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const { onClose } = renderModal()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a backdrop click but not on a click inside the dialog', () => {
    const { onClose } = renderModal()
    const dialog = screen.getByRole('dialog', { name: 'Custom scenario' })

    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fills a valid example scenario with the example button', () => {
    const { onClose, onLoad } = renderModal()
    const input = screen.getByLabelText(/scenario json/i) as HTMLTextAreaElement
    const loadButton = screen.getByRole('button', { name: 'LOAD SCENARIO' })

    expect(loadButton).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'USE THE EXAMPLE' }))

    expect(input.value.length).toBeGreaterThan(0)
    expect(() => JSON.parse(input.value)).not.toThrow()
    expect(loadButton).toBeEnabled()

    fireEvent.click(loadButton)

    expect(onLoad).toHaveBeenCalledTimes(1)
    const loaded = onLoad.mock.calls[0][0]
    expect(loaded.id).toBe('custom')
    expect(loaded.news.length).toBeGreaterThan(0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes from the CANCEL button', () => {
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('zhScenario', () => {
  it('ships Chinese copy for the strings the two components render', () => {
    const keys = [
      'SCENARIO',
      'Scenario',
      'CUSTOM JSON',
      'CUSTOM SCENARIO',
      'Custom scenario',
      'Load a scenario from JSON',
      'SCENARIO JSON',
      'Invalid scenario JSON',
      'USE THE EXAMPLE',
      'CANCEL',
      'LOAD SCENARIO',
    ]
    for (const key of keys) {
      expect(zhScenario[key], `missing zh translation for "${key}"`).toBeTruthy()
    }
  })
})
