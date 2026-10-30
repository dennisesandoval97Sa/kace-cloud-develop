/**
 * Constants for the DataTable component (Kace plugin).
 * Used by bulk actions UI and other fixed strings.
 */

/** Placeholder option for bulk action dropdown when no action is selected */
export const BULK_ACTION_SELECT_PLACEHOLDER = 'Seleccione acción...';

/** Label for the button that runs the selected bulk action */
export const BULK_ACTION_EXECUTE_LABEL = 'Ejecutar';

/** Template for the "N selected" text in bulk actions bar (use with count, e.g. `${count} seleccionado(s)`) */
export const BULK_ACTION_SELECTED_COUNT_SUFFIX = 'seleccionado(s)';

/** Fallback label for a bulk action when label is missing */
export const BULK_ACTION_FALLBACK_LABEL_PREFIX = 'Acción';

/** Default title for bulk action modal when not configured */
export const BULK_ACTION_MODAL_DEFAULT_TITLE = 'Seleccione una opción';

/** Label for confirm button in bulk action modal */
export const BULK_ACTION_MODAL_CONFIRM_LABEL = 'Ejecutar';

/** Label for cancel button in bulk action modal */
export const BULK_ACTION_MODAL_CANCEL_LABEL = 'Cancelar';

/** Placeholder for modal select when no option selected */
export const BULK_ACTION_MODAL_SELECT_PLACEHOLDER = 'Seleccione...';

/** Label shown on execute button while modal init code is running */
export const BULK_ACTION_MODAL_LOADING_LABEL = 'Cargando...';

/** Aviso en el modal combinado: solo se ejecutan las acciones marcadas */
export const BULK_ACTION_COMBINED_MODAL_HINT =
  'Marca solo las acciones que quieras ejecutar. Las acciones sin marcar no se ejecutarán.';

/**
 * Nombre de la función expuesta en el contexto de `Evaluator.evaluate` de acciones masivas
 * para volver a cargar las filas desde `component.initialData` (misma lógica que al montar).
 */
export const BULK_ACTION_CONTEXT_REFRESH_TABLE = 'refreshTable';

/**
 * Nombre de la función expuesta en el contexto de `Evaluator.evaluate` de acciones masivas
 * para limpiar la selección de filas (y notificar `onRowSelect` si existe).
 */
export const BULK_ACTION_CONTEXT_CLEAR_SELECTION = 'clearSelection';

/** Ancho por defecto de la columna de checkboxes (px) para cálculo de columnas fijas */
export const DATA_TABLE_CHECKBOX_COLUMN_WIDTH_PX = 50;

/** Ancho por defecto usado al calcular offsets si width no es parseable (px) */
export const DATA_TABLE_COLUMN_WIDTH_FALLBACK_PX = 120;

/** Ancho por defecto de la columna de acciones de fila */
export const DATA_TABLE_ACTIONS_COLUMN_WIDTH_FALLBACK_PX = 120;

/** z-index base celdas sticky en cuerpo (incrementa por columna fija) */
export const DATA_TABLE_STICKY_Z_BODY_BASE = 10;

/** z-index base celdas sticky en cabecera */
export const DATA_TABLE_STICKY_Z_HEADER_BASE = 20;

/**
 * z-index columna checkbox cuando es sticky: debe ser mayor que columnas de datos pinLeft
 * para que el contenido no se dibuje encima al hacer scroll horizontal.
 */
export const DATA_TABLE_STICKY_Z_CHECKBOX_HEADER = 80;

/** z-index celdas body checkbox sticky (por debajo del thead, por encima del scroll) */
export const DATA_TABLE_STICKY_Z_CHECKBOX_BODY = 70;

/** Tope z-index columnas de datos pinLeft (por debajo de la columna checkbox) */
export const DATA_TABLE_STICKY_Z_PINLEFT_HEADER_MAX = 45;

/** Tope z-index celdas body pinLeft */
export const DATA_TABLE_STICKY_Z_PINLEFT_BODY_MAX = 38;

/** Fondo cabecera checkbox sticky (inline + CSS) */
export const DATA_TABLE_CHECKBOX_STICKY_TH_BG = '#e9ecef';

/** Fondo celdas body checkbox sticky (inline + CSS) */
export const DATA_TABLE_CHECKBOX_STICKY_TD_BG = '#ffffff';

/** Ancho mínimo al redimensionar una columna con el ratón (px) */
export const DATA_TABLE_COLUMN_RESIZE_MIN_PX = 48;

/** Ancho máximo al redimensionar una columna con el ratón (px) */
export const DATA_TABLE_COLUMN_RESIZE_MAX_PX = 960;

/**
 * Color de acento (borde izquierdo) por acción en el modal combinado, según
 * `bulkActions[i].accentColor` (Neutral/Primary/Info/Warning/Danger/Success).
 * Si una acción no define accentColor, se usa una rotación de esta misma paleta por índice.
 *
 * Usa las variables CSS de Bootstrap (--bs-*) en vez de hex fijos: Bootstrap no es
 * dependencia de este plugin (se asume provisto por el host donde se embebe), así que
 * estos valores heredan el theme real del host en vez de asumir la paleta por defecto.
 * `--bs-secondary` se usa como "neutral" porque Bootstrap no define `--bs-neutral`.
 */
export const DATA_TABLE_COMBINED_ACTION_ACCENTS = {
  neutral: 'var(--bs-secondary, #6c757d)',
  primary: 'var(--bs-primary, #0d6efd)',
  info: 'var(--bs-info, #0dcaf0)',
  warning: 'var(--bs-warning, #ffc107)',
  danger: 'var(--bs-danger, #dc3545)',
  success: 'var(--bs-success, #198754)',
};

export const DATA_TABLE_COMBINED_ACTION_ACCENT_ROTATION = [
  'primary',
  'warning',
  'danger',
  'info',
  'success',
  'neutral',
];
