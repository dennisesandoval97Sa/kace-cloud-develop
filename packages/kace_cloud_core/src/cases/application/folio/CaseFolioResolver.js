import { FolioRenderer } from '../../../folio-configurations/domain/FolioRenderer.js';
import { SegmentRenderer } from '../../../folio-configurations/domain/segments/SegmentRenderer.js';
import { ScopeKeyResolver } from '../../../folio-configurations/domain/ScopeKeyResolver.js';
import { FolioCaseContextBuilder } from '../../../folio-configurations/domain/FolioCaseContextBuilder.js';
import { FolioSegmentError } from '../../../folio-configurations/domain/FolioSegmentError.js';
import { MAX_COUNTER_DIGITS, MAX_FOLIO_LENGTH } from '../../../folio-configurations/domain/segments/segmentCatalog.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

/**
 * How many consecutives a creation may skip inside its own transaction when their folio
 * already exists. Runs of taken folios are walked before, and committed, by skipTaken; this
 * only covers a folio taken by a concurrent creation in the meantime.
 */
const MAX_FOLIO_ATTEMPTS = 5;

/**
 * Generates the configurable folio (radicado) of a case.
 *
 * This is the only piece CaseCreator, CaseCreator2 and CaseUpdater talk to. It has
 * nothing to do with the legacy `external_code` folio (CaseFolioGenerator /
 * CaseFolioDecorator), which keeps working untouched alongside it.
 *
 * The order of operations is deliberate: every segment that does not need the database is
 * resolved BEFORE the counter is touched, so a broken configuration or an empty auxiliary
 * field raises a 400 without consuming a consecutive number.
 */
export class CaseFolioResolver {
    /** @type {import('../../../folio-configurations/infrastructure/KnexFolioConfigurationRepository.js').KnexFolioConfigurationRepository} */
    #configurationRepository;
    /** @type {import('../../../folio-configurations/infrastructure/KnexFolioSequenceRepository.js').KnexFolioSequenceRepository} */
    #sequenceRepository;

    constructor(configurationRepository, sequenceRepository) {
        this.#configurationRepository = configurationRepository;
        this.#sequenceRepository = sequenceRepository;
    }

    /**
     * @param {Object} params
     * @param {string} params.classificationId
     * @param {Object} params.caseDto - the validated case payload
     * @param {Object} [params.auxData] - `aux_cases.data`, already unwrapped
     * @param {import('knex').Knex.Transaction} [params.trx] - the case's own transaction, so a
     *   rollback also returns the reserved number
     * @returns {Promise<string|null>} the folio, or null when the classification has none configured
     */
    async execute({ classificationId, caseDto, auxData, trx }) {
        const found = await this.#configurationRepository.findByClassificationId(classificationId, trx);
        if (!found) return null;

        const { configuration, classification } = found;
        const segments = configuration.segments.value;

        const context = FolioCaseContextBuilder.build({ caseDto, auxData, classification });

        // Phase 1 — everything that can fail without side effects.
        const { prefix, suffix, sequenceSegment, sequenceIndex } = FolioRenderer.renderStatic(segments, context);

        CaseFolioResolver.#assertFits({
            prefix,
            suffix,
            sequenceSegment,
            sequenceIndex,
            overflowPolicy: configuration.overflow_policy,
        });
        const scopeKey = ScopeKeyResolver.resolve(configuration.reset_policy, prefix);
        const render = (value) =>
            CaseFolioResolver.#render({ prefix, suffix, sequenceSegment, sequenceIndex, value, configuration });

        await this.#skipTakenFolios({ configuration, scopeKey, render });

        // Phase 2 — reserve. From here on a failure rolls the number back with the case.
        for (let attempt = 1; attempt <= MAX_FOLIO_ATTEMPTS; attempt += 1) {
            const reserved = await this.#sequenceRepository.reserveNext({
                configId: configuration.id.value,
                scopeKey,
                startValue: configuration.start_value,
                trx,
            });

            const sequenceText = SegmentRenderer.formatSequence(
                sequenceSegment,
                sequenceIndex,
                reserved,
                configuration.overflow_policy
            );
            const folio = FolioRenderer.assemble(prefix, sequenceText, suffix);

            if (!(await this.#sequenceRepository.isFolioTaken(folio, trx))) {
                return folio;
            }

            Helper.logError('Folio already in use; its consecutive is skipped', { folio, consecutive: reserved });
        }

        throw new CustomError('No se pudo asignar un folio libre. Revise la configuración de folio.', 409);
    }

    /**
     * Moves the counter past the folios that already exist (another configuration issued
     * them, or this one with its previous layout) and commits the move, so a rollback of
     * this case cannot bring the collision back. Only when the next folio is taken: the
     * probe is two indexed reads, skipTaken locks the counter.
     */
    async #skipTakenFolios({ configuration, scopeKey, render }) {
        const configId = configuration.id.value;
        const current = await this.#sequenceRepository.currentValue(configId, scopeKey);
        const next = render(current === null ? configuration.start_value : current + 1);

        if (next === null || !(await this.#sequenceRepository.isFolioTaken(next))) return;

        const skipped = await this.#sequenceRepository.skipTaken({
            configId,
            scopeKey,
            startValue: configuration.start_value,
            render,
        });
        Helper.logError('Folios already in use; their consecutives are skipped', { configId, scopeKey, skipped });
    }

    /** The folio a consecutive renders, or null when it overflows the mask. */
    static #render({ prefix, suffix, sequenceSegment, sequenceIndex, value, configuration }) {
        try {
            const text = SegmentRenderer.formatSequence(
                sequenceSegment,
                sequenceIndex,
                value,
                configuration.overflow_policy
            );
            return FolioRenderer.assemble(prefix, text, suffix);
        } catch (error) {
            if (error instanceof FolioSegmentError) return null;
            throw error;
        }
    }

    /**
     * The widest the folio can get once reserved, checked BEFORE reserving so an oversized
     * field value is a 400 and not a database error after the number is taken. It also
     * bounds the 'prefix' scope key, which is part of the folio, below its 120 characters.
     * With overflow_policy 'grow' the consecutive can widen up to the digits of the counter.
     */
    static #assertFits({ prefix, suffix, sequenceSegment, sequenceIndex, overflowPolicy }) {
        const sequenceWidth = overflowPolicy === 'grow' ? MAX_COUNTER_DIGITS : sequenceSegment.length;
        const width = prefix.length + sequenceWidth + suffix.length;
        if (width > MAX_FOLIO_LENGTH) {
            throw new FolioSegmentError(
                sequenceIndex,
                'sequence',
                `daría un folio de ${width} caracteres, más de los ${MAX_FOLIO_LENGTH} permitidos`
            );
        }
    }

    /**
     * Renders what a configuration would produce, WITHOUT reserving. Backs the preview in
     * the configuration screen: reserving there would burn a consecutive number every
     * time an administrator opens it.
     *
     * @param {import('../../../folio-configurations/domain/FolioConfiguration.js').FolioConfiguration} configuration
     * @param {Object} [context] - sample context to resolve field segments against
     * @returns {Promise<string>}
     */
    async preview(configuration, context = {}) {
        const segments = configuration.segments.value;
        // Field values only exist once a case is created, so here they render as markers
        // instead of raising. execute() deliberately does NOT pass this: on the creation
        // path a missing value has to be a 400, before any consecutive is reserved.
        const { prefix, suffix, sequenceSegment, sequenceIndex } = FolioRenderer.renderStatic(segments, context, {
            placeholders: true,
        });

        // With reset_policy 'prefix' a marker makes the scope key one that has never been
        // used, so peek() returns null and the preview shows start_value rather than the
        // real next number for that prefix. Unavoidable when previewing without a case.
        const scopeKey = ScopeKeyResolver.resolve(configuration.reset_policy, prefix);
        const current = await this.#sequenceRepository.peek(configuration.id.value, scopeKey);
        const next = current === null ? configuration.start_value : current + 1;

        const sequenceText = SegmentRenderer.formatSequence(
            sequenceSegment,
            sequenceIndex,
            next,
            configuration.overflow_policy
        );

        return FolioRenderer.assemble(prefix, sequenceText, suffix);
    }
}
