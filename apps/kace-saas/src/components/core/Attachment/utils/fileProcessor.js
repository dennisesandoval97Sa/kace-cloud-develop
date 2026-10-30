import { toast } from "sonner";
import { ALLOWED_FILE_EXTENSIONS, ALL_ALLOWED_FILE_EXTENSIONS, formatValidationErrors, validateFiles } from "./fileValidations";

/**
 * Procesa y valida archivos antes de pasarlos al manejador
 * @param {FileList|Array} files - Archivos a procesar
 * @param {Array|String|null} allowedTypes - Tipos de archivos permitidos (categorías o null para todos)
 * @param {Number} maxSize - Tamaño máximo de archivo permitido (opcional)
 * @returns {Promise<void>}
 */
export const processFiles = async (
    files,
    allowedTypes,
    maxSize = undefined,
) => {
    if (!files || files.length === 0) return;

    try {
        const validation = await validateFiles(Array.from(files), allowedTypes, maxSize);

        if (validation.invalid.length > 0) {
            const errorMessage = formatValidationErrors(validation.invalid);
            toast.warning(errorMessage);

            if (validation.valid.length > 0 && validation.invalid.length > 0) {
                toast.info(`Se procesarán solo los ${validation.valid.length} archivos válidos.`);
            }
        }

        return validation.valid;
    } catch (error) {
        toast.error(`Error al procesar archivos: ${error.message}`);
    }
};

/**
 * Obtiene un conjunto de extensiones permitidas basadas en categorías
 * @param {Array|String|null} allowedTypes - Tipos permitidos o categorías
 * @returns {Array} Array de extensiones permitidas
 */
export const getAllowedExtensions = (allowedTypes) => {
    if (allowedTypes === null) {
        return ALL_ALLOWED_FILE_EXTENSIONS;
    }

    if (typeof allowedTypes === "string") {
        if (allowedTypes === "txt") {
            return [".txt"];
        }
        return ALLOWED_FILE_EXTENSIONS[allowedTypes] || [];
    }

    if (Array.isArray(allowedTypes)) {
        let extensions = [];

        allowedTypes.forEach(type => {
            if (type === "txt") {
                extensions.push(".txt");
            } else if (ALLOWED_FILE_EXTENSIONS[type]) {
                extensions = [...extensions, ...ALLOWED_FILE_EXTENSIONS[type]];
            }
        });

        return extensions;
    }

    return [];
};
