/**
 * Etiqueta legible de una clasificación: sus niveles unidos con ' -> ' hasta el primer vacío.
 *
 * El corte en el primer vacío no es una guarda defensiva, es la regla: los niveles son una
 * jerarquía, así que un hueco en medio interrumpe la ruta y lo que venga detrás no cuelga de
 * nada. Vive aquí —y no en cada consumidor— porque el desplegable de clasificaciones y la
 * bitácora tienen que nombrar la misma clasificación igual.
 *
 * Acepta tanto una fila de base de datos (niveles como texto) como una `Classification`
 * (niveles como ValueObject), que es la diferencia entre sus dos llamadores.
 *
 * @param {Object} source - Fila o entidad con `nivel1`…`nivel10`.
 * @returns {string} La etiqueta, o cadena vacía si no hay ni primer nivel.
 */
export function buildClassificationLabel(source) {
    if (!source) return '';

    const partes = [];
    for (let i = 1; i <= 10; i++) {
        const nivel = asString(source[`nivel${i}`]);
        if (!nivel) break;
        partes.push(nivel);
    }

    return partes.join(' -> ');
}

function asString(value) {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object' && 'value' in value) return String(value.value ?? '').trim();
    return '';
}
