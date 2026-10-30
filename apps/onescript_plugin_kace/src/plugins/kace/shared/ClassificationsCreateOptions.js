export const ClassificationsCreateOptions = (array, nivel = 1) => {
  const nivelKey = `nivel${nivel}`;

  const getField = (obj, key) => {
    if (!obj || typeof obj !== 'object') return undefined;
    if (obj[key] !== undefined) return obj[key];
    if (obj.clasificaciones && obj.clasificaciones[key] !== undefined)
      return obj.clasificaciones[key];
    if (obj.classification && obj.classification[key] !== undefined)
      return obj.classification[key];
    if (obj.clasificacion && obj.clasificacion[key] !== undefined)
      return obj.clasificacion[key];
    if (obj.data && obj.data[key] !== undefined) return obj.data[key];
    for (const k of Object.keys(obj)) {
      const child = obj[k];
      if (child && typeof child === 'object' && child[key] !== undefined)
        return child[key];
    }
    return undefined;
  };

  const groupedByNivel = array.reduce((acc, item) => {
    const rawValue = getField(item, nivelKey);
    let nivelValue = '';

    if (rawValue == null) {
      nivelValue = '';
    } else if (typeof rawValue === 'string') {
      nivelValue = rawValue.trim();
    } else {
      try {
        nivelValue = String(rawValue).trim();
      } catch (err) {
        nivelValue = '';
      }
    }

    if (!nivelValue) return acc;

    if (!acc[nivelValue]) {
      acc[nivelValue] = [];
    }
    acc[nivelValue].push(item);
    return acc;
  }, {});

  return Object.entries(groupedByNivel)
    .map(([label, items]) => {
      const nextNivelKey = `nivel${nivel + 1}`;
      const hasNextNivel = items.some((item) => {
        const rawNext = getField(item, nextNivelKey);
        if (rawNext == null) return false;
        if (typeof rawNext === 'string') return rawNext.trim() !== '';

        return String(rawNext).trim() !== '';
      });
      const options = hasNextNivel
        ? ClassificationsCreateOptions(items, nivel + 1)
        : [];
      const findNested = (key) => {
        const found = items.find(
          (it) =>
            getField(it, key) !== undefined &&
            getField(it, key) !== null &&
            getField(it, key) !== ''
        );
        return found ? getField(found, key) : undefined;
      };

      const flujo_id = findNested('flujo_id');
      const clasificacion_id =
        findNested('id') ??
        findNested('clasificacion_id') ??
        findNested('classification_id');

      return {
        label,
        value: String(label),
        options,
        flujo_id,
        clasificacion_id,
      };
    })
    .filter((option) => String(option.label).trim() !== '');
};
