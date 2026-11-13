import type { Scenario } from '../engine/scenarios'
import { useT } from '../i18n'

interface ScenarioPickerProps {
  scenarios: Scenario[]
  selectedId: string
  onSelect: (id: string) => void
  onOpenCustom: () => void
}

/**
 * 入口页的情景选择条：一排 chip + 选中剧本的一句话说明。
 * 最后一个是「自定义 JSON」入口，真正的编辑弹窗由 CustomScenarioModal 负责。
 */
export default function ScenarioPicker({
  scenarios,
  selectedId,
  onSelect,
  onOpenCustom,
}: ScenarioPickerProps) {
  const t = useT()
  const selected = scenarios.find((scenario) => scenario.id === selectedId)

  return (
    <div className="scenario-picker">
      <span className="scenario-picker__label">{t('SCENARIO')}</span>
      <div className="scenario-picker__chips" role="group" aria-label={t('Scenario')}>
        {scenarios.map((scenario) => {
          const active = scenario.id === selectedId
          return (
            <button
              key={scenario.id}
              type="button"
              className={active ? 'scenario-chip scenario-chip--on' : 'scenario-chip'}
              title={t(scenario.blurb)}
              aria-pressed={active}
              onClick={() => onSelect(scenario.id)}
            >
              {t(scenario.name)}
            </button>
          )
        })}
        <button
          type="button"
          className="scenario-chip scenario-chip--custom"
          onClick={onOpenCustom}
        >
          {t('CUSTOM JSON')}
        </button>
      </div>
      {selected ? <p className="scenario-picker__blurb">{t(selected.blurb)}</p> : null}
    </div>
  )
}
