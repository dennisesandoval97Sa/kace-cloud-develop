/**
 * Solo se acepta una ruta interna: debe empezar con "/" pero no con "//" ni con "/\",
 * que el navegador interpretaria como una URL absoluta hacia otro host (normaliza la
 * barra invertida a "/" en los esquemas especiales).
 */
export const isSafeInternalPath = (path) => typeof path === "string" && /^\/(?![/\\])/.test(path);
