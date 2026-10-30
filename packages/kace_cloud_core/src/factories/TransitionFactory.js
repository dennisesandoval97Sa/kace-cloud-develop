import { chance, Factory, uuidv4 } from './Factory.js';
import { KnexTransitionsRepository, Transitions } from '../transition/index.js';
import { StateFactory } from './StateFactory.js';
import { FlowFactory } from './FlowFactory.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class TransitionFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexTransitionsRepository, Transitions, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            estado_actual_id: null,
            status: chance.pickone([1, 2]),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        })
            .relation('flujo_id', new FlowFactory(knexConfig))
            .relation('siguiente_estado_id', new StateFactory(knexConfig))
            .afterMaking((transition) => {
                Helper.logInfo(`Transition made with id: ${transition.id.value}`);
            })
            .afterCreating((transition) => {
                Helper.logInfo(`Transition created with id: ${transition.id.value}`);
            });
    }
}
