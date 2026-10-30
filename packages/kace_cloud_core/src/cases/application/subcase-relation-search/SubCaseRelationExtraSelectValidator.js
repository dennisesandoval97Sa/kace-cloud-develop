import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';

export class SubCaseRelationExtraSelectValidator {
    static #baseTables = new Set(['cases', 'rel_cases_subcases']);

    static #ident = '[a-zA-Z_][a-zA-Z0-9_]*';

    static #plainSelectRe = new RegExp(
        `^${SubCaseRelationExtraSelectValidator.#ident}\\.${SubCaseRelationExtraSelectValidator.#ident}(\\s+as\\s+${SubCaseRelationExtraSelectValidator.#ident})?$`,
        'i'
    );

    static #jsonExtractPath = '\\$[a-zA-Z0-9_.\\[\\]]*';

    static #jsonExtractSelectRe = new RegExp(
        `^json_extract\\s*\\(\\s*${SubCaseRelationExtraSelectValidator.#ident}\\.${SubCaseRelationExtraSelectValidator.#ident}\\s*,\\s*'${SubCaseRelationExtraSelectValidator.#jsonExtractPath}'\\s*\\)(\\s+as\\s+${SubCaseRelationExtraSelectValidator.#ident})?$`,
        'i'
    );

    static #jsonOpSegment = `(?:->>|->|#>>|#>)(?:'(?:[a-zA-Z0-9_-]+|\\*|\\{[a-zA-Z0-9_,-]+\\})'|[0-9]+)`;

    static #jsonOperatorSelectRe = new RegExp(
        `^${SubCaseRelationExtraSelectValidator.#ident}\\.${SubCaseRelationExtraSelectValidator.#ident}(?:${SubCaseRelationExtraSelectValidator.#jsonOpSegment})+(\\s+as\\s+${SubCaseRelationExtraSelectValidator.#ident})?$`,
        'i'
    );

    static validate(extraSelect, relationship) {
        if (!extraSelect?.length) {
            return;
        }
        const allowed = new Set(SubCaseRelationExtraSelectValidator.#baseTables);
        if (relationship && Array.isArray(relationship)) {
            relationship.forEach((r) => {
                if (r && typeof r.table === 'string' && r.table.length) {
                    const t = r.table.split(/\s+as\s+/i)[0].trim();
                    allowed.add(t);
                }
            });
        }
        extraSelect.forEach((item) => {
            if (typeof item !== 'string' || !item.trim()) {
                throw new InvalidArgumentError('select items must be non-empty strings');
            }
            SubCaseRelationExtraSelectValidator.#assertAllowedSelectExpression(item);
            const table = SubCaseRelationExtraSelectValidator.#extractTableFromSelectItem(item);
            if (!allowed.has(table)) {
                throw new InvalidArgumentError(
                    `select references table "${table}" which is not allowed for this search`
                );
            }
        });
    }

    static #assertAllowedSelectExpression(item) {
        const trimmed = item.trim();
        if (trimmed.includes(';')) {
            throw new InvalidArgumentError('Invalid select expression');
        }
        if (
            SubCaseRelationExtraSelectValidator.#plainSelectRe.test(trimmed) ||
            SubCaseRelationExtraSelectValidator.#jsonExtractSelectRe.test(trimmed) ||
            SubCaseRelationExtraSelectValidator.#jsonOperatorSelectRe.test(trimmed)
        ) {
            return;
        }
        throw new InvalidArgumentError('Invalid select expression');
    }

    static #extractTableFromSelectItem(item) {
        const withoutAlias = item.split(/\s+as\s+/i)[0].trim();
        const jsonExtractMatch = withoutAlias.match(/^json_extract\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\./i);
        if (jsonExtractMatch) {
            return jsonExtractMatch[1];
        }
        const dotIdx = withoutAlias.indexOf('.');
        if (dotIdx <= 0) {
            throw new InvalidArgumentError('Invalid select expression');
        }
        return withoutAlias.slice(0, dotIdx).trim();
    }
}
