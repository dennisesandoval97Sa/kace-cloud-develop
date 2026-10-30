import { BoardResourcesSearch } from '../../src/boards/application/resourcesSearch/BoardResourcesSearch.js';
import { BoardUnifiedStatusPolicy } from '../../src/boards/domain/BoardUnifiedStatusPolicy.js';
import { KnexBoardResourcesRepository } from '../../src/boards/infrastructure/persistence/KnexBoardResourcesRepository.js';
import UsersMother from '../users/domain/UsersMother.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexRoleRepository } from '../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import RoleMother from '../role/domain/RoleMother.js';
import { BoardCreator } from '../../src/boards/application/create/BoardCreator.js';
import { KnexBoardsRepository } from '../../src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import BoardsMother from './domain/BoardsMother.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { KnexAuxiliariesRepository } from '../../src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository.js';
import { AuxiliaryMother } from '../auxiliaries/domain/AuxiliaryMother.js';
import { BoardUpdater } from '../../src/boards/application/update/BoardUpdater.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

async function insertCaseClone(connection, templateRow, overrides) {
    const newId = uuidv4();
    const newDesc = uuidv4();
    // `reference` sale de la fila plantilla y es UNIQUE (`casos_reference_unique`),
    // asi que copiarla hacia el clon reventaba en cuanto se pedia mas de uno. Se
    // descarta para que la tome del default de la columna, `casos_reference_seq`,
    // que es de donde salio la del original.
    const { reference: _referenciaOriginal, ...filaPlantilla } = templateRow;
    await connection('descripciones_casos').insert({ id: newDesc });
    await connection('cases').insert({
        ...filaPlantilla,
        id: newId,
        descripcion_caso_id: newDesc,
        ...overrides,
    });
    return newId;
}

describe('BoardResources', () => {
    const repository = new KnexBoardsRepository(knexConfig);
    const boardsResorcesRepository = new KnexBoardResourcesRepository(repository.connection);
    const userRepository = new KnexUsersRepository(repository.connection);
    const roleRepository = new KnexRoleRepository(repository.connection);
    const casesRepository = new KnexCaseRepository(repository.connection);
    const auxiliariesRepository = new KnexAuxiliariesRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);

    beforeEach(async () => {
        await repository.connection.raw(`SET search_path TO ${repository.connection.client.config.schema}`);

        await repository.connection.schema.dropTableIfExists('aux_proveedores');
        await repository.connection.schema.createTable('aux_proveedores', (table) => {
            table.string('id', 36).primary();
            table.jsonb('data').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.timestamp('deleted_at').nullable();
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.string('deleted_by', 36);
        });
    });

    afterEach(async () => {});

    it('Should create a board instance with complete board structure', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const boardCreator = new BoardCreator(repository);
        const payload = BoardsMother.dto({ group_id: group.id.value });
        await boardCreator.execute(payload);

        const boards = await repository.connection(repository.tableName).select('*');

        expect(boards.length).toBe(1);
    });

    it('Should update a board instance', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const boardCreator = new BoardCreator(repository);
        const payload = BoardsMother.dto({ group_id: group.id.value });
        await boardCreator.execute(payload);

        const updatePayload = {
            name: 'Updated Board',
            description: 'Updated Board Description',
            columns: [payload.columns[0]],
        };
        const boardUpdater = new BoardUpdater(repository);
        const updatedBoard = await boardUpdater.execute(updatePayload, payload.id);

        expect(updatedBoard.name.value).toBe(updatePayload.name);
        expect(updatedBoard.description.value).toBe(updatePayload.description);
        expect(updatedBoard.columns.value).toEqual([payload.columns[0]]);
    });

    it('Should create a board with can_admin_delete_record and can_agent_delete_record persisted', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const boardCreator = new BoardCreator(repository);
        const payload = BoardsMother.dto({
            group_id: group.id.value,
            can_admin_delete_record: true,
            can_agent_delete_record: true,
        });
        await boardCreator.execute(payload);

        const row = await repository.connection(repository.tableName).select('*').first();

        expect(row.can_admin_delete_record).toBe(true);
        expect(row.can_agent_delete_record).toBe(true);
    });

    it('Should update can_admin_delete_record and can_agent_delete_record', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const boardCreator = new BoardCreator(repository);
        const payload = BoardsMother.dto({ group_id: group.id.value });
        await boardCreator.execute(payload);

        const boardUpdater = new BoardUpdater(repository);
        const updatedBoard = await boardUpdater.execute(
            {
                can_admin_delete_record: true,
                can_agent_delete_record: true,
            },
            payload.id
        );

        expect(updatedBoard.can_admin_delete_record.value).toBe(true);
        expect(updatedBoard.can_agent_delete_record.value).toBe(true);
    });

    it('Should serialize can_admin_delete_record and can_agent_delete_record in toJson', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const boardCreator = new BoardCreator(repository);
        const payload = BoardsMother.dto({
            group_id: group.id.value,
            can_admin_delete_record: true,
            can_agent_delete_record: false,
        });
        await boardCreator.execute(payload);

        const board = await repository.find({ value: payload.id });
        const json = board.toJson();

        expect(json.can_admin_delete_record).toBe(true);
        expect(json.can_agent_delete_record).toBe(false);
    });

    it('Should be get a board instance with all nested relations', async () => {
        const kase = await CasesMother.createCaseWithRelations(casesRepository);
        const board = await BoardsMother.create(repository, { client_id: kase.cliente_id.value });

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const combinedFilter = [...baseFilterRequest.filter, ...board.criteria.value.items];
        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: combinedFilter,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(Object.keys(boardResult.data.items[0]).length).toBe(14);

        expect(boardResult.data.items).toEqual([
            {
                total: '1',
                id: kase.id.value,
                caso: 1,
                estado_actual: 'estado',
                cliente_creador: 'creador',
                clasificador_creador: 'actualizador',
                rol_client_creator: 'clients_managments',
                creador_rol: 'responsable',
                documento: '12345678',
                creador: 'creador',
                responsable: 'responsable',
                actualizador: 'actualizador',
                fecha_resolucion: null,
                transicion_id: kase.transicion_id.value,
            },
        ]);
    });

    it('should expose fecha_resolucion and transicion_id on case board rows', async () => {
        const fechaResolucion = dayjs().subtract(1, 'day').toISOString();
        const kase = await CasesMother.createCaseWithRelations(casesRepository, {
            fecha_resolucion: fechaResolucion,
        });
        const board = await BoardsMother.create(repository, {
            client_id: kase.cliente_id.value,
            criteria: {
                items: [
                    {
                        entity: 'case_client',
                        type: 'and',
                        field: 'id',
                        value: kase.cliente_id.value,
                        operator: 'eq',
                    },
                ],
            },
            havings: [],
        });

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const combinedFilter = [...baseFilterRequest.filter, ...board.criteria.value.items];
        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: combinedFilter,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

        const results = await service.execute(dtoCriteria);
        const row = results.toJson().data.items[0];

        expect(row.transicion_id).toBe(kase.transicion_id.value);
        expect(new Date(row.fecha_resolucion).toISOString()).toBe(new Date(fechaResolucion).toISOString());
    });

    it('should return countByStatus in metadata when searching for cases', async () => {
        const kase = await CasesMother.createCaseWithRelations(casesRepository);
        const board = await BoardsMother.create(repository, { client_id: kase.cliente_id.value });

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const combinedFilter = [...baseFilterRequest.filter, ...board.criteria.value.items];
        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: combinedFilter,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.metadata).toHaveProperty('countByStatus');
        expect(Array.isArray(boardResult.metadata.countByStatus)).toBe(true);
        expect(boardResult.metadata.countByStatus.length).toBeGreaterThan(0);

        boardResult.metadata.countByStatus.forEach((item) => {
            expect(item).toHaveProperty('status');
            expect(item).toHaveProperty('count');
            expect(item).toHaveProperty('color');
        });

        const totalFromStatus = boardResult.metadata.countByStatus.reduce((sum, s) => sum + s.count, 0);
        expect(totalFromStatus).toBe(boardResult.data.items.length);
    });

    it('should fetch results considering group by and count', async () => {
        const criteria = {
            filter: [{ type: 'and', entity: 'usuarios', field: 'deleted_at', value: 'null', operator: 'null' }],
            relationship: null,
            limit: 25,
            offset: 0,
            tableName: 'usuarios',
            select: [
                {
                    entity: 'usuarios',
                    field: 'rol_id',
                    alias: 'rol',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                },
                {
                    entity: 'usuarios',
                    field: 'id',
                    alias: 'total',
                    position: 2,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: 'count',
                },
            ],
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, 'usuarios');
        const results = await service.execute(criteria);
        const row = results.toJson().data.items[0];
        const [{ count: usersInGroup }] = await repository
            .connection('usuarios')
            .whereNull('deleted_at')
            .where({ rol_id: row.rol })
            .count('* as count');
        expect(parseInt(row.total, 10)).toBe(Number(usersInGroup));
        expect(row).toHaveProperty('rol');
        expect(row).toHaveProperty('total');
    });

    it('should fetch results considering group by and having', async () => {
        let role = await RoleMother.createRole(roleRepository);
        await UsersMother.createUser(userRepository, { rol_id: role.id.value });
        await UsersMother.createUser(userRepository, { rol_id: role.id.value });

        role = await RoleMother.createRole(roleRepository);
        await UsersMother.createUser(userRepository, { rol_id: role.id.value });

        const criteria = {
            filter: [{ type: 'and', entity: 'usuarios', field: 'deleted_at', value: 'null', operator: 'null' }],
            relationship: null,
            limit: 25,
            offset: 0,
            tableName: 'usuarios',
            select: [
                {
                    entity: 'usuarios',
                    field: 'rol_id',
                    alias: 'rol',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                },
                {
                    entity: 'usuarios',
                    field: 'id',
                    alias: 'total',
                    position: 2,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: 'count',
                },
            ],
            having: [
                {
                    type: 'having',
                    entity: 'usuarios',
                    field: 'id',
                    value: 1,
                    function: 'count',
                    operator: 'gt',
                },
            ],
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, 'usuarios');
        const results = await service.execute(criteria);
        const rows = results.toJson().data.items.length;
        expect(rows).toBe(2);
    });

    it('should fetch a simple criteria', async () => {
        const criteria = {
            filter: [{ type: 'and', entity: 'usuarios', field: 'deleted_at', value: 'null', operator: 'null' }],
            relationship: null,
            limit: 25,
            offset: 0,
            tableName: 'usuarios',
            select: [
                {
                    entity: 'usuarios',
                    field: 'rol_id',
                    alias: 'rol',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                },
                {
                    entity: 'usuarios',
                    field: 'id',
                    alias: 'id',
                    position: 2,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                },
            ],
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, 'usuarios');
        const results = await service.execute(criteria);
        const rows = results.toJson().data.items;

        const [{ count: expectedRowCount }] = await repository
            .connection('usuarios')
            .whereNull('deleted_at')
            .count('* as count');
        expect(rows.length).toBe(Number(expectedRowCount));
    });

    it('Should be get a board instance whit auxiliary data', async () => {
        const tableName = 'aux_proveedores';
        const auxOverrides = {
            data: {
                asistencia_movilidad: {
                    placa: 'prueba',
                    categoria: 'verde',
                    telefono_1: 3113022446,
                    telefono_2: 6045896563,
                    contingencia: 'contingencia 1',
                    creado_desde: '2025-11-20T12:00:00-05:00',
                    id_app_movil: 'id_app_movil 1',
                    tipo_servicio: 'tipo_servicio 1',
                    clase_vehiculo: 'clase_vehiculo 1',
                    marca_vehiculo: 'marca_vehiculo 1',
                    nombre_tecnico: 'nombre_tecnico 1',
                    tipo_de_cliente: 'tipo_de_cliente 1',
                    telefono_tecnico: 'telefono_tecnico 1',
                    municipio_destino: 'municipio_destino 1',
                    numero_expediente: '202511130000001',
                    direccion_servicio: 'direccion_servicio 1',
                    municipio_solicita: 'puertoTriunfo',
                    nombre_solicitante: 'nombre_solicitante 1',
                    ubicacion_servicio: 'ubicacion_servicio 1',
                    codigo_de_seguridad: 'codigo_de_seguridad 1',
                    estado_del_servicio: 'estado_del_servicio 1',
                    departamento_destino: 'departamento_destino 1',
                    fecha_y_hora_de_cita: 'fecha_y_hora_de_cita 1',
                    servicios_especiales: 'servicios_especiales 1',
                    departamento_solicita: 'antioquia',
                    direccion_del_destino: 'direccion_del_destino 1',
                    detalle_direccion_destino: 'detalle_direccion_destino 1',
                    fecha_y_hora_de_solicitud: '2025-11-20T12:00:00-05:00',
                    detalle_direccion_servicio: 'detalle_direccion_servicio 1',
                    agenda_asistencia_movilidad: {
                        nombre: 'agenda_asistencia_movilidad 1',
                        cola_de_llamada: 'cola_de_llamada 1',
                        numero_a_llamar: 'numero_a_llamar 1',
                        tipo_de_contacto: 'tipo_de_contacto 1',
                        contactos: {
                            numero_telefonico_1: 'numero_telefonico_1 1',
                            numero_telefonico_2: 'numero_telefonico_2 1',
                            numero_telefonico_3: '',
                        },
                    },
                    novedades_asistencia_movilidad: {
                        causa_de_la_novedad: 'causa_de_la_novedad 1',
                        genera_pago_al_proveedor: false,
                        quien_reporta_la_novedad: 'quien_reporta_la_novedad 1',
                    },
                    asignacion_asistencia_movilidad: {
                        clase: 'clase 1',
                        linea: 'autos',
                        servicio: 'abogadoEnSitio',
                        proveedor: 'proveedor 1',
                        asignado_a: 'asignado_a 1',
                        responsable: 'responsable 1',
                        estado_del_expediente: 'estado_del_expediente 1',
                        gestor_de_coordinacion: 'si',
                    },
                    finalizacion_asistencia_movilidad: {
                        finalizado_con: 'finalizado_con 1',
                    },
                    contactos_phone_asistencia_movilidad: {
                        connid: 'connid 1',
                        duracion: 'duracion 1',
                        telefono: 'telefono 1',
                        date_created: '2025-11-20T12:00:00-05:00',
                        usuario_fenix: 'usuario_fenix 1',
                        tipo_de_llamada: 'tipo_de_llamada 1',
                        estado_del_servicio: 'estado_del_servicio 1',
                        persona_de_contacto: 'persona_de_contacto 1',
                        fecha_y_hora_fin_de_la_llamada: 'fecha_y_hora_fin_de_la_llamada 1',
                        fecha_y_hora_inicio_de_llamada: '',
                    },
                    documentacion_cnm_asistencia_movilidad: [
                        {
                            observacion: 'DSFASDFASDF',
                            genera_queja: 'si',
                            persona_de_gestion: 'cnm',
                            radicado_de_la_queja: 'WERGSDFA',
                        },
                    ],
                    escalamiento_sura_asistencia_movilidad: {
                        genera_queja: 'genera_queja 1',
                        tipo_de_gestion: 'tipo_de_gestion 1',
                        tipo_de_respuesta: 'tipo_de_respuesta 1',
                        persona_de_gestion: 'persona_de_gestion 1',
                    },
                    gestion_proveedor_asistencia_movilidad: {
                        nombre: 'nombre 1',
                        celular_tecnico: 'celular_tecnico 1',
                        telefono_central_1: 'telefono_central_1 1',
                        telefono_central_2: 'telefono_central_2 1',
                        respuesta_de_proveedor: 'respuesta_de_proveedor 1',
                        fecha_y_hora_monitoreo_destino: 'fecha_y_hora_monitoreo_destino 1',
                        fecha_y_hora_monitoreo_en_sitio: 'fecha_y_hora_monitoreo_en_sitio 1',
                        tiempo_monitoreo_destino_minutos: 'tiempo_monitoreo_destino_minutos 1',
                        tiempo_monitoreo_en_sitio_minutos: 'tiempo_monitoreo_en_sitio_minutos 1',
                    },
                    monitoreo_proveedor_asistencia_movilidad: {
                        monitoreo_con: 'monitoreo_con 1',
                        se_genero_queja: 'se_genero_queja 1',
                        observacion_asesor: 'observacion_asesor 1',
                        momento_del_servicio: 'momento_del_servicio 1',
                        radicado_de_la_queja: 'radicado_de_la_queja 1',
                        observacion_proveedor: 'observacion_proveedor 1',
                        respuesta_a_monitoreo: 'respuesta_a_monitoreo 1',
                    },
                    reprogramacion_de_citas_asistencia_movilidad: {
                        motivo: 'motivo 1',
                        observacion: 'observacion 1',
                        quien_solicita: 'quien_solicita 1',
                        numero_de_citas: 'numero_de_citas 1',
                        fecha_y_hora_nueva_cita: 'fecha_y_hora_nueva_cita 1',
                    },
                },
            },
        };
        const data = await AuxiliaryMother.create(auxiliariesRepository, tableName, auxOverrides);

        const auxiliary = data.toJson();

        const filters = {
            items: [
                {
                    type: 'and',
                    entity: tableName,
                    field: 'asistencia_movilidad.numero_expediente',
                    value: 'null',
                    operator: 'notNull',
                },
            ],
        };

        const columns = [
            {
                entity: tableName,
                field: 'asistencia_movilidad.numero_expediente',
                alias: 'expediente',
                position: 1,
                is_filterable: false,
                data_type: 'STRING',
                format: '',
                function: null,
                group_by: false,
            },
            {
                entity: tableName,
                field: 'asistencia_movilidad.placa',
                alias: 'riesgo',
                position: 2,
                is_filterable: false,
                data_type: 'STRING',
                format: '',
                function: null,
                group_by: false,
            },
            {
                entity: tableName,
                field: 'asistencia_movilidad.fecha_y_hora_de_solicitud',
                alias: 'fecha_solicitud',
                position: 3,
                is_filterable: false,
                data_type: 'DATE',
                format: 'YYYY/MM/DD HH:MM:SS',
                function: null,
                group_by: false,
            },
            {
                entity: tableName,
                field: 'asistencia_movilidad.fecha_y_hora_de_cita',
                alias: 'fecha_cita',
                position: 4,
                is_filterable: false,
                data_type: 'DATE',
                format: 'YYYY/MM/DD HH:MM:SS',
                function: null,
                group_by: false,
            },
        ];
        const boardOverrides = {
            primary_entity: tableName,
            filters: filters,
            columns: columns,
        };
        const board = await BoardsMother.createAuxiliary(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const combinedFilter = [...baseFilterRequest.filter, ...board.criteria.value.items];
        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: combinedFilter,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(Object.keys(boardResult.data.items[0]).length).toBe(board.columns.value.length + 1);

        expect(boardResult.data.items).toEqual([
            {
                id: auxiliary.id,
                expediente: auxiliary.data.asistencia_movilidad.numero_expediente,
                riesgo: auxiliary.data.asistencia_movilidad.placa,
                fecha_solicitud: auxiliary.data.asistencia_movilidad.fecha_y_hora_de_solicitud,
                fecha_cita: auxiliary.data.asistencia_movilidad.fecha_y_hora_de_cita,
            },
        ]);
    });

    it('should return concatenated labels when case_auxiliar column points to a nested JSONB array field', async () => {
        const auxData = {
            departamento: {
                cundinamarca: {
                    edit_groups: [
                        { label: 'Usuario virtual', value: '28ac69b3-5c17-4dc2-9b20-1975b5b558d5' },
                        { label: 'Proveedor', value: '6b87790a-623d-4b80-bc6a-16465abe4f6c' },
                    ],
                },
            },
        };

        const kase = await CasesMother.createCaseWithRelations(casesRepository, {
            aux_data: auxData,
        });

        const boardOverrides = {
            primary_entity: 'cases',
            columns: [
                {
                    entity: 'case_auxiliar',
                    field: 'departamento.cundinamarca.edit_groups.label', // ← ruta con 3 niveles antes del key
                    alias: 'edit_groups_label',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: '',
                    function: null,
                    group_by: false,
                },
            ],
            filters: { items: [] },
            relations: [
                {
                    alias: 'case_auxiliar',
                    join_type: 'left',
                    on: [{ left: 'cases.id', operator: 'eq', right: 'case_auxiliar.caso_id', type: 'and' }],
                    primary_entity: 'cases',
                    related_entity: 'aux_cases',
                },
            ],
        };

        const board = await BoardsMother.createAuxiliary(repository, boardOverrides);

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.data.items[0].edit_groups_label).toBe('Usuario virtual, Proveedor');
    });

    it('should return concatenated labels when an aux table column points to a JSONB array field', async () => {
        const tableName = 'aux_proveedores';

        const auxOverrides = {
            data: {
                edit_groups: [
                    { label: 'Usuario virtual', value: '28ac69b3-5c17-4dc2-9b20-1975b5b558d5' },
                    { label: 'Proveedor', value: '6b87790a-623d-4b80-bc6a-16465abe4f6c' },
                ],
                type: 'Departamento',
                value: 'CUNDINAMARCA',
            },
        };
        const data = await AuxiliaryMother.create(auxiliariesRepository, tableName, auxOverrides);

        const columns = [
            {
                entity: tableName,
                field: 'edit_groups.label',
                alias: 'edit_groups_label',
                position: 1,
                is_filterable: false,
                data_type: 'STRING',
                format: '',
                function: null,
                group_by: false,
            },
        ];

        const boardOverrides = {
            primary_entity: tableName,
            filters: { items: [] },
            columns,
        };
        const board = await BoardsMother.createAuxiliary(repository, boardOverrides);

        const offset = 0;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.data.items[0].edit_groups_label).toBe('Usuario virtual, Proveedor');
    });

    it('Board should be received with subquery', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [
                    {
                        type: 'and',
                        field: 'id',
                        value: 'notNull',
                        entity: 'cases',
                        operator: 'notNull',
                    },
                ],
            },
            name: 'contador casos',
            description: 'contador casos',
            columns: [
                {
                    field: 'nombres',
                    alias: 'responsable',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                    entity: 'case_responsable',
                },
                {
                    field: 'nombre',
                    alias: 'estado',
                    position: 2,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                    entity: 'transition_next_state',
                },
                {
                    field: 'id',
                    alias: 'cantidad',
                    position: 3,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: 'count',
                    entity: 'cases',
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'transiciones',
                    alias: 'case_transiciones',
                    join_type: 'left',
                    on: [{ left: 'cases.transicion_id', operator: 'eq', right: 'case_transiciones.id', type: 'and' }],
                    relations: [
                        {
                            primary_entity: 'case_transiciones',
                            related_entity: 'estados',
                            alias: 'transition_next_state',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'case_transiciones.siguiente_estado_id',
                                    operator: 'eq',
                                    right: 'transition_next_state.id',
                                    type: 'and',
                                },
                            ],
                            relations: [],
                        },
                    ],
                },
                {
                    primary_entity: 'cases',
                    related_entity: 'usuarios',
                    alias: 'case_responsable',
                    join_type: 'left',
                    on: [{ left: 'cases.responsable_id', operator: 'eq', right: 'case_responsable.id', type: 'and' }],
                    relations: [],
                },
            ],
            havings: [{ type: 'having', field: 'id', value: 1, entity: 'cases', function: 'count', operator: 'gte' }],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [
                {
                    field: 'estado',
                    entity: 'transition_next_state',
                    operator: 'ilike',
                    type: 'AND',
                    value: 'inicial',
                },
                {
                    field: 'cantidad',
                    entity: 'cases',
                    operator: 'eq',
                    type: 'AND',
                    value: '5',
                },
            ],
            limit: 0,
            offset: 0,
        };

        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(0);
    });

    it('should return correct count and countByStatus with subQuery on cases board', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
                {
                    field: 'nombre',
                    alias: 'estado_actual',
                    position: 2,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'case_estado',
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'transiciones',
                    alias: 'case_transiciones',
                    join_type: 'left',
                    on: [{ left: 'cases.transicion_id', operator: 'eq', right: 'case_transiciones.id', type: 'and' }],
                    relations: [
                        {
                            primary_entity: 'case_transiciones',
                            related_entity: 'estados',
                            alias: 'case_estado',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'case_transiciones.siguiente_estado_id',
                                    operator: 'eq',
                                    right: 'case_estado.id',
                                    type: 'and',
                                },
                            ],
                            relations: [],
                        },
                    ],
                },
            ],
            havings: [],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [
                {
                    field: 'estado_actual',
                    entity: 'case_estado',
                    operator: 'ilike',
                    type: 'AND',
                    value: 'estado',
                },
            ],
            limit: 0,
            offset: 0,
        };

        const offset = 0;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.metadata.count).toBe(1);
        expect(Array.isArray(boardResult.metadata.countByStatus)).toBe(true);
        expect(boardResult.metadata.countByStatus.length).toBeGreaterThan(0);

        boardResult.metadata.countByStatus.forEach((item) => {
            expect(item).toHaveProperty('status');
            expect(item).toHaveProperty('count');
            expect(item).toHaveProperty('color');
        });

        const totalFromStatus = boardResult.metadata.countByStatus.reduce((sum, s) => sum + s.count, 0);
        expect(totalFromStatus).toBe(boardResult.data.items.length);
    });

    it('should return countByStatus when inner query has transition_next_state.color as color and count join uses count_by_status_color', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
                {
                    field: 'nombre',
                    alias: 'estado',
                    position: 2,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'transition_next_state',
                },
                {
                    field: 'color',
                    alias: 'color',
                    position: 3,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'transition_next_state',
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'transiciones',
                    alias: 'case_transiciones',
                    join_type: 'left',
                    on: [{ left: 'cases.transicion_id', operator: 'eq', right: 'case_transiciones.id', type: 'and' }],
                    relations: [
                        {
                            primary_entity: 'case_transiciones',
                            related_entity: 'estados',
                            alias: 'transition_next_state',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'case_transiciones.siguiente_estado_id',
                                    operator: 'eq',
                                    right: 'transition_next_state.id',
                                    type: 'and',
                                },
                            ],
                            relations: [],
                        },
                    ],
                },
            ],
            havings: [],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [
                {
                    field: 'estado',
                    entity: 'transition_next_state',
                    operator: 'ilike',
                    type: 'AND',
                    value: 'estado',
                },
            ],
            limit: 0,
            offset: 0,
        };

        const offset = 0;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.metadata.count).toBe(1);
        expect(boardResult.metadata.countByStatus.length).toBeGreaterThan(0);

        const byStatus = boardResult.metadata.countByStatus.find((s) => s.status === 'estado');
        expect(byStatus).toBeDefined();
        expect(byStatus.color).toBe('#66CC33');

        const row = boardResult.data.items[0];
        expect(row.color).toBe('#66CC33');
    });

    it('should apply subQuery filter by case_reference eq like board resources body filter', async () => {
        const kase = await CasesMother.createCaseWithRelations(casesRepository);
        const [{ reference: caseReference }] = await casesRepository.connection
            .select('reference')
            .from('cases')
            .where({ id: kase.id.value });

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'case_reference',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
                {
                    field: 'nombre',
                    alias: 'estado',
                    position: 2,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'transition_next_state',
                },
                {
                    field: 'color',
                    alias: 'color',
                    position: 3,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'transition_next_state',
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'transiciones',
                    alias: 'case_transiciones',
                    join_type: 'left',
                    on: [{ left: 'cases.transicion_id', operator: 'eq', right: 'case_transiciones.id', type: 'and' }],
                    relations: [
                        {
                            primary_entity: 'case_transiciones',
                            related_entity: 'estados',
                            alias: 'transition_next_state',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'case_transiciones.siguiente_estado_id',
                                    operator: 'eq',
                                    right: 'transition_next_state.id',
                                    type: 'and',
                                },
                            ],
                            relations: [],
                        },
                    ],
                },
            ],
            havings: [],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [
                {
                    entity: 'cases',
                    field: 'case_reference',
                    operator: 'eq',
                    type: 'AND',
                    value: caseReference,
                },
            ],
            limit: 0,
            offset: 0,
        };

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.metadata.count).toBe(1);
        expect(boardResult.data.items[0].case_reference).toBe(caseReference);
        expect(boardResult.metadata.countByStatus.length).toBeGreaterThan(0);
        const byStatus = boardResult.metadata.countByStatus.find((s) => s.status === 'estado');
        expect(byStatus).toBeDefined();
        expect(byStatus.color).toBe('#66CC33');
    });

    it('should return zero results when subQuery filter does not match', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
                {
                    field: 'nombre',
                    alias: 'estado_actual',
                    position: 2,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'case_estado',
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'transiciones',
                    alias: 'case_transiciones',
                    join_type: 'left',
                    on: [{ left: 'cases.transicion_id', operator: 'eq', right: 'case_transiciones.id', type: 'and' }],
                    relations: [
                        {
                            primary_entity: 'case_transiciones',
                            related_entity: 'estados',
                            alias: 'case_estado',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'case_transiciones.siguiente_estado_id',
                                    operator: 'eq',
                                    right: 'case_estado.id',
                                    type: 'and',
                                },
                            ],
                            relations: [],
                        },
                    ],
                },
            ],
            havings: [],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [
                {
                    field: 'estado_actual',
                    entity: 'case_estado',
                    operator: 'ilike',
                    type: 'AND',
                    value: 'nonexistent_status',
                },
            ],
            limit: 0,
            offset: 0,
        };

        const offset = 0;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(0);
        expect(boardResult.metadata.count).toBe(0);
    });

    it('should return correct countByStatus with subQuery on GROUP BY board', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            name: 'contador casos status',
            description: 'contador casos status',
            columns: [
                {
                    field: 'nombres',
                    alias: 'responsable',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                    entity: 'case_responsable',
                },
                {
                    field: 'nombre',
                    alias: 'estado',
                    position: 2,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                    entity: 'transition_next_state',
                },
                {
                    field: 'id',
                    alias: 'cantidad',
                    position: 3,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: 'count',
                    entity: 'cases',
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'transiciones',
                    alias: 'case_transiciones',
                    join_type: 'left',
                    on: [{ left: 'cases.transicion_id', operator: 'eq', right: 'case_transiciones.id', type: 'and' }],
                    relations: [
                        {
                            primary_entity: 'case_transiciones',
                            related_entity: 'estados',
                            alias: 'transition_next_state',
                            join_type: 'left',
                            on: [
                                {
                                    left: 'case_transiciones.siguiente_estado_id',
                                    operator: 'eq',
                                    right: 'transition_next_state.id',
                                    type: 'and',
                                },
                            ],
                            relations: [],
                        },
                    ],
                },
                {
                    primary_entity: 'cases',
                    related_entity: 'usuarios',
                    alias: 'case_responsable',
                    join_type: 'left',
                    on: [{ left: 'cases.responsable_id', operator: 'eq', right: 'case_responsable.id', type: 'and' }],
                    relations: [],
                },
            ],
            havings: [{ type: 'having', field: 'id', value: 1, entity: 'cases', function: 'count', operator: 'gte' }],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [
                {
                    field: 'estado',
                    entity: 'transition_next_state',
                    operator: 'ilike',
                    type: 'AND',
                    value: 'estado',
                },
            ],
            limit: 0,
            offset: 0,
        };

        const offset = 0;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.metadata.count).toBe(1);
        expect(Array.isArray(boardResult.metadata.countByStatus)).toBe(true);
        expect(boardResult.metadata.countByStatus.length).toBeGreaterThan(0);

        const totalFromStatus = boardResult.metadata.countByStatus.reduce((sum, s) => sum + s.count, 0);
        expect(totalFromStatus).toBe(boardResult.data.items.length);
        expect(boardResult.metadata.countByStatus[0].status).toBe('estado');
    });

    it('should use subQuery pagination when provided', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
            ],
            relations: [],
            havings: [],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [],
            limit: 2,
            offset: 1,
        };

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(2);
        expect(boardResult.metadata.count).toBe(3);
    });

    it('should fallback to board pagination when subQuery has no pagination', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
            ],
            relations: [],
            havings: [],
            page_size: 2,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(2);
        expect(boardResult.metadata.count).toBe(3);
    });

    it('should return correct pagination metadata using subQuery values', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
            ],
            relations: [],
            havings: [],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [],
            limit: 2,
            offset: 2,
        };

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(2);
        expect(boardResult.metadata.count).toBe(5);
        expect(boardResult.metadata.current_page).toBe(2);
        expect(boardResult.metadata.total_pages).toBe(3);
    });

    it('should return correct count reflecting subQuery filter results', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
            ],
            relations: [],
            havings: [],
            page_size: 25,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [
                {
                    field: 'caso',
                    entity: 'cases',
                    operator: 'eq',
                    type: 'AND',
                    value: 1,
                },
            ],
            limit: 10,
            offset: 0,
        };

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.metadata.count).toBe(1);
    });

    it('Boards resorces get a valid columns with comparsion functions', async () => {
        const boardPayload = {
            columns: [
                {
                    alias: 'now',
                    comparison_type: 'NOW',
                    comparison_value: 'NOW',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 1,
                },
                {
                    alias: 'hoy',
                    comparison_type: 'VALUE',
                    comparison_value: '2026-01-20 05:00:00',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 2,
                },
                {
                    alias: 'auxiliar',
                    comparison_entity: 'case_auxiliar',
                    comparison_field: 'pruebas_qa.fecha_peticion',
                    comparison_type: 'FIELD',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 3,
                },
            ],
            description: 'test one',
            icon_class: 'Airplay',
            // Id propio por test. Tres `it` de este archivo compartian el mismo
            // literal y el segundo chocaba con la fila que dejo el primero
            // (`boards_pkey`); ninguno de los tres afirma nada sobre el id.
            id: uuidv4(),
            is_active: true,
            name: 'test one',
            onescript_form_id: '8aa3fb43-7573-4efb-8348-66edbd84972f',
            primary_entity: 'cases',
            access_groups: [],
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            relations: [
                {
                    alias: 'case_auxiliar',
                    join_type: 'join',
                    on: [
                        {
                            left: 'cases.id',
                            operator: 'eq',
                            right: 'case_auxiliar.caso_id',
                            type: 'and',
                        },
                    ],
                    primary_entity: 'cases',
                    related_entity: 'aux_cases',
                },
            ],
        };

        const board = await BoardsMother.createWithSpecificData(repository, boardPayload);

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const fechaResolucion = dayjs().subtract(3, 'day').toISOString();
        const kase = await CasesMother.createCaseWithRelations(casesRepository, { fecha_resolucion: fechaResolucion });
        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);

        boardResult.data.items.forEach((item) => {
            expect(item).toEqual(
                expect.objectContaining({
                    now: expect.any(String),
                    hoy: expect.any(String),
                    auxiliar: expect.any(String),
                })
            );

            [item.now, item.hoy, item.auxiliar].forEach((value) => {
                expect(value).toContain('días');
                expect(value).toContain('horas');
                expect(value).toContain('minutos');
            });
        });
        expect(boardResult.data.items[0].id).toBe(kase.id.value);
    });

    it('Boards resorces get a null columns value when the auxiliary date is null using comparsion functions', async () => {
        const boardPayload = {
            columns: [
                {
                    alias: 'now',
                    comparison_type: 'NOW',
                    comparison_value: 'NOW',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 1,
                },
                {
                    alias: 'hoy',
                    comparison_type: 'VALUE',
                    comparison_value: '2026-01-20 05:00:00',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 2,
                },
                {
                    alias: 'auxiliar',
                    comparison_entity: 'case_auxiliar',
                    comparison_field: 'pruebas_qa.fecha_peticion',
                    comparison_type: 'FIELD',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 3,
                },
            ],
            description: 'test one',
            icon_class: 'Airplay',
            // Id propio por test. Tres `it` de este archivo compartian el mismo
            // literal y el segundo chocaba con la fila que dejo el primero
            // (`boards_pkey`); ninguno de los tres afirma nada sobre el id.
            id: uuidv4(),
            is_active: true,
            name: 'test one',
            onescript_form_id: '8aa3fb43-7573-4efb-8348-66edbd84972f',
            primary_entity: 'cases',
            access_groups: [],
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            relations: [
                {
                    alias: 'case_auxiliar',
                    join_type: 'join',
                    on: [
                        {
                            left: 'cases.id',
                            operator: 'eq',
                            right: 'case_auxiliar.caso_id',
                            type: 'and',
                        },
                    ],
                    primary_entity: 'cases',
                    related_entity: 'aux_cases',
                },
            ],
        };

        const board = await BoardsMother.createWithSpecificData(repository, boardPayload);

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const fechaResolucion = dayjs().subtract(3, 'day').toISOString();
        const auxData = {
            pruebas_qa: {
                fecha_peticion: null,
            },
        };
        const kase = await CasesMother.createCaseWithRelations(casesRepository, {
            fecha_resolucion: fechaResolucion,
            aux_data: auxData,
        });
        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);

        boardResult.data.items.forEach((item) => {
            expect(item).toEqual(
                expect.objectContaining({
                    now: expect.any(String),
                    hoy: expect.any(String),
                    auxiliar: null,
                })
            );

            [item.now, item.hoy].forEach((value) => {
                expect(value).toContain('días');
                expect(value).toContain('horas');
                expect(value).toContain('minutos');
            });
        });
        expect(boardResult.data.items[0].id).toBe(kase.id.value);
    });

    it('Boards resorces get a null columns value when the auxiliary date is any string value using comparsion functions', async () => {
        const boardPayload = {
            columns: [
                {
                    alias: 'now',
                    comparison_type: 'NOW',
                    comparison_value: 'NOW',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 1,
                },
                {
                    alias: 'hoy',
                    comparison_type: 'VALUE',
                    comparison_value: '2026-01-20 05:00:00',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 2,
                },
                {
                    alias: 'auxiliar',
                    comparison_entity: 'case_auxiliar',
                    comparison_field: 'pruebas_qa.fecha_peticion',
                    comparison_type: 'FIELD',
                    data_type: 'DATE',
                    entity: 'cases',
                    field: 'fecha_resolucion',
                    format: null,
                    function: 'date_difference',
                    function_type: 'comparison',
                    group_by: false,
                    is_filterable: false,
                    position: 3,
                },
            ],
            description: 'test one',
            icon_class: 'Airplay',
            // Id propio por test. Tres `it` de este archivo compartian el mismo
            // literal y el segundo chocaba con la fila que dejo el primero
            // (`boards_pkey`); ninguno de los tres afirma nada sobre el id.
            id: uuidv4(),
            is_active: true,
            name: 'test one',
            onescript_form_id: '8aa3fb43-7573-4efb-8348-66edbd84972f',
            primary_entity: 'cases',
            access_groups: [],
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            relations: [
                {
                    alias: 'case_auxiliar',
                    join_type: 'join',
                    on: [
                        {
                            left: 'cases.id',
                            operator: 'eq',
                            right: 'case_auxiliar.caso_id',
                            type: 'and',
                        },
                    ],
                    primary_entity: 'cases',
                    related_entity: 'aux_cases',
                },
            ],
        };

        const board = await BoardsMother.createWithSpecificData(repository, boardPayload);

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const offset = baseFilterRequest.offset < 1 ? 0 : (baseFilterRequest.offset - 1) * baseFilterRequest.limit;
        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const fechaResolucion = dayjs().subtract(3, 'day').toISOString();
        const auxData = {
            pruebas_qa: {
                fecha_peticion: 'N/A',
            },
        };
        const kase = await CasesMother.createCaseWithRelations(casesRepository, {
            fecha_resolucion: fechaResolucion,
            aux_data: auxData,
        });
        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);

        boardResult.data.items.forEach((item) => {
            expect(item).toEqual(
                expect.objectContaining({
                    now: expect.any(String),
                    hoy: expect.any(String),
                    auxiliar: null,
                })
            );

            [item.now, item.hoy].forEach((value) => {
                expect(value).toContain('días');
                expect(value).toContain('horas');
                expect(value).toContain('minutos');
            });
        });
        expect(boardResult.data.items[0].id).toBe(kase.id.value);
    });

    it('should use board pagination (query params) when subQuery has limit 0 and offset 0', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    field: 'reference',
                    alias: 'caso',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                    entity: 'cases',
                },
            ],
            relations: [],
            havings: [],
            page_size: 2,
        };
        const board = await BoardsMother.create(repository, boardOverrides);

        const baseFilterRequest = {
            filter: [],
            limit: 0,
            offset: 0,
        };

        const page = 2;
        const boardOffset = (page - 1) * board.page_size.value;

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: boardOffset,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: baseFilterRequest,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(2);
        expect(boardResult.metadata.count).toBe(5);
        expect(boardResult.metadata.current_page).toBe(2);
        expect(boardResult.metadata.total_pages).toBe(3);
    });

    it('should apply subQuery order without filter and without relationship (order-only subQuery)', async () => {
        // Regression test: when the user sends only an order (no filter, no relationship),
        // the controller sets subQuery = validation.value where subQuery.relationship is null/undefined.
        // Criteria handles null relationship safely via optional chaining in convertToKnex.
        // The order is applied to the derived table 't', which already has the inner query's JOINs.
        const criteria = {
            filter: [{ type: 'and', entity: 'usuarios', field: 'deleted_at', value: 'null', operator: 'null' }],
            relationship: null,
            limit: 25,
            offset: 0,
            tableName: 'usuarios',
            select: [
                {
                    entity: 'usuarios',
                    field: 'id',
                    alias: 'id',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    group_by: true,
                    function: null,
                },
            ],
            subQuery: {
                filter: null,
                relationship: null,
                limit: 0,
                offset: 0,
                order: { field: 'id', direction: 'desc' },
            },
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, 'usuarios');
        const results = await service.execute(criteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBeGreaterThan(0);
        expect(boardResult.metadata.count).toBeGreaterThan(0);
    });

    it('should throw QueryDBError with custom message when column does not exist', async () => {
        const service = new KnexBoardResourcesRepository(repository.connection);
        service.tableName = 'usuarios';

        const mockCriteria = {
            setTableColumns: () => {},
            convertToKnex: () => {
                throw new Error('column "usuarios"."invalid_column" does not exist');
            },
        };

        await expect(service.search(mockCriteria, null)).rejects.toThrow('columna o relación no válida');
    });

    it('should throw QueryDBError when relation table does not exist', async () => {
        const service = new KnexBoardResourcesRepository(repository.connection);
        service.tableName = 'usuarios';

        const mockCriteria = {
            setTableColumns: () => {},
            convertToKnex: () => {
                throw new Error('relation "invalid_table" does not exist');
            },
        };

        await expect(service.search(mockCriteria, null)).rejects.toThrow('columna o relación no válida');
    });

    describe('ORDER BY case-insensitive (human ordering)', () => {
        it('should order aux table JSONB scalar field ASC and DESC case-insensitively', async () => {
            const tableName = 'aux_proveedores';

            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { persona: { nombre: 'Carlos' } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { persona: { nombre: 'ana' } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { persona: { nombre: 'Beatriz' } },
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'persona.nombre',
                    alias: 'nombre',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const buildDtoCriteria = (direction) => ({
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: { filter: [], limit: 0, offset: 0, order: { field: 'nombre', direction } },
            });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

            // ASC: ana → Beatriz → Carlos  (LOWER comparison ignores case)
            const ascResult = await service.execute(buildDtoCriteria('asc'));
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(3);
            expect(ascItems[0].nombre.toLowerCase()).toBe('ana');
            expect(ascItems[1].nombre.toLowerCase()).toBe('beatriz');
            expect(ascItems[2].nombre.toLowerCase()).toBe('carlos');

            // DESC: Carlos → Beatriz → ana
            const descResult = await service.execute(buildDtoCriteria('desc'));
            const descItems = descResult.toJson().data.items;
            expect(descItems.length).toBe(3);
            expect(descItems[0].nombre.toLowerCase()).toBe('carlos');
            expect(descItems[1].nombre.toLowerCase()).toBe('beatriz');
            expect(descItems[2].nombre.toLowerCase()).toBe('ana');
        });

        it('should order cases board by joined STRING column ASC and DESC case-insensitively', async () => {
            const db = repository.connection;
            const estadoId = uuidv4();
            const transicionId = uuidv4();

            await db('estados').insert({ id: estadoId, nombre: 'Inicial', color: '#66CC33' });
            await db('transiciones').insert({ id: transicionId, siguiente_estado_id: estadoId });

            const responsables = [
                { id: uuidv4(), nombre: 'Zoe' },
                { id: uuidv4(), nombre: 'ana' },
                { id: uuidv4(), nombre: 'Mario' },
            ];

            for (const r of responsables) {
                await db('usuarios').insert({ id: r.id, nombres: r.nombre });
                const caseId = uuidv4();
                await db('cases').insert({
                    id: caseId,
                    transicion_id: transicionId,
                    responsable_id: r.id,
                    created_at: new Date().toISOString(),
                });
                await db('aux_cases').insert({ id: uuidv4(), data: {}, caso_id: caseId });
            }

            const boardOverrides = {
                primary_entity: 'cases',
                criteria: {
                    items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
                },
                columns: [
                    {
                        entity: 'case_responsable',
                        field: 'nombres',
                        alias: 'responsable',
                        position: 1,
                        is_filterable: true,
                        data_type: 'STRING',
                        format: null,
                        group_by: false,
                        function: null,
                    },
                ],
                relations: [
                    {
                        primary_entity: 'cases',
                        related_entity: 'usuarios',
                        alias: 'case_responsable',
                        join_type: 'join',
                        on: [
                            {
                                left: 'cases.responsable_id',
                                operator: 'eq',
                                right: 'case_responsable.id',
                                type: 'and',
                            },
                        ],
                        relations: [],
                    },
                ],
                havings: [],
                page_size: 25,
            };

            const board = await BoardsMother.create(repository, boardOverrides);

            const buildDtoCriteria = (direction) => ({
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: { filter: [], limit: 0, offset: 0, order: { field: 'responsable', direction } },
            });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

            // ASC: ana → Mario → Zoe
            const ascResult = await service.execute(buildDtoCriteria('asc'));
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(3);
            expect(ascItems[0].responsable.toLowerCase()).toBe('ana');
            expect(ascItems[1].responsable.toLowerCase()).toBe('mario');
            expect(ascItems[2].responsable.toLowerCase()).toBe('zoe');

            // DESC: Zoe → Mario → ana
            const descResult = await service.execute(buildDtoCriteria('desc'));
            const descItems = descResult.toJson().data.items;
            expect(descItems.length).toBe(3);
            expect(descItems[0].responsable.toLowerCase()).toBe('zoe');
            expect(descItems[1].responsable.toLowerCase()).toBe('mario');
            expect(descItems[2].responsable.toLowerCase()).toBe('ana');
        });

        it('should order aux JSONB NUMBER field numerically not lexically', async () => {
            const tableName = 'aux_proveedores';

            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { metricas: { edad: 100 } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { metricas: { edad: 5 } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { metricas: { edad: 20 } },
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'metricas.edad',
                    alias: 'edad_col',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const buildDtoCriteria = (direction) => ({
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: { filter: [], limit: 0, offset: 0, order: { field: 'edad_col', direction } },
            });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

            const ascResult = await service.execute(buildDtoCriteria('asc'));
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(3);
            expect(Number(ascItems[0].edad_col)).toBe(5);
            expect(Number(ascItems[1].edad_col)).toBe(20);
            expect(Number(ascItems[2].edad_col)).toBe(100);

            const descResult = await service.execute(buildDtoCriteria('desc'));
            const descItems = descResult.toJson().data.items;
            expect(Number(descItems[0].edad_col)).toBe(100);
            expect(Number(descItems[1].edad_col)).toBe(20);
            expect(Number(descItems[2].edad_col)).toBe(5);
        });

        it('should order aux JSONB DATE field chronologically', async () => {
            const tableName = 'aux_proveedores';

            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { evt: { cuando: '2024-06-15T10:00:00.000Z' } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { evt: { cuando: '2020-01-01T00:00:00.000Z' } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { evt: { cuando: '2022-12-31T12:00:00.000Z' } },
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'evt.cuando',
                    alias: 'cuando',
                    position: 1,
                    is_filterable: true,
                    data_type: 'DATE',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const buildDtoCriteria = (direction) => ({
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: { filter: [], limit: 0, offset: 0, order: { field: 'cuando', direction } },
            });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

            const ascResult = await service.execute(buildDtoCriteria('asc'));
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(3);
            expect(new Date(ascItems[0].cuando).getUTCFullYear()).toBe(2020);
            expect(new Date(ascItems[1].cuando).getUTCFullYear()).toBe(2022);
            expect(new Date(ascItems[2].cuando).getUTCFullYear()).toBe(2024);
        });

        it('should order aux JSONB BOOLEAN field', async () => {
            const tableName = 'aux_proveedores';

            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { flags: { activo: true } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { flags: { activo: false } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { flags: { activo: true } },
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'flags.activo',
                    alias: 'activo',
                    position: 1,
                    is_filterable: true,
                    data_type: 'BOOLEAN',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const buildDtoCriteria = (direction) => ({
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: { filter: [], limit: 0, offset: 0, order: { field: 'activo', direction } },
            });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

            const ascResult = await service.execute(buildDtoCriteria('asc'));
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(3);
            const toBool = (v) => v === true || v === 'true';
            expect(toBool(ascItems[0].activo)).toBe(false);
            expect(toBool(ascItems[1].activo)).toBe(true);
            expect(toBool(ascItems[2].activo)).toBe(true);
        });

        it('should order by deeply nested JSONB path', async () => {
            const tableName = 'aux_proveedores';

            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { direccion: { ciudad: { nombre: 'Zaragoza' } } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { direccion: { ciudad: { nombre: 'Almeria' } } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { direccion: { ciudad: { nombre: 'Barcelona' } } },
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'direccion.ciudad.nombre',
                    alias: 'ciudad_nombre',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const buildDtoCriteria = (direction) => ({
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: { filter: [], limit: 0, offset: 0, order: { field: 'ciudad_nombre', direction } },
            });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

            const ascResult = await service.execute(buildDtoCriteria('asc'));
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(3);
            expect(ascItems[0].ciudad_nombre.toLowerCase()).toBe('almeria');
            expect(ascItems[1].ciudad_nombre.toLowerCase()).toBe('barcelona');
            expect(ascItems[2].ciudad_nombre.toLowerCase()).toBe('zaragoza');
        });

        it('should place null JSONB values last when ordering ASC', async () => {
            const tableName = 'aux_proveedores';

            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { persona: { nombre: 'Carlos' } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { persona: { nombre: null } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { otra: 1 },
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'persona.nombre',
                    alias: 'nombre_nullable',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const dtoCriteria = {
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'nombre_nullable', direction: 'asc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
            const result = await service.execute(dtoCriteria);
            const items = result.toJson().data.items;
            expect(items.length).toBe(3);
            expect(items[2].nombre_nullable === null || items[2].nombre_nullable === undefined).toBe(true);
        });

        it('should order by column alias matching frontend header sort field', async () => {
            const tableName = 'aux_proveedores';

            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { persona: { nombre: 'Zoe' } },
            });
            await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { persona: { nombre: 'ana' } },
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'persona.nombre',
                    alias: 'nombre_alias_header',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const dtoCriteria = {
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'nombre_alias_header', direction: 'asc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
            const ascResult = await service.execute(dtoCriteria);
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(2);
            expect(ascItems[0].nombre_alias_header.toLowerCase()).toBe('ana');
            expect(ascItems[1].nombre_alias_header.toLowerCase()).toBe('zoe');
        });

        it('should order by date_difference (comparison) alias without casting numeric to timestamp', async () => {
            const tableName = 'aux_proveedores';

            const newest = dayjs().subtract(1, 'day').toISOString();
            const mid = dayjs().subtract(5, 'day').toISOString();
            const oldest = dayjs().subtract(20, 'day').toISOString();

            const rowNewest = await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { tag: 'n' },
                created_at: newest,
            });
            const rowMid = await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { tag: 'm' },
                created_at: mid,
            });
            const rowOldest = await AuxiliaryMother.create(auxiliariesRepository, tableName, {
                data: { tag: 'o' },
                created_at: oldest,
            });

            const columns = [
                {
                    entity: tableName,
                    field: 'created_at',
                    alias: 'diff_segundos',
                    position: 1,
                    is_filterable: false,
                    data_type: 'DATE',
                    format: null,
                    group_by: false,
                    function: 'date_difference',
                    function_type: 'comparison',
                    comparison_type: 'NOW',
                    comparison_value: 'NOW',
                },
            ];

            const board = await BoardsMother.createAuxiliary(repository, {
                primary_entity: tableName,
                filters: { items: [] },
                columns,
            });

            const buildDto = (direction) => ({
                filter: board.criteria.value.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: null,
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'diff_segundos', direction },
                },
            });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);

            const ascResult = await service.execute(buildDto('asc'));
            const ascItems = ascResult.toJson().data.items;
            expect(ascItems.length).toBe(3);
            expect(ascItems[0].id).toBe(rowNewest.toJson().id);
            expect(ascItems[1].id).toBe(rowMid.toJson().id);
            expect(ascItems[2].id).toBe(rowOldest.toJson().id);

            const descResult = await service.execute(buildDto('desc'));
            const descItems = descResult.toJson().data.items;
            expect(descItems[0].id).toBe(rowOldest.toJson().id);
            expect(descItems[2].id).toBe(rowNewest.toJson().id);
        });

        it('should order by count aggregate alias', async () => {
            let role = await RoleMother.createRole(roleRepository);
            await UsersMother.createUser(userRepository, { rol_id: role.id.value });
            await UsersMother.createUser(userRepository, { rol_id: role.id.value });
            role = await RoleMother.createRole(roleRepository);
            await UsersMother.createUser(userRepository, { rol_id: role.id.value });

            const criteria = {
                filter: [{ type: 'and', entity: 'usuarios', field: 'deleted_at', value: 'null', operator: 'null' }],
                relationship: null,
                limit: 25,
                offset: 0,
                tableName: 'usuarios',
                select: [
                    {
                        entity: 'usuarios',
                        field: 'rol_id',
                        alias: 'rol',
                        position: 1,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: null,
                    },
                    {
                        entity: 'usuarios',
                        field: 'id',
                        alias: 'total',
                        position: 2,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: 'count',
                    },
                ],
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'total', direction: 'desc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, 'usuarios');
            const result = await service.execute(criteria);
            const items = result.toJson().data.items;
            expect(items.length).toBeGreaterThan(1);
            for (let i = 0; i < items.length - 1; i += 1) {
                expect(parseInt(items[i].total, 10)).toBeGreaterThanOrEqual(parseInt(items[i + 1].total, 10));
            }
        });

        it('should order by sum aggregate alias', async () => {
            const grupoScope = uuidv4();
            const clientA = uuidv4();
            const clientB = uuidv4();

            const k1 = await CasesMother.createCaseWithRelations(casesRepository, {
                cliente_id: clientA,
                grupo_id: grupoScope,
            });
            const baseRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            await casesRepository
                .connection('clients')
                .insert({
                    id: clientB,
                    documento: '88776655',
                    created_by: baseRow.created_by,
                })
                .onConflict('id')
                .ignore();

            await casesRepository.connection('cases').where({ id: k1.id.value }).update({ reference: 100 });
            const templateRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            const id1 = k1.id.value;
            const id2 = await insertCaseClone(casesRepository.connection, templateRow, {
                reference: 50,
                cliente_id: clientA,
            });
            const id3 = await insertCaseClone(casesRepository.connection, templateRow, {
                reference: 10,
                cliente_id: clientB,
            });

            const criteria = {
                filter: [
                    {
                        type: 'and',
                        entity: 'cases',
                        field: 'id',
                        operator: 'in',
                        value: `${id1},${id2},${id3}`,
                    },
                    { type: 'and', entity: 'cases', field: 'deleted_at', value: 'null', operator: 'null' },
                ],
                relationship: null,
                limit: 100,
                offset: 0,
                tableName: 'cases',
                select: [
                    {
                        entity: 'cases',
                        field: 'cliente_id',
                        alias: 'cid',
                        position: 1,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: null,
                    },
                    {
                        entity: 'cases',
                        field: 'reference',
                        alias: 'suma_ref',
                        position: 2,
                        is_filterable: false,
                        data_type: 'NUMBER',
                        format: null,
                        group_by: true,
                        function: 'sum',
                    },
                ],
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'suma_ref', direction: 'desc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, 'cases');
            const result = await service.execute(criteria);
            const items = result.toJson().data.items;
            expect(items.length).toBe(2);
            expect(Number(items[0].suma_ref)).toBe(150);
            expect(Number(items[1].suma_ref)).toBe(10);
            expect(items[0].cid).toBe(clientA);
            expect(items[1].cid).toBe(clientB);
        });

        it('should order by avg aggregate alias', async () => {
            const grupoScope = uuidv4();
            const clientA = uuidv4();
            const clientB = uuidv4();

            const k1 = await CasesMother.createCaseWithRelations(casesRepository, {
                cliente_id: clientA,
                grupo_id: grupoScope,
            });
            const baseRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            await casesRepository
                .connection('clients')
                .insert({
                    id: clientB,
                    documento: '88776654',
                    created_by: baseRow.created_by,
                })
                .onConflict('id')
                .ignore();

            await casesRepository.connection('cases').where({ id: k1.id.value }).update({ reference: 10 });
            const templateRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            const id1 = k1.id.value;
            const id2 = await insertCaseClone(casesRepository.connection, templateRow, {
                reference: 30,
                cliente_id: clientA,
            });
            const id3 = await insertCaseClone(casesRepository.connection, templateRow, {
                reference: 100,
                cliente_id: clientB,
            });

            const criteria = {
                filter: [
                    {
                        type: 'and',
                        entity: 'cases',
                        field: 'id',
                        operator: 'in',
                        value: `${id1},${id2},${id3}`,
                    },
                    { type: 'and', entity: 'cases', field: 'deleted_at', value: 'null', operator: 'null' },
                ],
                relationship: null,
                limit: 100,
                offset: 0,
                tableName: 'cases',
                select: [
                    {
                        entity: 'cases',
                        field: 'cliente_id',
                        alias: 'cid',
                        position: 1,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: null,
                    },
                    {
                        entity: 'cases',
                        field: 'reference',
                        alias: 'promedio',
                        position: 2,
                        is_filterable: false,
                        data_type: 'NUMBER',
                        format: null,
                        group_by: true,
                        function: 'avg',
                    },
                ],
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'promedio', direction: 'asc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, 'cases');
            const result = await service.execute(criteria);
            const items = result.toJson().data.items;
            expect(items.length).toBe(2);
            expect(Number(items[0].promedio)).toBe(20);
            expect(Number(items[1].promedio)).toBe(100);
        });

        it('should order by min aggregate alias preserving DATE semantics', async () => {
            const grupoScope = uuidv4();
            const clientA = uuidv4();
            const clientB = uuidv4();

            const tOld = dayjs().subtract(30, 'day').toISOString();
            const tMid = dayjs().subtract(10, 'day').toISOString();
            const tOther = dayjs().subtract(5, 'day').toISOString();

            const k1 = await CasesMother.createCaseWithRelations(casesRepository, {
                cliente_id: clientA,
                grupo_id: grupoScope,
                created_at: tOld,
            });
            const baseRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            await casesRepository
                .connection('clients')
                .insert({
                    id: clientB,
                    documento: '88776653',
                    created_by: baseRow.created_by,
                })
                .onConflict('id')
                .ignore();

            await casesRepository.connection('cases').where({ id: k1.id.value }).update({
                created_at: tOld,
                reference: 879_999,
            });
            const templateRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            const id1 = k1.id.value;
            const id2 = await insertCaseClone(casesRepository.connection, templateRow, {
                created_at: tMid,
                cliente_id: clientA,
                reference: 880_001,
            });
            const id3 = await insertCaseClone(casesRepository.connection, templateRow, {
                created_at: tOther,
                cliente_id: clientB,
                reference: 880_002,
            });

            const criteria = {
                filter: [
                    {
                        type: 'and',
                        entity: 'cases',
                        field: 'id',
                        operator: 'in',
                        value: `${id1},${id2},${id3}`,
                    },
                    { type: 'and', entity: 'cases', field: 'deleted_at', value: 'null', operator: 'null' },
                ],
                relationship: null,
                limit: 100,
                offset: 0,
                tableName: 'cases',
                select: [
                    {
                        entity: 'cases',
                        field: 'cliente_id',
                        alias: 'cid',
                        position: 1,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: null,
                    },
                    {
                        entity: 'cases',
                        field: 'created_at',
                        alias: 'min_creado',
                        position: 2,
                        is_filterable: false,
                        data_type: 'DATE',
                        format: null,
                        group_by: true,
                        function: 'min',
                    },
                ],
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'min_creado', direction: 'desc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, 'cases');
            const result = await service.execute(criteria);
            const items = result.toJson().data.items;
            expect(items.length).toBe(2);
            const rowA = items.find((r) => r.cid === clientA);
            const rowB = items.find((r) => r.cid === clientB);
            expect(new Date(rowA.min_creado).getTime()).toBe(new Date(tOld).getTime());
            expect(new Date(rowB.min_creado).getTime()).toBe(new Date(tOther).getTime());
            expect(items[0].cid).toBe(clientB);
            expect(items[1].cid).toBe(clientA);
        });

        it('should order by max aggregate alias preserving NUMBER semantics', async () => {
            const grupoScope = uuidv4();
            const clientX = uuidv4();
            const clientY = uuidv4();

            const k1 = await CasesMother.createCaseWithRelations(casesRepository, {
                cliente_id: clientX,
                grupo_id: grupoScope,
            });
            const baseRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            await casesRepository
                .connection('clients')
                .insert({
                    id: clientY,
                    documento: '88776652',
                    created_by: baseRow.created_by,
                })
                .onConflict('id')
                .ignore();

            await casesRepository.connection('cases').where({ id: k1.id.value }).update({ reference: 1 });
            const templateRow = await casesRepository.connection('cases').where({ id: k1.id.value }).first();
            const id1 = k1.id.value;
            const id2 = await insertCaseClone(casesRepository.connection, templateRow, {
                reference: 50,
                cliente_id: clientX,
            });
            const id3 = await insertCaseClone(casesRepository.connection, templateRow, {
                reference: 10,
                cliente_id: clientY,
            });

            const criteria = {
                filter: [
                    {
                        type: 'and',
                        entity: 'cases',
                        field: 'id',
                        operator: 'in',
                        value: `${id1},${id2},${id3}`,
                    },
                    { type: 'and', entity: 'cases', field: 'deleted_at', value: 'null', operator: 'null' },
                ],
                relationship: null,
                limit: 100,
                offset: 0,
                tableName: 'cases',
                select: [
                    {
                        entity: 'cases',
                        field: 'cliente_id',
                        alias: 'cid',
                        position: 1,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: null,
                    },
                    {
                        entity: 'cases',
                        field: 'reference',
                        alias: 'max_ref',
                        position: 2,
                        is_filterable: false,
                        data_type: 'NUMBER',
                        format: null,
                        group_by: true,
                        function: 'max',
                    },
                ],
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'max_ref', direction: 'asc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, 'cases');
            const result = await service.execute(criteria);
            const items = result.toJson().data.items;
            expect(items.length).toBe(2);
            expect(Number(items[0].max_ref)).toBe(10);
            expect(Number(items[1].max_ref)).toBe(50);
            expect(items[0].cid).toBe(clientY);
            expect(items[1].cid).toBe(clientX);
        });

        it('should order by count aggregate alias when query has HAVING', async () => {
            let role = await RoleMother.createRole(roleRepository);
            await UsersMother.createUser(userRepository, { rol_id: role.id.value });
            await UsersMother.createUser(userRepository, { rol_id: role.id.value });

            role = await RoleMother.createRole(roleRepository);
            await UsersMother.createUser(userRepository, { rol_id: role.id.value });

            const criteria = {
                filter: [{ type: 'and', entity: 'usuarios', field: 'deleted_at', value: 'null', operator: 'null' }],
                relationship: null,
                limit: 25,
                offset: 0,
                tableName: 'usuarios',
                select: [
                    {
                        entity: 'usuarios',
                        field: 'rol_id',
                        alias: 'rol',
                        position: 1,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: null,
                    },
                    {
                        entity: 'usuarios',
                        field: 'id',
                        alias: 'total',
                        position: 2,
                        is_filterable: false,
                        data_type: 'STRING',
                        format: null,
                        group_by: true,
                        function: 'count',
                    },
                ],
                having: [
                    {
                        type: 'having',
                        entity: 'usuarios',
                        field: 'id',
                        value: 1,
                        function: 'count',
                        operator: 'gt',
                    },
                ],
                subQuery: {
                    filter: [],
                    limit: 0,
                    offset: 0,
                    order: { field: 'total', direction: 'desc' },
                },
            };

            const service = new BoardResourcesSearch(boardsResorcesRepository, 'usuarios');
            const results = await service.execute(criteria);
            const items = results.toJson().data.items;
            expect(items.length).toBeGreaterThan(0);
            for (let i = 0; i < items.length - 1; i += 1) {
                expect(parseInt(items[i].total, 10)).toBeGreaterThanOrEqual(parseInt(items[i + 1].total, 10));
            }
        });
    });

    it('should exclude soft-deleted records from both items and count in aux table board', async () => {
        const tableName = 'aux_proveedores';

        const active = await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { info: { nombre: 'activo' } },
        });
        const deleted = await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { info: { nombre: 'eliminado' } },
        });

        await repository
            .connection(tableName)
            .where({ id: deleted.toJson().id })
            .update({ deleted_at: new Date().toISOString(), deleted_by: 'test' });

        const columns = [
            {
                entity: tableName,
                field: 'info.nombre',
                alias: 'nombre',
                position: 1,
                is_filterable: true,
                data_type: 'STRING',
                format: null,
                group_by: false,
                function: null,
            },
        ];

        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: tableName,
            filters: { items: [] },
            columns,
        });

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.data.items[0].id).toBe(active.toJson().id);

        expect(boardResult.metadata.count).toBe(1);
    });

    it('should expand unified status filter and present active inactive on aux board', async () => {
        const tableName = 'aux_proveedores';

        await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { flags: { is_active: true } },
        });
        await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { flags: { is_active: 1 } },
        });
        await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { flags: { is_active: false } },
        });
        await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { flags: { is_active: 2 } },
        });

        const columns = [
            {
                entity: tableName,
                field: 'flags.is_active',
                alias: 'is_active',
                position: 1,
                is_filterable: true,
                data_type: 'BOOLEAN',
                format: null,
                group_by: false,
                function: null,
            },
        ];

        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: tableName,
            filters: { items: [] },
            columns,
        });

        const baseDto = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, tableName);

        const activeResult = await service.execute({
            ...baseDto,
            subQuery: {
                filter: [{ entity: tableName, field: 'is_active', operator: 'eq', value: true, type: 'AND' }],
                limit: 0,
                offset: 0,
            },
        });
        const activeItems = activeResult.toJson().data.items;
        expect(activeItems.length).toBe(2);
        expect(activeItems.every((r) => BoardUnifiedStatusPolicy.isRawActive(r.is_active))).toBe(true);

        const inactiveResult = await service.execute({
            ...baseDto,
            subQuery: {
                filter: [{ entity: tableName, field: 'is_active', operator: 'eq', value: false, type: 'AND' }],
                limit: 0,
                offset: 0,
            },
        });
        const inactiveItems = inactiveResult.toJson().data.items;
        expect(inactiveItems.length).toBe(2);
        expect(inactiveItems.every((r) => !BoardUnifiedStatusPolicy.isRawActive(r.is_active))).toBe(true);
    });

    it('should not expand unified status when is_status_column is false', async () => {
        const tableName = 'aux_proveedores';

        await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { flags: { is_active: true } },
        });
        await AuxiliaryMother.create(auxiliariesRepository, tableName, {
            data: { flags: { is_active: 1 } },
        });

        const columns = [
            {
                entity: tableName,
                field: 'flags.is_active',
                alias: 'is_active',
                position: 1,
                is_filterable: true,
                data_type: 'BOOLEAN',
                format: null,
                group_by: false,
                function: null,
                is_status_column: false,
            },
        ];

        const board = await BoardsMother.createAuxiliary(repository, {
            primary_entity: tableName,
            filters: { items: [] },
            columns,
        });

        const baseDto = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, tableName);

        const activeResult = await service.execute({
            ...baseDto,
            subQuery: {
                filter: [{ entity: tableName, field: 'is_active', operator: 'eq', value: true, type: 'AND' }],
                limit: 0,
                offset: 0,
            },
        });
        expect(activeResult.toJson().data.items.length).toBe(1);
    });

    it('should filter by scalar JSONB leaf value and not match sibling fields (servicios_especiales bug)', async () => {
        // Caso A: servicios_especiales = 'GUARDIANES URBANOS', placa = 'ABC123'  → DEBE matchear
        // Caso B: servicios_especiales = 'BASICO',              placa = 'GUARDIANES-PLACA-999' → NO debe matchear
        // Pre-fix: el ILIKE sobre el blob del padre retornaba ambos casos porque 'GUARDIANES' aparecía en el JSON completo.
        await CasesMother.createCaseWithRelations(casesRepository, {
            aux_data: { asistencia_movilidad: { servicios_especiales: 'GUARDIANES URBANOS', placa: 'ABC123' } },
        });
        await CasesMother.createCaseWithRelations(casesRepository, {
            aux_data: { asistencia_movilidad: { servicios_especiales: 'BASICO', placa: 'GUARDIANES-PLACA-999' } },
        });

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    entity: 'case_auxiliar',
                    field: 'asistencia_movilidad.servicios_especiales',
                    alias: 'servicios_especiales',
                    position: 1,
                    is_filterable: true,
                    data_type: 'STRING',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ],
            relations: [
                {
                    alias: 'case_auxiliar',
                    join_type: 'join',
                    on: [{ left: 'cases.id', operator: 'eq', right: 'case_auxiliar.caso_id', type: 'and' }],
                    primary_entity: 'cases',
                    related_entity: 'aux_cases',
                },
            ],
            havings: [],
            page_size: 25,
        };

        const board = await BoardsMother.create(repository, boardOverrides);

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: {
                filter: [
                    {
                        entity: 'case_auxiliar',
                        field: 'servicios_especiales',
                        operator: 'ilike',
                        type: 'OR',
                        value: 'GUARDIANES',
                    },
                ],
                relationship: [],
                limit: 0,
                offset: 0,
                order: null,
            },
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.data.items[0].servicios_especiales).toBe('GUARDIANES URBANOS');
        expect(boardResult.metadata.count).toBe(1);
    });

    it('should filter by JSONB array leaf value for any key without frontend hints', async () => {
        await CasesMother.createCaseWithRelations(casesRepository, {
            aux_data: {
                demographic: [{ age: 33, tag: 'first' }],
            },
        });
        await CasesMother.createCaseWithRelations(casesRepository, {
            aux_data: {
                demographic: [{ age: 20, tag: 'second' }],
            },
        });

        const boardOverrides = {
            primary_entity: 'cases',
            criteria: {
                items: [{ type: 'and', field: 'id', value: 'notNull', entity: 'cases', operator: 'notNull' }],
            },
            columns: [
                {
                    entity: 'case_auxiliar',
                    field: 'demographic.age',
                    alias: 'age',
                    position: 1,
                    is_filterable: true,
                    data_type: 'NUMBER',
                    format: null,
                    group_by: false,
                    function: null,
                },
            ],
            relations: [
                {
                    alias: 'case_auxiliar',
                    join_type: 'join',
                    on: [{ left: 'cases.id', operator: 'eq', right: 'case_auxiliar.caso_id', type: 'and' }],
                    primary_entity: 'cases',
                    related_entity: 'aux_cases',
                },
            ],
            havings: [],
            page_size: 25,
        };

        const board = await BoardsMother.create(repository, boardOverrides);

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: {
                filter: [
                    {
                        entity: 'case_auxiliar',
                        field: 'age',
                        operator: 'ilike',
                        type: 'OR',
                        value: '33',
                    },
                ],
                relationship: [],
                limit: 0,
                offset: 0,
                order: null,
            },
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        expect(boardResult.data.items[0].age).toBe('33');
        expect(boardResult.metadata.count).toBe(1);
    });

    it('should return concatenated field value when board has a CONCAT column', async () => {
        const kase = await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            filters: {
                items: [
                    {
                        type: 'and',
                        entity: 'cases',
                        field: 'id',
                        value: kase.id.value,
                        operator: 'eq',
                    },
                ],
            },
            columns: [
                {
                    entity: null,
                    field: null,
                    alias: 'nombre_completo',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    function: 'concat',
                    group_by: false,
                    separator: ' ',
                    concat_sources: [
                        { entity: 'case_responsable', field: 'nombres' },
                        { entity: 'case_responsable', field: 'apellido1' },
                    ],
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'usuarios',
                    alias: 'case_responsable',
                    join_type: 'left',
                    on: [{ left: 'cases.responsable_id', operator: 'eq', right: 'case_responsable.id', type: 'and' }],
                    relations: [],
                },
            ],
            havings: [],
            page_size: 25,
        };

        const board = await BoardsMother.createAuxiliary(repository, boardOverrides);

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBe(1);
        const row = boardResult.data.items[0];
        expect(row).toHaveProperty('nombre_completo');
        expect(typeof row.nombre_completo).toBe('string');
        expect(row.nombre_completo).toContain('responsable');
    });

    it('should not throw when board has CONCAT column combined with GROUP BY and aggregate columns', async () => {
        await CasesMother.createCaseWithRelations(casesRepository);

        const boardOverrides = {
            primary_entity: 'cases',
            filters: {
                items: [{ type: 'and', entity: 'cases', field: 'id', value: 'notNull', operator: 'notNull' }],
            },
            columns: [
                {
                    entity: 'case_responsable',
                    field: 'nombres',
                    alias: 'responsable',
                    position: 1,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    function: null,
                    group_by: true,
                },
                {
                    entity: 'cases',
                    field: 'id',
                    alias: 'total',
                    position: 2,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    function: 'count',
                    group_by: true,
                },
                {
                    entity: null,
                    field: null,
                    alias: 'nombre_completo',
                    position: 3,
                    is_filterable: false,
                    data_type: 'STRING',
                    format: null,
                    function: 'concat',
                    group_by: false,
                    separator: ' ',
                    concat_sources: [
                        { entity: 'case_responsable', field: 'nombres' },
                        { entity: 'case_responsable', field: 'apellido1' },
                    ],
                },
            ],
            relations: [
                {
                    primary_entity: 'cases',
                    related_entity: 'usuarios',
                    alias: 'case_responsable',
                    join_type: 'left',
                    on: [{ left: 'cases.responsable_id', operator: 'eq', right: 'case_responsable.id', type: 'and' }],
                    relations: [],
                },
            ],
            havings: [],
            page_size: 25,
        };

        const board = await BoardsMother.createAuxiliary(repository, boardOverrides);

        const dtoCriteria = {
            filter: board.criteria.value.items,
            relationship: board.relations.value,
            limit: board.page_size.value,
            offset: 0,
            tableName: board.primary_entity.value,
            select: board.columns.value,
            having: board.havings.value,
            subQuery: false,
        };

        const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
        const results = await service.execute(dtoCriteria);
        const boardResult = results.toJson();

        expect(boardResult.data.items.length).toBeGreaterThan(0);
        const row = boardResult.data.items[0];
        expect(row).toHaveProperty('responsable');
        expect(row).toHaveProperty('total');
        expect(row).toHaveProperty('nombre_completo');
        expect(typeof row.nombre_completo).toBe('string');
    });

    describe('countByAns metadata', () => {
        const ansColumn = {
            entity: 'cases',
            field: 'ans_posicion',
            alias: 'ans_pos',
            position: 12,
            is_filterable: true,
            is_ans: true,
            data_type: 'NUMBER',
            format: null,
            group_by: false,
            function: null,
        };

        const enabledQuickAnsFilter = {
            enabled: true,
            ans_column_alias: 'ans_pos',
            labels: { 1: 'A tiempo', 2: 'Por vencer', 3: 'Vencido' },
            use_default_colors: true,
            colors: { 1: '', 2: '', 3: '' },
        };

        async function seedCasesWithAnsPositions(positions) {
            const [first, ...rest] = positions;
            const kase = await CasesMother.createCaseWithRelations(casesRepository);
            await casesRepository.connection('cases').where({ id: kase.id.value }).update({ ans_posicion: first });
            const templateRow = await casesRepository.connection('cases').where({ id: kase.id.value }).first();
            for (const position of rest) {
                await insertCaseClone(casesRepository.connection, templateRow, { ans_posicion: position });
            }
            return { kase, templateRow };
        }

        function buildDtoCriteria(board) {
            return {
                filter: [...board.criteria.value.items],
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset: 0,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: board.orders.value,
                subQuery: false,
                quickAnsFilter: board.quick_ans_filter?.value ?? null,
            };
        }

        it('returns countByAns aggregated by ans_posicion when quick_ans_filter is enabled', async () => {
            const { kase } = await seedCasesWithAnsPositions([1, 1, 2, 3]);

            const baseDto = BoardsMother.dto({ client_id: kase.cliente_id.value });
            baseDto.columns = [...baseDto.columns, ansColumn];
            baseDto.havings = [];
            baseDto.quick_ans_filter = enabledQuickAnsFilter;
            const board = await BoardsMother.createWithSpecificData(repository, baseDto);

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
            const results = await service.execute(buildDtoCriteria(board));
            const boardResult = results.toJson();

            expect(boardResult.metadata).toHaveProperty('countByAns');
            expect(boardResult.metadata.countByAns).toEqual([
                { id: 1, count: 2 },
                { id: 2, count: 1 },
                { id: 3, count: 1 },
            ]);
        });

        it('omits countByAns from metadata when quick_ans_filter is disabled', async () => {
            const { kase } = await seedCasesWithAnsPositions([1, 2, 3]);

            const board = await BoardsMother.create(repository, { client_id: kase.cliente_id.value });

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
            const results = await service.execute(buildDtoCriteria(board));
            const boardResult = results.toJson();

            expect(boardResult.metadata).not.toHaveProperty('countByAns');
        });

        it('returns three buckets including zero counts for missing positions', async () => {
            const { kase } = await seedCasesWithAnsPositions([1, 1]);

            const baseDto = BoardsMother.dto({ client_id: kase.cliente_id.value });
            baseDto.columns = [...baseDto.columns, ansColumn];
            baseDto.havings = [];
            baseDto.quick_ans_filter = enabledQuickAnsFilter;
            const board = await BoardsMother.createWithSpecificData(repository, baseDto);

            const service = new BoardResourcesSearch(boardsResorcesRepository, board.primary_entity.value);
            const results = await service.execute(buildDtoCriteria(board));
            const boardResult = results.toJson();

            expect(boardResult.metadata.countByAns).toEqual([
                { id: 1, count: 2 },
                { id: 2, count: 0 },
                { id: 3, count: 0 },
            ]);
        });
    });
});
