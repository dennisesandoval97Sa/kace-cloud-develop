import { Loader } from './loader';
import { Button } from './button';

export const PauseReasonModal = ({
  onResume,
  onPauseReasonChange,
  formattedTime,
  formattedPauseTime,
  pauseReasonList,
  pauseReason,
  isSaving,
  isLoading,
  handleConfirmPause,
  error,
  disabled = false,
}) => {
  return (
    <div className="kace-timer-modal-backdrop">
      <div className="kace-timer-modal">
        <div className="kace-timer-modal-header">
          <h5 className="mb-0">Motivo de la pausa</h5>
          <Button
            className="kace-timer-icon-button"
            onClick={onResume}
            isDisabled={disabled}
          >
            ×
          </Button>
        </div>
        <div className="kace-timer-modal-body">
          <p className="mb-2">
            Tiempo en pausa: <strong>{formattedPauseTime}</strong>
          </p>
          <p className="mb-2" style={{ fontSize: '0.9em', color: '#666' }}>
            Tiempo total del caso: <strong>{formattedTime}</strong>
          </p>
          <label className="d-block mb-2">
            Seleccione un motivo:
            {isLoading ? (
              <Loader />
            ) : (
              <select
                className="form-control mt-1"
                value={pauseReason}
                onChange={onPauseReasonChange}
                disabled={disabled || isSaving}
              >
                <option value="">Seleccione...</option>
                {pauseReasonList.map((reason, index) => (
                  <option key={index} value={reason.motivo}>
                    {reason.motivo}
                  </option>
                ))}
              </select>
            )}
          </label>
          {error && <div className="kace-timer-error mt-2">{error}</div>}
        </div>
        <div className="kace-timer-modal-footer">
          {isSaving ? (
            <Loader />
          ) : (
            <>
              <Button
                className="btn btn-primary btn-sm mr-2"
                onClick={() => handleConfirmPause('PAUSED', pauseReason)}
                isDisabled={disabled || isSaving || !pauseReason}
              >
                Confirmar pausa
              </Button>

              <Button
                className="btn btn-secondary btn-sm"
                onClick={onResume}
                isDisabled={disabled || isSaving}
              >
                Reanudar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
