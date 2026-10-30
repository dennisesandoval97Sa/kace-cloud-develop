import ClassificationsOptions from '#plugins/kace/components/classifications/components/ClassificationsOptions.jsx';
import { shouldShowClassificationLevel } from '../classificationLevelsUtils.js';

const LEFT_LEVELS = ['nivel1', 'nivel3', 'nivel5'];
const RIGHT_LEVELS = ['nivel2', 'nivel4'];

const ClassificationLevelsGrid = ({
  levelKeys,
  selectedOptions,
  options,
  classificationsLoading,
  hasRequestedOptions,
  handleSelectClassification,
  handleFirstLevelInteraction,
  deferredCreateEmptyFailed,
  lockedLevelCount,
  getLevelOptions,
  disabled = false,
}) => {
  const renderLevel = (nivel) => {
    if (
      nivel !== 'nivel1' &&
      !shouldShowClassificationLevel(nivel, options, selectedOptions)
    ) {
      return null;
    }

    const levelOptions = getLevelOptions(nivel);
    const isNivel1 = nivel === 'nivel1';

    return (
      <ClassificationsOptions
        key={nivel}
        classifications={levelKeys}
        handleSelect={handleSelectClassification}
        isLoading={Boolean(
          isNivel1 &&
          hasRequestedOptions &&
          classificationsLoading &&
          !options.length
        )}
        isDeferredEmptyFailed={isNivel1 ? deferredCreateEmptyFailed : false}
        onNivel1EmptyActivate={
          isNivel1 ? handleFirstLevelInteraction : undefined
        }
        options={levelOptions}
        selectedOptions={selectedOptions}
        disabled={disabled}
        lockedLevelCount={lockedLevelCount}
        nivel={nivel}
        renderNested={false}
      />
    );
  };

  return (
    <div className="row classification-levels-grid">
      <div className="col-md-6">{LEFT_LEVELS.map(renderLevel)}</div>
      <div className="col-md-6">{RIGHT_LEVELS.map(renderLevel)}</div>
    </div>
  );
};

export default ClassificationLevelsGrid;
