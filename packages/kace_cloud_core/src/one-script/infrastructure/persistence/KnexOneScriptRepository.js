import { KnexRepository } from '../../../shared';
import { OneScript } from '../../index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexOneScriptRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'one-script', readerConfig);
    }

    async save(oneScript) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: oneScript.id.value,
                url: oneScript.url.value,
                url_api: oneScript.url_api.value,
                name: oneScript.name.value,
                schema_id: oneScript.schema_id.value,
                onescript_reference_id: oneScript.onescript_reference_id.value,
                created_at: oneScript.created_at.value,
                created_by: oneScript.created_by.value,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    async find(id) {
        try {
            const result = await this.table().select('*').where({ id: id.value }).first();
            return !result ? null : new OneScript(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    async search(criteria) {
        try {
            const queryBuilder = this.read.table('one-script').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');
            const rows = await queryBuilder;
            return rows.map((item) => new OneScript(item));
        } catch (error) {
            Helper.logError('Error searching one script', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts one-script records matching the criteria. Read-only list counter
     * routed to the replica (base count() runs on the writer).
     * @param {Object} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('one-script').count());
            query.whereNull('one-script.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting one script', error);
            throw new QueryDBError('count');
        }
    }

    async findByGroupIdAndClassificationId(groupId, classificationId) {
        const relName = this.qualifiedName('classification_group_relationships');
        // Plain table name (without schema prefix) for use in ON/WHERE clauses,
        // because Postgres references the joined table by alias = its bare name.
        const relBare = 'classification_group_relationships';
        const queryBuilder = this.table()
            .select('*')
            .leftJoin(relName, function () {
                this.on(`one-script.id`, '=', `${relBare}.form`);
            })
            .where(`${relBare}.classification_id`, '=', classificationId)
            .where(`${relBare}.group_id`, '=', groupId)
            .first();

        return await queryBuilder;
    }
}
