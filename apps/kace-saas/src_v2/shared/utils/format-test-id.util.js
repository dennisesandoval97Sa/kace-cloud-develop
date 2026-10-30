export const formatTestId = (prefix, value, clean = false) => {
    if (!value) return prefix;

    let finalValue;

    if (clean) {
        finalValue = value
            ?.split(".")
            ?.pop()
            ?.toLowerCase()
            ?.replace(/\s+/g, "-")
            ?.replace(/[^a-z0-9_]/g, "");
    } else {
        finalValue = value?.toLowerCase()?.replace(/\s+/g, "-");
    }

    return `${prefix}-${finalValue}`;
};
