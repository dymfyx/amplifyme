import { useState } from 'react'
import type { Instrument } from '../types'
import { eventMarkers, seriesFor } from '../data/mock'
import PanelHeader from './PanelHeader'

const VIEW_W = 1000
const VIEW_H = 300
const PAD_X = 4
const TOP = 18
const BOTTOM = 64

const RANGES = ['1M', '5M', '15M', '30M', '1H', 'ALL']

interface ChartPanelProps {
  instrument: Instrument
}

export default function ChartPanel({ instrument }: ChartPanelProps) {
  const [range, setRange] = useState('15M')
  const values = seriesFor(instrument.symbol)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const isUp = instrument.changePct >= 0
  const last = values[values.length - 1]

  const xOf = (index: number) => PAD_X + (index / (values.length - 1)) * (VIEW_W - PAD_X * 2)
  const yOf = (value: number) => TOP + (1 - (value - min) / span) * (VIEW_H - BOTTOM - TOP)

  const points = values.map((value, index) => `${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`).join(' ')
  const baseY = VIEW_H - BOTTOM
  const areaPath = `M ${xOf(0).toFixed(1)},${baseY} L ${points.split(' ').join(' L ')} L ${xOf(
    values.length - 1,
  ).toFixed(1)},${baseY} Z`

  const volumes = values.map((value, index) => {
    const prev = index === 0 ? value : values[index - 1]
    return Math.abs(value - prev)
  })
  const maxVolume = Math.max(...volumes) || 1

  return (
    <section className="panel panel--chart">
      <PanelHeader
        index="5"
        title="CHARTS"
        right={
          <div className="chart-ranges" role="group" aria-label="Chart range">
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                className={range === option ? 'chip chip--on' : 'chip'}
                aria-pressed={range === option}
                onClick={() => setRange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      <div className="chart">
        <div className="chart__headline">
          <span className="chart__symbol">{instrument.symbol}</span>
          <span className={isUp ? 'chart__last num--up' : 'chart__last num--down'}>
            {last.toFixed(2)}
          </span>
          <span className={isUp ? 'num--up' : 'num--down'}>
            {isUp ? '+' : ''}
            {instrument.changePct.toFixed(2)}%
          </span>
          <span className="muted">{range} · SMA 20</span>
        </div>

        <div className="chart__canvas">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" role="img" aria-label={`${instrument.symbol} price chart`}>
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1={0}
                x2={VIEW_W}
                y1={TOP + ratio * (VIEW_H - BOTTOM - TOP)}
                y2={TOP + ratio * (VIEW_H - BOTTOM - TOP)}
                className="chart__grid"
              />
            ))}

            {eventMarkers.map((marker) => (
              <rect
                key={marker.label}
                x={xOf(marker.index)}
                y={TOP}
                width={1.5}
                height={VIEW_H - BOTTOM - TOP}
                className="chart__marker"
              />
            ))}

            <path d={areaPath} className={isUp ? 'chart__area chart__area--up' : 'chart__area chart__area--down'} />
            <polyline
              points={points}
              className={isUp ? 'chart__line chart__line--up' : 'chart__line chart__line--down'}
            />

            {volumes.map((volume, index) => {
              const height = Math.max((volume / maxVolume) * 46, 1.5)
              return (
                <rect
                  key={index}
                  x={xOf(index) - 3}
                  y={VIEW_H - 8 - height}
                  width={6}
                  height={height}
                  className={isUp ? 'chart__vol chart__vol--up' : 'chart__vol chart__vol--down'}
                />
              )
            })}

            <line x1={0} x2={VIEW_W} y1={VIEW_H - 8} y2={VIEW_H - 8} className="chart__axis" />
          </svg>
          <span className="chart__tick chart__tick--top">{max.toFixed(2)}</span>
          <span className="chart__tick chart__tick--bottom">{min.toFixed(2)}</span>
        </div>

        <div className="chart__legend">
          {eventMarkers.map((marker) => (
            <span key={marker.label} className="chart__legend-item">
              <i className="chart__dot" /> {marker.label}
            </span>
          ))}
          <span className="chart__legend-item chart__legend-item--end">VOLUME</span>
        </div>
      </div>
    </section>
  )
}
