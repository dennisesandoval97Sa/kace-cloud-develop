import { chance, Factory, uuidv4 } from './Factory.js';
import { KnexWSRestEndpointRepository, WSRestEndpoint } from '../ws-rest-endpoints/index.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class WSRestEndpointFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexWSRestEndpointRepository, WSRestEndpoint, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            type: () => chance.pickone(['authorization', 'consumption']),
            description: () => chance.sentence({ words: 5 }),
            url: () => chance.url(),
            method: () => chance.pickone(['GET', 'POST', 'PUT', 'DELETE']),
            headers: () => ({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${uuidv4()}`,
            }),
            body: () => ({ data: chance.sentence({ words: 3 }) }),
            token_location: () => chance.pickone(['data', 'data.token']),
            is_dynamic_body: () => chance.bool(),
            is_active: true,
            created_at: () => new Date().toISOString(),
            created_by: () => uuidv4(),
            updated_at: () => new Date().toISOString(),
            updated_by: () => uuidv4(),
        })
            .state('disabled', { is_active: false })
            .afterMaking((endpoint) => {
                Helper.logInfo(`WSRestEndpoint made with id: ${endpoint.id.value}`);
            })
            .afterCreating((endpoint) => {
                Helper.logInfo(`WSRestEndpoint created with id: ${endpoint.id.value}`);
            });
    }
}
