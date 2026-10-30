import { chance, Factory, uuidv4 } from './Factory.js';
import { Classification, KnexClassificationRepository } from '../classifications/index.js';
import { FlowFactory } from './FlowFactory.js';
import { AnsFactory } from './AnsFactory.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class ClassificationFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexClassificationRepository, Classification, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            external_id: () => uuidv4(),
            nivel1: () => chance.word({ length: 5 }),
            nivel2: () => chance.word({ length: 5 }),
            nivel3: () => chance.word({ length: 5 }),
            nivel4: () => chance.word({ length: 5 }),
            nivel5: () => chance.word({ length: 5 }),
            nivel6: () => chance.word({ length: 5 }),
            nivel7: () => chance.word({ length: 5 }),
            nivel8: () => chance.word({ length: 5 }),
            nivel9: () => chance.word({ length: 5 }),
            nivel10: () => chance.word({ length: 5 }),
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        })
            .state('disabled', { is_active: false })
            .relation('flujo_id', new FlowFactory(knexConfig))
            .relation('ans_id', new AnsFactory(knexConfig))
            .afterMaking((classification) => {
                Helper.logInfo(`Classification made with id: ${classification.id.value}`);
            })
            .afterCreating((classification) => {
                Helper.logInfo(`Classification created with id: ${classification.id.value}`);
            });
    }
}
