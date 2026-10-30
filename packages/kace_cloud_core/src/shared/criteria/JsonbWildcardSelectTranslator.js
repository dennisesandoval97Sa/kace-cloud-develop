import { InvalidArgumentError } from '../errors/InvalidArgumentError.js';

export class JsonbWildcardSelectTranslator {
    static #wildcardRe = /->'\*'/;

    static #exprRe =
        /^(\w+\.\w+)((?:(?:->>|->|#>>|#>)(?:'(?:[a-zA-Z0-9_*-]+|\{[a-zA-Z0-9_,-]+\})'|[0-9]+))+)(\s+as\s+\w+)?$/i;

    static #segmentRe = /(->>|->|#>>|#>)('(?:[a-zA-Z0-9_*-]+|\{[a-zA-Z0-9_,-]+\})'|[0-9]+)/g;

    static hasWildcard(expr) {
        return typeof expr === 'string' && JsonbWildcardSelectTranslator.#wildcardRe.test(expr);
    }

    static translate(expr) {
        if (!JsonbWildcardSelectTranslator.hasWildcard(expr)) {
            return expr;
        }

        const match = JsonbWildcardSelectTranslator.#exprRe.exec(expr.trim());
        if (!match) {
            throw new InvalidArgumentError(`Cannot translate wildcard JSONB select expression: ${expr.trim()}`);
        }

        const tableCol = match[1];
        const chain = match[2];
        const alias = match[3] ? match[3].trim() : null;

        const segments = [];
        let lastOp = null;
        let m;
        JsonbWildcardSelectTranslator.#segmentRe.lastIndex = 0;

        while ((m = JsonbWildcardSelectTranslator.#segmentRe.exec(chain)) !== null) {
            lastOp = m[1];
            const raw = m[2];

            if (/^\d+$/.test(raw)) {
                segments.push({ type: 'index', value: parseInt(raw, 10) });
            } else {
                const key = raw.slice(1, -1);
                segments.push({ type: 'key', value: key });
            }
        }

        let path = '$';

        for (const seg of segments) {
            if (seg.type === 'key' && seg.value === '*') {
                path += '.*';
            } else if (seg.type === 'index') {
                path += `[${seg.value}]`;
            } else {
                path += `."${seg.value}"`;
            }
        }

        const isText = lastOp === '->>' || lastOp === '#>>';
        const aliasSuffix = alias ? ` ${alias}` : '';

        if (isText) {
            return `jsonb_path_query_first(${tableCol}, '${path}') #>> '{}'${aliasSuffix}`;
        }
        return `jsonb_path_query_first(${tableCol}, '${path}')${aliasSuffix}`;
    }
}
