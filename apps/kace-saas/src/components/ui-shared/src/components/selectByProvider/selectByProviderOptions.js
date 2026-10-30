export const extracValue = (data, keyFrom) => {
    const fromArray = String(keyFrom).split(".");
    return fromArray.reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), data);
};

export const getLabelFromItem = (item, labelFrom) => {
    if (Array.isArray(labelFrom)) {
        return labelFrom
            .map((key) => extracValue(item, key))
            .filter((value) => typeof value === "string" && value.trim() !== "")
            .join(" ");
    }
    const res = extracValue(item, labelFrom);
    return typeof res === "string" ? res : "";
};

export const resolveFieldName = (labelFrom, explicitField) => {
    if (typeof explicitField === "string" && explicitField.trim() !== "") {
        return explicitField;
    }
    if (typeof labelFrom === "string" && labelFrom.trim() !== "") {
        return labelFrom;
    }
    if (Array.isArray(labelFrom) && typeof labelFrom[0] === "string") {
        return labelFrom[0];
    }
    return null;
};

const mapItemToOption = (item, { valueFrom = "id", labelFrom = "nombre" } = {}) => {
    if (item instanceof Object) {
        return {
            value: extracValue(item, valueFrom),
            label: getLabelFromItem(item, labelFrom),
        };
    }
    if (typeof item === "string") {
        return { label: item, value: item };
    }
    return null;
};

/** The saved value as an option, or `null` when it has no value or no label (it would render as a blank option). */
export const seedOptionFromInitialValue = (initialValue, { valueFrom = "id", labelFrom = "nombre" } = {}) => {
    const option = mapItemToOption(initialValue, { valueFrom, labelFrom });
    if (!option || option.value === undefined || option.value === null || option.value === "" || !option.label) {
        return null;
    }
    return option;
};

export const mapRawItemsToOptions = (items, { valueFrom = "id", labelFrom = "nombre" } = {}) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => mapItemToOption(item, { valueFrom, labelFrom })).filter(Boolean);
};

/**
 * Adds the seed option (e.g. the saved value) unless it has no value or is already listed.
 * Values are compared as strings, so an id typed differently across sources is not duplicated.
 */
export const mergeSeedIntoOptions = (options, seedOption, { prepend = false } = {}) => {
    if (!seedOption || seedOption.value === undefined || seedOption.value === null || seedOption.value === "") {
        return options;
    }
    const seedValue = String(seedOption.value);
    if (options.some((opt) => String(opt.value) === seedValue)) {
        return options;
    }
    return prepend ? [seedOption, ...options] : [...options, seedOption];
};

/** Appends the options of a newly loaded page, skipping values already listed (compared as strings). */
export const appendUniqueOptions = (previous, items) => {
    const seen = new Set(previous.map((option) => String(option.value)));
    return [...previous, ...items.filter((option) => !seen.has(String(option.value)))];
};

export const shouldIncludeSeedInOptions = (seedOption, searchTerm = "") => {
    if (!seedOption || seedOption.value === undefined || seedOption.value === null || seedOption.value === "") {
        return false;
    }
    const normalized = String(searchTerm ?? "")
        .trim()
        .toLowerCase();
    if (!normalized) return true;
    return String(seedOption.label ?? "")
        .toLowerCase()
        .includes(normalized);
};

export const sortOptionsAlphabetically = (options) =>
    [...options].sort((a, b) =>
        String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, { sensitivity: "base" }),
    );

export const filterOptionsByLabel = (options, query) => {
    const normalized = String(query ?? "")
        .trim()
        .toLowerCase();
    if (!normalized) return options;
    return options.filter((opt) =>
        String(opt.label ?? "")
            .toLowerCase()
            .includes(normalized),
    );
};

export const computeHasNextPage = ({ accumulatedCount, pageSize, total, lastPageCount }) => {
    if (typeof total === "number" && Number.isFinite(total)) {
        return accumulatedCount < total;
    }
    return lastPageCount >= pageSize;
};
