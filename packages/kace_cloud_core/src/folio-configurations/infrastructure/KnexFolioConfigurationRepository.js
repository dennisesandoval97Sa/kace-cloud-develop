import { KnexRepository } from '../../shared/index.js';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';
import { FolioConfiguration } from '../domain/FolioConfiguration.js';

export class KnexFolioConfigurationRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'folio_configurations', readerConfig);
    }

    /**
     * @param {FolioConfiguration} configuration
     * @returns {Promise<void>}
     */
    async save(configuration) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert(KnexFolioConfigurationRepository.#toRow(configuration));
        } catch (error) {
            Helper.logError('Error saving a folio configuration:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * @param {import('../../shared/index.js').ValueObjectUuid} id
     * @returns {Promise<FolioConfiguration | null>}
     */
    async find(id) {
        try {
            const result = await this.read
                .table(this.tableName)
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first();

            return result ? new FolioConfiguration(result) : null;
        } catch (error) {
            Helper.logError('Error finding folio configuration:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Loads the configuration attached to a classification, resolving the join in a single
     * query because this runs on the case-creation path.
     *
     * Returns null when the classification has no configuration, which is the normal case
     * and must leave the case with a null folio.
     *
     * @param {string} classificationId
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<{configuration: FolioConfiguration, classification: Object} | null>}
     */
    async findByClassificationId(classificationId, trx) {
        if (!classificationId) return null;

        try {
            const db = trx ?? this.reader;
            const classification = await db(this.qualifiedName('clasificaciones'))
                .where({ id: classificationId })
                .whereNull('deleted_at')
                .first();

            if (!classification?.folio_config_id) return null;

            const row = await db(this.qualifiedName())
                .where({ id: classification.folio_config_id })
                .whereNull('deleted_at')
                .first();

            if (!row) return null;

            // A deactivated configuration stops generating folios without having to
            // detach it from every classification first.
            const configuration = new FolioConfiguration(row);
            if (configuration.status.value !== 1) return null;

            return { configuration, classification };
        } catch (error) {
            Helper.logError('Error finding folio configuration by classification:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * @param {FolioConfiguration} configuration
     * @returns {Promise<void>}
     */
    async update(configuration) {
        const changes = { ...configuration.changedAttributes };
        if (changes.segments !== undefined) {
            changes.segments = JSON.stringify(changes.segments);
        }
        try {
            DbRequestContext.markWrite();
            await this.table().update(changes).where({ id: configuration.id.value }).whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error updating folio configuration:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * @param {import('../../shared/criteria/Criteria.js').Criteria} criteria
     * @returns {Promise<FolioConfiguration[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');

            const rows = await queryBuilder;
            return rows.map((row) => new FolioConfiguration(row));
        } catch (error) {
            Helper.logError('Error searching folio configurations:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Classifications currently pointing at a configuration, with their levels so the caller
     * can compose a label without loading the whole catalogue.
     *
     * Read-only on purpose: the association is written from the classification form, which
     * sets `clasificaciones.folio_config_id`.
     *
     * @param {string} configId
     * @returns {Promise<Array<Object>>} rows with `id` and `nivel1..nivel10`
     */
    async findClassifications(configId) {
        try {
            return await this.read
                .table('clasificaciones')
                .where({ folio_config_id: configId })
                .whereNull('deleted_at')
                .select('id', ...Array.from({ length: 10 }, (_, i) => `nivel${i + 1}`));
        } catch (error) {
            Helper.logError('Error finding classifications of a folio configuration:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Layouts a new or edited configuration must not overlap: the other active ones, plus
     * every configuration that already issued folios, whatever its status or deleted_at.
     *
     * For the ones that issued, `min_issued_length` is the narrowest consecutive they have
     * had since their first counter row. After issuing, FolioConfigurationUpdater only lets
     * the consecutive widen, so the layouts of the history rows written since then (each
     * row keeps the layout before its update) differ from the current one only in width.
     *
     * @param {string} excludeId
     * @returns {Promise<Array<{id: string, nombre: string, segments: Array<Object>, overflow_policy: string,
     *   issued: boolean, min_issued_length: number|null}>>}
     */
    async findCompetingLayouts(excludeId) {
        try {
            const firstIssued = () =>
                this.read
                    .table('folio_sequences')
                    .select('config_id')
                    .min({ first_issued_at: 'created_at' })
                    .groupBy('config_id')
                    .as('issued');

            const rows = await this.read
                .table(this.tableName)
                .leftJoin(firstIssued(), 'issued.config_id', `${this.tableName}.id`)
                .whereNot(`${this.tableName}.id`, excludeId)
                .where((query) =>
                    query
                        .where((active) =>
                            active.where(`${this.tableName}.status`, 1).whereNull(`${this.tableName}.deleted_at`)
                        )
                        .orWhereNotNull('issued.config_id')
                )
                .select(
                    `${this.tableName}.id`,
                    `${this.tableName}.nombre`,
                    `${this.tableName}.segments`,
                    `${this.tableName}.overflow_policy`,
                    'issued.first_issued_at'
                );

            const issuedIds = rows.filter((row) => row.first_issued_at).map((row) => row.id);
            const pastLayouts = issuedIds.length
                ? await this.read
                      .table(`history_${this.tableName}`)
                      .join(firstIssued(), 'issued.config_id', `history_${this.tableName}.entity_id`)
                      .whereIn(`history_${this.tableName}.entity_id`, issuedIds)
                      .whereRaw(`history_${this.tableName}.created_at >= issued.first_issued_at`)
                      .select('entity_id', 'original_attributes')
                : [];

            return rows.map((row) => {
                const issued = Boolean(row.first_issued_at);
                const widths = [row, ...pastLayouts.filter((past) => past.entity_id === row.id)]
                    .map((layout) => KnexFolioConfigurationRepository.#sequenceLength(layout))
                    .filter((width) => width !== null);

                return {
                    id: row.id,
                    nombre: row.nombre,
                    segments: row.segments,
                    overflow_policy: row.overflow_policy,
                    issued,
                    min_issued_length: issued && widths.length ? Math.min(...widths) : null,
                };
            });
        } catch (error) {
            Helper.logError('Error finding competing folio configuration layouts:', error);
            throw new QueryDBError('find');
        }
    }

    /** Width of the consecutive in a configuration row or in a history row's original layout. */
    static #sequenceLength(layout) {
        const raw = layout.original_attributes ?? layout;
        const attributes = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const segments =
            typeof attributes?.segments === 'string' ? JSON.parse(attributes.segments) : attributes?.segments;
        return Array.isArray(segments)
            ? (segments.find((segment) => segment.type === 'sequence')?.length ?? null)
            : null;
    }

    static #toRow(configuration) {
        return {
            id: configuration.id.value,
            nombre: configuration.nombre.value,
            descripcion: configuration.descripcion.value,
            segments: JSON.stringify(configuration.segments.value),
            reset_policy: configuration.reset_policy,
            start_value: configuration.start_value,
            overflow_policy: configuration.overflow_policy,
            status: configuration.status.value,
            created_at: configuration.created_at?.value,
            created_by: configuration.created_by?.value,
        };
    }
}
