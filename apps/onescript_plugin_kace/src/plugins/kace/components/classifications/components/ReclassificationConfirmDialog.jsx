import { useCallback, useEffect, useRef } from 'react';

/** Elementos que pueden recibir foco dentro del diálogo. */
const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Confirmación previa a reclasificar. El plugin no tiene un diálogo compartido: `timer` y `drawer`
 * traen cada uno el suyo, así que este sigue el mismo patrón de backdrop propio.
 *
 * Tres estados: preguntar, verificando (precheck en vuelo) y bloqueado (el backend dijo que no).
 * Bloqueado no ofrece reintentar: el motivo es de negocio y no cambia por insistir.
 *
 * Declara `aria-modal`, así que tiene que comportarse como modal de verdad: el foco entra al
 * abrirse, el tabulador no se escapa al formulario de detrás —que sigue en el DOM— y Escape
 * cancela. Sin eso, un usuario de teclado o de lector de pantalla se pierde fuera del diálogo.
 *
 * @param {Object} props
 * @param {string} props.classificationLabel - Clasificación destino, para que el asesor la reconozca.
 * @param {boolean} props.isChecking - Precheck en curso.
 * @param {string} props.blockerMessage - Motivo por el que no se puede reclasificar, si lo hay.
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export const ReclassificationConfirmDialog = ({
  classificationLabel,
  isChecking = false,
  blockerMessage = '',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);

  /**
   * El foco entra al abrirse y vuelve a entrar cuando el diálogo cambia de estado: al pasar a
   * bloqueado, el botón que tenía el foco («Continuar») desaparece del DOM y el foco se iría al
   * `body`, dejando al usuario de teclado fuera del modal.
   */
  useEffect(() => {
    primaryActionRef.current?.focus();
  }, [blockerMessage]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const leavingBackwards =
        event.shiftKey && document.activeElement === first;
      const leavingForwards =
        !event.shiftKey && document.activeElement === last;

      if (leavingBackwards || leavingForwards) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    },
    [onCancel]
  );

  return (
    <div className="kace-reclassify-modal-backdrop">
      {/* El manejador va en el diálogo y no en `document` para no cancelar un modal ajeno que
          estuviera abierto por debajo. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="kace-reclassify-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kace-reclassify-title"
        onKeyDown={handleKeyDown}
      >
        <div className="kace-reclassify-modal-header">
          <h5 className="mb-0" id="kace-reclassify-title">
            {blockerMessage
              ? 'No se puede reclasificar'
              : 'Reclasificar el caso'}
          </h5>
        </div>

        <div className="kace-reclassify-modal-body">
          {blockerMessage ? (
            <p className="mb-0 kace-reclassify-blocker">{blockerMessage}</p>
          ) : (
            <>
              {classificationLabel ? (
                <p className="mb-2">
                  El caso pasará a <strong>{classificationLabel}</strong>.
                </p>
              ) : null}
              <p className="mb-0">
                Se reemplazará el formulario actual por el del flujo destino y
                se perderán los cambios que no haya guardado.
              </p>
            </>
          )}
        </div>

        <div className="kace-reclassify-modal-footer">
          {blockerMessage ? (
            <button
              ref={primaryActionRef}
              type="button"
              className="btn btn-primary"
              onClick={onCancel}
            >
              Cerrar
            </button>
          ) : (
            <>
              {/* Cancelar sigue vivo durante el precheck: si la llamada tarda, el asesor no puede
                  quedar encerrado en el diálogo sin salida. */}
              <button
                type="button"
                className="btn btn-light"
                onClick={onCancel}
              >
                Cancelar
              </button>
              <button
                ref={primaryActionRef}
                type="button"
                className="btn btn-primary"
                onClick={onConfirm}
                disabled={isChecking}
              >
                {isChecking ? 'Verificando…' : 'Continuar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
