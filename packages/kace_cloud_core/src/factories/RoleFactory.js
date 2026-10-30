import { chance, Factory, uuidv4 } from './Factory.js';
import { Role } from '../role/index.js';
import { KnexRoleRepository } from '../role/infrastructure/persistence/KnexRoleRepository.js';
import { PolicesFactory } from './PolicesFactory.js';
import { ListPermissions } from '../role/domain/ListPermissions.js';
import { Helper } from '../shared/infrastructure/utils/Helper.js';

export class RoleFactory extends Factory {
    /**
     * @param {*} knexConfig - instancia de knex
     */
    constructor(knexConfig) {
        super(KnexRoleRepository, Role, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            descripcion: () => chance.sentence({ words: 5 }),
            status: chance.pickone([1, 2]),
            permisos: () => new ListPermissions().toPrimivites(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        })
            .relation('policy_id', new PolicesFactory(knexConfig))
            .afterMaking((role) => {
                Helper.logInfo(`Role made with id: ${role.id.value}`);
            })
            .afterCreating((role) => {
                Helper.logInfo(`Role created with id: ${role.id.value}`);
            });
    }
}
