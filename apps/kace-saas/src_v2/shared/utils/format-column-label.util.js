export const formatColumnLabel = (label) => {
    if (!label || typeof label !== "string") return label || "";

    const withSpaces = label.replace(/_/g, " ");

    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};
