// tests/cases/CaseTransitionsUpdater.integration.test.js
import { jest } from '@jest/globals';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository, CaseTransitionsUpdater } from '../../src/cases';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository, User } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import { ActionTriggers } from '../../src/actions/index.js';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';
import { KnexTransitionsCaseRepository } from '../../src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import AnsMother from '../ans/domain/AnsMother.js';
import { KnexAnsRepository, Types } from '../../src/ans/index.js';
import { ValueObjectUuid } from '../../src/shared/index.js';
import { v4 as uuidv4 } from 'uuid';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('CaseTransitionsUpdater', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const ansRepository = new KnexAnsRepository(repository.connection);

    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    const actionExecutionServiceMock = { execute: jest.fn(async () => true) };
    const eventPublisherMock = { publishAll: jest.fn(async () => true) };
    const tenant = { id: { value: 'tenant-1' } };

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    afterEach(async () => {
        jest.clearAllMocks();
    });

    /**
     * Devuelve los `changed_attributes` de la fila de historial que registra el
     * salto de `fromTransitionId` a `toTransitionId`.
     *
     * No vale coger la ultima fila por `created_at`: cada update deja DOS filas de
     * historial, la del cambio de negocio y la que escribe
     * `CaseUpdater.#calculateSLATimers` justo despues, que solo lleva campos de SLA.
     * La segunda solo faltaba mientras la factoria dejaba la cadena ANS rota y el
     * calculo abortaba. La fila se identifica por sus extremos -original todavia en
     * la transicion de partida, nuevo ya en la de destino-, que es una columna
     * distinta de la que se afirma.
     *
     * @param {string} caseId
     * @param {string} fromTransitionId
     * @param {string} toTransitionId
     * @returns {Promise<Object|undefined>}
     */
    async function transitionHistoryChanges(caseId, fromTransitionId, toTransitionId) {
        const rows = await repository
            .connection('history_cases')
            .select('changed_attributes', 'original_attributes', 'new_attributes')
            .where({ entity_id: caseId });

        const asObject = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

        const row = rows.find(
            (candidate) =>
                asObject(candidate.original_attributes)?.transicion_id === fromTransitionId &&
                asObject(candidate.new_attributes)?.transicion_id === toTransitionId
        );

        return row && asObject(row.changed_attributes);
    }

    async function seedLinearFlowWithJson() {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const C = await StateMother.createState(stateRepo);

        const flow = await FlowsMother.createFlow(flowRepo);

        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const T2 = await TransitionsMother.createTransition(transitionRepo, B, flow, C);

        const json_flujo = {
            nodes: [{ id: A.id.value }, { id: B.id.value }, { id: C.id.value }],
            edges: [
                { id: 'edge-A-B', source: A.id.value, target: B.id.value, kace_transition: T1.id.value },
                { id: 'edge-B-C', source: B.id.value, target: C.id.value, kace_transition: T2.id.value },
                { id: 'edge-0-A', source: '0', target: A.id.value, kace_transition: T1.id.value },
            ],
        };

        await repository
            .connection('flujos')
            .update({ json_flujo: JSON.stringify(json_flujo) })
            .where({ id: flow.id.value });

        return { flow, states: { A, B, C }, transitions: { T1, T2 } };
    }

    function makeTransitionsRepo() {
        return new KnexTransitionsCaseRepository(repository.connection);
    }

    it('Actualiza a una transición permitida y registra histórico', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();

        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const updater = new CaseTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            actionExecutionServiceMock,
            currentUser,
            null,
            eventPublisherMock,
            tenant
        );

        await updater.execute(kase.id.value, { transicion_id: T2.id.value });

        const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(updated.transicion_id).toBe(T2.id.value);
        expect(updated.state_change_at).toBeTruthy();

        const changed = await transitionHistoryChanges(kase.id.value, T1.id.value, T2.id.value);

        expect(changed).toHaveProperty('transicion_id');
        expect(actionExecutionServiceMock.execute).not.toHaveBeenCalled();
        expect(eventPublisherMock.publishAll).toHaveBeenCalledTimes(1);
        expect(eventPublisherMock.publishAll.mock.calls[0][0]).toHaveLength(1);
        expect(eventPublisherMock.publishAll.mock.calls[0][0][0].eventName).toBe('kace.core.case.updated');
        expect(eventPublisherMock.publishAll.mock.calls[0][0][0].payload.trigger).toBe(
            ActionTriggers.STATE_CHANGE.value
        );
        expect(eventPublisherMock.publishAll.mock.calls[0][0][0].metadata.tenant_id).toBe('tenant-1');
    });

    it('Rechaza transición NO permitida', async () => {
        const {
            transitions: { T1 },
            flow,
        } = await seedLinearFlowWithJson();

        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value, // estado actual = B
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const X = await StateMother.createState(stateRepo);
        const Y = await StateMother.createState(stateRepo);
        const invalid = await TransitionsMother.createTransition(transitionRepo, X, flow, Y);

        const updater = new CaseTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            actionExecutionServiceMock,
            currentUser
        );

        await expect(updater.execute(kase.id.value, { transicion_id: invalid.id.value })).rejects.toThrow(
            /not allowed/i
        );

        const after = await repository.connection('cases').first('*').where({ id: kase.id.value });
        expect(after.transicion_id).toBe(T1.id.value);
    });

    it('No permite actualizar sin permiso CaseUpdateNotOwner y no responsable', async () => {
        const {
            transitions: { T1 },
        } = await seedLinearFlowWithJson();
        const notAllowedUser = new User({
            permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: false }] },
            ...UsersMother.dto(),
        });

        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const transicionId = ValueObjectUuid.random();
        await ensureParentRow(repository.connection, 'transiciones', transicionId);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transicionId,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const updater = new CaseTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            actionExecutionServiceMock,
            notAllowedUser
        );

        await expect(updater.execute(kase.id.value, { transicion_id: T1.id.value })).rejects.toThrow(
            'You do not have permission to update this case'
        );
        expect(actionExecutionServiceMock.execute).not.toHaveBeenCalled();
    });

    it('should log an event when a case transition is updated', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();

        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const updater = new CaseTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            actionExecutionServiceMock,
            currentUser
        );

        await updater.execute(kase.id.value, { transicion_id: T2.id.value });

        const eventLog = await repository
            .connection('event_logs')
            .where({ aggregate_id: kase.id.value, event_name: 'case.state_changed' })
            .first();

        expect(eventLog).toBeDefined();
        expect(eventLog.aggregate_id).toBe(kase.id.value);
        expect(eventLog.event_name).toBe('case.state_changed');

        const body = eventLog.body;
        expect(body.transicion_id).toBe(T2.id.value);

        const oldData = eventLog.old_data;
        expect(oldData.transicion_id).toBe(T1.id.value);
    });

    it('Actualiza transición y guarda update_source', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();

        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

        const kase = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const updater = new CaseTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            actionExecutionServiceMock,
            currentUser
        );

        await updater.execute(kase.id.value, {
            transicion_id: T2.id.value,
            update_source: 'manual',
        });

        const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });

        expect(updated.transicion_id).toBe(T2.id.value);
        expect(updated.update_source).toBe('manual');

        const changed = await transitionHistoryChanges(kase.id.value, T1.id.value, T2.id.value);

        expect(changed).toHaveProperty('update_source');
        expect(changed.update_source).toBe('manual');
    });

    async function seedLinearFlowWithManyStates(n) {
        const states = [];
        for (let i = 0; i < n + 1; i++) {
            states.push(await StateMother.createState(stateRepo));
        }

        const flow = await FlowsMother.createFlow(flowRepo);
        const transitions = [];
        for (let i = 0; i < n; i++) {
            transitions.push(await TransitionsMother.createTransition(transitionRepo, states[i], flow, states[i + 1]));
        }

        const nodes = states.map((s) => ({ id: s.id.value }));
        const edges = [
            { id: 'edge-0-A', source: '0', target: states[0].id.value, kace_transition: transitions[0].id.value },
            ...transitions.map((t, i) => ({
                id: `edge-${i}`,
                source: states[i].id.value,
                target: states[i + 1].id.value,
                kace_transition: t.id.value,
            })),
        ];

        await repository
            .connection('flujos')
            .update({ json_flujo: JSON.stringify({ nodes, edges }) })
            .where({ id: flow.id.value });

        return { flow, states, transitions };
    }

    describe('update_source — invariante en CaseTransitionsUpdater', () => {
        async function seedCaseOnT1(T1, overrides = {}) {
            const client = await ClientMother.createClient(clientRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            return CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: T1.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
                ...overrides,
            });
        }

        function makeUpdater() {
            return new CaseTransitionsUpdater(
                repository,
                makeTransitionsRepo(),
                actionExecutionServiceMock,
                currentUser,
                null,
                eventPublisherMock,
                tenant
            );
        }

        async function getDbUpdateSource(caseId) {
            const row = await repository.connection('cases').first('update_source').where({ id: caseId });
            return row.update_source;
        }

        async function getHistorialUpdateSource(caseId) {
            const { CaseTransitionsFinder } = await import('../../src/cases/index.js');
            const result = await new CaseTransitionsFinder(repository).execute(caseId);
            return result.toJson().data[0].update_source;
        }

        it('update_source=manual se guarda en DB e historial', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const kase = await seedCaseOnT1(T1);

            await makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value, update_source: 'manual' });

            expect(await getDbUpdateSource(kase.id.value)).toBe('manual');
            expect(await getHistorialUpdateSource(kase.id.value)).toBe('manual');
        });

        it('sin update_source en dto → null en DB e historial (no hereda valor previo)', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const kase = await seedCaseOnT1(T1, { update_source: 'manual' });

            await makeUpdater().execute(kase.id.value, { transicion_id: T2.id.value });

            expect(await getDbUpdateSource(kase.id.value)).toBeNull();
            expect(await getHistorialUpdateSource(kase.id.value)).toBeNull();
        });

        it('manual → auto → manual → auto → manual: historial refleja cada valor exacto (intercalado)', async () => {
            const { transitions } = await seedLinearFlowWithManyStates(5);
            const [T1, T2, T3, T4, T5] = transitions;
            const kase = await seedCaseOnT1(T1, { update_source: null });
            const updater = makeUpdater();

            // 1ra: manual
            await updater.execute(kase.id.value, { transicion_id: T2.id.value, update_source: 'manual' });
            // 2da: automática — no debe heredar 'manual'
            await updater.execute(kase.id.value, { transicion_id: T3.id.value });
            // 3ra: manual
            await updater.execute(kase.id.value, { transicion_id: T4.id.value, update_source: 'manual' });
            // 4ta: automática — no debe heredar 'manual'
            await updater.execute(kase.id.value, { transicion_id: T5.id.value });

            expect(await getDbUpdateSource(kase.id.value)).toBeNull();

            const { CaseTransitionsFinder } = await import('../../src/cases/index.js');
            const result = await new CaseTransitionsFinder(repository).execute(kase.id.value);
            const hist = result.toJson().data;

            expect(hist.length).toBeGreaterThanOrEqual(5);
            expect(hist[0].update_source).toBeNull(); // 4ta — auto
            expect(hist[1].update_source).toBe('manual'); // 3ra
            expect(hist[2].update_source).toBeNull(); // 2da — auto
            expect(hist[3].update_source).toBe('manual'); // 1ra
            expect(hist[4].update_source).toBeNull(); // creación
        });
    });

    describe('SLA Updates on Transition Changes', () => {
        it('should update SLA fields when case transition is changed', async () => {
            const transitionAns = await AnsMother.createAns(ansRepository, {
                intermedio: 2,
                vancido: 4,
                medicion_ans_id: Types.HOURS.value,
            });

            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();

            await repository
                .connection('transiciones')
                .whereIn('id', [T1.id.value, T2.id.value])
                .update({ ans_id: transitionAns.id.value });

            const caseAns = await AnsMother.createAns(ansRepository, {
                intermedio: 1,
                vancido: 2,
                medicion_ans_id: Types.DAYS.value,
            });

            const client = await ClientMother.createClient(clientRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository, {
                ans_id: caseAns.id.value,
            });
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const kase = await CasesMother.createCase(repository, {
                ans_posicion: 1,
                cliente_id: client.id.value,
                transicion_id: T1.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            const originalCase = await repository.connection('cases').where({ id: kase.id.value }).first();

            await new Promise((resolve) => setTimeout(resolve, 100));

            const updater = new CaseTransitionsUpdater(
                repository,
                makeTransitionsRepo(),
                actionExecutionServiceMock,
                currentUser
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const updatedCase = await repository.connection('cases').where({ id: kase.id.value }).first();

            expect(updatedCase.transicion_id).toBe(T2.id.value);
            expect(updatedCase.state_change_at).not.toBe(originalCase.state_change_at);

            expect(updatedCase.sla_state_elapsed_days).toBe(0);
            expect(updatedCase.sla_state_elapsed_hours).toBe(0);

            expect(updatedCase.ans_posicion).toBeGreaterThanOrEqual(originalCase.ans_posicion);
        });
    });

    describe('actualizador — correct attribution when an automated action writes to history_cases after a state transition', () => {
        async function seedCaseForActualizador(T1) {
            const client = await ClientMother.createClient(clientRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            return CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: T1.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });
        }

        it('shows the human user login, not the system user, when an automated action writes history_cases after the state change', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();

            const humanUser = await UsersMother.createUser(usersRepository, { login: 'camilo.londono' });
            const humanCurrentUser = new User({
                permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
                ...UsersMother.dto({ id: humanUser.id.value, login: humanUser.login.value }),
            });

            const systemUser = await UsersMother.createUser(usersRepository, { login: 'system.action.executor' });

            const kase = await seedCaseForActualizador(T1);

            const updater = new CaseTransitionsUpdater(
                repository,
                makeTransitionsRepo(),
                actionExecutionServiceMock,
                humanCurrentUser,
                null,
                eventPublisherMock,
                tenant
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const caseAfterTransition = await repository.connection('cases').first('*').where({ id: kase.id.value });
            await repository.connection('history_cases').insert({
                id: uuidv4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({
                    responsable_id: systemUser.id.value,
                    updated_by: systemUser.id.value,
                }),
                new_attributes: JSON.stringify({
                    ...caseAfterTransition,
                    responsable_id: systemUser.id.value,
                    updated_by: systemUser.id.value,
                }),
                original_attributes: JSON.stringify(caseAfterTransition),
                created_at: new Date().toISOString(),
                created_by: systemUser.id.value,
            });

            const { CaseTransitionsFinder } = await import('../../src/cases/index.js');
            const result = await new CaseTransitionsFinder(repository).execute(kase.id.value);
            const hist = result.toJson().data;

            expect(hist[0].actualizador).toBe(humanUser.login.value);
            expect(hist[0].actualizador).not.toBe(systemUser.login.value);
        });

        it('shows the correct login for intermediate transitions when automated actions interleave history_cases between state changes', async () => {
            const { transitions } = await seedLinearFlowWithManyStates(3);
            const [T1, T2, T3] = transitions;

            const humanUser = await UsersMother.createUser(usersRepository, { login: 'camilo.londono.2' });
            const humanCurrentUser = new User({
                permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
                ...UsersMother.dto({ id: humanUser.id.value, login: humanUser.login.value }),
            });
            const systemUser = await UsersMother.createUser(usersRepository, { login: 'system.action.2' });

            const kase = await seedCaseForActualizador(T1);
            const updater = new CaseTransitionsUpdater(
                repository,
                makeTransitionsRepo(),
                actionExecutionServiceMock,
                humanCurrentUser,
                null,
                eventPublisherMock,
                tenant
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const caseOnT2 = await repository.connection('cases').first('*').where({ id: kase.id.value });
            await repository.connection('history_cases').insert({
                id: uuidv4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({
                    responsable_id: systemUser.id.value,
                    updated_by: systemUser.id.value,
                }),
                new_attributes: JSON.stringify({
                    ...caseOnT2,
                    responsable_id: systemUser.id.value,
                    updated_by: systemUser.id.value,
                }),
                original_attributes: JSON.stringify(caseOnT2),
                created_at: new Date().toISOString(),
                created_by: systemUser.id.value,
            });

            await updater.execute(kase.id.value, { transicion_id: T3.id.value });

            const { CaseTransitionsFinder } = await import('../../src/cases/index.js');
            const result = await new CaseTransitionsFinder(repository).execute(kase.id.value);
            const hist = result.toJson().data;

            expect(hist[0].actualizador).toBe(humanUser.login.value);
            expect(hist[1].actualizador).toBe(humanUser.login.value);
        });
    });

    describe('edited_by and edited_at tracking', () => {
        it('persists edited_by and edited_at when transition is executed by a regular user', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();

            const client = await ClientMother.createClient(clientRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const kase = await CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: T1.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });

            const updater = new CaseTransitionsUpdater(
                repository,
                makeTransitionsRepo(),
                actionExecutionServiceMock,
                currentUser,
                null,
                eventPublisherMock,
                tenant
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.edited_by).toBe(currentUser.id.value);
            expect(updated.edited_at).not.toBeNull();
        });

        it('does not set or overwrite edited_by and edited_at when transition is executed by a service account', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();

            const client = await ClientMother.createClient(clientRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const originalEditedAt = new Date('2026-01-01T10:00:00Z').toISOString();
            const kase = await CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: T1.id.value,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
                edited_by: currentUser.id.value,
                edited_at: originalEditedAt,
            });

            const serviceUser = new User({
                permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
                ...UsersMother.dto(),
                account_type: 2,
            });

            const updater = new CaseTransitionsUpdater(
                repository,
                makeTransitionsRepo(),
                actionExecutionServiceMock,
                serviceUser,
                null,
                eventPublisherMock,
                tenant
            );

            await updater.execute(kase.id.value, { transicion_id: T2.id.value });

            const updated = await repository.connection('cases').first('*').where({ id: kase.id.value });
            expect(updated.edited_by).toBe(currentUser.id.value);
            expect(new Date(updated.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
        });
    });
});
