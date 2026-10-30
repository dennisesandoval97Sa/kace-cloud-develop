import { RuleValidator } from '../../../actions/domain/QueryTranslator/RuleValidator.js';
import createDayjsInstance from '../../../shared/factories/DayjsFactory.js';
import { FolioSegmentError } from '../FolioSegmentError.js';
import { DATE_FORMATS } from './segmentCatalog.js';

export { DATE_FORMATS, SEGMENT_TYPES } from './segmentCatalog.js';

/**
 * Renders the segments that do not need the database. Pure: same input, same output.
 */
export class SegmentRenderer {
    /**
     * @param {Object} segment - { type, ...params }
     * @param {number} index - position in the configuration, for error reporting
     * @param {Object} context - { cases, aux_cases, clasificaciones } — same shape as
     *   KnexCaseRepository.getCaseContextById produces
     * @param {Object} [options]
     * @param {boolean} [options.placeholders] - preview mode: a field whose value only
     *   exists once a case is created renders as a marker instead of raising. Never enabled
     *   on the creation path, where a missing value must still be a 400.
     * @returns {string}
     */
    static render(segment, index, context, options = {}) {
        const type = segment?.type;

        switch (type) {
            case 'literal':
                return String(segment.value ?? '');
            case 'date':
                return SegmentRenderer.#renderDate(segment, index);
            case 'field':
                return SegmentRenderer.#renderField(segment, index, context, options);
            default:
                throw new FolioSegmentError(index, String(type), 'es de un tipo desconocido');
        }
    }

    /** `aux_cases.flags.canal` -> `‹canal›`, so each marker names the field it stands for. */
    static #placeholderFor(path) {
        return `‹${String(path).split('.').pop()}›`;
    }

    static #renderDate(segment, index) {
        if (!DATE_FORMATS.includes(segment.format)) {
            throw new FolioSegmentError(index, 'date', `usa un formato no permitido: "${segment.format}"`);
        }

        // Same tenant-timezone instance the ScopeKeyResolver uses. If these two ever
        // diverge, on the night of a year change the folio would say one year while the
        // counter scope says another.
        return createDayjsInstance({})().format(segment.format);
    }

    static #renderField(segment, index, context, options) {
        const path = segment.path;
        // Missing path is a broken configuration, so it raises even in preview mode.
        if (!path) {
            throw new FolioSegmentError(index, 'field', 'no tiene ruta configurada');
        }

        // Same resolver the action rules use, so a path picked in the UI behaves here
        // exactly as it does there — including walking through arrays.
        const value = RuleValidator.getFieldValue(path, context);

        if (value === undefined || value === null || value === '') {
            if (options?.placeholders) {
                return SegmentRenderer.#placeholderFor(path);
            }
            throw new FolioSegmentError(index, 'field', `no encuentra ningún valor en la ruta "${path}"`);
        }

        return String(value);
    }

    /**
     * Formats the reserved sequence number with its zero mask.
     *
     * Overflow is an error and never a truncation: cutting digits off a counter produces
     * two different cases with the same folio, which is precisely what this whole
     * mechanism exists to prevent.
     *
     * @param {Object} segment - { length, pad_char }
     * @param {number} index
     * @param {number} value - the reserved number
     * @param {string} overflowPolicy - 'fail' | 'grow'
     * @returns {string}
     */
    static formatSequence(segment, index, value, overflowPolicy = 'fail') {
        const text = String(value);
        const length = segment.length;

        if (text.length > length) {
            if (overflowPolicy === 'fail') {
                throw new FolioSegmentError(
                    index,
                    'sequence',
                    `desbordó el ancho configurado: el consecutivo ${value} no cabe en ${length} dígitos. ` +
                        `Amplíe el ancho o configure un reinicio del contador`
                );
            }
            return text;
        }

        return text.padStart(length, segment.pad_char ?? '0');
    }
}
