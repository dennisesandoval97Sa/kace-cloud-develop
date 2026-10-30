import { FolioSegmentError } from './FolioSegmentError.js';
import { SegmentRenderer } from './segments/SegmentRenderer.js';

/**
 * Renders a folio in two phases, and the order is load-bearing.
 *
 * `renderStatic` resolves every segment that does not touch the database. Running it
 * *before* reserving the counter is what guarantees that a broken configuration or an
 * empty auxiliary field returns a 400 without burning a consecutive number.
 *
 * Splitting prefix from suffix is also what makes `reset: 'prefix'` possible: its scope
 * key is precisely the folio rendered up to the sequence segment.
 */
export class FolioRenderer {
    /**
     * @param {Array<Object>} segments
     * @param {Object} context - { cases, aux_cases, clasificaciones }
     * @param {Object} [options] - forwarded to SegmentRenderer. Only the preview passes
     *   `{ placeholders: true }`; the creation path calls this without options so a missing
     *   field value keeps being a 400.
     * @returns {{prefix: string, suffix: string, sequenceSegment: Object, sequenceIndex: number}}
     */
    static renderStatic(segments, context, options = {}) {
        const sequenceIndex = segments.findIndex((segment) => segment.type === 'sequence');

        if (sequenceIndex === -1) {
            throw new FolioSegmentError(0, 'sequence', 'no existe: la configuración no tiene consecutivo');
        }

        let prefix = '';
        let suffix = '';

        segments.forEach((segment, index) => {
            if (index === sequenceIndex) return;

            const rendered = SegmentRenderer.render(segment, index, context, options);

            if (index < sequenceIndex) {
                prefix += rendered;
            } else {
                suffix += rendered;
            }
        });

        return { prefix, suffix, sequenceSegment: segments[sequenceIndex], sequenceIndex };
    }

    /**
     * @param {string} prefix
     * @param {string} sequenceText
     * @param {string} suffix
     * @returns {string}
     */
    static assemble(prefix, sequenceText, suffix) {
        return `${prefix}${sequenceText}${suffix}`;
    }
}
