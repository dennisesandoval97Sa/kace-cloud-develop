/**
 * Default list of submission keys to ignore when validating or submitting schema forms.
 * Used when the component has no ignoreSchemaKeys configured (e.g. legacy forms).
 */
export const DEFAULT_IGNORE_SCHEMA_KEYS = ['kaceSubcases', 'kace_subcases'];

/**
 * Store key where Schema/AuxCasesSchema components persist their ignoreSchemaKeys
 * so the Submit component can use the same list when stripping payload.
 */
export const STORE_KEY_IGNORE_SCHEMA_KEYS = 'kace.ignoreSchemaKeys';

/**
 * Reads the list of schema keys to ignore from a Form.io component definition.
 * Supports both array of strings (e.g. from a tags component) and array of objects
 * with a "key" property (e.g. from an editgrid: [{ key: "kaceSubcases" }, ...]).
 *
 * @param {{ ignoreSchemaKeys?: string[] | Array<{ key?: string }> }} [component] - Form.io component instance (this.component)
 * @returns {string[] | undefined} Array of key names to ignore, or undefined if none configured (caller should use DEFAULT_IGNORE_SCHEMA_KEYS)
 */
export function getIgnoreSchemaKeysFromComponent(component) {
  if (component == null || typeof component !== 'object') return undefined;

  const raw = component.ignoreSchemaKeys;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const first = raw[0];
  const isArrayOfStrings = typeof first === 'string';

  let keys;
  if (isArrayOfStrings) {
    keys = raw
      .map((item) => (typeof item === 'string' ? item : ''))
      .filter(Boolean);
  } else {
    keys = raw
      .map((item) =>
        item != null && typeof item === 'object' ? item.key : null
      )
      .filter(Boolean);
  }

  return keys.length > 0 ? keys : undefined;
}

/**
 * Llaves de primer nivel del payload que el `data_structure` vigente no declara.
 *
 * Tras reclasificar, `aux_cases` conserva los datos de la clasificación anterior. El backend los
 * tolera (`DeepMergeAuxiliariesData` + `allowUnknown`); sin esto el plugin rechazaría llaves que el
 * backend acepta. Devolver las huérfanas —en vez de validar con `allowUnknown`— mantiene intacta la
 * validación de un formulario que no se reclasificó: allí la lista sale vacía.
 *
 * Solo primer nivel: una llave anidada solo puede quedar huérfana bajo una raíz que también lo
 * está, y el descarte recursivo por nombre de `removeKeysFromSubmissionData` borraría homónimas
 * legítimas de otras ramas.
 *
 * @param {Record<string, unknown> | null | undefined} dataStructure - `data_structure` del schema aux vigente.
 * @param {Record<string, unknown> | null | undefined} formData - Payload a validar.
 * @returns {string[]}
 */
export function keysNotInSchema(dataStructure, formData) {
  if (dataStructure == null || typeof dataStructure !== 'object') return [];
  if (formData == null || typeof formData !== 'object') return [];

  const declared = Object.keys(dataStructure);
  // Sin schema declarado no hay huérfanas que distinguir: descartarlo todo convertiría en válido
  // un payload que hoy se rechaza.
  if (declared.length === 0) return [];

  const declaredSet = new Set(declared);
  return Object.keys(formData).filter((key) => !declaredSet.has(key));
}
