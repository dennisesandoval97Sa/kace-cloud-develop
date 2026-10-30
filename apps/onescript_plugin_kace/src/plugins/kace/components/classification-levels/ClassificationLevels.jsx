import '#plugins/kace/components/classifications/Classifications.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import './ClassificationLevels.css';
import ClassificationLevelsGrid from './components/ClassificationLevelsGrid.jsx';
import { useClassificationLevelsSelect } from './useClassificationLevelsSelect.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';

export const ClassificationLevels = ({
  disabled = false,
  data = {},
  onEvent,
  offEvent,
  component = {},
  onLevelsChange,
  root,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const selectState = useClassificationLevelsSelect({
    data,
    component,
    onEvent,
    offEvent,
    onLevelsChange,
    root,
  });

  const panelLabel =
    typeof component?.label === 'string' ? component.label.trim() : '';
  const showLabel = Boolean(panelLabel);

  return (
    <div
      className={`card shadow-sm classification-levels-card ${disabledClassName}`}
    >
      {showLabel && (
        <div className="card-header">
          <div className="card-title mb-0">{panelLabel}</div>
        </div>
      )}
      <div className="card-body">
        <ClassificationLevelsGrid {...selectState} disabled={isDisabled} />
        {selectState.options.length === 0 &&
          selectState.hasRequestedOptions &&
          !selectState.classificationsLoading &&
          !selectState.deferredCreateEmptyFailed && (
            <div className="text-center text-muted py-3">
              <p>No se encontraron clasificaciones disponibles.</p>
            </div>
          )}
      </div>
    </div>
  );
};
