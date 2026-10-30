export const normalizeText = (text) => {
  return text.replace(/["']/g, '');
};

export function formatEntityName(entityName) {
  return entityName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
export function buildLevelsConfig(entity, field, relationEntity) {
  if (!entity) return [];

  const levels = [];

  // First level (no filter)
  levels.push({
    entity: entity,
    field: field,
    path: null,
    label: formatEntityName(entity),
  });

  // Subsequent levels from relation_entity.items
  if (relationEntity?.items && Array.isArray(relationEntity.items)) {
    relationEntity.items.forEach((item) => {
      if (item.entity && item.path) {
        levels.push({
          entity: item.entity,
          field: field, // Use same field for all levels
          path: item.path,
          label: formatEntityName(item.entity),
        });
      }
    });
  }

  return levels;
}
