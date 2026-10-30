import { Button } from './Button';

export const CloseCaseMsg = ({ formattedDate, toggleOpen }) => {
  return (
    <div className="kace-drawer-state-modal">
      <div className="kace-drawer-state-content">
        <div className="kace-drawer-state-initialState-container">
          <h2 className="kace-drawer-modal-title">Estado del Caso</h2>

          <div className="kace-drawer-case-closed">
            <div className="kace-drawer-case-closed-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Icono de caso cerrado"
              >
                <title>Caso Cerrado</title>
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
            <h3 className="kace-drawer-case-closed-title">Caso Cerrado</h3>
            <p className="kace-drawer-case-closed-date">{formattedDate}</p>
            <p className="kace-drawer-case-closed-message">
              Este caso ya ha sido resuelto y no puede cambiar de estado.
            </p>
          </div>

          <div className="kace-drawer-modal-actions">
            <Button className="btn btn-confirm" onClick={toggleOpen}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
