export const ONLY_CSV_ERROR = "ONLY_CSV";

const ALLOWED_CSV_MIME_TYPES = new Set([
    "text/csv",
    "text/plain",
    "application/vnd.ms-excel",
    "application/csv",
    "text/x-csv",
    "",
]);

/**
 * Lee y valida un archivo CSV asegurando formato de extensión y tipo de contenido plano.
 *
 * @param {Array<{ fileData?: File, path?: string }>} files - Lista de archivos seleccionados.
 * @returns {Promise<string>} Contenido de texto del archivo CSV.
 */
export const readCsvFile = (files) => {
    return new Promise((resolve, reject) => {
        if (!files || !files.length || !files[0]?.fileData) {
            return resolve("");
        }

        const file = files[0].fileData;
        const fileName = file.name || files[0].path || "";

        if (!fileName.toLowerCase().endsWith(".csv")) {
            return reject(new Error(ONLY_CSV_ERROR));
        }

        const mimeType = (file.type || "").toLowerCase().trim();
        if (mimeType && !ALLOWED_CSV_MIME_TYPES.has(mimeType)) {
            return reject(new Error(ONLY_CSV_ERROR));
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text !== "string") {
                return resolve("");
            }

            // Verificación de contenido: prevenir archivos binarios renombrados a .csv
            if (text.includes("\0")) {
                return reject(new Error(ONLY_CSV_ERROR));
            }

            resolve(text);
        };

        reader.onerror = () => resolve("");
        reader.readAsText(file);
    });
};
