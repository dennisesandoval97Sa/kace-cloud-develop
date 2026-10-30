import { v4 as uuidv4 } from 'uuid';
import Chance from 'chance';
import { StatusEnum } from '../../../src/shared';
import { Role } from '../../../src/role';
import { ListPermissions } from '../../../src/role/domain/ListPermissions';

export default class RoleMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Role` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Role` entity.
     */
    static dto(descripcion = null) {
        const permisos = new ListPermissions().toPrimivites();

        if (permisos.agente?.[0]) permisos.agente[0].granted = true;
        if (permisos.administrador?.[0]) permisos.administrador[0].granted = true;
        if (permisos.auxiliaries?.[0]) permisos.auxiliaries[0].granted = true;

        return {
            id: uuidv4(),
            descripcion: descripcion ?? 'descripcion del role',
            permisos,
            status: StatusEnum.ACTIVE.value,
            created_at: new Date(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates an `Role` instance and saves it to the repository.
     *
     * @param {KnexRoleRepository} repository - The repository to save the `Role` instance.
     * @returns {Promise<Role>} The created `Role` instance.
     */
    static async createRole(repository, { descripcion } = {}) {
        const role = Role.create(RoleMother.dto(descripcion));
        await repository.save(role);
        return role;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `Role` entity.
     *
     * @returns {Object} The DTO containing random properties for a `Role` entity.
     */
    static randomDto(permisos = null) {
        return {
            id: uuidv4(),
            descripcion: 'descripcion del role',
            permisos: permisos ?? new ListPermissions().toPrimivites(),
            status: StatusEnum.ACTIVE.value,
            created_at: new Date(),
            updated_at: null,
            created_by: uuidv4(),
            updated_by: null,
            deleted_by: null,
            deleted_at: null,
        };
    }

    /**
     * Creates a `Role` instance with random properties and saves it to the repository.
     *
     * @param {KnexRoleRepository} repository - The repository to save the `Role` instance.
     * @returns {Promise<Role>} The created `Role` instance.
     */
    static async createRandomRole(repository, permisos) {
        const role = Role.create(RoleMother.randomDto(permisos));
        await repository.save(role);
        return role;
    }

    static dtoWithAuxiliaries() {
        const permisos = new ListPermissions().toPrimivites();
        permisos.auxiliaries = [
            {
                module_id: 'cases',
                name: 'CasesCreate',
                description: 'Create aux cases',
                granted: true,
            },
            {
                module_id: 'cases',
                name: 'CasesUpdate',
                description: 'Update aux cases',
                granted: true,
            },
            {
                module_id: 'cases',
                name: 'CasesDelete',
                description: 'Delete aux cases',
                granted: true,
            },
            {
                module_id: 'cases',
                name: 'CasesRead',
                description: 'Read aux cases',
                granted: true,
            },
            {
                module_id: 'clients',
                name: 'ClientsCreate',
                description: 'Create aux clients',
                granted: false,
            },
            {
                module_id: 'clients',
                name: 'ClientsUpdate',
                description: 'Update aux clients',
                granted: false,
            },
            {
                module_id: 'clients',
                name: 'ClientsDelete',
                description: 'Delete aux clients',
                granted: false,
            },
            {
                module_id: 'clients',
                name: 'ClientsRead',
                description: 'Read aux clients',
                granted: false,
            },
        ];

        return {
            id: uuidv4(),
            descripcion: 'role con auxiliaries',
            permisos,
            status: StatusEnum.ACTIVE.value,
            created_at: new Date(),
            created_by: uuidv4(),
        };
    }
}
