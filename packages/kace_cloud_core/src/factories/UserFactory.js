import { chance, Factory, uuidv4 } from './Factory.js';
import { KnexUsersRepository, User } from '../users/index.js';
import { RoleFactory } from './RoleFactory.js';
import { Helper } from '../shared/index.js';

export class UserFactory extends Factory {
    /**
     * @param {*} knexConfig
     */
    constructor(knexConfig) {
        super(KnexUsersRepository, User, {}, knexConfig);

        this.define({
            id: () => uuidv4(),
            login: () => chance.word({ length: 8 }),
            nombres: () => chance.first(),
            apellido1: () => chance.last(),
            apellido2: () => chance.last(),
            email: () => chance.email(),
            telefono: () => chance.string({ length: 10, pool: '0123456789' }),
            movil: () => chance.string({ length: 10, pool: '0123456789' }),
            is_active: 1,
            created_at: new Date().toISOString(),
            created_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
        })
            .state('disabled', { is_active: 2 })
            .relation('rol_id', new RoleFactory(knexConfig))
            .afterMaking((user) => {
                Helper.logInfo(`User made with id: ${user.id.value}`);
            })
            .afterCreating((user) => {
                Helper.logInfo(`User created with id: ${user.id.value}`);
            });
    }
}
