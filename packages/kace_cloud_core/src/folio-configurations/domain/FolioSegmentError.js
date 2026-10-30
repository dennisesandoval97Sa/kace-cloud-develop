import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';

/**
 * Raised when a folio cannot be built. Carries the offending segment so the API can tell
 * the caller exactly which piece of the configuration failed instead of a generic error.
 *
 * Extends ValidationFailError so the existing controller catches map it to a 400 without
 * any extra wiring. In production Response replaces the message of a 4xx with a generic one,
 * so the explanation travels in toPublicData(), the channel validationFailPublicFields reads.
 */
export class FolioSegmentError extends ValidationFailError {
    static exposesPublicData = true;

    /** @type {number} */
    #segmentIndex;
    /** @type {string} */
    #segmentType;

    /**
     * @param {number} segmentIndex - zero-based position of the segment in the configuration
     * @param {string} segmentType - literal | date | field | sequence
     * @param {string} reason - human readable explanation
     */
    constructor(segmentIndex, segmentType, reason) {
        super(`No se pudo generar el folio: el segmento ${segmentIndex + 1} (${segmentType}) ${reason}`, 'folio');
        this.#segmentIndex = segmentIndex;
        this.#segmentType = segmentType;
    }

    get segmentIndex() {
        return this.#segmentIndex;
    }

    get segmentType() {
        return this.#segmentType;
    }

    toPublicData() {
        return {
            detail: this.message,
            segment_index: this.#segmentIndex,
            segment_type: this.#segmentType,
        };
    }
}
