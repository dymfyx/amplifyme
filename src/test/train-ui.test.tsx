import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import DrillHud from '../components/DrillHud'
import DrillPicker from '../components/DrillPicker'
import DrillVerdict from '../components/DrillVerdict'
import { I18nProvider } from '../i18n'
import { zhTrain } from '../i18n/zh-train'
import {
  DRILLS,
  formatMetric,
  type Drill,
  type DrillId,
  type DrillProgress,
} from '../train/drills'

/** 组件单测统一显式给 en provider，避免依赖默认 context */
const renderEn = (node: ReactNode) => render(<I18nProvider lang="en">{node}</I18nProvider>)

const QUOTE_DRILL = DRILLS[0]

const GLYPH = { gte: '≥', lte: '≤', gt: '>' } as const

/** 用 criteria 造一份可控的 progress：oks / values 按 criteria 顺序对位 */
function progressOf(drill: Drill, oks: boolean[], values?: number[]): DrillProgress {
  return {
    drillId: drill.id,
    passed: oks.every((ok) => ok),
    metrics: drill.criteria.map((criterion, index) => ({
      id: criterion.id,
      label: criterion.label,
      value: values?.[index] ?? criterion.target,
      target: criterion.target,
      unit: criterion.unit,
      compare: criterion.compare,
      ok: oks[index] ?? true,
    })),
  }
}

describe('DrillPicker', () => {
  it('renders one card per drill with the expected aria-label and blurb', () => {
    renderEn(<DrillPicker drills={DRILLS} onStart={vi.fn()} />)

    expect(screen.getAllByRole('button')).toHaveLength(DRILLS.length)

    for (const drill of DRILLS) {
      const card = screen.getByRole('button', { name: `Start drill: ${drill.name}` })
      expect(card).toHaveTextContent(drill.name)
      expect(card).toHaveTextContent(drill.blurb)
    }
  })

  it('shows a TRAIN kicker with the untranslated desk code', () => {
    renderEn(<DrillPicker drills={DRILLS} onStart={vi.fn()} />)

    const mmCard = screen.getByRole('button', { name: `Start drill: ${QUOTE_DRILL.name}` })
    expect(mmCard).toHaveTextContent('TRAIN · MARKET MAKER')

    const salesDrill = DRILLS.find((drill) => drill.role === 'sales')!
    const salesCard = screen.getByRole('button', { name: `Start drill: ${salesDrill.name}` })
    expect(salesCard).toHaveTextContent('TRAIN · SALES')
  })

  it('summarises every criterion with formatMetric and the compare glyph', () => {
    renderEn(<DrillPicker drills={DRILLS} onStart={vi.fn()} />)

    for (const drill of DRILLS) {
      const card = screen.getByRole('button', { name: `Start drill: ${drill.name}` })
      const summary = drill.criteria
        .map(
          (criterion) =>
            `${criterion.label} ${GLYPH[criterion.compare]}${formatMetric(
              criterion.target,
              criterion.unit,
            )}`,
        )
        .join(', ')
      expect(card).toHaveTextContent(summary)
    }
  })

  it('shows the record line from best, or NOT ATTEMPTED YET without one', () => {
    renderEn(
      <DrillPicker
        drills={DRILLS}
        onStart={vi.fn()}
        best={{ [QUOTE_DRILL.id]: { attempts: 3, passes: 2 } }}
      />,
    )

    expect(screen.getByText('ATTEMPTS 3 · PASSED 2')).toBeInTheDocument()
    expect(screen.getAllByText('NOT ATTEMPTED YET')).toHaveLength(DRILLS.length - 1)
  })

  it('calls onStart with the id of the clicked drill', () => {
    const onStart = vi.fn<(id: DrillId) => void>()
    renderEn(<DrillPicker drills={DRILLS} onStart={onStart} />)

    fireEvent.click(
      screen.getByRole('button', { name: `Start drill: ${DRILLS[4].name}` }),
    )

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(DRILLS[4].id)
  })
})

describe('DrillHud', () => {
  it('renders one chip per metric with current / target and matching data-ok', () => {
    const progress = progressOf(QUOTE_DRILL, [true, false], [12, 0.75])
    renderEn(<DrillHud drill={QUOTE_DRILL} progress={progress} />)

    const hud = screen.getByRole('status', { name: `Drill: ${QUOTE_DRILL.name}` })
    expect(hud).toHaveTextContent(`TRAIN · ${QUOTE_DRILL.name}`)
    expect(hud).toHaveTextContent('LIVE')

    const chips = Array.from(hud.querySelectorAll<HTMLElement>('[data-ok]'))
    expect(chips).toHaveLength(progress.metrics.length)

    expect(chips[0]).toHaveAttribute('data-ok', 'true')
    expect(chips[0]).toHaveTextContent('Quotes sent')
    expect(chips[0]).toHaveTextContent('12 / 8')
    expect(chips[0]).toHaveAttribute('title', 'Quotes sent: 12 of 8')

    expect(chips[1]).toHaveAttribute('data-ok', 'false')
    expect(chips[1]).toHaveTextContent('75% / 90%')
    expect(chips[1]).toHaveAttribute('title', 'Quotes inside 1.8x: 75% of 90%')
  })
})

describe('DrillVerdict', () => {
  it('shows PASSED, the attempts line and fires both callbacks', () => {
    const onRetry = vi.fn<() => void>()
    const onExit = vi.fn<() => void>()
    const progress = progressOf(QUOTE_DRILL, [true, true], [9, 0.95])

    renderEn(
      <DrillVerdict
        drill={QUOTE_DRILL}
        progress={progress}
        attempts={3}
        passes={2}
        onRetry={onRetry}
        onExit={onExit}
      />,
    )

    const card = screen.getByRole('group', { name: `Drill result: ${QUOTE_DRILL.name}` })
    expect(card).toHaveTextContent('DRILL RESULT')
    expect(within(card).getByText('PASSED')).toBeInTheDocument()
    expect(within(card).queryByText('FAILED')).not.toBeInTheDocument()
    expect(card).toHaveTextContent('ATTEMPTS 3 · PASSED 2')
    expect(card).toHaveTextContent('Quotes sent')
    expect(card).toHaveTextContent('9 / 8')

    fireEvent.click(within(card).getByRole('button', { name: 'RETRY DRILL' }))
    fireEvent.click(within(card).getByRole('button', { name: 'BACK TO DRILLS' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('shows FAILED and marks only the missed criteria red', () => {
    const progress = progressOf(QUOTE_DRILL, [true, false], [9, 0.5])
    renderEn(
      <DrillVerdict
        drill={QUOTE_DRILL}
        progress={progress}
        attempts={1}
        passes={0}
        onRetry={vi.fn()}
        onExit={vi.fn()}
      />,
    )

    const card = screen.getByRole('group', { name: `Drill result: ${QUOTE_DRILL.name}` })
    expect(within(card).getByText('FAILED')).toBeInTheDocument()
    expect(card).toHaveTextContent('50% / 90%')
    expect(card.querySelectorAll('.drill-verdict__tick--ok')).toHaveLength(1)
    expect(card.querySelectorAll('.drill-verdict__tick--bad')).toHaveLength(1)
  })
})

describe('zhTrain', () => {
  it('covers every drill name, blurb and criterion label', () => {
    for (const drill of DRILLS) {
      expect(zhTrain[drill.name], `missing drill name: ${drill.name}`).toBeTruthy()
      expect(zhTrain[drill.blurb], `missing drill blurb: ${drill.blurb}`).toBeTruthy()
      for (const criterion of drill.criteria) {
        expect(zhTrain[criterion.label], `missing criterion label: ${criterion.label}`).toBeTruthy()
      }
    }
  })

  it('covers every literal rendered by the train UI', () => {
    const keys = [
      'TRAIN',
      'SIMULATE',
      'LIVE',
      'DRILL RESULT',
      'PASSED',
      'FAILED',
      'ATTEMPTS {n} · PASSED {m}',
      'ATTEMPTS {n}',
      'PASSED {m}',
      'NOT ATTEMPTED YET',
      'RETRY DRILL',
      'BACK TO DRILLS',
      'Start drill: {name}',
      'Drill: {name}',
      'Drill result: {name}',
      '{label}: {value} of {target}',
    ]
    for (const key of keys) {
      expect(zhTrain[key], `missing zh translation for "${key}"`).toBeTruthy()
    }
  })
})
