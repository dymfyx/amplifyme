import { useEffect, useState } from 'react'
import { EXAMPLE_SCENARIO_JSON, parseScenarioJson, type Scenario } from '../engine/scenarios'
import { useT } from '../i18n'

interface CustomScenarioModalProps {
  onClose: () => void
  onLoad: (scenario: Scenario) => void
}

/** 一行就能看懂的 JSON 示例，用作 textarea 的 placeholder */
const PLACEHOLDER_JSON =
  '{"name":"My tape","news":[{"at":0.1,"kind":"macro","tag":"MACRO","impact":2,"headline":"Rates cut","short":"rate cut","direction":1,"driftBps":50}]}'

/**
 * 自定义情景弹窗：粘贴一段 JSON，校验通过后交回上层。
 * 解析逻辑全部在 engine/scenarios.ts 的 parseScenarioJson 里，这里只负责展示错误。
 */
export default function CustomScenarioModal({ onClose, onLoad }: CustomScenarioModalProps) {
  const t = useT()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const change = (value: string) => {
    setText(value)
    if (error) setError('')
  }

  const load = () => {
    const result = parseScenarioJson(text)
    if (!result.scenario) {
      setError(result.error ?? 'Invalid scenario JSON')
      return
    }
    onLoad(result.scenario)
    onClose()
  }

  const useExample = () => {
    setText(EXAMPLE_SCENARIO_JSON)
    setError('')
  }

  return (
    <div className="custom-scenario__backdrop" onClick={onClose}>
      <div
        className="custom-scenario"
        role="dialog"
        aria-modal="true"
        aria-label={t('Custom scenario')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="custom-scenario__head">
          <span className="custom-scenario__eyebrow">{t('CUSTOM SCENARIO')}</span>
          <h2 className="custom-scenario__title">{t('Load a scenario from JSON')}</h2>
        </header>

        <p className="custom-scenario__help">
          {t(
            'Fields: name, news[].at (0-1), kind (macro/note/equity), impact (1-3), headline, short. Optional: direction (1 or -1), symbol, driftBps, spreadMultiplier, liquidityMultiplier.',
          )}
        </p>

        <label className="custom-scenario__label" htmlFor="custom-scenario-input">
          {t('SCENARIO JSON')}
        </label>
        <textarea
          id="custom-scenario-input"
          className="custom-scenario__input"
          value={text}
          placeholder={PLACEHOLDER_JSON}
          spellCheck={false}
          autoFocus
          onChange={(event) => change(event.target.value)}
        />

        {error ? (
          <p className="custom-scenario__error" role="alert">
            {t('Invalid scenario JSON')} — {t(error)}
          </p>
        ) : null}

        <div className="custom-scenario__actions">
          <button
            type="button"
            className="custom-scenario__btn custom-scenario__btn--example"
            onClick={useExample}
          >
            {t('USE THE EXAMPLE')}
          </button>
          <button type="button" className="custom-scenario__btn" onClick={onClose}>
            {t('CANCEL')}
          </button>
          <button
            type="button"
            className="custom-scenario__btn custom-scenario__btn--primary"
            disabled={text.trim().length === 0}
            onClick={load}
          >
            {t('LOAD SCENARIO')}
          </button>
        </div>
      </div>
    </div>
  )
}
