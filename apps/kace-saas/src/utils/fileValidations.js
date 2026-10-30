import { FORMAT_FILES } from "@/utils/filesExtensions";

export const ALLOWED_FILE_TYPES = {
    images: ["image/jpeg", "image/png", "image/gif", "image/bmp"],
    documents: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "application/vnd.oasis.opendocument.text",
    ],
    csv: ["text/csv"],
    media: ["audio/wav", "video/mp4", "application/javascript"],
    compressed: ["application/zip", "application/x-zip-compressed"],
};

export const ALL_ALLOWED_FILE_TYPES = Object.values(FORMAT_FILES).flat();

export const ALLOWED_FILE_EXTENSIONS = FORMAT_FILES.reduce((acc, item) => {
    const key = item.name.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "");
    acc[key] = item.value;
    return acc;
}, {});

export const ALL_ALLOWED_FILE_EXTENSIONS = Object.values(ALLOWED_FILE_EXTENSIONS).flat();

const EXTENSION_TO_MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".js": "application/javascript",
    ".zip": "application/zip",
};

const hasOleSignature = (buffer) =>
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

const OOXML_PART_PREFIXES = ["[Content_Types].xml", "_rels/", "docProps/", "xl/", "ppt/"];

// Office moderno guardado con extensión legacy: ZIP cuya primera entrada es una parte OOXML.
const isOoxmlZip = (buffer) => {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return false;
    }
    const nameLength = buffer[26] | (buffer[27] << 8);
    const firstEntry = new TextDecoder("utf-8").decode(buffer.slice(30, 30 + nameLength));
    return OOXML_PART_PREFIXES.some((prefix) => firstEntry.startsWith(prefix));
};

const SCRIPT_PATTERNS = [/<script[\s>]/i, /<\/script>/i, /javascript:/i];

const CSV_CODE_PATTERNS = [
    ...SCRIPT_PATTERNS,
    /onerror\s*=/i,
    /onload\s*=/i,
    /eval\s*\(/i,
    /function\s*\(/i,
    /=>\s*{/i,
    /\bvar\s+/i,
    /\blet\s+/i,
    /\bconst\s+/i,
    /<\?php/i,
    /system\s*\(/i,
    /shell_exec/i,
    /import\s+.*from/i,
    /\bclass\s+[A-Z]/i,
];

// eslint-disable-next-line no-control-regex
const isPlainText = (text) => text.trim() !== "" && !/[\x00-\x08\x0E-\x1F]/.test(text);

const isSafeDelimitedText = (text) => isPlainText(text) && !CSV_CODE_PATTERNS.some((pattern) => pattern.test(text));

// Exportes de texto delimitado abiertos por Excel: sus celdas traen "Class A", "let"…, por eso solo marcado y script.
const isDelimitedXlsText = (text) =>
    isPlainText(text) && !/^\s*</.test(text) && !SCRIPT_PATTERNS.some((pattern) => pattern.test(text));

const decodeUtf8Strict = (buffer) => {
    try {
        // stream: la lectura se corta en 1000 bytes y puede partir un carácter multibyte.
        return new TextDecoder("utf-8", { fatal: true }).decode(buffer, { stream: true });
    } catch {
        return null;
    }
};

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Obtiene el tamaño máximo de archivo permitido desde las variables de entorno
 * @returns {number} Tamaño máximo en bytes
 */
export const getMaxFileSize = () => {
    const maxSizeMB = import.meta.env.VITE_MAX_FILE_SIZE_MB;
    if (maxSizeMB && !isNaN(maxSizeMB)) {
        return parseInt(maxSizeMB) * 1024 * 1024;
    }
    return DEFAULT_MAX_SIZE;
};

/**
 * Obtiene el tipo MIME basado en la extensión del archivo
 * @param {string} filename - Nombre del archivo
 * @returns {string|null} Tipo MIME o null si no se reconoce
 */
export const getMimeTypeFromExtension = (filename) => {
    if (!filename) return null;
    const extension = "." + filename.split(".").pop().toLowerCase();
    return EXTENSION_TO_MIME[extension] || null;
};

/**
 * Verifica si el archivo tiene una extensión permitida
 * @param {File} file - El archivo a validar
 * @param {string|string[]|null} allowedTypes - Tipos permitidos o null para todos
 * @returns {boolean} Verdadero si la extensión es permitida
 */
export const hasAllowedExtension = (file, allowedTypes = null) => {
    if (!file.name.includes(".")) {
        return false;
    }

    const extension = "." + file.name.split(".").pop().toLowerCase();

    if (allowedTypes === null) {
        return ALL_ALLOWED_FILE_EXTENSIONS.includes(extension);
    }

    if (typeof allowedTypes === "string") {
        // Puede ser una categoría conocida o una extensión directa
        if (ALLOWED_FILE_EXTENSIONS[allowedTypes]) {
            return ALLOWED_FILE_EXTENSIONS[allowedTypes].includes(extension);
        }

        return allowedTypes.toLowerCase() === extension;
    }

    if (Array.isArray(allowedTypes) && allowedTypes.length > 0) {
        // Si todos los valores corresponden a categorías conocidas, se usan esas categorías
        if (allowedTypes.every((type) => typeof type === "string" && ALLOWED_FILE_EXTENSIONS[type])) {
            const validExtensions = allowedTypes.flatMap((category) => ALLOWED_FILE_EXTENSIONS[category]);
            return validExtensions.includes(extension);
        }

        // En caso contrario, se asume que es un arreglo de extensiones directas (ej: [".pdf", ".png"])
        return allowedTypes.some((type) => typeof type === "string" && type.toLowerCase() === extension);
    }

    return false;
};

/**
 * Valida la extensión de un archivo
 * @param {File} file - El archivo a validar
 * @param {string|string[]|null} allowedTypes - Tipos MIME permitidos, categoría(s), o null para permitir todos
 * @returns {boolean} Verdadero si la extensión es válida
 */
export const validateFileType = (file, allowedTypes = null) => {
    if (hasAllowedExtension(file, allowedTypes)) {
        return true;
    }

    if (allowedTypes === null) {
        return ALL_ALLOWED_FILE_TYPES.includes(file.type);
    }

    if (typeof allowedTypes === "string" && ALLOWED_FILE_TYPES[allowedTypes]) {
        return ALLOWED_FILE_TYPES[allowedTypes].includes(file.type);
    }

    if (
        Array.isArray(allowedTypes) &&
        allowedTypes.every((type) => typeof type === "string" && ALLOWED_FILE_TYPES[type])
    ) {
        const allowedMimeTypes = allowedTypes.flatMap((category) => ALLOWED_FILE_TYPES[category]);
        return allowedMimeTypes.includes(file.type);
    }

    return false;
};

/**
 * Valida el tamaño de un archivo
 * @param {File} file - El archivo a validar
 * @param {number} maxSize - Tamaño máximo en bytes (opcional)
 * @returns {boolean} Verdadero si el tamaño es válido
 */
export const validateFileSize = (file, maxSize = getMaxFileSize()) => {
    return file.size <= maxSize;
};

/**
 * Verifica la consistencia entre el tipo MIME declarado y el contenido real del archivo
 * @param {File} file - El archivo a validar
 * @returns {Promise<boolean>} Promesa que se resuelve a verdadero si el contenido es válido
 */
export const validateFileContent = async (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = function (event) {
            const buffer = new Uint8Array(event.target.result);
            const type = file.type;

            if (type === "image/png") {
                const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
                return resolve(isPng);
            }

            if (type === "image/jpeg") {
                const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
                return resolve(isJpeg);
            }

            if (type === "image/gif") {
                const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
                return resolve(isGif);
            }

            if (type === "image/bmp") {
                const isBmp = buffer[0] === 0x42 && buffer[1] === 0x4d;
                return resolve(isBmp);
            }

            if (type === "application/pdf") {
                const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50;
                return resolve(isPdf);
            }

            if (type === "application/msword") {
                return resolve(hasOleSignature(buffer));
            }

            const isZipBased = buffer[0] === 0x50 && buffer[1] === 0x4b;
            if (
                [
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "application/vnd.oasis.opendocument.text",
                ].includes(type)
            ) {
                return resolve(isZipBased);
            }

            if (type === "application/vnd.ms-excel") {
                const text = decodeUtf8Strict(buffer);
                return resolve(
                    hasOleSignature(buffer) || isOoxmlZip(buffer) || (text !== null && isDelimitedXlsText(text)),
                );
            }

            if (type === "application/vnd.ms-powerpoint") {
                return resolve(hasOleSignature(buffer) || isOoxmlZip(buffer));
            }

            if (type === "text/plain") {
                const text = new TextDecoder("utf-8").decode(buffer);
                const controlChars = new RegExp(
                    `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`,
                );
                const hasSuspicious = controlChars.test(text);
                return resolve(!hasSuspicious);
            }

            if (type === "text/csv") {
                return resolve(isSafeDelimitedText(new TextDecoder("utf-8").decode(buffer)));
            }

            if (type === "application/javascript") {
                const text = new TextDecoder("utf-8").decode(buffer);
                const controlChars = new RegExp(
                    `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`,
                );
                const isText = !controlChars.test(text);
                return resolve(isText);
            }
            if (type === "application/zip" || type === "application/x-zip-compressed") {
                const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
                return resolve(isZip);
            }

            if (type === "audio/wav") {
                const isWav = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
                return resolve(isWav);
            }

            if (type === "video/mp4") {
                const isMp4 = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
                return resolve(isMp4);
            }

            return resolve(true);
        };

        reader.onerror = function () {
            resolve(false);
        };

        reader.readAsArrayBuffer(file.slice(0, 1000));
    });
};

/**
 * Valida un archivo completo (tipo, tamaño y contenido)
 * @param {File} file - El archivo a validar
 * @param {string|string[]|null} allowedTypes - Tipos MIME permitidos, categoría(s), o null para todos
 * @param {number} maxSize - Tamaño máximo en bytes (opcional)
 * @returns {Promise<{isValid: boolean, errors: string[]}>} Resultado de la validación
 */
export const validateFile = async (file, allowedTypes = null, maxSize = getMaxFileSize()) => {
    const errors = [];

    if (!validateFileType(file, allowedTypes)) {
        let allowedExtensionsArray = [];

        if (Array.isArray(allowedTypes) && allowedTypes.length > 0) {
            // Cuando se pasan categorías específicas, solo mostramos las extensiones de esas categorías
            if (allowedTypes.every((type) => ALLOWED_FILE_EXTENSIONS[type])) {
                allowedExtensionsArray = allowedTypes.flatMap((category) => ALLOWED_FILE_EXTENSIONS[category]);
            } else {
                // Arreglo de extensiones directas (ej: [".pdf", ".png"])
                allowedExtensionsArray = allowedTypes;
            }
        } else if (typeof allowedTypes === "string") {
            // Cuando se pasa una sola categoría o una sola extensión
            if (ALLOWED_FILE_EXTENSIONS[allowedTypes]) {
                allowedExtensionsArray = ALLOWED_FILE_EXTENSIONS[allowedTypes];
            } else if (allowedTypes.startsWith(".")) {
                allowedExtensionsArray = [allowedTypes];
            }
        } else if (allowedTypes === null) {
            // Sin restricción explícita: se usan todas las extensiones disponibles
            allowedExtensionsArray = ALL_ALLOWED_FILE_EXTENSIONS;
        }

        errors.push(`Tipo de archivo no permitido. Extensiones permitidas: ${allowedExtensionsArray.join(", ")}`);
    }

    if (!validateFileSize(file, maxSize)) {
        const maxSizeMB = Math.round((maxSize / (1024 * 1024)) * 10) / 10;
        errors.push(`El archivo excede el tamaño máximo de ${maxSizeMB} MB`);
    }

    const isContentValid = await validateFileContent(file);
    if (!isContentValid) {
        errors.push("El contenido del archivo no coincide con el tipo declarado o está dañado.");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Función de utilidad para validar múltiples archivos
 * @param {File[]|FileList} files - Lista de archivos a validar
 * @param {string|string[]|null} allowedTypes - Tipos MIME permitidos, categoría(s), o null para todos
 * @param {number} maxSize - Tamaño máximo en bytes (opcional)
 * @returns {Promise<{valid: File[], invalid: {file: File, errors: string[]}[]}>}
 */
export const validateFiles = async (files, allowedTypes = null, maxSize = getMaxFileSize()) => {
    if (!files) {
        return { valid: [], invalid: [] };
    }

    const filesArray = Array.isArray(files) ? files : Array.from(files);

    if (filesArray.length === 0) {
        return { valid: [], invalid: [] };
    }

    const results = await Promise.all(
        filesArray.map(async (file) => {
            try {
                const validation = await validateFile(file, allowedTypes, maxSize);
                return {
                    file,
                    isValid: validation.isValid,
                    errors: validation.errors,
                };
            } catch (error) {
                return {
                    file,
                    isValid: false,
                    errors: ["Error al validar archivo: " + (error.message || "error desconocido")],
                };
            }
        }),
    );

    return {
        valid: results.filter((r) => r.isValid).map((r) => r.file),
        invalid: results.filter((r) => !r.isValid).map((r) => ({ file: r.file, errors: r.errors })),
    };
};

/**
 * Formatea los errores de validación para mostrarlos al usuario
 * @param {Array} invalidFiles - Array de archivos inválidos y sus errores
 * @returns {string} Mensaje de error formateado
 */
export const formatValidationErrors = (invalidFiles) => {
    if (invalidFiles.length === 0) return "";

    if (invalidFiles.length === 1) {
        const { file, errors } = invalidFiles[0];
        return `Error en el archivo "${file.name}": ${errors.join(", ")}`;
    }

    return (
        `Errores en ${invalidFiles.length} archivos:\n` +
        invalidFiles.map(({ file, errors }) => `- "${file.name}": ${errors.join(", ")}`).join("\n")
    );
};
