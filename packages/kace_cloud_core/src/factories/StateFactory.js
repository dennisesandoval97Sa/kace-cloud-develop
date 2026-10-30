import { chance, Factory, uuidv4 } from './Factory.js';
import { KnexStateRepository, State } from '../state/index.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class StateFactory extends Factory {
    /**
     * @param {*} knexConfig - instancia de knex
     */
    constructor(knexConfig) {
        super(KnexStateRepository, State, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            nombre: () => chance.word({ length: 8 }),
            descripcion: () => chance.sentence({ words: 4 }),
            icon_class: () => chance.pickone(['exclamationIcon', 'checkListIcon', 'exclamationCircle']),
            status: chance.pickone([1, 2]),
            color: () => chance.color({ format: 'hex' }),
            require_observation: () => chance.bool(),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        })
            .afterMaking((state) => {
                Helper.logInfo(`State made with id: ${state.id.value}`);
            })
            .afterCreating((state) => {
                Helper.logInfo(`State created with id: ${state.id.value}`);
            });
    }
}
