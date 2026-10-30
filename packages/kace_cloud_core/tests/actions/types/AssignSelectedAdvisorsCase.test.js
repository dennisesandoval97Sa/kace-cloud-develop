import { AssignSelectedAdvisorsCase } from '../../../src/actions/domain/types/AssignSelectedAdvisorsCase.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { KnexUserListsRepository } from '../../../src/user-lists/infrastructure/persistence/KnexUserListsRepository.js';
import { CaseFactory } from '../../../src/factories/CaseFactory.js';
import { UserFactory } from '../../../src/factories/UserFactory.js';
import { GroupFactory } from '../../../src/factories/GroupFactory.js';
import UsersMother from '../../users/domain/UsersMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import { knexConfig } from '../../knexfile.js';
import { v4 as uuidV4 } from 'uuid';
import { Action } from '../../../src/actions/index.js';
import ActionMother from '../domain/ActionMother.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';

describe('AssignSelectedAdvisorsCase', () => {
    let caseRepository;
    let userRepository;
    let userListRepository;
    let assignSelectedAdvisorsCase;
    let caseFactory;
    let userFactory;
    let groupFactory;
    let responsableId;

    /**
     * `UserFactory` genera los apellidos con `chance.last()`, que emite `O'connor`, `D'Angelo` o
     * `Degl'Innocenti` en torno al 0.45% de las veces por apellido. `ValueObjectUserName` rechaza
     * el apostrofe ASCII, asi que el constructor de `User` los tumbaba y la factoria relanzaba un
     * escueto `Error creating factory instance` imputado a un `it` distinto en cada corrida.
     * Ninguna asercion de este archivo mira los apellidos, asi que se fijan.
     */
    const createUser = (overrides = {}) =>
        userFactory.create({ apellido1: 'Ramirez', apellido2: 'Delgado', ...overrides });

    /**
     * Misma tirada de dados por la via indirecta: `CaseFactory` resuelve `responsable_id` con
     * `UserFactory` cuando el llamante no lo pasa. Con un responsable propio -una fila minima en
     * `usuarios`, sin nombres- la relacion no llega a resolverse.
     */
    const createCase = (overrides = {}) => caseFactory.create({ responsable_id: responsableId, ...overrides });

    beforeAll(async () => {
        caseRepository = new KnexCaseRepository(knexConfig);
        userRepository = new KnexUsersRepository(caseRepository.connection);
        userListRepository = new KnexUserListsRepository(caseRepository.connection);
        assignSelectedAdvisorsCase = new AssignSelectedAdvisorsCase(caseRepository, userListRepository);

        caseFactory = new CaseFactory(knexConfig);
        userFactory = new UserFactory(knexConfig);
        groupFactory = new GroupFactory(knexConfig);
    });

    // La base se reinicia antes de cada `it`, asi que el responsable se siembra por test.
    beforeEach(async () => {
        responsableId = uuidV4();
        await ensureParentRow(caseRepository.connection, 'usuarios', responsableId);
    });

    it('should throw an error if the caseEntity is not a valid instance of Case', async () => {
        const invalidCase = {};
        const action = new Action(
            ActionMother.dto({
                advisor_list_id: uuidV4(),
            })
        );
        const result = await assignSelectedAdvisorsCase.execute(invalidCase, action);
        expect(result).toBe(false);
    });

    it('should return false if the case is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const action = new Action(
            ActionMother.dto({
                advisor_list_id: uuidV4(),
            })
        );
        const result = await assignSelectedAdvisorsCase.execute(validCase, action);
        expect(result).toBe(false);
    });

    it('should return false if the selected advisor is not found', async () => {
        const validCase = await createCase();

        const action = new Action(
            ActionMother.dto({
                advisor_list_id: uuidV4(),
            })
        );

        const result = await assignSelectedAdvisorsCase.execute(validCase, action);
        expect(result).toBe(false);
    });

    it('should return true and update the case if the advisor is successfully assigned', async () => {
        const user = await createUser();

        const group = await groupFactory.create();

        user.grupo_activo = group.id.value;
        await userRepository.update(user);

        const userList = {
            id: uuidV4(),
            descripcion: 'Test List',
            lista_usuarios: JSON.stringify([
                {
                    id: user.id.value,
                    nombres: user.nombres.value,
                },
            ]),
            is_active: true,
            group_id: group.id.value,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: user.id.value,
            updated_by: user.id.value,
            deleted_at: null,
            deleted_by: null,
        };

        await userListRepository.connection('lista_usuarios').insert(userList);

        const globalConfig = {
            id: uuidV4(),
            settings: JSON.stringify({
                behaviors: {
                    application: {
                        agente: {
                            casos: {
                                type_assignment: 'cola_de_trabajo',
                                max_cases_per_user: 10,
                                activeUsers_filter_bool: false,
                                activeUsers_filter_integration_bool: false,
                            },
                        },
                    },
                },
            }),
            created_at: new Date(),
            updated_at: new Date(),
        };

        await userListRepository.connection('global_configurations').insert(globalConfig);

        await userListRepository
            .connection('grupos')
            .where('id', group.id.value)
            .update({ configuration_id: globalConfig.id });

        const otherUser = await createUser();
        // El caso reutiliza el id del usuario como grupo_id; en postgres eso es una FK
        // contra `grupos`, asi que hay que respaldar la fila con ese mismo id.
        await ensureParentRow(caseRepository.connection, 'grupos', otherUser.id.value);
        const validCase = await createCase({
            responsable_id: otherUser.id.value,
            grupo_id: otherUser.id.value,
            created_by: otherUser.id.value,
        });

        const action = new Action(
            ActionMother.dto({
                advisor_list_id: userList.id,
            })
        );

        const responsableBefore = validCase.responsable_id?.value;
        const result = await assignSelectedAdvisorsCase.execute(validCase, action, 'test_trigger');
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.grupo_id).toBe(group.id.value);
        expect(updatedCase.responsable_id).toBe(user.id.value);
        expect(updatedCase.responsable_id).not.toBe(responsableBefore);
    });

    it('should log an event when advisor is assigned by AssignSelectedAdvisorsCase', async () => {
        const user = await createUser({ nombres: 'Selected Advisor' });

        const group = await groupFactory.create();

        user.grupo_activo = group.id.value;
        await userRepository.update(user);

        const globalConfig = {
            id: uuidV4(),
            settings: JSON.stringify({
                behaviors: {
                    application: {
                        agente: {
                            casos: {
                                type_assignment: 'cola_de_trabajo',
                                max_cases_per_user: 10,
                                activeUsers_filter_bool: false,
                                activeUsers_filter_integration_bool: false,
                            },
                        },
                    },
                },
            }),
            created_at: new Date(),
            updated_at: new Date(),
        };

        await userListRepository.connection('global_configurations').insert(globalConfig);

        await userListRepository
            .connection('grupos')
            .where('id', group.id.value)
            .update({ configuration_id: globalConfig.id });

        const userList = {
            id: uuidV4(),
            descripcion: 'Test List for Logging',
            lista_usuarios: JSON.stringify([
                {
                    id: user.id.value,
                    nombres: user.nombres.value,
                },
            ]),
            is_active: true,
            group_id: group.id.value,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: user.id.value,
            updated_by: user.id.value,
            deleted_at: null,
            deleted_by: null,
        };

        await userListRepository.connection('lista_usuarios').insert(userList);

        const kase = await createCase({
            responsable_id: user.id.value,
            grupo_id: group.id.value,
            created_by: user.id.value,
            updated_by: user.id.value,
        });

        kase.asignacion_agente = userList.id;

        const originalValues = kase.toJson();
        const mockTrigger = 'cron_job';

        const action = new Action(
            ActionMother.dto({
                advisor_list_id: userList.id,
            })
        );

        const result = await assignSelectedAdvisorsCase.execute(kase, action, mockTrigger);
        expect(result).toBe(true);

        const eventLog = await caseRepository
            .connection('event_logs')
            .select('*')
            .where({ aggregate_id: action.id.value, event_name: 'action.executed' })
            .first();

        expect(eventLog).toBeDefined();

        const body = typeof eventLog.body === 'string' ? JSON.parse(eventLog.body) : eventLog.body;
        expect(body).toBeDefined();
        expect(body.actionType).toBe(AssignSelectedAdvisorsCase.ACTION_TYPE);
        expect(body.trigger).toBe(mockTrigger);
        expect(body.success).toBe(true);
        expect(body.responsable_id).toBe(user.id.value);
        expect(body.grupo_id).toBe(group.id.value);

        const oldData = typeof eventLog.old_data === 'string' ? JSON.parse(eventLog.old_data) : eventLog.old_data;
        expect(oldData).toBeDefined();
        expect(oldData.grupo_id).toBe(originalValues.grupo_id);
        expect(oldData.responsable_id).toBe(originalValues.responsable_id);
    });

    it('should assign advisor filtering by active_session_limit from configuration', async () => {
        const activeUser = await createUser();
        const inactiveUser = await createUser();
        const group = await groupFactory.create();

        await userRepository
            .connection('usuarios')
            .where('id', activeUser.id.value)
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
            });

        await userRepository
            .connection('usuarios')
            .where('id', inactiveUser.id.value)
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            });

        const globalConfig = {
            id: uuidV4(),
            settings: JSON.stringify({
                behaviors: {
                    application: {
                        agente: {
                            casos: {
                                type_assignment: 'cola_de_trabajo',
                                max_cases_per_user: 10,
                                activeUsers_filter_bool: true,
                                activeUsers_filter_integration_bool: false,
                            },
                            usuarios: {
                                active_session_limit: 5,
                            },
                        },
                    },
                },
            }),
            created_at: new Date(),
            updated_at: new Date(),
        };

        await userListRepository.connection('global_configurations').insert(globalConfig);
        await userListRepository
            .connection('grupos')
            .where('id', group.id.value)
            .update({ configuration_id: globalConfig.id });

        const userList = {
            id: uuidV4(),
            descripcion: 'Test active session limit',
            lista_usuarios: JSON.stringify([
                { id: activeUser.id.value, nombres: activeUser.nombres.value },
                { id: inactiveUser.id.value, nombres: inactiveUser.nombres.value },
            ]),
            is_active: true,
            group_id: group.id.value,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: activeUser.id.value,
            updated_by: activeUser.id.value,
            deleted_at: null,
            deleted_by: null,
        };

        await userListRepository.connection('lista_usuarios').insert(userList);

        const validCase = await createCase({
            responsable_id: inactiveUser.id.value,
            grupo_id: group.id.value,
            created_by: inactiveUser.id.value,
        });

        const action = new Action(ActionMother.dto({ advisor_list_id: userList.id }));
        const result = await assignSelectedAdvisorsCase.execute(validCase, action, 'test_trigger');

        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.responsable_id).toBe(activeUser.id.value);
    });

    it('should fall back to default 2 minutes when active_session_limit is not in configuration', async () => {
        const activeUser = await createUser();
        const group = await groupFactory.create();

        await userRepository
            .connection('usuarios')
            .where('id', activeUser.id.value)
            .update({
                grupo_activo: group.id.value,
                last_seen_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
            });

        const globalConfig = {
            id: uuidV4(),
            settings: JSON.stringify({
                behaviors: {
                    application: {
                        agente: {
                            casos: {
                                type_assignment: 'cola_de_trabajo',
                                max_cases_per_user: 10,
                                activeUsers_filter_bool: true,
                                activeUsers_filter_integration_bool: false,
                            },
                        },
                    },
                },
            }),
            created_at: new Date(),
            updated_at: new Date(),
        };

        await userListRepository.connection('global_configurations').insert(globalConfig);
        await userListRepository
            .connection('grupos')
            .where('id', group.id.value)
            .update({ configuration_id: globalConfig.id });

        const userList = {
            id: uuidV4(),
            descripcion: 'Test default session limit',
            lista_usuarios: JSON.stringify([{ id: activeUser.id.value, nombres: activeUser.nombres.value }]),
            is_active: true,
            group_id: group.id.value,
            created_at: new Date(),
            updated_at: new Date(),
            created_by: activeUser.id.value,
            updated_by: activeUser.id.value,
            deleted_at: null,
            deleted_by: null,
        };

        await userListRepository.connection('lista_usuarios').insert(userList);

        const validCase = await createCase({
            responsable_id: activeUser.id.value,
            grupo_id: group.id.value,
            created_by: activeUser.id.value,
        });

        const action = new Action(ActionMother.dto({ advisor_list_id: userList.id }));
        const result = await assignSelectedAdvisorsCase.execute(validCase, action, 'test_trigger');

        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.responsable_id).toBe(activeUser.id.value);
    });
});
