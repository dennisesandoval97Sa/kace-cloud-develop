import { ALLOWED_CRITERIA_FUNCTIONS } from '../../shared/criteria/allowedCriteriaFunctions';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { AuxiliaryColumnFieldHelper } from '../../shared/criteria/AuxiliaryColumnFieldHelper.js';
import { AuxiliaryEntityHelper } from '../../shared/criteria/AuxiliaryEntityHelper.js';
import { BetweenParser } from '../../shared/criteria/BetweenParser.js';
import { JsonbPathHelper } from '../../shared/criteria/JsonbPathHelper.js';

/**
 * Domain service responsible for formatting board query criteria.
 * Extracts and encapsulates the logic for building select columns, relationships, filters, and formatting results.
 */
export class BoardCriteriaFormat {
    #formatter = [];

    /**
     * Builds select columns for the query, handling aggregate functions and comparisons.
     * @param {Array} select - Array of column definitions with entity, field, alias, function, etc.
     * @returns {Array} - Array of formatted select expressions
     */
    buildSelectColumns(select) {
        this.#formatter = [];

        return select.map((col) => {
            if (col.function === ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT) {
                const separator = col.separator ?? ' ';
                const parts = (col.concat_sources ?? []).map((s) =>
                    this.#resolveConcatSourceExpression(s.entity, s.field)
                );
                const interleaved = parts.flatMap((p, i) => (i < parts.length - 1 ? [p, `'${separator}'`] : [p]));
                return {
                    function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                    alias: col.alias,
                    field: interleaved.join(', '),
                };
            }

            const expression = this.#resolveFieldExpression(col.entity, col.field);

            if (col.function && ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions[col.function.toUpperCase()]) {
                return {
                    function: col.function,
                    alias: col.alias,
                    field: expression,
                };
            }

            if (col.function && ALLOWED_CRITERIA_FUNCTIONS.compartion_functions[col.function.toUpperCase()]) {
                switch (col.function) {
                    case ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE:
                        this.#formatter.push({ function: col.function, alias: col.alias });
                        const comparisonExpression = this.#buildComparisonDateDifferenceExpression(col);

                        let baseExpression = expression;

                        if (this.#isJsonField(col.entity, col.field)) {
                            const jsonValue = this.#resolveFieldExpression(col.entity, col.field);

                            baseExpression = `(CASE WHEN ${jsonValue} IN ('', 'N/A') THEN NULL ELSE (${jsonValue})::timestamptz END)`;
                        }

                        const separator = this.#getDateDifferenceSeparator();

                        return {
                            function: col.function,
                            alias: col.alias,
                            field: `${baseExpression} ${separator} ${comparisonExpression}`,
                        };
                    default:
                        break;
                }
            }

            if (this.#isAuxEntity(col.entity) && col.field && col.field.includes('.')) {
                const lastDotIndex = col.field.lastIndexOf('.');
                const jsonArrayField = col.field.substring(0, lastDotIndex);
                const jsonKey = col.field.substring(lastDotIndex + 1);
                const alias = col.alias || `${col.entity}_${jsonArrayField.replace(/\./g, '_')}_${jsonKey}`;

                this.#formatter.push({
                    function: 'JSON_ARRAY_KEY_EXTRACT',
                    alias,
                    jsonKey,
                });

                const rewrittenExpression = `${col.entity}.${col.field}`;
                return alias ? `${rewrittenExpression} as ${alias}` : rewrittenExpression;
            }

            if (col.alias) {
                return `${expression} as ${col.alias}`;
            }

            return expression;
        });
    }

    /**
     * Builds relationships (joins) from the relationship tree structure.
     * @param {Array} relations - Array of relationship definitions
     * @returns {Array} - Array of formatted join objects
     */
    buildRelationships(relations = []) {
        const result = [];

        const walk = (rels) => {
            for (const rel of rels) {
                if (rel.on?.length) {
                    const on = rel.on[0];

                    result.push({
                        table: `${rel.related_entity} as ${rel.alias}`,
                        type: (rel.join_type || 'left').toLowerCase(),
                        condition: {
                            column: on.left,
                            refColumn: on.right,
                        },
                    });
                }

                if (Array.isArray(rel.relations) && rel.relations.length) {
                    walk(rel.relations);
                }
            }
        };

        walk(relations);

        Helper.logDebug('newRelations', result);
        return result;
    }

    /**
     * Builds filters from the criteria in the internal Criteria format.
     * @param {Object[]|null} filters - Array of filter definitions
     * @returns {Array} - Array of normalized filters
     */
    buildFilters(filters) {
        if (!filters) return [];
        const normalized = Array.isArray(filters) ? filters : [filters];

        return normalized.map((c) => {
            if (c.isBoardUnifiedSqlWhere) {
                return c;
            }
            const normalizedField = this.#normalizeField(c.entity, c.field);

            // For dynamic aux_* tables (e.g. aux_proveedores) with dotted JSON fields, pass
            // the entity-prefixed dotted path (e.g. "aux_proveedores.asistencia_movilidad.numero_expediente")
            // rather than a pre-resolved SQL expression. Criteria.#getBoardsWhereConditions handles
            // JSONB extraction via JsonbPathHelper, so pre-resolving here causes double-processing
            // and generates broken SQL.
            // Note: case_auxiliar and clients_auxiliar are NOT included here — they use the
            const isAuxTableJsonField =
                c.entity &&
                typeof c.entity === 'string' &&
                c.entity.toLowerCase().startsWith('aux_') &&
                normalizedField &&
                normalizedField.includes('.') &&
                !this.#shouldTreatAsColumn(c.entity, normalizedField);

            const fieldExpression = isAuxTableJsonField
                ? `${c.entity}.${normalizedField}`
                : this.#resolveFieldExpression(c.entity, normalizedField);

            const baseFilter = {
                field: fieldExpression,
                operator: c.operator,
                type: c.type,
            };

            if (c.function_type) {
                return {
                    ...baseFilter,
                    value: {
                        function: c.function_type,
                        value: c.value,
                    },
                };
            }
            let finalValue = c.value;

            if (c.operator === 'between') {
                finalValue = BetweenParser.parse(c.value);
            }

            return {
                ...baseFilter,
                value: finalValue,
            };
        });
    }

    /**
     * Builds HAVING clauses for aggregated queries.
     * @param {Array} having - Array of having definitions
     * @returns {Array} - Array of formatted having clauses
     */
    buildHavings(having) {
        return having.map((hav) => {
            if (hav.function) {
                if (AuxiliaryEntityHelper.isAuxiliaryField(hav.entity)) {
                    return {
                        operator: hav.operator,
                        column: `${hav.function}(${hav.entity}.data #>> '{${hav.field}}')`,
                        value: hav.value,
                    };
                }
                return {
                    operator: hav.operator,
                    column: `${hav.function}(${hav.entity}.${hav.field})`,
                    value: hav.value,
                };
            }
            return {
                operator: hav.operator,
                column: `${hav.field}`,
                value: hav.value,
            };
        });
    }

    /**
     * Formats rows applying post-processing transformations (e.g., date differences).
     * @param {Array} rows - Array of row objects from the database
     * @returns {Array} - Array of formatted rows
     */
    formatRows(rows) {
        if (this.#formatter.length === 0) {
            return rows;
        }

        rows.forEach((row) => {
            this.#formatter.forEach((formatItem) => {
                if (formatItem.function === ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE) {
                    row[formatItem.alias] = this.#formatDateDifferenceResponse(row[formatItem.alias]);
                } else if (formatItem.function === 'JSON_ARRAY_KEY_EXTRACT') {
                    row[formatItem.alias] = this.#extractJsonArrayKey(row[formatItem.alias], formatItem.jsonKey);
                }
            });
        });

        return rows;
    }

    /**
     * Builds the comparison expression for DATE_DIFFERENCE function.
     * @param {Object} col - Column definition with comparison details
     * @returns {string} - SQL expression for the comparison
     * @private
     */
    #buildComparisonDateDifferenceExpression(col) {
        if (col.comparison_type.toUpperCase() === 'FIELD') {
            if (
                this.#isAuxComparisonField(col.comparison_field) &&
                !this.#shouldTreatAsColumn(col.comparison_entity, col.comparison_field)
            ) {
                const jsonPath = col.comparison_field.split('.');
                const lastKey = jsonPath.pop();

                const jsonValue = `${col.comparison_entity}.data${jsonPath
                    .map((k) => ` -> '${k}'`)
                    .join('')} ->> '${lastKey}'`;

                return `(CASE WHEN ${jsonValue} IN ('', 'N/A') THEN NULL ELSE (${jsonValue})::timestamptz END)`;
            }
            return `${col.comparison_entity}.${col.comparison_field}`;
        }
        if (col.comparison_value.toUpperCase() === 'NOW') {
            return 'NOW()';
        }
        return `'${col.comparison_value}'::timestamptz`;
    }

    /**
     * Checks if an entity name corresponds to an auxiliary table.
     * @param {string} entity - Entity name to check
     * @returns {boolean}
     * @private
     */
    #isAuxEntity(entity) {
        if (!entity || typeof entity !== 'string') return false;
        const lower = entity.toLowerCase();
        return lower.startsWith('aux_') || lower === 'case_auxiliar' || lower === 'clients_auxiliar';
    }

    /**
     * Checks if a field should be treated as a physical column instead of a JSON field.
     * @param {string} field - Field name to evaluate
     * @param {string} [entity] - tabla o alias del auxiliar, necesario para las FK a la entidad duena
     * @returns {boolean} - True if the field is a direct column
     * @private
     */
    #isColumnField(field, entity = null) {
        return AuxiliaryColumnFieldHelper.isColumnField(field, entity);
    }
    #shouldTreatAsColumn(entity, field) {
        return this.#isAuxEntity(entity) && this.#isColumnField(field, entity);
    }

    /**
     * Extracts a nested key from each element of a JSONB array value and
     * returns all found values concatenated with ', '.
     * Handles the value being a parsed array, a JSON string, or null/undefined.
     * e.g. value=[{label:'A'},{label:'B'}], jsonKey='label' → 'A, B'
     * @param {Array|string|null} value - The raw value from the DB row
     * @param {string} jsonKey - Dot-notation key to extract from each element
     * @returns {string|null}
     * @private
     */
    #extractJsonArrayKey(value, jsonKey) {
        if (value === null || value === undefined) return null;

        let parsed = value;
        if (typeof value === 'string') {
            try {
                parsed = JSON.parse(value);
            } catch {
                return value;
            }
        }

        if (!Array.isArray(parsed)) {
            if (typeof parsed !== 'object' || parsed === null) {
                return String(parsed);
            }
            const result = this.#getNestedValue(parsed, jsonKey);
            return result !== undefined ? String(result) : null;
        }

        const values = parsed
            .map((item) => this.#getNestedValue(item, jsonKey))
            .filter((v) => v !== undefined && v !== null);

        return values.length > 0 ? values.join(', ') : null;
    }

    /**
     * Gets a nested value from an object using a dot-notation key path.
     * @param {Object} obj
     * @param {string} keyPath - e.g. 'label' or 'nested.key'
     * @returns {*}
     * @private
     */
    #getNestedValue(obj, keyPath) {
        if (!obj || typeof obj !== 'object') return undefined;
        return keyPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    }

    /**
     * Checks if a field belongs to an auxiliary table with JSON structure.
     * @param {string} field - Field name to check
     * @returns {boolean} - True if it's an auxiliary field
     * @private
     */
    #isAuxComparisonField(field) {
        if (!field || typeof field !== 'string') return false;
        const lower = field.toLowerCase();
        return (
            lower.startsWith('aux_') ||
            lower.startsWith('aux-') ||
            lower.includes('auxiliar') ||
            field.split('.').length > 1
        );
    }

    /**
     * Formats a date difference result (in seconds) into a human-readable format.
     * @param {number|null} seconds - Number of seconds
     * @returns {string|null} - Formatted string "X días → Y horas → Z minutos"
     * @private
     */
    #formatDateDifferenceResponse(seconds) {
        if (seconds === null || seconds === undefined) return null;

        const isNegative = Number(seconds) < 0;
        let remaining = Math.abs(Number(seconds));

        const days = Math.floor(remaining / 86400);
        remaining %= 86400;
        const hours = Math.floor(remaining / 3600);
        remaining %= 3600;
        const minutes = Math.floor(remaining / 60);

        return `${isNegative ? '-' : ''}${days} días → ${isNegative ? '-' : ''}${hours} horas → ${isNegative ? '-' : ''}${minutes} minutos`;
    }

    /**
     * Gets the formatter array used for post-processing rows.
     * @returns {Array} - Array of formatter definitions
     */
    getFormatters() {
        return this.#formatter;
    }

    #isJsonField(entity, field) {
        return this.#isAuxEntity(entity) && field.includes('.') && !this.#shouldTreatAsColumn(entity, field);
    }

    #getDateDifferenceSeparator() {
        return ':::';
    }

    // Unlike #resolveFieldExpression, this always applies jsonExtract for aux entities regardless
    // of whether the field has a dot, because concat sources bypass Criteria.js's #isAuxiliarySelect
    // rewriting (objects are not rewritten, only strings are).
    #resolveConcatSourceExpression(entity, field) {
        const isColumn = this.#shouldTreatAsColumn(entity, field);
        if (this.#isAuxEntity(entity) && field && !isColumn) {
            return JsonbPathHelper.jsonExtract(entity, field);
        }
        return `${entity}.${field}`;
    }

    #resolveFieldExpression(entity, field) {
        const isAux = this.#isAuxEntity(entity);
        const isColumn = this.#shouldTreatAsColumn(entity, field);

        if (isAux && field && field.includes('.') && !isColumn) {
            return JsonbPathHelper.jsonExtract(entity, field);
        }

        return `${entity}.${field}`;
    }

    #normalizeField(entity, field) {
        if (!field) return field;

        if (field.startsWith('aux.')) {
            return field.replace('aux.', '');
        }

        if (field.startsWith(`${entity}.`)) {
            return field;
        }

        return field;
    }
}
