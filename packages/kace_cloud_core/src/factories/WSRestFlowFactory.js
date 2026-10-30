import { chance, Factory, uuidv4 } from './Factory.js';
import { KnexWSRestFlowRepository, WSRestFlow } from '../ws-rest-flows/index.js';
import { WSRestEndpointFactory } from './WSRestEndpointFactory.js';
import { Helper } from '../shared/index.js';

export class WSRestFlowFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexWSRestFlowRepository, WSRestFlow, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            description: () => chance.sentence({ words: 8 }),
            authorization_type: () => chance.pickone(['Bearer', null]),
            timeout: () => chance.integer(),
            is_active: true,
            created_at: () => new Date().toISOString(),
            created_by: () => uuidv4(),
        })
            .state('disabled', { is_active: false })
            .relation('authorization_id', new WSRestEndpointFactory(knexConfig))
            .relation('consumption_id', new WSRestEndpointFactory(knexConfig))
            .afterMaking((flow) => {
                Helper.logInfo(`WSRestFlow made with id: ${flow.id.value}`);
            })
            .afterCreating((flow) => {
                Helper.logInfo(`WSRestFlow created with id: ${flow.id.value}`);
            });
    }
}
