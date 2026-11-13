/**
 * 本地存档抽屉：列出已保存的场次，支持导出 / 导入 / 链接共享文件 / 删除。
 *
 * 这个组件只负责展示和交互，所有持久化动作都通过 props 回调交给上层；
 * 打开 / 关闭、ESC 关闭等行为与 ReplayDrawer 保持一致（遮罩 + role="dialog"）。
 */

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useT } from '../i18n'
import { formatArchiveDate, serializeArchive } from '../storage/archive'
import type { ArchiveFile, ArchivedSession } from '../storage/archive'

interface ArchiveDrawerProps {
  file: ArchiveFile
  linked: boolean
  linkLabel: string | null
  busy?: boolean
  onClose(): void
  onDelete(id: string): void
  onClear(): void
  onImport(text: string): void
  onLink(): void
  onUnlink(): void
}

/** `$1,234` / `-$1,234`：存档里的金额一律四舍五入到整数美元 */
const money = (value: number): string => {
  const digits = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${value < 0 ? '-' : ''}$${digits}`
}

/** P&L 类数值的正负配色，0 保持中性 */
const pnlClass = (value: number): string =>
  value > 0 ? ' archive__value--up' : value < 0 ? ' archive__value--down' : ''

const DESK_LABEL: Record<ArchivedSession['desk'], string> = {
  sales: 'Sales',
  'market-maker': 'Market Maker',
}

interface MetricProps {
  label: string
  value: string
  className?: string
}

/** 详情面板里的一格指标 */
const Metric = ({ label, value, className = '' }: MetricProps) => (
  <div className="archive__metric">
    <span className="archive__metric-label">{label}</span>
    <span className={`archive__metric-value${className}`}>{value}</span>
  </div>
)

export function ArchiveDrawer({
  file,
  linked,
  linkLabel,
  busy = false,
  onClose,
  onDelete,
  onClear,
  onImport,
  onLink,
  onUnlink,
}: ArchiveDrawerProps) {
  const t = useT()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 清空需要二次确认，3 秒后自动恢复
  useEffect(() => {
    if (!confirmingClear) return undefined
    const timer = window.setTimeout(() => setConfirmingClear(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirmingClear])

  const sessions = file.sessions
  const selected = sessions.find((session) => session.id === selectedId) ?? null
  const showShared = linked || linkLabel !== null

  // 导出走浏览器下载，避免依赖 File System Access API
  const handleExport = (): void => {
    try {
      const text = serializeArchive(file)
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'market-sim-archive.json'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      // 导出失败不应影响抽屉本身
    }
  }

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget
    const picked = input.files?.[0]
    if (!picked) return
    try {
      onImport(await picked.text())
    } catch {
      // 文件读不出来就当作没选
    } finally {
      input.value = ''
    }
  }

  const toggleRow = (id: string): void => {
    setSelectedId((current) => (current === id ? null : id))
  }

  const handleDelete = (): void => {
    if (!selected) return
    onDelete(selected.id)
    setSelectedId(null)
  }

  const handleClear = (): void => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    setConfirmingClear(false)
    setSelectedId(null)
    onClear()
  }

  return (
    <div className="archive-backdrop" data-testid="archive-backdrop" onClick={onClose}>
      <section
        className="archive"
        role="dialog"
        aria-modal="true"
        aria-label={t('Session archive')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="archive__header">
          <div className="archive__heading">
            <div className="archive__kicker">{t('ARCHIVE')}</div>
            <h2 className="archive__title">{t('Saved sessions')}</h2>
          </div>
          <button type="button" className="archive__tool" onClick={onClose}>
            {t('CLOSE')}
          </button>
        </header>

        <div className="archive__toolbar">
          <button type="button" className="archive__tool" onClick={handleExport} disabled={busy}>
            {t('EXPORT')}
          </button>
          <button
            type="button"
            className="archive__tool"
            onClick={() => importRef.current?.click()}
            disabled={busy}
          >
            {t('IMPORT')}
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            data-testid="archive-import"
            className="archive__file-input"
            onChange={(event) => {
              void handleImportChange(event)
            }}
          />
          <span className="archive__toolbar-spacer" />
          {showShared ? (
            <span className="archive__shared">
              <span className="archive__shared-label">
                {t('SHARED FILE')}
                {linkLabel ? ` · ${linkLabel}` : ''}
              </span>
              <button type="button" className="archive__tool" onClick={onUnlink} disabled={busy}>
                {t('UNLINK')}
              </button>
            </span>
          ) : (
            <button type="button" className="archive__tool" onClick={onLink} disabled={busy}>
              {t('LINK ARCHIVE FILE')}
            </button>
          )}
        </div>

        <div className="archive__body">
          {sessions.length === 0 ? (
            <p className="archive__empty">
              {t('No saved sessions yet — close a session and it lands here.')}
            </p>
          ) : (
            <>
              <div className="archive__head" aria-hidden="true">
                <span className="archive__cell archive__cell--date">{t('DATE')}</span>
                <span className="archive__cell">{t('DESK')}</span>
                <span className="archive__cell">{t('SCENARIO')}</span>
                <span className="archive__cell archive__cell--num">{t('MIN')}</span>
                <span className="archive__cell archive__cell--num">{t('P&L')}</span>
                <span className="archive__cell archive__cell--num">{t('ALPHA')}</span>
                <span className="archive__cell archive__cell--num archive__cell--score">
                  {t('SCORE')}
                </span>
              </div>
              <div className="archive__rows">
                {sessions.map((session, index) => {
                  const date = formatArchiveDate(session.savedAt)
                  const isSelected = session.id === selectedId
                  return (
                    <div className="archive__row-wrap" key={session.id}>
                      <button
                        type="button"
                        className={`archive__row${isSelected ? ' archive__row--selected' : ''}`}
                        aria-label={`Save #${index + 1} · ${date}`}
                        aria-expanded={isSelected}
                        onClick={() => toggleRow(session.id)}
                      >
                        <span className="archive__cell archive__cell--date">{date}</span>
                        <span className="archive__cell">{t(DESK_LABEL[session.desk])}</span>
                        <span className="archive__cell archive__cell--scenario">
                          {t(session.scenarioName)}
                        </span>
                        <span className="archive__cell archive__cell--num">{session.minutes}m</span>
                        <span className={`archive__cell archive__cell--num${pnlClass(session.total)}`}>
                          {money(session.total)}
                        </span>
                        <span className={`archive__cell archive__cell--num${pnlClass(session.alpha)}`}>
                          {money(session.alpha)}
                        </span>
                        <span className="archive__cell archive__cell--num archive__cell--score">
                          {session.composite.toFixed(1)}
                        </span>
                      </button>
                      {isSelected ? (
                        <div className="archive__detail" data-testid="archive-detail">
                          <div className="archive__detail-grid">
                            <Metric
                              label={t('TOTAL P&L')}
                              value={money(session.total)}
                              className={pnlClass(session.total)}
                            />
                            <Metric
                              label={t('REALISED')}
                              value={money(session.realised)}
                              className={pnlClass(session.realised)}
                            />
                            <Metric
                              label={t('UNREALISED')}
                              value={money(session.unrealised)}
                              className={pnlClass(session.unrealised)}
                            />
                            <Metric label={t('COMMISSION')} value={money(session.commission)} />
                            <Metric
                              label={t('BENCHMARK')}
                              value={money(session.benchmarkPnl)}
                              className={pnlClass(session.benchmarkPnl)}
                            />
                            <Metric
                              label={t('ALPHA')}
                              value={money(session.alpha)}
                              className={pnlClass(session.alpha)}
                            />
                            <Metric label={t('COMPOSITE')} value={session.composite.toFixed(1)} />
                            <Metric
                              label={t('PERCENTILE')}
                              value={`${Math.round(session.percentile)}%`}
                            />
                            <Metric label={t('TRADES')} value={String(session.trades)} />
                            <Metric label={t('QUOTES')} value={String(session.quotes)} />
                            <Metric
                              label={t('INFORMED')}
                              value={`${session.informedFills} / ${session.informedRfqs}`}
                            />
                            <Metric label={t('PICKED OFF')} value={String(session.adverse)} />
                            <Metric label={t('MISSED')} value={String(session.missed)} />
                            <Metric
                              label={t('WORST DRAWDOWN')}
                              value={money(session.worstDrawdown)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <footer className="archive__footer">
          {selected ? (
            <button
              type="button"
              className="archive__action archive__action--danger"
              onClick={handleDelete}
            >
              {t('DELETE THIS SESSION')}
            </button>
          ) : (
            <span className="archive__footer-spacer" />
          )}
          {sessions.length > 0 ? (
            <button type="button" className="archive__action" onClick={handleClear}>
              {confirmingClear ? t('CLICK AGAIN TO CLEAR') : t('CLEAR ALL')}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
