import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';
import {
    DATE_FORMAT_UNITS,
    FIXED_WIDTH_DATE_FORMATS,
    MAX_COUNTER_DIGITS,
    RESET_REQUIRED_UNITS,
} from './segments/segmentCatalog.js';

const UNIT_LABELS = { Y: 'año', M: 'mes', D: 'día' };

const DIGITS = '0123456789';

/**
 * Rules that make a folio decodable back into (counter scope, consecutive number), so two
 * different issuances of the same configuration can never render the same folio:
 *
 * - The consecutive needs one side made only of fixed-width pieces. Otherwise a variable
 *   field on each side shifts where the number sits: `X12-` + 34 + `-56` reads like
 *   `X` + 12 + `-34-56`.
 * - With `overflow_policy: 'grow'` the consecutive has no fixed width, so the other side must
 *   be fixed-width too, or start with a literal that cannot be part of the number.
 * - A periodic reset restarts the numbering, so the date units of its period must be in the
 *   folio, at a position fixed relative to one of its ends.
 *
 * Between different configurations, `overlaps` compares the strings each layout can render.
 * Fields make that undecidable, so two layouts with fields are only compared token by token,
 * and CaseFolioResolver skips any folio that already exists.
 */
export class FolioUniquenessPolicy {
    /**
     * @param {Object} params
     * @param {Array<Object>} params.segments
     * @param {string} params.resetPolicy
     * @param {string} params.overflowPolicy
     */
    static assert({ segments, resetPolicy, overflowPolicy }) {
        const sequenceIndex = segments.findIndex((segment) => segment.type === 'sequence');
        const sequence = segments[sequenceIndex];
        const before = segments.slice(0, sequenceIndex);
        const after = segments.slice(sequenceIndex + 1);
        const isFixed = (segment) => FolioUniquenessPolicy.#isFixedWidth(segment, overflowPolicy);
        const beforeFixed = before.every(isFixed);
        const afterFixed = after.every(isFixed);

        if (!beforeFixed && !afterFixed) {
            throw new ValidationFailError(
                'segments: a un lado del consecutivo solo puede haber texto fijo o fechas de ancho fijo; ' +
                    'con campos a ambos lados dos números distintos pueden producir el mismo folio',
                'segments'
            );
        }

        if (overflowPolicy === 'grow') {
            FolioUniquenessPolicy.#assertGrowIsDelimited({ before, after, beforeFixed, afterFixed, sequence });
        }

        FolioUniquenessPolicy.#assertResetIsRendered(segments, resetPolicy, isFixed);
    }

    /**
     * Whether two layouts can render the same folio, so their independent counters would
     * hand out the same radicado.
     *
     * Each layout is expanded into fixed-width strings of character classes: a literal
     * character is itself, a date is a digit per character it renders and the consecutive is
     * a digit or its pad character per position, at every width it can take. Two layouts
     * overlap when two of those strings have the same length and share a character at every
     * position. Dates count as any digit, so `YYYY-` overlaps the literal `2026-`.
     *
     * A field can render anything. With a field on either side the comparison falls back to
     * the masked layout, which only catches the identical ones.
     *
     * @param {Object} a
     * @param {Array<Object>} a.segments
     * @param {string} [a.overflowPolicy]
     * @param {number|null} [a.minIssuedLength] - narrowest consecutive the configuration has
     *   issued folios with; it can only have widened since (FolioConfigurationUpdater)
     * @param {Object} b - same shape as `a`
     * @returns {boolean}
     */
    static overlaps(a, b) {
        const left = FolioUniquenessPolicy.#variants(a);
        const right = FolioUniquenessPolicy.#variants(b);

        if (left === null || right === null) {
            return FolioUniquenessPolicy.#signature(a.segments) === FolioUniquenessPolicy.#signature(b.segments);
        }

        return left.some((x) =>
            right.some((y) => x.length === y.length && x.every((chars, i) => [...chars].some((c) => y[i].includes(c))))
        );
    }

    /**
     * @returns {Array<Array<string>>|null} every fixed-width shape the layout renders, one
     *   string of allowed characters per position; null when a field makes it open-ended
     */
    static #variants({ segments, overflowPolicy, minIssuedLength = null }) {
        if (segments.some((segment) => segment.type === 'field')) return null;

        return segments.reduce(
            (variants, segment) => {
                const options = FolioUniquenessPolicy.#shapes(segment, overflowPolicy, minIssuedLength);
                return variants.flatMap((variant) => options.map((option) => [...variant, ...option]));
            },
            [[]]
        );
    }

    static #shapes(segment, overflowPolicy, minIssuedLength) {
        if (segment.type === 'literal') return [[...String(segment.value)]];

        if (segment.type === 'date') {
            const widths = FIXED_WIDTH_DATE_FORMATS.includes(segment.format) ? [segment.format.length] : [1, 2];
            return widths.map((width) => Array(width).fill(DIGITS));
        }

        const padded = DIGITS + String(segment.pad_char ?? '0');
        const narrowest = Math.min(minIssuedLength ?? segment.length, segment.length);
        const widest = overflowPolicy === 'grow' ? MAX_COUNTER_DIGITS : segment.length;
        const shapes = [];
        for (let width = narrowest; width <= widest; width += 1) {
            // Only a number narrower than the mask is padded; a grown one is all digits.
            shapes.push(Array(width).fill(width > segment.length ? DIGITS : padded));
        }
        return shapes;
    }

    /** Layout with the variable parts masked and adjacent literals merged. */
    static #signature(segments) {
        const tokens = [];
        segments.forEach((segment) => {
            if (segment.type === 'literal' && typeof tokens.at(-1) === 'string') {
                tokens[tokens.length - 1] += segment.value;
                return;
            }
            tokens.push(FolioUniquenessPolicy.#token(segment));
        });
        return JSON.stringify(tokens);
    }

    static #token(segment) {
        switch (segment.type) {
            case 'literal':
                return segment.value;
            case 'date':
                return { date: segment.format };
            case 'field':
                return { field: true };
            default:
                return { sequence: segment.length, pad: segment.pad_char ?? '0' };
        }
    }

    static #isFixedWidth(segment, overflowPolicy) {
        if (segment.type === 'literal') return true;
        if (segment.type === 'date') return FIXED_WIDTH_DATE_FORMATS.includes(segment.format);
        if (segment.type === 'sequence') return overflowPolicy !== 'grow';
        return false;
    }

    static #assertGrowIsDelimited({ before, after, beforeFixed, afterFixed, sequence }) {
        if (beforeFixed && afterFixed) return;

        const padChar = String(sequence.pad_char ?? '0');
        const isDelimiter = (char) => char !== undefined && !/\d/.test(char) && char !== padChar;
        const delimited = beforeFixed
            ? after[0]?.type === 'literal' && isDelimiter(after[0].value[0])
            : before.at(-1)?.type === 'literal' && isDelimiter(before.at(-1).value.at(-1));

        if (!delimited) {
            throw new ValidationFailError(
                'overflow_policy: "grow" exige que el consecutivo quede separado de los campos por un texto fijo ' +
                    'que no sea un dígito; si no, al crecer se confunde con el valor del campo',
                'overflow_policy'
            );
        }
    }

    static #assertResetIsRendered(segments, resetPolicy, isFixed) {
        const required = RESET_REQUIRED_UNITS[resetPolicy];
        if (!required) return;

        const rendered = new Set(
            segments
                .filter((segment, index) => {
                    if (segment.type !== 'date') return false;
                    const anchoredToStart = segments.slice(0, index).every(isFixed);
                    const anchoredToEnd = segments.slice(index + 1).every(isFixed);
                    return anchoredToStart || anchoredToEnd;
                })
                .flatMap((segment) => DATE_FORMAT_UNITS[segment.format] ?? [])
        );
        const missing = required.filter((unit) => !rendered.has(unit));

        if (missing.length) {
            throw new ValidationFailError(
                `reset_policy: "${resetPolicy}" reinicia el consecutivo, así que el folio debe incluir ` +
                    `${missing.map((unit) => UNIT_LABELS[unit]).join(', ')} en un segmento de fecha de ancho fijo ` +
                    'sin campos entre él y un extremo del folio; si no, se repetirían folios ya emitidos',
                'reset_policy'
            );
        }
    }
}
