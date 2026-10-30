/**
 * Contrato compartido de la reclasificación de casos (MSKT-1392).
 *
 * Vive en `shared/` y no junto al componente de clasificaciones porque lo consumen las dos capas:
 * el componente escribe y los servicios leen. Que un servicio importara de un componente invertiría
 * la dependencia.
 */

/** Tope del textarea. El backend acepta hasta 5000; el negocio pidió ~500 en el formulario. */
export const RECLASSIFICATION_REASON_MAX_LENGTH = 500;

/** `comment.descripcion` es obligatorio si el auxiliary detecta reclasificación; min 3. */
export const RECLASSIFICATION_REASON_MIN_LENGTH = 3;

/** Motivo que el asesor escribió; OS-11 lo manda como `comment.descripcion`. */
export const RECLASSIFICATION_REASON_STORE_PATH =
  'classifications.reclassification_reason';

/** Estados y reglas del flujo destino que devolvió el precheck. */
export const RECLASSIFICATION_PRECHECK_STORE_PATH =
  'classifications.reclassification_precheck';

/**
 * Reclasificación ya aplicada en el backend cuyo guardado auxiliar todavía no aterrizó.
 *
 * Es lo que hace que un reintento del guardado NO repita la reclasificación —lo que duplicaría el
 * comentario de motivo— y lo que permite decirle al asesor que el caso ya cambió de clasificación
 * aunque el formulario no se haya guardado.
 */
export const RECLASSIFICATION_APPLIED_STORE_PATH =
  'classifications.reclassification_applied';

/** Aviso de que el precheck pasó y el formulario se va a reemplazar. */
export const RECLASSIFIED_EVENT = 'kaceCaseReclassified';

/**
 * El caso se reclasificó, pero el motivo escrito no llegó a guardarse por ser más corto que
 * `RECLASSIFICATION_REASON_MIN_LENGTH`. El aviso previo a confirmar no bloquea nada, así que sin
 * este mensaje el asesor daría por registrado un motivo que nunca salió del navegador.
 */
export const RECLASSIFY_REASON_DISCARDED_MESSAGE =
  'El caso se reclasificó, pero el motivo no se guardó por ser demasiado corto ' +
  `(mínimo ${RECLASSIFICATION_REASON_MIN_LENGTH} caracteres).`;

/** El caso ya se reclasificó en el backend pero su formulario no se guardó. */
export const RECLASSIFY_PENDING_AUX_MESSAGE =
  'El caso ya quedó reclasificado, pero no se pudo guardar el formulario. Vuelva a guardar para completar el cambio.';
