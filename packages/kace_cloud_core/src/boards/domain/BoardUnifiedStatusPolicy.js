export class BoardUnifiedStatusPolicy {
    static expandFilters(filters, selectColumns, outerAlias) {
        if (!filters || !Array.isArray(filters)) return filters;
        return filters.map((f) => BoardUnifiedStatusPolicy.#expandFilterItem(f, selectColumns, outerAlias));
    }

    static isRawActive(raw) {
        if (raw === true || raw === 1) return true;
        if (raw === false || raw === 0) return false;
        if (raw === null || raw === undefined) return false;
        if (typeof raw === 'number') return raw === 1;
        if (typeof raw === 'string') {
            const s = raw.trim().toLowerCase();
            if (['true', 't', '1'].includes(s)) return true;
            if (['false', 'f', '0'].includes(s)) return false;
            if (/^[0-9]+$/.test(s)) return Number(s) === 1;
        }
        return false;
    }

    static columnTreatsAsUnifiedStatus(col) {
        if (!col || typeof col !== 'object') return false;
        if (col.is_status_column === false) return false;
        if (col.is_status_column === true) return true;
        const leaf = BoardUnifiedStatusPolicy.#leafField(col.field);
        return leaf === 'status' || leaf === 'is_active';
    }

    static #leafField(field) {
        if (!field || typeof field !== 'string') return '';
        const parts = field.split('.');
        return parts[parts.length - 1] || '';
    }

    static #findColumnForFilter(select, entity, field) {
        if (!Array.isArray(select)) return null;
        return select.find((c) => c && c.entity === entity && (c.alias === field || c.field === field)) ?? null;
    }

    static #qualifyFilterColumnSql(outerAlias, field) {
        const safe = String(field ?? '');
        if (safe.includes('.')) {
            const dotIdx = safe.indexOf('.');
            const jsonCol = safe.substring(0, dotIdx);
            const pathParts = safe.substring(dotIdx + 1).split('.');
            if (pathParts.length === 1) {
                return `${outerAlias}.${jsonCol}->>'${pathParts[0]}'`;
            }
            return `${outerAlias}.${jsonCol} #>> '{${pathParts.join(',')}}'`;
        }
        const ident = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(safe) ? safe : `"${safe.replace(/"/g, '""')}"`;
        return `${outerAlias}.${ident}`;
    }

    static #sqlUnifiedActive(qualifiedExpr) {
        return `(LOWER(TRIM(COALESCE((${qualifiedExpr})::text, ''))) IN ('true','t','1') OR ((${qualifiedExpr})::text ~ '^[0-9]+$' AND LOWER(TRIM((${qualifiedExpr})::text)) = '1'))`;
    }

    static #sqlUnifiedInactive(qualifiedExpr) {
        return `NOT (${BoardUnifiedStatusPolicy.#sqlUnifiedActive(qualifiedExpr)})`;
    }

    static #expandFilterItem(filter, selectColumns, outerAlias) {
        if (!filter || typeof filter !== 'object' || filter.isBoardUnifiedSqlWhere) return filter;
        if (filter.groupType && Array.isArray(filter.filters)) {
            return {
                ...filter,
                filters: filter.filters.map((sub) =>
                    BoardUnifiedStatusPolicy.#expandFilterItem(sub, selectColumns, outerAlias)
                ),
            };
        }
        const entity = filter.entity;
        const field = filter.field;
        const operator = filter.operator;
        const value = filter.value;
        if (!entity || !field || operator !== 'eq') return filter;
        if (value !== true && value !== false) return filter;
        const col = BoardUnifiedStatusPolicy.#findColumnForFilter(selectColumns, entity, field);
        if (!col || !BoardUnifiedStatusPolicy.columnTreatsAsUnifiedStatus(col)) return filter;
        const isDirectTableAccess = outerAlias === entity;
        const referenceField = isDirectTableAccess ? col.field : (col.alias ?? col.field);
        const qualified = BoardUnifiedStatusPolicy.#qualifyFilterColumnSql(outerAlias, referenceField);
        const sql =
            value === true
                ? BoardUnifiedStatusPolicy.#sqlUnifiedActive(qualified)
                : BoardUnifiedStatusPolicy.#sqlUnifiedInactive(qualified);
        const logicalType = typeof filter.type === 'string' ? filter.type : 'AND';
        return {
            isBoardUnifiedSqlWhere: true,
            sql,
            type: logicalType,
        };
    }
}
