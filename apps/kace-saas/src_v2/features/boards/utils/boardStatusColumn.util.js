export const getFieldLeaf = (field) => {
    if (!field || typeof field !== "string") return "";
    const parts = field.split(".");
    return parts[parts.length - 1] || "";
};

export const isStatusOrIsActiveFieldPath = (field) => {
    const leaf = getFieldLeaf(field);
    return leaf === "status" || leaf === "is_active";
};

export const inferIsStatusColumn = (column) => {
    if (!column || typeof column !== "object") return false;
    if (!isStatusOrIsActiveFieldPath(column.field)) return false;
    if (column.is_status_column === true) return true;
    if (column.is_status_column === false) return false;
    return true;
};

export const unifiedStatusBadgeInlineStyle = (isActive) => ({
    backgroundColor: isActive ? "#2A9D9070" : "#E76E5080",
    color: isActive ? "#2A9D90" : "#E76E50",
    padding: "4px 8px",
    borderRadius: "6px",
    display: "inline-block",
    fontWeight: 500,
});

export const isRawUnifiedActive = (raw) => {
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    if (raw === null || raw === undefined) return false;
    if (typeof raw === "number") return raw === 1;
    if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        if (["true", "t", "1"].includes(s)) return true;
        if (["false", "f", "0"].includes(s)) return false;
        if (/^[0-9]+$/.test(s)) return Number(s) === 1;
    }
    return false;
};
