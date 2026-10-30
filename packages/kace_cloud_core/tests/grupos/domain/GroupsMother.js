import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../../src/shared';
import { Groups } from '../../../src/grupos';
import ShiftManagementMother from '../../shift-management/domain/ShiftManagementMother.js';
import RoleMother from '../../role/domain/RoleMother.js';
import { KnexRoleRepository } from '../../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { KnexGlobalConfigurationRepository } from '../../../src/global-config/index.js';
import { GlobalConfigurationsMother } from '../../global-config/domain/GlobalConfigurationsMother.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export class GroupsMother {
    /**
     * Garantiza que las filas padre referenciadas por las claves foraneas de
     * `grupos` (horario_id, rol_id, configuration_id) existan antes de guardar.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id: `ensureParentRow`
     * es idempotente, asi que respaldar una fila que ya existe no cuesta nada,
     * mientras que saltarsela deja el insert al borde de una violacion -el llamador
     * casi siempre pone un uuid inventado-. Las columnas salen de pg_constraint.
     *
     * @param {import('knex').Knex} connection - `repository.connection`.
     * @param {Object} dto - DTO ya resuelto.
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        const rows = [
            ['rol_id', 'roles'],
            ['configuration_id', 'global_configurations'],
        ].map(([field, table]) => ({ table, id: dto[field] }));

        await ensureParentRows(connection, rows);

        // El horario NO puede llevar solo el id: `grupos.horario_id` es el segundo
        // eslabon de la cadena que recorre `KnexCaseRepository.#buildBaseQueryAns`,
        // y una fila sin `work_days` ni `holiday_dates` hace que `#prepareEntities`
        // falle con "holiday_dates: The value must be an array".
        if (dto.horario_id) {
            await ShiftManagementMother.ensureRow(connection, dto.horario_id);
        }
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `Groups` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Groups` entity.
     */
    static dto(override = {}) {
        const id = uuidv4();
        const uniqueTestGroupName = `Grupo de prueba ${id.replace(/[^a-zA-Z\s]/g, '')}`;
        return {
            id: id,
            nombre: uniqueTestGroupName,
            status: StatusEnum.ACTIVE.value,
            horario_id: uuidv4(),
            rol_id: uuidv4(),
            descripcion: null,
            codigo_externo: null,
            codigos_externos: null,
            permisos: {},
            layouts: null,
            comportamientos: null,
            filter_order: null,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            configuration_id: uuidv4(),
            ...override,
        };
    }

    /**
     * Creates an `Groups` instance and saves it to the repository.
     *
     * @param {KnexGroupsRepository} repository - The repository to save the `Groups` instance.
     * @param repositoryShiftManagement
     * @returns {Promise<Groups>} The created `Groups` instance.
     */
    static async createGroup(repository, repositoryShiftManagement, overrides = {}, overridesShiftManagement = {}) {
        const id = uuidv4();
        const descripcion = `descripcion rol de prueba ${id.replace(/[^a-zA-Z\s]/g, '')}`;

        const shiftManagement = await ShiftManagementMother.createShiftManagement(
            repositoryShiftManagement,
            overridesShiftManagement
        );
        const globalConfiguration = await GlobalConfigurationsMother.createConfiguration(
            new KnexGlobalConfigurationRepository(repository.connection)
        );
        const rol = await RoleMother.createRole(new KnexRoleRepository(repository.connection), {
            descripcion: descripcion,
        });
        const rol_id = rol.id.value;

        const dto = GroupsMother.dto({ ...overrides, rol_id: rol_id });
        dto.horario_id = shiftManagement.id.value;
        if (!overrides.configuration_id) {
            dto.configuration_id = globalConfiguration.id.value;
        }
        await GroupsMother.ensureRelations(repository.connection, dto);
        const groups = Groups.create(dto);
        await repository.save(groups);
        return groups;
    }

    static async createGroupWithRelations(repository, overrides = {}) {
        const dto = GroupsMother.dto(overrides);
        await GroupsMother.ensureRelations(repository.connection, dto);
        const groups = Groups.create(dto);
        await repository.save(groups);
        return groups;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `Groups` entity.
     *
     * @returns {Object} The DTO containing random properties for a `Groups` entity.
     */
    static randomDto(rol_id = null, overrides = {}) {
        return {
            id: uuidv4(),
            nombre: 'Grupo de prueba',
            status: StatusEnum.ACTIVE.value,
            horario_id: uuidv4(),
            descripcion: 'Grupo para pruebas',
            codigo_externo: null,
            codigos_externos: null,
            permisos: {},
            layouts: {},
            comportamientos: {},
            filter_order: null,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
            rol_id: rol_id ?? uuidv4(),
            configuration_id: uuidv4(),
            ...overrides,
        };
    }

    /**
     * Creates a `Groups` instance with random properties and saves it to the repository.
     *
     * @param {KnexGroupsRepository} repository - The repository to save the `Groups` instance.
     * @param rol_id
     * @returns {Promise<Groups>} The created `Groups` instance.
     */
    static async createRandomGroup(repository, rol_id = null, overrides = {}) {
        const dto = GroupsMother.randomDto(rol_id, overrides);
        await GroupsMother.ensureRelations(repository.connection, dto);
        const group = Groups.create(dto);
        await repository.save(group);
        return group;
    }

    static async createWithCustomShiftManagement(groupsRepository, shiftManagement) {
        const dto = GroupsMother.randomDto();
        dto.horario_id = shiftManagement.id.value;
        await GroupsMother.ensureRelations(groupsRepository.connection, dto);
        const group = Groups.create(dto);
        await groupsRepository.save(group);
        return group;
    }

    static async createWithCustomShiftManagementAndConfig(
        groupsRepository,
        shiftManagement,
        configuration,
        overrides = {}
    ) {
        const { rol_id = null, ...rest } = overrides;
        const dto = GroupsMother.randomDto(rol_id, rest);
        dto.horario_id = shiftManagement.id.value;
        dto.configuration_id = configuration.id.value;

        await GroupsMother.ensureRelations(groupsRepository.connection, dto);

        const group = Groups.create(dto);
        await groupsRepository.save(group);
        return group;
    }
}
