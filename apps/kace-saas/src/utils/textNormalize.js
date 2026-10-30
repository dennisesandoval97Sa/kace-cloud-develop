/**
 * Normaliza un valor para comparaciones de búsqueda: descompone los caracteres
 * acentuados (NFD), elimina las marcas diacríticas, recorta y pasa a minúsculas.
 *
 * Pensado para filtros de listas y autocompletados, donde "CÓDIGO" debe matchear
 * con "codigo". No usar para sanear nombres de archivo ni para generar
 * identificadores: esos casos tienen reglas propias.
 *
 * Alcance: el repo tiene otros sitios que descomponen en NFD, pero con contratos
 * distintos que NO deben consolidarse aquí:
 *   - Saneadores de nombre de archivo (`attachmentDisplayName.js`,
 *     `FileNameAttachment.js`, `EmailZipGenerator.js`): además filtran caracteres
 *     no seguros y limitan la longitud.
 *   - `core/Editor/Toolbar.jsx`: sin `toLowerCase` ni `trim`, porque envuelve
 *     tokens de plantilla `{{valor}}` sensibles a mayúsculas y espacios.
 * El único equivalente real es `apps/onescript_plugin_kace/.../utils/normalize.js`;
 * unificarlo exige mover esta utilidad a un paquete compartido, fuera del alcance
 * de este módulo del frontend.
 *
 * @param {unknown} value valor a normalizar; null/undefined devuelven "".
 * @returns {string} el texto normalizado.
 */
export const normalizeForSearch = (value) => {
    if (value == null) return "";
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
};
