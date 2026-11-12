import type { ReactNode } from 'react'

interface PanelHeaderProps {
  index: string
  title: string
  right?: ReactNode
}

export default function PanelHeader({ index, title, right }: PanelHeaderProps) {
  return (
    <header className="panel__head">
      <span className="panel__index">{index}</span>
      <h2 className="panel__title">{title}</h2>
      {right ? <div className="panel__head-right">{right}</div> : null}
    </header>
  )
}
