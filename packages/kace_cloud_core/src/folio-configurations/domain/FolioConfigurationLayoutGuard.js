import { CustomError } from '../../shared/errors/CustomError.js';
import { FolioUniquenessPolicy } from './FolioUniquenessPolicy.js';

/**
 * Refuses an active configuration that can render a folio another configuration also
 * renders. Each one counts independently, so they would hand out the same radicados and
 * the unique index on `cases.folio` would turn them into failed case creations.
 *
 * The others are the active configurations and every configuration that already issued
 * folios, whatever its status: deactivating or deleting one keeps its counters precisely so
 * that its folios are never issued again.
 */
export class FolioConfigurationLayoutGuard {
    /** @type {import('../infrastructure/KnexFolioConfigurationRepository.js').KnexFolioConfigurationRepository} */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {import('./FolioConfiguration.js').FolioConfiguration} configuration
     * @returns {Promise<void>}
     */
    async ensureUnique(configuration) {
        if (configuration.status.value !== 1) return;

        const layout = {
            segments: configuration.segments.value,
            overflowPolicy: configuration.overflow_policy,
        };
        const others = await this.#repository.findCompetingLayouts(configuration.id.value);
        const twin = others.find((other) =>
            FolioUniquenessPolicy.overlaps(layout, {
                segments: other.segments,
                overflowPolicy: other.overflow_policy,
                minIssuedLength: other.min_issued_length,
            })
        );

        if (twin) {
            throw new CustomError(
                `La estructura del folio puede producir los mismos folios que la configuración "${twin.nombre}"` +
                    `${twin.issued ? ', que ya emitió folios' : ''}. Añada un texto fijo que las distinga.`,
                400
            );
        }
    }
}
