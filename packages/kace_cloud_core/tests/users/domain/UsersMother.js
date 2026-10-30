import { Chance } from 'chance';
import { v4 as uuidv4 } from 'uuid';
import { AccountTypeEnum } from '../../../src/shared/domain/enum/AccountTypeEnum';
import { StatusEnum } from '../../../src/shared/index.js';
import { Login, User, UserCreator } from '../../../src/users';
import { UserFinder } from '../../../src/users/domain/UserFinder.js';
import RoleMother from '../../role/domain/RoleMother.js';
import { KnexRoleRepository } from '../../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class UsersMother {
    /**
     * Postgres exige que existan las filas padre de estas claves foraneas, y
     * esta factoria inventaba los ids sin respaldarlos con ninguna fila.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente. Las columnas salen de pg_constraint.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'roles', id: dto.rol_id },
            { table: 'grupos', id: dto.grupo_activo },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `Users` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Users` entity.
     */
    static dto(override = {}) {
        const chance = new Chance();
        return {
            id: uuidv4(),
            login: uuidv4(),
            nombres: 'John',
            apellido1: 'Doe',
            apellido2: 'Smith',
            email: 'john.doe@example.com',
            telefono: '1234567890',
            movil: '0987654321',
            rol_id: globalRoleId,
            is_active: StatusEnum.ACTIVE.value,
            created_at: new Date(),
            created_by: uuidv4(),
            account_type: AccountTypeEnum.ACTIVE_DIRECTORY.value,
            updated_by: null,
            last_seen_at: null,
            last_login_at: null,
            grupo_activo: null,
            ...override,
        };
    }

    /**
     * Creates an `Users` instance and saves it to the repository.
     *
     * @param {KnexUsersRepository} repository - The repository to save the `Users` instance.
     * @returns {Promise<User>} The created `Users` instance.
     */
    static async createUser(repository, data = {}) {
        const dto = UsersMother.dto(data);
        await UsersMother.ensureRelations(repository.connection, dto);
        const user = User.create(dto);
        await repository.save(user);
        return await repository.find(user.id);
    }

    static async generateToken(repository, rolId) {
        const dto = UsersMother.systemUser({ rol_id: rolId });
        const userFinder = new UserFinder(repository);

        try {
            await userFinder.execute(dto.id);
        } catch (error) {
            const userCreator = new UserCreator(repository);
            await userCreator.execute({
                ...dto,
                account_type: AccountTypeEnum.SERVICE.value,
            });
        }

        const userLogin = new Login(repository);
        const response = await userLogin.execute(dto.login, dto.password);
        const userResponse = response.toJson();
        return userResponse.token;
    }

    static systemUser({ rol_id, ...override } = {}) {
        return {
            id: 'db0b1414-5eca-4db0-afb1-0db00039f645',
            login: 'usuario_sistema',
            nombres: 'Pruebas',
            apellido1: 'Sistemas',
            apellido2: '',
            email: 'konecta@example.com',
            telefono: '1234567890',
            movil: '0987654321',
            rol_id: rol_id ?? uuidv4(),
            is_active: StatusEnum.ACTIVE.value,
            created_at: new Date(),
            created_by: uuidv4(),
            account_type: AccountTypeEnum.ACTIVE_DIRECTORY.value,
            ...override,
        };
    }

    static async createUserWithRole(repository, data = {}) {
        const roleRepository = new KnexRoleRepository(repository.connection);
        const role = await RoleMother.createRole(roleRepository);
        const dto = UsersMother.dto({ ...data, rol_id: role.id.value });
        await UsersMother.ensureRelations(repository.connection, dto);
        const user = User.create(dto);
        await repository.save(user);
        return user;
    }
}
