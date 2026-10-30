export const getNestedValue = (obj, path) => {
    if (!path) return undefined;
    return path?.split(".")?.reduce((acc, key) => acc?.[key], obj);
};

export const fromObjectToArray = (obj) => {
    return Object.entries(obj)?.map(([key, value]) => ({
        key,
        value,
    }));
};
