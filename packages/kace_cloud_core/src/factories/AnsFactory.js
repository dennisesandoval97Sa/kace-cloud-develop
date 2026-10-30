import { chance, Factory, uuidv4 } from './Factory.js';
import { Ans } from '../ans/domain/Ans.js';
import { KnexAnsRepository } from '../ans/infrastructure/persistence/KnexAnsRepository.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class AnsFactory extends Factory {
    /**
     * @param {*} knexConfig - Instancia de knex
     */
    constructor(knexConfig) {
        super(KnexAnsRepository, Ans, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            nombre: () => chance.word({ length: 8 }),
            intermedio: () => chance.integer({ min: 5, max: 10 }),
            vencido: () => chance.integer({ min: 11, max: 20 }),
            color_ans_inicial: () => chance.color({ format: 'hex' }),
            color_ans_intermedio: () => chance.color({ format: 'hex' }),
            color_ans_final: () => chance.color({ format: 'hex' }),
            status: chance.pickone([1]),
            medicion_ans_id: () => chance.pickone(['Days', 'Hours', 'Minutes']),
            created_at: () => new Date().toISOString(),
            created_by: () => uuidv4(),
        })
            .afterMaking((ans) => {
                Helper.logInfo(`Ans made with id: ${ans.id.value}`);
            })
            .afterCreating((ans) => {
                Helper.logInfo(`Ans created with id: ${ans.id.value}`);
            });
    }
}
