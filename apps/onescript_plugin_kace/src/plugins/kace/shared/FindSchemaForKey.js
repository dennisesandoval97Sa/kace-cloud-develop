/**
 * Busca recursivamente la definición para la key dentro de kace_data.schema
 * Navega por propiedades 'data_structure' y por arrays/objetos anidados.
 */

export const findSchemaForKey = (root = null, targetKey = null) => {
  if (!root || !targetKey) return null;

  // Si root directamente contiene data_structure con la key
  if (
    root.data_structure &&
    Object.prototype.hasOwnProperty.call(root.data_structure, targetKey)
  ) {
    return root.data_structure[targetKey];
  }

  // Buscar recursivamente en cada entrada de data_structure
  if (root.data_structure) {
    for (const k of Object.keys(root.data_structure)) {
      const node = root.data_structure[k];
      // Si node es el objetivo
      if (k === targetKey) return node;
      // Buscar dentro del node (si tiene sub estructura)
      const found = findSchemaForKey(node, targetKey);
      if (found) return found;
    }
  }

  // Si root tiene propiedades que a su vez contienen data_structure (protección adicional)
  for (const prop of Object.keys(root)) {
    if (prop === 'data_structure') continue;
    const child = root[prop];
    if (child && typeof child === 'object') {
      const found = findSchemaForKey(child, targetKey);
      if (found) return found;
    }
  }

  return null;
};
