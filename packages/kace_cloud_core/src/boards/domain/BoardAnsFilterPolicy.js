// Las columnas is_ans son integer (ans_posicion: 1=VIGENTE, 2=INTERMEDIO, 3=VENCIDO).
// El único filtro válido sobre ellas es el del botón rápido: { operator: 'eq', value: 1|2|3 }.
// Otros shapes (p.ej. BETWEEN con strings de fecha cuando data_type="DATE" en la config)
// rompen PostgreSQL con type mismatch (integer vs date) → 500. Los descartamos silenciosamente
// para que el frontend no se reviente esperando una respuesta válida.
const ANS_POSITIONS = new Set([1, 2, 3]);

export class BoardAnsFilterPolicy {
    static stripFilters(filters, selectColumns) {
        if (!Array.isArray(filters)) return filters;
        const ansColumns = Array.isArray(selectColumns) ? selectColumns.filter((c) => c?.is_ans === true) : [];
        if (ansColumns.length === 0) return filters;

        const isAnsFilter = (f) =>
            ansColumns.some((col) => col.entity === f?.entity && (col.alias === f?.field || col.field === f?.field));

        const isQuickAnsFilterShape = (f) => {
            if (f?.operator !== 'eq') return false;
            const v = f.value;
            // Aceptamos number o string numérico (frontend a veces serializa el value como string).
            // Excluimos boolean (Number(true) === 1 se colaría como VIGENTE) y otros tipos.
            if (typeof v !== 'number' && typeof v !== 'string') return false;
            const n = Number(v);
            return Number.isInteger(n) && ANS_POSITIONS.has(n);
        };

        const sanitizeItem = (f) => {
            if (!f || typeof f !== 'object') return f;
            if (f.groupType && Array.isArray(f.filters)) {
                const inner = f.filters.map(sanitizeItem).filter((x) => x != null);
                return inner.length > 0 ? { ...f, filters: inner } : null;
            }
            if (!isAnsFilter(f)) return f;
            return isQuickAnsFilterShape(f) ? f : null;
        };

        return filters.map(sanitizeItem).filter((x) => x != null);
    }
}
