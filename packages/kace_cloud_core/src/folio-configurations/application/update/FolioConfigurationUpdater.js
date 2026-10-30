import { FolioConfigurationFinder } from '../../domain/FolioConfigurationFinder.js';
import { FolioConfigurationLayoutGuard } from '../../domain/FolioConfigurationLayoutGuard.js';
import { CustomError, UniquenessValidator } from '../../../shared/index.js';

export class FolioConfigurationUpdater {
    /** @type {KnexFolioConfigurationRepository} */
    #repository;

    /** @type {import('../../infrastructure/KnexFolioSequenceRepository.js').KnexFolioSequenceRepository|null} */
    #sequenceRepository;

    /** @type {FolioConfigurationFinder} */
    #finder;

    /** @type {UniquenessValidator} */
    #uniquenessValidator;

    /** @type {FolioConfigurationLayoutGuard} */
    #layoutGuard;

    /**
     * @param {KnexFolioConfigurationRepository} repository
     * @param {import('../../infrastructure/KnexFolioSequenceRepository.js').KnexFolioSequenceRepository} [sequenceRepository]
     *   when given, edits that the live counters would silently ignore or break are refused.
     */
    constructor(repository, sequenceRepository = null) {
        this.#repository = repository;
        this.#sequenceRepository = sequenceRepository;
        this.#finder = new FolioConfigurationFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#layoutGuard = new FolioConfigurationLayoutGuard(repository);
    }

    /**
     * @param {string} id
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const configuration = await this.#finder.execute(id);

        if (!configuration) {
            throw new CustomError(`FolioConfiguration with ID ${id} does not exist.`, 404);
        }

        await this.#ensureCountersAllow(configuration, dto);

        const originalValues = configuration.toJson ? configuration.toJson() : {};
        configuration.update(dto);

        if (dto.nombre) {
            await this.#uniquenessValidator.validate('nombre', dto.nombre, id);
        }

        // overflow_policy too: with 'grow' the consecutive widens and can reach another layout.
        if (dto.segments !== undefined || dto.status !== undefined || dto.overflow_policy !== undefined) {
            await this.#layoutGuard.ensureUnique(configuration);
        }

        await this.#repository.update(configuration);
        await this.#repository.saveHistory(configuration, originalValues);
        configuration.flushChanges();
    }

    /**
     * The counter row is seeded once, with `start_value - 1`, the first time a folio is
     * issued for a scope. From then on `start_value` is history: editing it would save
     * cleanly and change nothing, which is worse than an error.
     *
     * The layout is history too. Every folio already issued was rendered with it, and the
     * counter carries on from where it is: `A-1` + 3 digits turned into `A-` + 4 digits renders
     * A-1001 again at n = 1001. The only safe edit is widening the consecutive, which makes
     * every new folio longer than the ones issued with the narrower mask.
     *
     * @param {import('../../domain/FolioConfiguration.js').FolioConfiguration} configuration
     * @param {Object} dto
     */
    async #ensureCountersAllow(configuration, dto) {
        if (!this.#sequenceRepository) return;

        const changesStartValue = dto.start_value !== undefined && dto.start_value !== configuration.start_value;
        const changesSegments =
            dto.segments !== undefined && JSON.stringify(dto.segments) !== JSON.stringify(configuration.segments.value);
        const changesResetPolicy = dto.reset_policy !== undefined && dto.reset_policy !== configuration.reset_policy;

        if (!changesStartValue && !changesSegments && !changesResetPolicy) return;

        const highest = await this.#sequenceRepository.maxCurrentValue(configuration.id.value);
        if (highest === null) return;

        if (changesStartValue) {
            throw new CustomError(
                'No se puede cambiar el valor inicial: la configuración ya emitió folios y el contador ' +
                    'seguiría desde donde va. Cree una configuración nueva o reinicie los contadores.',
                400
            );
        }

        /*
         * The counter lives in the (config_id, scope_key) row and ScopeKeyResolver derives
         * scope_key from the policy. Changing it sends reservations to a different row, which
         * reserveNext seeds from start_value - 1: the numbering starts over. Going from
         * 'never' to 'yearly' without touching the segments leaves the prefix untouched, so
         * the reissued folios are byte-for-byte the ones already handed out and
         * idx_cases_folio_unique rejects every case creation until the counter passes them.
         */
        if (changesResetPolicy) {
            throw new CustomError(
                'No se puede cambiar el reinicio del contador: la configuración ya emitió folios y la ' +
                    'numeración volvería a empezar, repitiendo radicados ya entregados.',
                400
            );
        }

        if (
            changesSegments &&
            !FolioConfigurationUpdater.#onlyWidensSequence(configuration.segments.value, dto.segments)
        ) {
            throw new CustomError(
                'No se puede cambiar la estructura del folio: la configuración ya emitió folios y la nueva ' +
                    'estructura podría repetirlos. Solo se permite ampliar el ancho del consecutivo; para ' +
                    'otro formato cree una configuración nueva.',
                400
            );
        }
    }

    /**
     * @param {Array<Object>} current
     * @param {Array<Object>} next
     * @returns {boolean} whether `next` is `current` with a wider consecutive and nothing else changed
     */
    static #onlyWidensSequence(current, next) {
        if (!Array.isArray(next) || next.length !== current.length) return false;

        return current.every((segment, index) => {
            const other = next[index];
            if (segment.type !== other?.type) return false;
            if (segment.type !== 'sequence') {
                return ['value', 'format', 'path'].every((key) => segment[key] === other[key]);
            }
            return (segment.pad_char ?? '0') === (other.pad_char ?? '0') && other.length >= segment.length;
        });
    }
}
