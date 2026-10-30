const optionKey = (option) => {
    if (option?.value === undefined || option?.value === null || option?.value === "") return null;
    return String(option.value);
};

export const dedupeSelectOptionsKeepingLast = (options = []) => {
    const lastIndexByKey = new Map();
    options.forEach((option, index) => {
        const key = optionKey(option);
        if (key === null) return;
        lastIndexByKey.set(key, index);
    });
    return options.filter((option, index) => {
        const key = optionKey(option);
        if (key === null) return true;
        return lastIndexByKey.get(key) === index;
    });
};

export const mergeEnsuredSelectOptions = (ensureOptions = [], pageOptions = []) => {
    const pageKeys = new Set();
    const uniquePages = [];

    for (const option of pageOptions) {
        const key = optionKey(option);
        if (key === null || pageKeys.has(key)) continue;
        pageKeys.add(key);
        uniquePages.push(option);
    }

    const seenEnsure = new Set();
    const missingEnsure = [];

    for (const option of ensureOptions) {
        const key = optionKey(option);
        if (key === null || pageKeys.has(key) || seenEnsure.has(key)) continue;
        seenEnsure.add(key);
        missingEnsure.push(option);
    }

    return [...missingEnsure, ...uniquePages];
};
