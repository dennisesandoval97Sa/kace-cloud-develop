export class CaseFolioDecorator {
    /**
     * Decorates the external_code of a case with a folio.
     * The folio is an incremental number suffix with configurable length.
     *
     * @param {string|null} externalCode - The current external code (prefix like M20260118).
     * @param {number} folioLength - The length of the folio (default 7).
     * @param {number} nextNumber - The next folio number.
     * @returns {string|null} The decorated external code.
     */
    static decorate(externalCode, folioLength, nextNumber) {
        const folio = String(nextNumber).padStart(folioLength, '0').slice(-folioLength);

        if (!externalCode) {
            return externalCode;
        }

        return `${externalCode}${folio}`;
    }
}
