import { CaseFolioDecorator } from '../../domain/services/CaseFolioDecorator.js';

export class CaseFolioGenerator {
    /**
     * @type {KnexCaseRepository}
     */
    #repository;

    /**
     * @param {KnexCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Generates the complete external code with folio if enabled in the configuration.
     * Orchestrates retrieving the next sequence number from the repository
     * and delegating the formatting to CaseFolioDecorator.
     *
     * @param {string} externalCode
     * @param {Object} config
     * @param {string|null} excludeId - Optional case ID to exclude from the count (used when updating).
     * @returns {Promise<string>}
     */
    async execute(externalCode, config, excludeId = null) {
        if (!config?.add_folio_to_external_code || !externalCode) {
            return externalCode;
        }

        const folioLength = config.folio_length || 4;
        const pattern = `${externalCode}%`;
        const count = await this.#repository.countCreatedToday(pattern, excludeId);
        const nextNumber = count + 1;

        return CaseFolioDecorator.decorate(externalCode, folioLength, nextNumber);
    }
}
