export const MAX_CLASSIFICATION_LEVELS = 10;

export const NIVEL_COLUMN_PATTERN = /^nivel([1-9]\d*)$/i;

export const CLASSIFICATION_LEVEL_KEYS = Array.from(
    { length: MAX_CLASSIFICATION_LEVELS },
    (_, index) => `nivel${index + 1}`,
);

export const parseNivelNumber = (columnName) => {
    const match = columnName?.match(NIVEL_COLUMN_PATTERN);
    if (!match) return null;

    const levelNumber = parseInt(match[1], 10);
    return levelNumber >= 1 && levelNumber <= MAX_CLASSIFICATION_LEVELS ? levelNumber : null;
};

export const isNivelColumn = (columnName) => parseNivelNumber(columnName) !== null;

export const getFilledClassificationLevels = (row = {}) =>
    CLASSIFICATION_LEVEL_KEYS.reduce((levels, key) => {
        const value = row[key];
        if (value === null || value === undefined || value === "") {
            return levels;
        }

        const normalizedValue = String(value);
        levels.push({
            id: key,
            label: normalizedValue,
            value: normalizedValue,
        });
        return levels;
    }, []);

const normalizeFallbackClassificationLevel = (level) => {
    const levelNumber = parseNivelNumber(level?.id);
    const rawLabel = level?.label ?? level?.value;

    if (levelNumber === null || rawLabel === null || rawLabel === undefined || rawLabel === "") {
        return null;
    }

    const label = String(rawLabel);
    const value = String(level?.value ?? rawLabel);

    return {
        id: `nivel${levelNumber}`,
        label,
        value,
    };
};

export const getClassificationPath = (row = {}, fallbackLevels = []) => {
    const canonicalPath = getFilledClassificationLevels(row);

    if (canonicalPath.length > 1 || !fallbackLevels?.length) {
        return canonicalPath;
    }

    const levelsById = new Map(canonicalPath.map((level) => [level.id, level]));

    fallbackLevels.forEach((level) => {
        const normalizedLevel = normalizeFallbackClassificationLevel(level);

        if (normalizedLevel && !levelsById.has(normalizedLevel.id)) {
            levelsById.set(normalizedLevel.id, normalizedLevel);
        }
    });

    return Array.from(levelsById.values()).sort(
        (left, right) => parseNivelNumber(left.id) - parseNivelNumber(right.id),
    );
};

export const getExpandableClassificationLevelsFromRow = (row, rootColumnName) => {
    const filledLevels = getFilledClassificationLevels(row);
    const rootLevel = parseNivelNumber(rootColumnName) ?? 1;
    const deeperThanRoot = filledLevels.filter((level) => {
        const levelNumber = parseNivelNumber(level.id);
        return levelNumber !== null && levelNumber > rootLevel;
    });

    if (deeperThanRoot.length > 0) {
        return deeperThanRoot;
    }

    return filledLevels.filter((level) => {
        const levelNumber = parseNivelNumber(level.id);
        return levelNumber !== null && levelNumber > 1;
    });
};
