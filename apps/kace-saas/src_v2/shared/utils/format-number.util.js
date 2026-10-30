export const formatNumber = (value, pattern) => {
    if (typeof value !== "number" || isNaN(value)) return value;

    switch (pattern) {
        case "###,###,##0.00":
            return new Intl.NumberFormat("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(value);
        case "###,###,##0":
            return new Intl.NumberFormat("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(value);
        case "0.00":
            return value.toFixed(2);
        case "0":
            return value.toFixed(0);
        default:
            return value.toString();
    }
};
