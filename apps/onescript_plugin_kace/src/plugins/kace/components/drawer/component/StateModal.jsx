import { State } from './State.jsx';
import { Button } from './Button.jsx';
import { CloseCaseMsg } from './CloseCaseMsg';
import { formattedDateWithDate } from '../data/processData';

export const StateModal = ({
  caseStates,
  toggleOpen,
  onStateChange,
  fechaResolucion,
  disabled = false,
}) => {
  const isCaseClosed =
    fechaResolucion && fechaResolucion !== null && fechaResolucion !== '';

  return (
    <div>
      <div className="kace-drawer-modal-backdrop">
        <div className="kace-drawer-modal">
          <div className="kace-drawer-header">
            <Button
              className="kace-drawer-close-button"
              onClick={toggleOpen}
              isDisabled={disabled}
            >
              x
            </Button>
          </div>
          {isCaseClosed ? (
            <CloseCaseMsg
              formattedDate={formattedDateWithDate(fechaResolucion)}
              toggleOpen={toggleOpen}
            />
          ) : (
            <State
              caseStates={caseStates}
              toggleOpen={toggleOpen}
              onStateChange={onStateChange}
              disabled={disabled}
            />
          )}
        </div>
      </div>
    </div>
  );
};
