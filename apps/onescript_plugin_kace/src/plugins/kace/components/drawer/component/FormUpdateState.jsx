import { Button } from './Button';
import { Loader } from './Loader';

export const FormUpdateState = ({
  estadoActualId,
  estadoSiguienteId,
  estadoActual,
  handleSubmit,
  caseStates,
  selectedTransitionId,
  setSelectedTransitionId,
  error,
  setError,
  isSubmitting,
  toggleOpen,
  disabled = false,
}) => {
  const handleChange = (e) => {
    setSelectedTransitionId(e.target.value);
    setError(null);
  };

  return (
    <div className="kace-drawer-state-initialState-container">
      <h2 className="kace-drawer-modal-title">Cambiar Estado del Caso</h2>

      <div className="kace-drawer-state-info">
        <label htmlFor={estadoActualId} className="kace-drawer-state-label">
          Estado Actual:
        </label>
        <div
          id={estadoActualId}
          className="kace-drawer-current-stage"
          style={{ backgroundColor: estadoActual?.color }}
        >
          <p>{estadoActual?.nombre}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="kace-drawer-stage-selector">
          <label
            htmlFor={estadoSiguienteId}
            className="kace-drawer-state-label"
          >
            Estados disponibles:
          </label>
          <select
            id={estadoSiguienteId}
            className="kace-drawer-select"
            value={selectedTransitionId}
            onChange={handleChange}
            disabled={disabled || isSubmitting}
          >
            <option value="">Seleccione un estado</option>
            {caseStates.map((item) => (
              <option key={item?.transition?.id} value={item?.transition?.id}>
                {item?.estado_siguiente?.nombre}
              </option>
            ))}
          </select>
          {error && <p className="kace-drawer-error-message">{error}</p>}
        </div>
        <div className="kace-drawer-modal-actions">
          {isSubmitting ? (
            <Loader />
          ) : (
            <>
              <Button
                className="btn btn-cancel"
                onClick={toggleOpen}
                isDisabled={disabled || isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="btn btn-confirm"
                isDisabled={disabled || isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Confirmar'}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};
