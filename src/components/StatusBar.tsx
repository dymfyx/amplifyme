interface SessionMeta {
  clock: string
  dayIndex: number
  totalDays: number
  status: string
  speed: string
}

interface StatusBarProps {
  meta: SessionMeta
}

export default function StatusBar({ meta }: StatusBarProps) {
  return (
    <footer className="statusbar">
      <div className="statusbar__group">
        <span className="statusbar__dot" aria-hidden="true" />
        <span className="statusbar__status">{meta.status}</span>
        <span className="statusbar__clock">SIM {meta.clock}</span>
      </div>
      <div className="statusbar__group">
        <span>
          DAY {meta.dayIndex}/{meta.totalDays}
        </span>
        <span>SPEED {meta.speed}</span>
        <span>LATENCY 12ms</span>
      </div>
      <div className="statusbar__group statusbar__group--end">
        <span>ENTER send · ESC close</span>
      </div>
    </footer>
  )
}
