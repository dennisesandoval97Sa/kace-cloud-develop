// Presupuesto por defecto para aux_cases.data en una respuesta de caso (~4.3 MiB).
// Deja >1 MB para el resto del caso bajo el corte de Response.
export const AUX_BUDGET_BYTES = 4_500_000;

const SAMPLE_LAST = 50;
const SAMPLE_MAX_BYTES = 50_000;
const MAX_TRUNCATIONS = 50;

function sizeOf(value) {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

// Construye sample_last: los últimos items del array mientras su tamaño acumulado quede bajo un tope.
// Garantiza que el marcador sea pequeño aunque el array tenga pocos items enormes (convergencia).
function buildSampleLast(arr) {
    const sample = [];
    let bytes = 0;
    for (let j = arr.length - 1; j >= 0 && sample.length < SAMPLE_LAST; j -= 1) {
        const itemBytes = sizeOf(arr[j]);
        if (bytes + itemBytes > SAMPLE_MAX_BYTES) {
            break;
        }
        sample.unshift(arr[j]);
        bytes += itemBytes;
    }
    return sample;
}

// Recolecta arrays y strings "hoja" con referencia a su contenedor (parent + key), su tamaño,
// y un path legible solo para reporte. No desciende dentro de arrays.
function collectHeavyNodes(node, path, out) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
        return;
    }
    for (const [key, value] of Object.entries(node)) {
        const childPath = path ? `${path}.${key}` : key;
        if (Array.isArray(value)) {
            out.push({ parent: node, key, value, bytes: sizeOf(value), type: 'array', path: childPath });
        } else if (typeof value === 'string') {
            out.push({ parent: node, key, value, bytes: sizeOf(value), type: 'string', path: childPath });
        } else if (value && typeof value === 'object') {
            collectHeavyNodes(value, childPath, out);
        }
    }
}

/**
 * Recorta los valores más grandes de `data` hasta caber en `budgetBytes`, reemplazándolos por
 * un marcador { _truncated: true, ... }. Si `data` ya cabe, lo devuelve intacto (preserva el tipo).
 *
 * @param {object|string|null|undefined} data
 * @param {number} budgetBytes
 * @returns {{ data: any, truncated: Array<{path:string, original_bytes:number, item_count?:number}> }}
 */
export function trimAuxData(data, budgetBytes = AUX_BUDGET_BYTES) {
    if (data === null || data === undefined) {
        return { data, truncated: [] };
    }

    let obj = data;
    if (typeof data === 'string') {
        try {
            obj = JSON.parse(data);
        } catch {
            return { data, truncated: [] };
        }
    }
    if (typeof obj !== 'object') {
        return { data, truncated: [] };
    }

    if (sizeOf(obj) <= budgetBytes) {
        return { data, truncated: [] };
    }

    const working = JSON.parse(JSON.stringify(obj));
    const heavy = [];
    collectHeavyNodes(working, '', heavy);
    heavy.sort((a, b) => b.bytes - a.bytes);

    const truncated = [];
    let i = 0;
    // Re-stringify cada iteración para medir el tamaño; acotado por MAX_TRUNCATIONS y porque cada
    // truncación reduce el objeto rápidamente (no es un hot path).
    while (sizeOf(working) > budgetBytes && i < heavy.length && truncated.length < MAX_TRUNCATIONS) {
        const node = heavy[i];
        i += 1;
        const marker =
            node.type === 'array'
                ? {
                      _truncated: true,
                      reason: 'oversized',
                      original_bytes: node.bytes,
                      item_count: node.value.length,
                      sample_last: buildSampleLast(node.value),
                  }
                : { _truncated: true, reason: 'oversized', original_bytes: node.bytes };
        node.parent[node.key] = marker;
        truncated.push({
            path: node.path,
            original_bytes: node.bytes,
            item_count: node.type === 'array' ? node.value.length : undefined,
        });
    }

    return { data: working, truncated };
}
