import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'

export interface ReplayFrame {
  tick: number
  time: string
  prices: Record<string, number>
}

export interface ReplayDecision {
  id: string
  tick: number
  time: string
  kind: 'quote' | 'fill' | 'decline'
  label: string
  detail: string
  tone?: 'up' | 'down'
}

export interface ReplayEvent {
  id: string
  tick: number
  time: string
  label: string
  direction?: 1 | -1
}

export interface ReplayDrawerProps {
  frames: ReplayFrame[]
  decisions: ReplayDecision[]
  events: ReplayEvent[]
  symbols: string[]
  session: { desk: string; seed: number; minutes: number; scenario: string }
  onClose: () => void
}

const KIND_LABEL: Record<ReplayDecision['kind'], string> = {
  quote: 'QUOTE',
  fill: 'FILL',
  decline: 'DECLINE',
}

/** 画布固定 1000x320，横向由 preserveAspectRatio="none" 拉伸铺满面板 */
const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 320
const PLOT_TOP = 18
const TIMELINE_Y = 300
const PLOT_HEIGHT = TIMELINE_Y - PLOT_TOP
/** 帧数超过这个值时按等间隔抽样画线，避免路径点过多糊成一片 */
const MAX_CHART_POINTS = 400

const frameX = (index: number, total: number): number =>
  total <= 1 ? VIEW_WIDTH / 2 : (index / (total - 1)) * VIEW_WIDTH

const priceY = (value: number, low: number, high: number): number => {
  const ratio = high === low ? 0.5 : (value - low) / (high - low)
  return PLOT_TOP + (1 - ratio) * PLOT_HEIGHT
}

/** 找到 tick <= 目标 tick 且最接近的一帧；早于第一帧时退回第 0 帧 */
const frameIndexAtTick = (frames: ReplayFrame[], tick: number): number => {
  let best = -1
  frames.forEach((frame, index) => {
    if (frame.tick <= tick && (best === -1 || frame.tick > frames[best].tick)) best = index
  })
  return best === -1 ? 0 : best
}

const formatPrice = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '--'

export default function ReplayDrawer({
  frames,
  decisions,
  events,
  symbols,
  session,
  onClose,
}: ReplayDrawerProps) {
  const t = useT()
  const [pickedSymbol, setPickedSymbol] = useState<string | null>(null)
  const [position, setPosition] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // 帧数变化（例如会话重启）后把游标收回有效范围
  useEffect(() => {
    setPosition((current) => Math.min(current, Math.max(frames.length - 1, 0)))
  }, [frames.length])

  const activeSymbol = pickedSymbol && symbols.includes(pickedSymbol) ? pickedSymbol : symbols[0]
  const selectedIndex = frames.length === 0 ? 0 : Math.max(0, Math.min(position, frames.length - 1))
  const selectedFrame: ReplayFrame | undefined = frames[selectedIndex]

  const chart = useMemo(() => {
    const step = frames.length > MAX_CHART_POINTS ? Math.ceil(frames.length / MAX_CHART_POINTS) : 1
    const points: { index: number; value: number }[] = []
    const pushPoint = (index: number) => {
      const value = activeSymbol ? frames[index].prices[activeSymbol] : undefined
      if (typeof value === 'number' && Number.isFinite(value)) points.push({ index, value })
    }

    for (let index = 0; index < frames.length; index += step) pushPoint(index)
    if (frames.length > 0 && points[points.length - 1]?.index !== frames.length - 1) {
      pushPoint(frames.length - 1)
    }
    if (points.length === 0) return null

    const values = points.map((point) => point.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = min === max ? Math.max(Math.abs(min) * 0.001, 0.01) : (max - min) * 0.08
    const low = min - pad
    const high = max + pad
    const path = points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${frameX(point.index, frames.length).toFixed(1)},${priceY(
            point.value,
            low,
            high,
          ).toFixed(1)}`,
      )
      .join(' ')
    const first = points[0]
    const last = points[points.length - 1]
    const area = `${path} L${frameX(last.index, frames.length).toFixed(1)},${TIMELINE_Y} L${frameX(
      first.index,
      frames.length,
    ).toFixed(1)},${TIMELINE_Y} Z`

    return { low, high, path, area, up: last.value >= first.value }
  }, [frames, activeSymbol])

  const playheadX = frameX(selectedIndex, frames.length)
  const selectedPrice = selectedFrame && activeSymbol ? selectedFrame.prices[activeSymbol] : undefined
  const playheadY = chart
    ? priceY(
        typeof selectedPrice === 'number' && Number.isFinite(selectedPrice) ? selectedPrice : chart.low,
        chart.low,
        chart.high,
      )
    : PLOT_TOP

  const eventMarkers = events.map((event) => ({
    event,
    x: frameX(frameIndexAtTick(frames, event.tick), frames.length),
  }))
  const decisionMarkers = decisions.map((decision) => ({
    decision,
    x: frameX(frameIndexAtTick(frames, decision.tick), frames.length),
  }))

  return (
    <div className="replay-backdrop" data-testid="replay-backdrop" onClick={onClose}>
      <section
        className="replay"
        role="dialog"
        aria-modal="true"
        aria-label={t('Session replay')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="replay__head">
          <div className="replay__head-copy">
            <span className="replay__eyebrow">{t('DECISION REVIEW')}</span>
            <h2 className="replay__title">{t('SESSION REPLAY')}</h2>
            <p className="replay__meta">
              {t('{desk} · SEED {seed} · {minutes} MIN · {scenario}', {
                desk: session.desk,
                seed: session.seed,
                minutes: session.minutes,
                scenario: session.scenario,
              })}
            </p>
          </div>
          <button type="button" className="replay__close" onClick={onClose}>
            {t('CLOSE')}
          </button>
        </header>

        {frames.length === 0 ? (
          <div className="replay__empty" role="status">
            <p className="replay__empty-title">{t('No price history yet in this session')}</p>
          </div>
        ) : (
          <div className="replay__body">
            <div className="replay__main">
              <div className="replay__symbols" role="group" aria-label={t('Replay symbol')}>
                {symbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    className={
                      symbol === activeSymbol ? 'replay__chip replay__chip--on' : 'replay__chip'
                    }
                    aria-pressed={symbol === activeSymbol}
                    onClick={() => setPickedSymbol(symbol)}
                  >
                    {symbol}
                  </button>
                ))}
              </div>

              <div className="replay__chart-wrap">
                <svg
                  className="replay__chart"
                  viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={t('{symbol} price across the session', { symbol: activeSymbol ?? '--' })}
                >
                  <line
                    className="replay__grid"
                    x1={0}
                    y1={PLOT_TOP}
                    x2={VIEW_WIDTH}
                    y2={PLOT_TOP}
                  />
                  <line
                    className="replay__grid"
                    x1={0}
                    y1={(PLOT_TOP + TIMELINE_Y) / 2}
                    x2={VIEW_WIDTH}
                    y2={(PLOT_TOP + TIMELINE_Y) / 2}
                  />
                  <line
                    className="replay__baseline"
                    x1={0}
                    y1={TIMELINE_Y}
                    x2={VIEW_WIDTH}
                    y2={TIMELINE_Y}
                  />

                  {eventMarkers.map(({ event, x }) => (
                    <line
                      key={event.id}
                      className={
                        event.direction === 1
                          ? 'replay__event replay__event--up'
                          : event.direction === -1
                            ? 'replay__event replay__event--down'
                            : 'replay__event replay__event--muted'
                      }
                      x1={x}
                      y1={PLOT_TOP}
                      x2={x}
                      y2={TIMELINE_Y}
                    >
                      <title>{t(event.label)}</title>
                    </line>
                  ))}

                  {chart ? (
                    <>
                      <path
                        className={chart.up ? 'replay__area replay__area--up' : 'replay__area replay__area--down'}
                        d={chart.area}
                      />
                      <path
                        className={chart.up ? 'replay__line replay__line--up' : 'replay__line replay__line--down'}
                        d={chart.path}
                      />
                    </>
                  ) : null}

                  {decisionMarkers.map(({ decision, x }) => (
                    <path
                      key={decision.id}
                      className="replay__mark"
                      d={`M${x.toFixed(1)},${TIMELINE_Y + 6} l4,4 l-4,4 l-4,-4 Z`}
                    >
                      <title>{`${decision.time} · ${t(decision.label)}`}</title>
                    </path>
                  ))}

                  <g className="replay__playhead">
                    <line x1={playheadX} y1={PLOT_TOP} x2={playheadX} y2={TIMELINE_Y} />
                    <circle cx={playheadX} cy={playheadY} r={3.4} />
                  </g>
                </svg>

                {chart ? (
                  <>
                    <span className="replay__axis replay__axis--top">{chart.high.toFixed(2)}</span>
                    <span className="replay__axis replay__axis--bottom">{chart.low.toFixed(2)}</span>
                  </>
                ) : (
                  <p className="replay__chart-empty">{t('No price history for this symbol')}</p>
                )}
              </div>

              <div className="replay__legend">
                <span className="replay__legend-item">
                  <i className="replay__swatch replay__swatch--up" />
                  <i className="replay__swatch replay__swatch--down" />
                  {t('EVENTS')}
                </span>
                <span className="replay__legend-item">
                  <i className="replay__swatch replay__swatch--decision" />
                  {t('DECISIONS')}
                </span>
                <span className="replay__legend-frame">
                  {t('FRAME {index} / {total}', {
                    index: selectedIndex + 1,
                    total: frames.length,
                  })}
                </span>
              </div>

              <div className="replay__scrubber">
                <input
                  className="replay__range"
                  type="range"
                  min={0}
                  max={frames.length - 1}
                  step={1}
                  value={selectedIndex}
                  aria-label={t('Replay position')}
                  onChange={(event) => setPosition(Number(event.currentTarget.value))}
                />
                <div className="replay__frame">
                  <span className="replay__frame-label">{t('FRAME')}</span>
                  <span className="replay__frame-time" data-testid="replay-frame-time">
                    {selectedFrame?.time ?? '--'}
                  </span>
                  <ul className="replay__prices">
                    {symbols.map((symbol) => (
                      <li
                        key={symbol}
                        className={
                          symbol === activeSymbol ? 'replay__price replay__price--on' : 'replay__price'
                        }
                      >
                        <span className="replay__price-symbol">{symbol}</span>
                        <span className="replay__price-value">
                          {formatPrice(selectedFrame?.prices[symbol])}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="replay__log">
              <div className="replay__log-head">
                <span className="replay__log-title">{t('DECISION LOG')}</span>
                <span className="replay__log-count">{decisions.length}</span>
              </div>
              {decisions.length === 0 ? (
                <p className="replay__log-empty">{t('No decisions logged in this session')}</p>
              ) : (
                <ul className="replay__rows">
                  {decisions.map((decision) => (
                    <li key={decision.id}>
                      <button
                        type="button"
                        className={
                          decision.tone ? `replay__row replay__row--${decision.tone}` : 'replay__row'
                        }
                        onClick={() => setPosition(frameIndexAtTick(frames, decision.tick))}
                      >
                        <span className="replay__row-top">
                          <span className="replay__row-time">{decision.time}</span>
                          <span className={`replay__badge replay__badge--${decision.kind}`}>
                            {t(KIND_LABEL[decision.kind])}
                          </span>
                        </span>
                        <span className="replay__row-label">{t(decision.label)}</span>
                        <span className="replay__row-detail">{t(decision.detail)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <p className="replay__note">{t('Click a decision to jump to that moment. Press ESC to close.')}</p>
      </section>
    </div>
  )
}
