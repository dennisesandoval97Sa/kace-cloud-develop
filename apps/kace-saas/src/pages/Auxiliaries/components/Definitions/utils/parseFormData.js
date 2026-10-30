export const generateAuxTableFields = (name) => {
    if (!name || typeof name !== "string") return { tablename: "", logs_tablename: "" };

    const cleanName = name.toLowerCase();
    const tablename = `aux_${cleanName}`;
    const logstable = `history_${tablename}`;

    return { tablename, logstable };
};
