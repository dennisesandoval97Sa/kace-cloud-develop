import { Button } from './Button';

export const SuccessMessage = ({ toggleOpen, newStateName }) => {
  return (
    <div className="kace-drawer-state-modal">
      <div className="kace-drawer-state-content">
        <div className="kace-drawer-state-initialState-container">
          <h2 className="kace-drawer-modal-title">Estado Actualizado</h2>

          <div className="kace-drawer-success-message">
            <div className="kace-drawer-success-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Icono de éxito"
              >
                <title>Actualización Exitosa</title>
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="#10b981"
                  strokeWidth="2"
                />
                <path
                  d="M8 12l2 2 4-4"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="kace-drawer-success-title">
              ¡Estado actualizado correctamente!
            </h3>
            {newStateName && (
              <p className="kace-drawer-success-state">
                Nuevo estado: <strong>{newStateName}</strong>
              </p>
            )}
            <p className="kace-drawer-success-description">
              El estado del caso se ha actualizado exitosamente. Los cambios se
              han guardado correctamente.
            </p>
          </div>

          <div className="kace-drawer-modal-actions">
            <Button className="btn btn-confirm" onClick={toggleOpen}>
              Aceptar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
