import { EntityCache, KnexRepository } from '../../../shared/index.js';
import { AuxCases } from '../../domain/AuxCases';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

const AUX_CASES_BY_CASE_NAMESPACE = 'aux_cases:byCase';
const AUX_CASES_TTL_MS = 300_000;

export class KnexAuxCasesRepository extends KnexRepository {
    constructor(config) {
        super(config, 'aux_cases');
    }

    /**
     * @param {AuxCases} auxCase
     * @param {import('knex').Knex.Transaction} [trx] - optional transaction for atomic inserts.
     */
    async save(auxCase, trx) {
        try {
            const [insertedRecord] = await (trx ? this.trxTable(trx) : this.table())
                .insert({
                    id: auxCase.id.value,
                    caso_id: auxCase.caso_id.value,
                    data: auxCase.data.value,
                    created_at: auxCase.created_at.value,
                    created_by: auxCase.created_by.value,
                })
                .returning('*');

            EntityCache.invalidate(AUX_CASES_BY_CASE_NAMESPACE, auxCase.caso_id.value);
            return new AuxCases(insertedRecord);
        } catch (error) {
            Helper.logError('Error saving aux casos', error);
            throw new QueryDBError('save');
        }
    }

    async update(aggregate) {
        await super.update(aggregate);
        EntityCache.invalidate(AUX_CASES_BY_CASE_NAMESPACE, aggregate.caso_id.value);
    }

    async find(id) {
        try {
            const auxCase = await this.table().select('*').where({ id: id.value }).first();
            return auxCase ? new AuxCases(auxCase) : null;
        } catch (error) {
            Helper.logError('Error finding aux casos', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds an auxiliary case record (`aux_casos`) by case ID.
     *
     * @param {ValueObjectUuid} caseId - An object containing the case ID to search for.
     * @param {object} [options] - Optional configuration.
     * @param {boolean} [options.skipCache=false] - If true, bypasses the cache and reads directly from the database.
     * @param {import('knex').Knex.Transaction} [options.trx] - reads inside this transaction; the cache is bypassed.
     * @param {boolean} [options.forUpdate=false] - locks the row until `trx` ends. Requires `trx`.
     * @returns {Promise<AuxCases|null>} Returns an instance of `AuxCases` if found, or `null` if not found.
     * @throws {QueryDBError} Throws an error if a database query issue occurs.
     */
    async findByCaseId(caseId, { skipCache = false, trx, forUpdate = false } = {}) {
        try {
            const fetcher = async () => {
                const query = (trx ? this.trxTable(trx) : this.table())
                    .select('*')
                    .where({ caso_id: caseId.value })
                    .whereNull('deleted_at')
                    .first();
                if (forUpdate) query.forUpdate();
                const auxCase = await query;
                return auxCase ? new AuxCases(auxCase) : null;
            };
            if (skipCache || trx) {
                return await fetcher();
            }
            return await EntityCache.get(AUX_CASES_BY_CASE_NAMESPACE, caseId.value, fetcher, AUX_CASES_TTL_MS);
        } catch (error) {
            Helper.logError('Error finding aux casos by id', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds an auxiliary case record by external code from the related case.
     *
     * @param {string} externalCode - The external code to search for in the related case.
     * @returns {Promise<AuxCases|null>} Returns an instance of `AuxCases` if found, or `null` if not found.
     * @throws {QueryDBError} Throws an error if a database query issue occurs.
     */
    async findByCaseExternalCode(externalCode) {
        try {
            const auxCase = await this.table()
                .select(`${this.tableName}.*`)
                .join(this.qualifiedName('cases'), 'aux_cases.caso_id', 'cases.id')
                .where({ 'cases.external_code': externalCode })
                .whereNull('aux_cases.deleted_at')
                .whereNull('cases.deleted_at')
                .first();
            return auxCase ? new AuxCases(auxCase) : null;
        } catch (error) {
            Helper.logError('Error finding aux casos by external code', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates specific paths in the JSON `data` column.
     * @param {ValueObjectUuid} id - The ID of the AuxCase.
     * @param {string} casoId - The ID of the Case (for cache invalidation).
     * @param {Array<{path: string, value: any}>} updates - List of updates.
     */
    async updateDataFields(id, casoId, updates) {
        if (!updates || updates.length === 0) return;
        try {
            let query = this.table().where({ id: id.value });

            let expr = 'data';
            let bindings = [];

            for (const { path, value } of updates) {
                expr = `jsonb_set(${expr}, ?::text[], ?::jsonb, true)`;
                const pathArray = path.split(/[.[\]]/g).filter((p) => p !== '');
                bindings.push(`{${pathArray.join(',')}}`);
                bindings.push(JSON.stringify(value));
            }

            await query.update({ data: this.connection.raw(expr, bindings) });
            EntityCache.invalidate(AUX_CASES_BY_CASE_NAMESPACE, casoId);
        } catch (error) {
            Helper.logError('Error updating jsonb fields in aux casos', error);
            throw new QueryDBError('update');
        }
    }
}
