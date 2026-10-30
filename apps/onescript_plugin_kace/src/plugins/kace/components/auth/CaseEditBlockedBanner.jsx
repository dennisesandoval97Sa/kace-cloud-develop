import './Auth.css';

export const CaseEditBlockedBanner = () => (
  <div
    className="kace-case-edit-blocked-banner"
    role="status"
    aria-live="polite"
  >
    No tiene permiso para editar este caso. Solo puede visualizarlo porque no es
    el responsable.
  </div>
);
