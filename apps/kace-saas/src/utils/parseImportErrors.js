/**
 * Parses a concatenated generalErrors string from the import API into structured rows.
 * Backend format: "Fila 2: \"field\" msg. \"field2\" msg; Fila 3: \"field\" msg"
 */
export const parseGeneralErrors = (errorString) => {
    if (!errorString || typeof errorString !== "string") return [];

    const rowSegments = errorString.split(/;\s*(?=Fila\s+\d+:)/);

    return rowSegments.map((segment) => {
        const rowMatch = segment.match(/^Fila\s+(\d+):\s*(.*)/s);
        if (!rowMatch) return { row: null, errors: [segment.trim()] };

        const rowNum = rowMatch[1];
        const errorsStr = rowMatch[2];

        const fieldErrors = errorsStr.split(/\.\s+(?=")/);

        return {
            row: rowNum,
            errors: fieldErrors.map((e) => e.trim()).filter(Boolean),
        };
    });
};
