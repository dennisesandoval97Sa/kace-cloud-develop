import { chance, Factory, uuidv4 } from './Factory.js';
import { Groups, KnexGroupsRepository } from '../grupos/index.js';
import { ShiftManagementFactory } from './ShiftManagementFactory.js';
import { RoleFactory } from './RoleFactory.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class GroupFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexGroupsRepository, Groups, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            nombre: () => chance.word({ length: 10 }),
            status: chance.pickone([1, 2]),
            descripcion: () => chance.string({ length: 20, alpha: true }),
            codigo_externo: null,
            codigos_externos: null,
            permisos: {},
            layouts: {},
            comportamientos: {},
            filter_order: () => chance.string({ length: 20, alpha: true }),
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        })
            .relation('horario_id', new ShiftManagementFactory(knexConfig))
            .relation('rol_id', new RoleFactory(knexConfig))
            .afterMaking((group) => {
                Helper.logInfo(`Group made with id: ${group.id.value}`);
            })
            .afterCreating((group) => {
                Helper.logInfo(`Group created with id: ${group.id.value}`);
            });
    }
}
