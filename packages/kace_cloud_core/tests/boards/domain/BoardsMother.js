import { v4 as uuidv4 } from 'uuid';
import { Board } from '../../../src/boards/domain/Board';

export default class BoardsMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Board` entity.
     *
     * @param {Object} params - Optional parameters to customize the DTO.
     * @param {string} params.id - The ID of the case description.
     * @param {string} params.created_by - The ID of the creator.
     * @returns {Object} The DTO containing the properties for a `Board` entity.
     */
    static dto(overrides = {}) {
        return {
            name: 'test f1',
            description: 'test f1 description',
            primary_entity: 'cases',
            page_size: 10,
            onescript_form_id: overrides.one_script_id || uuidv4(),
            is_active: true,
            icon_class: 'BellOff',
            access_groups: [overrides.group_id || uuidv4()],
            criteria: {
                items: [
                    {
                        entity: 'case_client',
                        type: 'and',
                        field: 'id',
                        value: overrides.client_id || uuidv4(),
                        operator: 'eq',
                    },
                    {
                        entity: 'cases',
                        type: 'and',
                        field: 'fecha_resolucion',
                        value: 'null',
                        operator: 'null',
                    },
                ],
            },
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'clients',
                    alias: 'case_client',
                    join_type: 'left',
                    on: [
                        {
                            left: 'case_client.id',
                            operator: 'eq',
                            right: 'cases.cliente_id',
                            type: 'and',
                        },
                    ],
                    relations: [
                        {
                            primary_entity: 'case_client',
                            related_entity: 'usuarios',
                            alias: 'client_user_creator',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'client_user_creator.id',
                                    operator: 'eq',
                                    right: 'case_client.created_by',
                                    type: 'and',
                                },
                            ],
                            relations: [
                                {
                                    primary_entity: 'client_user_creator',
                                    related_entity: 'roles',
                                    alias: 'user_role',
                                    join_type: 'left',
                                    on: [
                                        {
                                            left: 'user_role.id',
                                            operator: 'eq',
                                            right: 'client_user_creator.rol_id',
                                            type: 'and',
                                        },
                                    ],
                                    relations: [
                                        {
                                            primary_entity: 'user_role',
                                            related_entity: 'usuarios',
                                            alias: 'rol_user_creator',
                                            join_type: 'left',
                                            on: [
                                                {
                                                    left: 'rol_user_creator.id',
                                                    operator: 'eq',
                                                    right: 'user_role.created_by',
                                                    type: 'and',
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    primary_entity: 'cases',
                    related_entity: 'clasificaciones',
                    alias: 'case_clasificaciones',
                    join_type: 'left',
                    on: [
                        {
                            left: 'case_clasificaciones.id',
                            operator: 'eq',
                            right: 'cases.clasificacion_id',
                            type: 'and',
                        },
                    ],
                    relations: [
                        {
                            primary_entity: 'case_clasificaciones',
                            related_entity: 'usuarios',
                            alias: 'clasification_user_creator',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'clasification_user_creator.id',
                                    operator: 'eq',
                                    right: 'case_clasificaciones.created_by',
                                    type: 'and',
                                },
                            ],
                        },
                    ],
                },
                {
                    primary_entity: 'cases',
                    related_entity: 'transiciones',
                    alias: 'case_transiciones',
                    join_type: 'left',
                    on: [
                        {
                            left: 'case_transiciones.id',
                            operator: 'eq',
                            right: 'cases.transicion_id',
                            type: 'and',
                        },
                    ],
                    relations: [
                        {
                            primary_entity: 'case_transiciones',
                            related_entity: 'estados',
                            alias: 'case_estado',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'case_estado.id',
                                    operator: 'eq',
                                    right: 'case_transiciones.siguiente_estado_id',
                                    type: 'and',
                                },
                            ],
                        },
                    ],
                },
                {
                    primary_entity: 'cases',
                    related_entity: 'usuarios',
                    alias: 'case_creator',
                    join_type: 'left',
                    on: [
                        {
                            left: 'case_creator.id',
                            operator: 'eq',
                            right: 'cases.created_by',
                            type: 'and',
                        },
                    ],
                    relations: [],
                },
                {
                    primary_entity: 'cases',
                    related_entity: 'usuarios',
                    alias: 'case_responsable',
                    join_type: 'left',
                    on: [
                        {
                            left: 'case_responsable.id',
                            operator: 'eq',
                            right: 'cases.responsable_id',
                            type: 'and',
                        },
                    ],
                    relations: [],
                },
                {
                    primary_entity: 'cases',
                    related_entity: 'usuarios',
                    alias: 'case_updater',
                    join_type: 'left',
                    on: [
                        {
                            left: 'case_updater.id',
                            operator: 'eq',
                            right: 'cases.updated_by',
                            type: 'and',
                        },
                    ],
                    relations: [],
                },
            ],
            columns: [
                {
                    entity: 'cases',
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'case_estado',
                    field: 'nombre',
                    alias: 'estado_actual',
                    position: 2,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'client_user_creator',
                    field: 'nombres',
                    alias: 'cliente_creador',
                    position: 3,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'clasification_user_creator',
                    field: 'nombres',
                    alias: 'clasificador_creador',
                    position: 4,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'user_role',
                    field: 'descripcion',
                    alias: 'rol_client_creator',
                    position: 5,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'rol_user_creator',
                    field: 'nombres',
                    alias: 'creador_rol',
                    position: 6,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'case_client',
                    field: 'documento',
                    alias: 'documento',
                    position: 7,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'case_creator',
                    field: 'nombres',
                    alias: 'creador',
                    position: 8,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'case_responsable',
                    field: 'nombres',
                    alias: 'responsable',
                    position: 9,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'case_updater',
                    field: 'nombres',
                    alias: 'actualizador',
                    position: 10,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
                {
                    entity: 'cases',
                    field: 'id',
                    alias: 'total',
                    position: 11,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: 'count',
                },
            ],
            options: [
                {
                    type: 'ONESCRIPT',
                    ref_id: overrides.one_script_id || uuidv4(),
                    label: 'boards form',
                    requires_confirmation: true,
                    id: uuidv4(),
                },
            ],
            can_admin_delete_record: false,
            can_agent_delete_record: false,
            havings: [
                {
                    entity: 'cases',
                    type: 'having',
                    field: 'id',
                    value: 1,
                    function: 'count',
                    operator: 'eq',
                },
            ],
            id: overrides.id || uuidv4(),
            created_at: overrides.created_at || new Date().toISOString(),
            created_by: overrides.created_by || uuidv4(),
            ...overrides,
        };
    }

    static dtoAuxiliary(overrides = {}) {
        return {
            name: 'test f1',
            description: 'test f1 description',
            primary_entity: overrides.primary_entity || 'cases',
            page_size: 10,
            onescript_form_id: overrides.one_script_id || uuidv4(),
            is_active: true,
            icon_class: 'BellOff',
            id: overrides.id || uuidv4(),
            created_at: overrides.created_at || new Date().toISOString(),
            created_by: overrides.created_by || uuidv4(),
            access_groups: [overrides.group_id || uuidv4()],
            criteria: overrides.filters,
            relations: overrides.relations || [],
            columns: overrides.columns,
            options: [
                {
                    type: 'ONESCRIPT',
                    ref_id: overrides.one_script_id || uuidv4(),
                    label: 'boards form',
                    requires_confirmation: true,
                    id: uuidv4(),
                },
            ],
            can_admin_delete_record: false,
            can_agent_delete_record: false,
            havings: [],
        };
    }
    /**
     * Creates a `Board` instance and saves it to the repository.
     *
     * @param {KnexBoardRepository} repository - The repository to save the `Board` instance.
     * @param {Object} data - Optional data to customize the `Board` instance.
     * @returns {Promise<Board>} The created `Board` instance.
     */
    static async create(repository, data = {}) {
        const board = Board.create(BoardsMother.dto(data));
        await repository.save(board);
        return board;
    }

    static async createAuxiliary(repository, data = {}) {
        const board = Board.create(BoardsMother.dtoAuxiliary(data));
        await repository.save(board);
        return board;
    }

    static async createWithSpecificData(repository, data) {
        const board = Board.create(data);
        await repository.save(board);
        return board;
    }
}
