const ADMIN_CONFIG_STORE_PATH =
  'config.global_config.layouts.application.admin';

/** Campos del caso que apuntan a una entidad: se nombran como sujeto, no como «el campo». */
const CASE_ENTITIES = {
  responsable_id: 'el responsable',
  grupo_id: 'el grupo',
  clasificacion_id: 'la clasificación',
  estadoActual: 'el estado',
  transicion_id: 'la transición',
  cliente_id: 'el cliente',
  created_by: 'el usuario que creó el caso',
  updated_by: 'el último usuario que actualizó el caso',
  closed_by: 'el usuario que cerró el caso',
  reopen_by: 'el usuario que reabrió el caso',
  edited_by: 'el usuario que editó el caso',
  cloned_by: 'el usuario que clonó el caso',
  deleted_by: 'el usuario que eliminó el caso',
};

const UNITS = { days: 'días', hours: 'horas', minutes: 'minutos' };

const slaLabels = () => {
  const labels = {
    sla_due_date: 'Fecha de vencimiento del ANS',
    sla_elapsed_time: 'Tiempo transcurrido del ANS',
    sla_remaining_time: 'Tiempo restante del ANS',
    sla_position: 'Posición del ANS',
    sla_state_due_date: 'Fecha de vencimiento del ANS del estado',
    sla_state_elapsed_time: 'Tiempo transcurrido del ANS del estado',
    sla_state_remaining_time: 'Tiempo restante del ANS del estado',
    sla_state_position: 'Posición del ANS del estado',
  };
  for (const [unit, spanish] of Object.entries(UNITS)) {
    labels[`sla_elapsed_${unit}`] = `Tiempo transcurrido del ANS en ${spanish}`;
    labels[`sla_remaining_${unit}`] = `Tiempo restante del ANS en ${spanish}`;
    labels[`sla_state_elapsed_${unit}`] =
      `Tiempo transcurrido del ANS del estado en ${spanish}`;
    labels[`sla_state_remaining_${unit}`] =
      `Tiempo restante del ANS del estado en ${spanish}`;
  }
  return labels;
};

/** Mismos textos que `actions.form.*` del constructor de reglas en la SPA. */
const CASE_FIELDS = {
  antiguedad: 'Antigüedad del caso',
  antiguedad_dias: 'Antigüedad del caso en días',
  antiguedad_horas: 'Antigüedad del caso en horas',
  antiguedad_minutos: 'Antigüedad del caso en minutos',
  state_elapsed_time: 'Antigüedad del estado',
  state_elapsed_days: 'Antigüedad del estado en días',
  state_elapsed_hours: 'Antigüedad del estado en horas',
  state_elapsed_minutes: 'Antigüedad del estado en minutos',
  reference: 'Caso',
  motivo_baja: 'Motivo baja',
  alto_impacto: 'Alto impacto',
  external_code: 'Código externo',
  fecha_resolucion: 'Fecha de resolución',
  created_at: 'Fecha de creación',
  updated_at: 'Fecha de actualización',
  closed_at: 'Fecha de cierre',
  reopen_at: 'Fecha de reapertura',
  cloned_at: 'Fecha de clonación',
  edited_at: 'Fecha de edición',
  expired_at: 'Fecha de vencimiento',
  remaining_time: 'Tiempo restante',
  ans_posicion: 'Posición ANS',
  cambio_clasificacion: 'Cambio de clasificación',
  is_visible: 'Es visible',
  vista: 'Vista',
  ...slaLabels(),
};

const CLIENT_FIELDS = {
  tipo_cliente: 'Tipo de cliente',
  tipo_documento: 'Tipo de documento',
  documento: 'Documento',
  nombres: 'Nombres',
  apellido1: 'Primer apellido',
  apellido2: 'Segundo apellido',
  nombre_empresa: 'Nombre de empresa',
  estado_civil: 'Estado civil',
  fecha_nacimiento: 'Fecha de nacimiento',
  email: 'Correo electrónico',
  email_alterno: 'Correo alternativo',
  telefono: 'Teléfono',
  telefono_alterno: 'Teléfono alternativo',
  sexo: 'Género',
  genero: 'Género',
  pais: 'País',
  ciudad: 'Ciudad',
  campos_extra1: 'Campo extra 1',
  campos_extra2: 'Campo extra 2',
  campos_extra3: 'Campo extra 3',
};

const ENTITY_FIELDS = {
  'estados.id': 'el estado',
  'clasificaciones.id': 'la clasificación',
  'clasificaciones.description': 'la clasificación',
};

const OWNER_BY_NAMESPACE = {
  clients: ' del cliente',
  aux_clients: ' del cliente',
  aux_users: ' del usuario',
  estados: ' del estado',
  clasificaciones: ' de la clasificación',
};

const nonEmpty = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const humanize = (key) => {
  const words = String(key).replaceAll('_', ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
};

const fieldPhrase = (label, namespace) =>
  `el campo «${label}»${OWNER_BY_NAMESPACE[namespace] ?? ''}`;

const levelLabel = (column, adminConfig) => {
  const level = /^nivel(\d+)$/.exec(column)?.[1];
  if (!level) return undefined;
  return (
    nonEmpty(adminConfig?.classifications?.[`label_${level}`]) ??
    `Nivel ${level}`
  );
};

/**
 * Cómo nombrar, en una frase para el asesor, el campo de una condición de
 * transición: «el responsable», «el campo «Documento» del cliente»…
 *
 * @param {string} field - Ruta de la regla (`cases.responsable_id`, `aux_cases.x.y`…).
 * @param {{
 *   adminConfig?: { classifications?: object, clients?: object }|null,
 *   findFormLabel?: (path: string) => string|undefined
 * }} [options] - Etiquetas del tenant y del formulario, cuando están disponibles.
 * @returns {string}
 */
export const conditionFieldLabel = (field, options = {}) => {
  if (typeof field !== 'string' || field === '') return 'un campo';

  const [rawNamespace, ...rest] = field.split('.');
  const namespace = rawNamespace === 'casos' ? 'cases' : rawNamespace;
  const path = rest.join('.');
  const column = rest[rest.length - 1] ?? rawNamespace;
  const { adminConfig, findFormLabel } = options;

  const entity = ENTITY_FIELDS[`${namespace}.${path}`];
  if (entity) return entity;

  switch (namespace) {
    case 'cases':
      return (
        CASE_ENTITIES[path] ??
        fieldPhrase(CASE_FIELDS[path] ?? humanize(column), namespace)
      );
    case 'clients':
      return fieldPhrase(
        nonEmpty(adminConfig?.clients?.[path]) ??
          CLIENT_FIELDS[path] ??
          humanize(column),
        namespace
      );
    case 'clasificaciones':
      return fieldPhrase(
        levelLabel(path, adminConfig) ?? humanize(column),
        namespace
      );
    case 'aux_cases':
    case 'aux_clients':
    case 'aux_users':
      return fieldPhrase(
        nonEmpty(findFormLabel?.(path)) ?? humanize(column),
        namespace
      );
    default:
      return fieldPhrase(humanize(column), namespace);
  }
};

const formioForms = () => {
  const forms = globalThis.Formio?.forms;
  return forms && typeof forms === 'object' ? Object.values(forms) : [];
};

const labelInForm = (form, key) => {
  try {
    return nonEmpty(form?.getComponent?.(key)?.component?.label);
  } catch {
    return undefined;
  }
};

/**
 * Etiqueta que el asesor ve en pantalla para un campo del formulario. Se busca
 * por la ruta completa y, si el formulario anida el campo de otra forma, por su
 * última clave.
 *
 * @param {string} path
 * @returns {string|undefined}
 */
const findRenderedFormLabel = (path) => {
  const leaf = path.split('.').pop();
  const keys = leaf && leaf !== path ? [path, leaf] : [path];
  for (const key of keys) {
    for (const form of formioForms()) {
      const label = labelInForm(form, key);
      if (label) return label;
    }
  }
  return undefined;
};

/**
 * `conditionFieldLabel` con las etiquetas del tenant (configuración global en el
 * store) y las del formulario renderizado.
 *
 * @param {{ get: (path: string) => any }|null|undefined} storeService
 * @returns {(field: string) => string}
 */
export const storeConditionFieldLabel = (storeService) => (field) =>
  conditionFieldLabel(field, {
    adminConfig: storeService?.get?.(ADMIN_CONFIG_STORE_PATH) ?? null,
    findFormLabel: findRenderedFormLabel,
  });
