import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { CaseBulkTransitionsUpdater } from '../../src/cases/application/bulk-transitions-updater/CaseBulkTransitionsUpdater.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { KnexFlowRepository } from '../../src/flow';
import { KnexTransitionsRepository } from '../../src/transition';
import { KnexStateRepository } from '../../src/state';
import { KnexGroupsRepository } from '../../src/grupos';
import { KnexShiftManagementRepository } from '../../src/shift-management';
import { KnexClientRepository } from '../../src/clients';
import { KnexUsersRepository, User } from '../../src/users';
import { KnexClassificationRepository } from '../../src/classifications';
import FlowsMother from '../flow/domain/FlowsMother';
import { TransitionsMother } from '../transition/domain/TransitionsMother';
import { StateMother } from '../state/domain/StateMother';
import CasesMother from './domain/CasesMother';
import ClientMother from '../clients/domain/ClientMother';
import UsersMother from '../users/domain/UsersMother';
import ClassificationsMother from '../classifications/domain/ClassificationsMother';
import { GroupsMother } from '../grupos/domain/GroupsMother';
import { KnexTransitionsCaseRepository } from '../../src/cases/infrastructure/persistence/KnexTransitionsCaseRepository.js';
import { ValueObjectUpdateSource } from '../../src/cases/domain/ValueObjectUpdateSource.js';
import { KnexTransitionRuleRepository } from '../../src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { TransitionRuleMother } from '../transition-rules/domain/TransitionRuleMother.js';
import { InMemoryEventBus } from '../../src/shared/infrastructure/events/InMemoryEventBus.js';
import { EventPublisher } from '../../src/shared/application/events/EventPublisher.js';

describe('CaseBulkTransitionsUpdater and KnexCaseRepository findByIds bulkUpdateTransition', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const flowRepo = new KnexFlowRepository(repository.connection);
    const stateRepo = new KnexStateRepository(repository.connection);
    const transitionRepo = new KnexTransitionsRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const clientRepository = new KnexClientRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const transitionRuleRepository = new KnexTransitionRuleRepository(repository.connection);

    const currentUser = new User({
        permissions: { administrador: [{ module_id: 'cases', name: 'CaseUpdateNotOwner', granted: true }] },
        ...UsersMother.dto(),
    });

    function makeTransitionsRepo() {
        return new KnexTransitionsCaseRepository(repository.connection);
    }

    async function seedTwoCasesSameTransition(transicionId) {
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transicionId,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kase2 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: transicionId,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        return { kase1, kase2, client };
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

    async function attachNonMatchingRuleToTransition(transitionId) {
        const rule = await TransitionRuleMother.create(transitionRuleRepository, {
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        field: 'cases.id',
                        operator: '=',
                        value: uuidv4(),
                        type: 'manual_input',
                        value_type: 'text',
                    },
                ],
            },
        });
        await repository.connection('transiciones').update({ rule_id: rule.id.value }).where({ id: transitionId });
    }

    it('findByIds returns expected columns and bulkUpdateTransition updates transition and audit fields', async () => {
        const A = await StateMother.createState(stateRepo);
        const B = await StateMother.createState(stateRepo);
        const C = await StateMother.createState(stateRepo);
        const flow = await FlowsMother.createFlow(flowRepo);
        const T1 = await TransitionsMother.createTransition(transitionRepo, A, flow, B);
        const T2 = await TransitionsMother.createTransition(transitionRepo, B, flow, C);
        const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

        const rowsBefore = await repository.findByIds([kase1.id.value, kase2.id.value]);
        expect(rowsBefore).toHaveLength(2);
        const byIdBefore = new Map(rowsBefore.map((r) => [r.id, r]));
        expect(byIdBefore.get(kase1.id.value)).toMatchObject({
            id: kase1.id.value,
            transicion_id: T1.id.value,
            fecha_resolucion: null,
        });
        expect(byIdBefore.get(kase2.id.value)).toMatchObject({
            id: kase2.id.value,
            transicion_id: T1.id.value,
            fecha_resolucion: null,
        });

        const actorId = uuidv4();
        const now = new Date();

        await repository.bulkUpdateTransition([kase1.id.value, kase2.id.value], {
            transicion_id: T2.id.value,
            state_change_at: now,
            updated_at: now,
            updated_by: actorId,
            update_source: ValueObjectUpdateSource.BULK,
        });

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(r1.transicion_id).toBe(T2.id.value);
        expect(r2.transicion_id).toBe(T2.id.value);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r1.updated_by).toBe(actorId);
        expect(r2.updated_by).toBe(actorId);
        // `estado_id` lo deriva `bulkUpdateTransition` de la transición destino. Se afirma aquí y
        // no solo en `CaseEstadoIdSync` porque este es el test que fija el shape de la escritura
        // masiva, y la E2E del Lambda `cases-bulk` solo corre contra un entorno desplegado.
        expect(r1.estado_id).toBe(C.id.value);
        expect(r2.estado_id).toBe(C.id.value);
    });

    it('throws CustomError 404 when transition does not exist', async () => {
        await seedLinearFlowWithJson();
        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        const missingTransitionId = uuidv4();
        await expect(updater.execute([uuidv4()], missingTransitionId)).rejects.toMatchObject({
            message: expect.stringContaining(missingTransitionId),
            statusCode: 404,
        });
    });

    it('throws CustomError 404 when a case id is missing', async () => {
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
        const missingCaseId = uuidv4();
        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await expect(updater.execute([kase.id.value, missingCaseId], T2.id.value)).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    it('throws CustomError 400 when any case is closed', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kase2 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
            fecha_resolucion: new Date().toISOString(),
        });
        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await expect(updater.execute([kase1.id.value, kase2.id.value], T2.id.value)).rejects.toThrow(
            'Some cases are already closed'
        );
    });

    it('throws CustomError 400 when cases do not share the same current transition', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kase2 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T2.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await expect(updater.execute([kase1.id.value, kase2.id.value], T2.id.value)).rejects.toThrow(
            'Cases must share the same current transition'
        );
    });

    it('throws CustomError 400 when target transition is not allowed from current state', async () => {
        const {
            transitions: { T1 },
            flow,
        } = await seedLinearFlowWithJson();
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kase2 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const X = await StateMother.createState(stateRepo);
        const Y = await StateMother.createState(stateRepo);
        const invalid = await TransitionsMother.createTransition(transitionRepo, X, flow, Y);
        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await expect(updater.execute([kase1.id.value, kase2.id.value], invalid.id.value)).rejects.toThrow(
            'The provided transition is not allowed from the current state'
        );
    });

    it('updates all cases to allowed transition with update_source bulk', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kase2 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await updater.execute([kase1.id.value, kase2.id.value, kase1.id.value], T2.id.value);
        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(r1.transicion_id).toBe(T2.id.value);
        expect(r2.transicion_id).toBe(T2.id.value);
        expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        expect(r1.updated_by).toBe(currentUser.id.value);
        expect(r2.updated_by).toBe(currentUser.id.value);
    });

    it('emits one case.state_changed event per case with CaseUpdater-shaped payload', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        const { kase1, kase2, client } = await seedTwoCasesSameTransition(T1.id.value);

        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await updater.execute([kase1.id.value, kase2.id.value], T2.id.value);

        const events = await repository
            .connection('event_logs')
            .whereIn('aggregate_id', [kase1.id.value, kase2.id.value])
            .where({ event_name: 'case.state_changed' })
            .select('*');

        expect(events).toHaveLength(2);

        const parse = (val) => (typeof val === 'string' ? JSON.parse(val) : val);

        for (const event of events) {
            const body = parse(event.body);
            const oldData = parse(event.old_data);
            expect(body.transicion_id).toBe(T2.id.value);
            expect(oldData.transicion_id).toBe(T1.id.value);
            expect(event.case_id).toBe(event.aggregate_id);
            expect(event.client_id).toBe(client.id.value);
            expect(event.initiated_by_user).toBe(currentUser.id.value);
        }

        const allEvents = await repository
            .connection('event_logs')
            .whereIn('aggregate_id', [kase1.id.value, kase2.id.value])
            .select('event_name');
        expect(allEvents).toHaveLength(2);
    });

    it('sets update_source=bulk for multiple cases and update_source=manual for a single case', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        const client = await ClientMother.createClient(clientRepository);
        const responsible = await UsersMother.createUser(usersRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const kase1 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });
        const kase2 = await CasesMother.createCase(repository, {
            cliente_id: client.id.value,
            transicion_id: T1.id.value,
            responsable_id: responsible.id.value,
            clasificacion_id: classification.id.value,
            grupo_id: group.id.value,
        });

        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await updater.execute([kase1.id.value, kase2.id.value], T2.id.value);

        const allHistoryRecords = await repository
            .connection('history_cases')
            .whereIn('entity_id', [kase1.id.value, kase2.id.value])
            .select('*');

        const bulkHistoryRecords = allHistoryRecords.filter((record) => {
            const changed =
                typeof record.changed_attributes === 'string'
                    ? JSON.parse(record.changed_attributes)
                    : record.changed_attributes;
            return changed.transicion_id === T2.id.value;
        });

        expect(bulkHistoryRecords).toHaveLength(2);
        for (const record of bulkHistoryRecords) {
            const changed =
                typeof record.changed_attributes === 'string'
                    ? JSON.parse(record.changed_attributes)
                    : record.changed_attributes;
            const newAtts =
                typeof record.new_attributes === 'string' ? JSON.parse(record.new_attributes) : record.new_attributes;
            const originalAtts =
                typeof record.original_attributes === 'string'
                    ? JSON.parse(record.original_attributes)
                    : record.original_attributes;

            expect(changed).toHaveProperty('transicion_id', T2.id.value);
            expect(changed).toHaveProperty('update_source', ValueObjectUpdateSource.BULK);
            expect(newAtts.transicion_id).toBe(T2.id.value);
            expect(originalAtts.transicion_id).toBe(T1.id.value);
        }

        const transitions1 = await repository.findTransitionsByCaseId(kase1.id);
        const transitions2 = await repository.findTransitionsByCaseId(kase2.id);
        expect(transitions1.find((t) => t.update_source === ValueObjectUpdateSource.BULK)).toBeDefined();
        expect(transitions2.find((t) => t.update_source === ValueObjectUpdateSource.BULK)).toBeDefined();
    });

    it('sets update_source=manual when a single case_id is sent through the bulk endpoint', async () => {
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

        const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        await updater.execute([kase.id.value], T2.id.value);

        const allHistoryRecords = await repository
            .connection('history_cases')
            .where({ entity_id: kase.id.value })
            .select('*');

        const manualHistoryRecord = allHistoryRecords.find((record) => {
            const changed =
                typeof record.changed_attributes === 'string'
                    ? JSON.parse(record.changed_attributes)
                    : record.changed_attributes;
            return changed.transicion_id === T2.id.value;
        });

        expect(manualHistoryRecord).toBeDefined();
        const changed =
            typeof manualHistoryRecord.changed_attributes === 'string'
                ? JSON.parse(manualHistoryRecord.changed_attributes)
                : manualHistoryRecord.changed_attributes;
        expect(changed).toHaveProperty('update_source', ValueObjectUpdateSource.MANUAL);

        const transitions = await repository.findTransitionsByCaseId(kase.id);
        expect(transitions.find((t) => t.update_source === ValueObjectUpdateSource.MANUAL)).toBeDefined();
    });

    describe('update_source — explicit override parameter (third argument)', () => {
        async function seedSingleCase(transicionId) {
            const client = await ClientMother.createClient(clientRepository);
            const responsible = await UsersMother.createUser(usersRepository);
            const classification = await ClassificationsMother.createClassification(classificationRepository);
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            return CasesMother.createCase(repository, {
                cliente_id: client.id.value,
                transicion_id: transicionId,
                responsable_id: responsible.id.value,
                clasificacion_id: classification.id.value,
                grupo_id: group.id.value,
            });
        }

        function makeUpdater() {
            return new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);
        }

        async function getUpdateSourceFromHistory(caseId, transicionId) {
            const record = await repository
                .connection('history_cases')
                .where({ entity_id: caseId })
                .select('changed_attributes')
                .orderBy('created_at', 'desc')
                .first();
            const changed =
                typeof record?.changed_attributes === 'string'
                    ? JSON.parse(record.changed_attributes)
                    : record?.changed_attributes;
            return changed?.update_source ?? null;
        }

        it('single case with explicit bulk override → stores bulk in DB and history (OS form fix)', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const kase = await seedSingleCase(T1.id.value);

            await makeUpdater().execute([kase.id.value], T2.id.value, ValueObjectUpdateSource.BULK);

            const row = await repository.connection('cases').first('update_source').where({ id: kase.id.value });
            expect(row.update_source).toBe(ValueObjectUpdateSource.BULK);
            expect(await getUpdateSourceFromHistory(kase.id.value, T2.id.value)).toBe(ValueObjectUpdateSource.BULK);
        });

        it('multiple cases with explicit bulk override → stores bulk in all cases', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

            await makeUpdater().execute([kase1.id.value, kase2.id.value], T2.id.value, ValueObjectUpdateSource.BULK);

            const r1 = await repository.connection('cases').first('update_source').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('update_source').where({ id: kase2.id.value });
            expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
            expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        });

        it('no override (null) + single case → manual (original behavior preserved)', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const kase = await seedSingleCase(T1.id.value);

            await makeUpdater().execute([kase.id.value], T2.id.value, null);

            const row = await repository.connection('cases').first('update_source').where({ id: kase.id.value });
            expect(row.update_source).toBe(ValueObjectUpdateSource.MANUAL);
            expect(await getUpdateSourceFromHistory(kase.id.value, T2.id.value)).toBe(ValueObjectUpdateSource.MANUAL);
        });

        it('no override (null) + multiple cases → bulk (original behavior preserved)', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

            await makeUpdater().execute([kase1.id.value, kase2.id.value], T2.id.value, null);

            const r1 = await repository.connection('cases').first('update_source').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('update_source').where({ id: kase2.id.value });
            expect(r1.update_source).toBe(ValueObjectUpdateSource.BULK);
            expect(r2.update_source).toBe(ValueObjectUpdateSource.BULK);
        });
    });

    it('throws when transition rule conditions are not met for bulk transition', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        await attachNonMatchingRuleToTransition(T2.id.value);
        const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

        const updater = new CaseBulkTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            currentUser,
            transitionRuleRepository
        );

        await expect(updater.execute([kase1.id.value, kase2.id.value], T2.id.value)).rejects.toThrow(
            'The conditions configured for this transition are not met'
        );

        const row1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const row2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(row1.transicion_id).toBe(T1.id.value);
        expect(row2.transicion_id).toBe(T1.id.value);
    });

    it('publishes a CaseUpdated domain event per case with STATE_CHANGE trigger', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

        const eventBus = new InMemoryEventBus();
        const captured = [];
        eventBus.subscribe('*', async (event) => {
            captured.push(event);
        });
        const eventPublisher = new EventPublisher(eventBus);
        const tenant = { id: { value: 'tenant-123' } };

        const updater = new CaseBulkTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            currentUser,
            null,
            eventPublisher,
            tenant
        );
        await updater.execute([kase1.id.value, kase2.id.value], T2.id.value);

        const caseUpdatedEvents = captured.filter((e) => e.eventName === 'kace.core.case.updated');
        expect(caseUpdatedEvents).toHaveLength(2);

        const byAggregate = new Map(caseUpdatedEvents.map((e) => [e.aggregateId, e]));
        for (const caseId of [kase1.id.value, kase2.id.value]) {
            const event = byAggregate.get(caseId);
            expect(event).toBeDefined();
            expect(event.payload.trigger).toBe('cambio_estado');
            expect(event.payload.changedAttributes.transicion_id).toBe(T2.id.value);
            expect(event.metadata.tenant_id).toBe('tenant-123');
            expect(event.metadata.user_id).toBe(currentUser.id.value);
            expect(event.metadata.correlation_id).toBeNull();
            expect(event.metadata.causation_id).toBeNull();
        }
    });

    it('does not break the committed transition when domain-event publishing fails', async () => {
        const {
            transitions: { T1, T2 },
        } = await seedLinearFlowWithJson();
        const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

        const throwingPublisher = {
            publishAll: async () => {
                throw new Error('publish failed');
            },
        };
        const tenant = { id: { value: 'tenant-123' } };

        const updater = new CaseBulkTransitionsUpdater(
            repository,
            makeTransitionsRepo(),
            currentUser,
            null,
            throwingPublisher,
            tenant
        );

        await expect(updater.execute([kase1.id.value, kase2.id.value], T2.id.value)).resolves.toBeUndefined();

        const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
        const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });
        expect(r1.transicion_id).toBe(T2.id.value);
        expect(r2.transicion_id).toBe(T2.id.value);
    });

    describe('edited_by and edited_at tracking', () => {
        it('persists edited_by and edited_at when bulk transitions are executed by a regular user', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

            const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), currentUser);

            await updater.execute([kase1.id.value, kase2.id.value], T2.id.value);

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

            expect(r1.edited_by).toBe(currentUser.id.value);
            expect(r2.edited_by).toBe(currentUser.id.value);
            expect(r1.edited_at).not.toBeNull();
            expect(r2.edited_at).not.toBeNull();
        });

        it('does not set or overwrite edited_by and edited_at when bulk transitions are executed by a service account', async () => {
            const {
                transitions: { T1, T2 },
            } = await seedLinearFlowWithJson();
            const { kase1, kase2 } = await seedTwoCasesSameTransition(T1.id.value);

            const originalEditedAt = new Date('2026-01-01T10:00:00Z').toISOString();
            await repository.connection('cases').whereIn('id', [kase1.id.value, kase2.id.value]).update({
                edited_by: currentUser.id.value,
                edited_at: originalEditedAt,
            });

            const serviceUser = new User({
                permissions: { agente: [{ module_id: 'cases', name: 'CasesUpdate', granted: true }] },
                ...UsersMother.dto(),
                account_type: 2,
            });

            const updater = new CaseBulkTransitionsUpdater(repository, makeTransitionsRepo(), serviceUser);

            await updater.execute([kase1.id.value, kase2.id.value], T2.id.value);

            const r1 = await repository.connection('cases').first('*').where({ id: kase1.id.value });
            const r2 = await repository.connection('cases').first('*').where({ id: kase2.id.value });

            expect(r1.edited_by).toBe(currentUser.id.value);
            expect(new Date(r1.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
            expect(r2.edited_by).toBe(currentUser.id.value);
            expect(new Date(r2.edited_at).toISOString()).toBe(new Date(originalEditedAt).toISOString());
        });
    });
});
