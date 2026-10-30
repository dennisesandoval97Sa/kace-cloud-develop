import { Factory, uuidv4 } from './Factory.js';
import { Policy } from '../policies/domain/Policy.js';
import { KnexPoliciesRepository } from '../policies/infrastructure/persistence/KnexPoliciesRepository.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class PolicesFactory extends Factory {
    /**
     * @param {*} knexConfig - instancia de knex
     */
    constructor(knexConfig) {
        super(KnexPoliciesRepository, Policy, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            title: 'dasdadasds',
            provider: 'API',
            effect: 'ALLOW',
            operations: ['read', 'update'],
            actions: ['all'],
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        })
            .afterMaking((policy) => {
                Helper.logInfo(`Policy made with id: ${policy.id.value}`);
            })
            .afterCreating((policy) => {
                Helper.logInfo(`Policy created with id: ${policy.id.value}`);
            });
    }
}
