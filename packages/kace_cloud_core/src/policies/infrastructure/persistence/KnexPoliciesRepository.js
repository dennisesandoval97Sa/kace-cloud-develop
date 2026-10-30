import { Helper, KnexRepository } from '../../../shared';
import { Policy } from '../../domain/Policy';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexPoliciesRepository extends KnexRepository {
    constructor(config) {
        super(config, 'policies');
    }

    async save(policy) {
        try {
            await this.table().insert({
                id: policy.id.value,
                title: policy.title.value,
                provider: policy.provider.value,
                effect: policy.effect.value,
                operations: JSON.stringify(policy.operations.value),
                actions: JSON.stringify(policy.actions.value),
                created_at: policy.created_at.value,
                created_by: policy.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving policies', error);
            throw new QueryDBError('save');
        }
    }

    async find(id) {
        try {
            const policy = await this.table().where({ id: id.value }).first();
            return !policy ? null : new Policy(policy);
        } catch (error) {
            Helper.logError('Error finding policies', error);
            throw new QueryDBError('find');
        }
    }

    async search(criteria) {
        try {
            const result = await criteria.convertToKnex(this.table().select('*'));
            return result.map((item) => new Policy(item));
        } catch (error) {
            Helper.logError('Error searching policies', error);
            throw new QueryDBError('search');
        }
    }
}
