/**
 * Genera un objeto con la estructura completa desde el schema (data_structure)
 * manteniendo la jerarquía y asignando valores por defecto
 *
 * @param {Object} schema - El schema de kace_data con data_structure
 * @returns {Object} Objeto con la estructura anidada y valores por defecto
 */
export const generateDefaultDataFromSchema = (schema = null) => {
  if (!schema || !schema.data_structure) return {};

  const defaultData = {};

  /**
   * Procesa recursivamente el data_structure manteniendo la jerarquía
   * @param {Object} structure - El objeto data_structure a procesar
   * @param {Object} target - El objeto donde se almacenarán los valores
   */
  const processDataStructure = (structure, target) => {
    if (!structure || typeof structure !== 'object') return;

    // Iterar sobre cada key en data_structure
    for (const key of Object.keys(structure)) {
      const field = structure[key];
      if (!field || typeof field !== 'object') continue;

      switch (field.type) {
        case 'object':
          target[key] = {};
          processDataStructure(field.data_structure, target[key]);
          break;
        default:
          target[key] = field.default ?? getDefaultValueByType(field);
          break;
      }
    }
  };

  /**
   * Determina el valor por defecto según el tipo de campo
   * @param {Object} field - La definición del campo
   * @returns {any} Valor por defecto apropiado
   */
  const getDefaultValueByType = (field) => {
    const type = field.type?.toLowerCase();

    switch (type) {
      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return '';

      case 'boolean':
      case 'checkbox':
        return false;

      case 'array':
      case 'select':
      case 'multiselect':
      case 'tags':
      case 'editgrid':
        return [];

      case 'object':
      case 'json':
        return {};

      case 'date':
      case 'datetime':
      case 'time':
      case 'string':
      case 'text':
      case 'textarea':
      case 'email':
      case 'phone':
      case 'url':
      case 'password':
      default:
        return '';
    }
  };

  // Iniciar el procesamiento desde data_structure
  processDataStructure(schema.data_structure, defaultData);

  return defaultData;
};

/**
 * Construye un mapa de todas las keys y sus paths completos en el schema
 * Ejemplo: { "primaria": "estudios.primaria", "secundaria": "estudios.secundaria" }
 *
 * @param {Object} schema - El schema con data_structure
 * @returns {Map<string, string>} Mapa de key -> path completo
 */
export const buildSchemaKeyMap = (schema = null) => {
  const keyMap = new Map();

  if (!schema || !schema.data_structure) return keyMap;

  /**
   * Recorre recursivamente el schema construyendo el mapa de paths
   * @param {Object} structure - data_structure a procesar
   * @param {string} currentPath - Path acumulado
   */
  const traverse = (structure, currentPath = '') => {
    if (!structure || typeof structure !== 'object') return;

    for (const key of Object.keys(structure)) {
      const field = structure[key];
      const fullPath = currentPath ? `${currentPath}.${key}` : key;

      if (!field || typeof field !== 'object') continue;

      // Si tiene data_structure, es un contenedor - seguir bajando
      if (field.data_structure) {
        // Registrar el contenedor también
        keyMap.set(key, fullPath);
        // Procesar hijos
        traverse(field.data_structure, fullPath);
      }
      // Si es un campo final, registrarlo
      else if (field.type || field.label || field.validation) {
        keyMap.set(key, fullPath);
      }
      // Intentar procesar como estructura anidada
      else {
        traverse(field, fullPath);
      }
    }
  };

  traverse(schema.data_structure);

  return keyMap;
};

/**
 * Convierte datos planos de Form.io a estructura anidada usando el mapa del schema
 * @param {Object} flatData - Datos en formato plano de Form.io
 * @param {Map<string, string>} keyMap - Mapa de key -> path del schema
 * @returns {Object} Datos con estructura anidada correcta
 */
export const unflattenWithSchemaMap = (flatData, keyMap) => {
  const nested = {};

  for (const [key, value] of Object.entries(flatData)) {
    // Buscar el path correcto en el mapa del schema
    const correctPath = keyMap.get(key) || key;

    // Separar el path en keys
    const keys = correctPath.split('.');
    let current = nested;

    // Navegar/crear la estructura anidada
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    // Asignar el valor en la posición correcta
    current[keys[keys.length - 1]] = value;
  }

  return nested;
};

/**
 * Genera estructura inicial con valores por defecto y la combina con datos existentes
 * Mantiene la jerarquía del schema
 *
 * @param {Object} schema - Schema con data_structure
 * @param {Object} existingData - Datos existentes a preservar
 * @returns {Object} Estructura completa con jerarquía
 */
export const mergeSchemaWithData = (schema = null, existingData = {}) => {
  const defaultData = generateDefaultDataFromSchema(schema);
  return deepMerge(defaultData, existingData);
};

/**
 * Realiza un merge profundo manteniendo la estructura anidada
 * @param {Object} target - Objeto base (valores por defecto con estructura)
 * @param {Object} source - Objeto con valores a preservar
 * @returns {Object} Objeto combinado
 */
const deepMerge = (target, source) => {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Merge recursivo para objetos anidados
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        // Sobrescribir con el valor existente
        result[key] = sourceValue;
      }
    }
  }

  return result;
};

/**
 * Aplana un objeto anidado conservando la estructura en el nombre de las keys
 * { estudios: { primaria: true } } → { "estudios.primaria": true }
 *
 * @param {Object} obj - Objeto anidado
 * @returns {Object} Objeto plano
 */
export const flattenObject = (obj) => {
  const flattened = {};

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];

    // Si es un objeto, aplánalo completamente (sin incluir el nombre del primer nivel)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value));
    } else {
      // Si no es objeto, mantenlo en el primer nivel
      flattened[key] = value;
    }
  }

  return flattened;
};
