export const parseInputType = (value = "") => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (Number(value) >= 0) return Number(value);
    return value;
};
