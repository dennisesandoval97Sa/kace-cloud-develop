export const buildRelations = (data) => {
    // Obtener los niveles ordenados
    const levels = Object.keys(data)
        .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)[0], 10);
            const nb = parseInt(b.match(/\d+/)[0], 10);
            return na - nb;
        })
        .map(key => ({ ...data[key] }));

    // El primer nivel es la raíz
    const root = levels[0];

    let current = root;

    // Anidar los siguientes niveles
    for (let i = 1; i < levels.length; i++) {
        current.relations = [levels[i]];
        current = levels[i];
    }

    return root;
};

export const flattenJoinConditions = (node, level = 1, acc = {}) => {
    if (!node || typeof node !== "object") return acc;

    acc[`join_condition_level_${level}`] = {
        id: node.id,
        primary_entity: node.primary_entity,
        related_entity: node.related_entity,
        alias: node.alias,
        join_type: node.join_type,
        on: node.on || [],
    };

    if (Array.isArray(node.relations) && node.relations.length > 0) {
        // Asumimos 1 camino lineal (join encadenado)
        flattenJoinConditions(node.relations[0], level + 1, acc);
    }

    return acc;
};

export const collectJoinData = (
    node,
    acc = {
        entities: [],
        related_entity: [],
        alias: [],
        join_types: [],
        on: [],
    },
) => {
    if (!node || typeof node !== "object") return acc;

    // primary_entity
    if (node.primary_entity) {
        acc.entities.push(node.primary_entity);
    }

    // related_entity
    if (node.related_entity) {
        acc.related_entity.push(node.related_entity);
    }

    // alias
    if (node.alias) {
        acc.alias.push(node.alias);
    }

    // join_type
    if (node.join_type) {
        acc.join_types.push(node.join_type);
    }

    // on conditions (puede ser array)
    if (Array.isArray(node.on)) {
        acc.on.push(...node.on);
    }

    // recorrer relaciones anidadas
    if (Array.isArray(node.relations)) {
        for (const relation of node.relations) {
            collectJoinData(relation, acc);
        }
    }

    return acc;
};
